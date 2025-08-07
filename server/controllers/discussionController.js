const DiscussionPost = require('../models/discussionPostSchema');
const DiscussionReply = require('../models/discussionReplySchema');
const Announcement = require('../models/announcementSchema');
const Group = require('../models/groupSchema');
const GroupMembership = require('../models/groupMembershipSchema');
const File = require('../models/fileSchema');
const { ObjectId } = require('mongoose').Types;
const { errorResponse } = require('../middleware/auth');
const { uploadToDrive } = require('../utils/uploadToDrive');



// Create a discussion post (any group member)
const createPost = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { content } = req.body;
    const files = req.files || [];

    // Validate input
    if (!content || !groupId) {
      return errorResponse(res, 400, 'Missing parameters', 'Content and group ID are required');
    }
    if (!ObjectId.isValid(groupId)) {
      return errorResponse(res, 400, 'Invalid group ID');
    }

    // Check group membership
    const membership = await GroupMembership.findOne({ group_id: groupId, user_id: req.user._id });
    if (!membership && req.user.role !== 'admin') {
      return errorResponse(res, 403, 'Access denied', 'Not a group member');
    }

    // Save file metadata to Google Drive
    const attachmentIds = [];
    for (const file of files) {
      try {

        // Upload to Google Drive
        const driveFile = await uploadToDrive(file);

        // Save file metadata in DB
        const fileDoc = new File({
          filename: driveFile.filename,
          drive_file_id: driveFile.fileId,
          webViewLink: driveFile.webViewLink,
          webContentLink: driveFile.webContentLink,
          size: driveFile.size,
          uploaded_by: req.user._id,
          group_id: groupId
        });
        await fileDoc.save();
        attachmentIds.push(fileDoc._id);
      } catch (driveError) {
        console.error('Error uploading file:', file.originalname, driveError);
        return errorResponse(
          res,
          500,
          'Upload failed',
          `Failed to upload ${file.originalname} to Google Drive`
        );
      }
    }


    // Create post
    const post = new DiscussionPost({
      content,
      group_id: groupId,
      created_by: req.user._id,
      attachments: attachmentIds
    });
    await post.save();

    // Populate user and group details
    const populatedPost = await DiscussionPost.findById(post._id)
      .populate('created_by', 'name role')
      .populate('group_id', 'name')
      .populate({
        path: 'attachments',
        select: 'filename size webViewLink',
        match: { drive_file_id: { $exists: true } }
      });

    res.status(201).json({ message: 'Post created successfully', post: populatedPost });
  } catch (error) {
    next(error);
  }
};



// List posts in a group (any group member)
const listPosts = async (req, res, next) => {
  try {
    const { groupId, page = 1, limit = 10 } = req.params.groupId ? req.params : req.query;
    if (!groupId || !ObjectId.isValid(groupId)) {
      return errorResponse(res, 400, 'Missing or invalid group ID');
    }

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 10);

    // Check group membership
    const membership = await GroupMembership.findOne({ group_id: groupId, user_id: req.user._id });
    if (!membership && req.user.role !== 'admin') {
      return errorResponse(res, 403, 'Access denied', 'Not a group member');
    }

    const skip = (pageNum - 1) * limitNum;
    const posts = await DiscussionPost.find({ group_id: groupId })
      .populate('created_by', 'name role')
      .populate('group_id', 'name')
      .populate({
        path: 'attachments',
        select: 'filename size webViewLink',
        match: { drive_file_id: { $exists: true } }
      })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limitNum);

    const total = await DiscussionPost.countDocuments({ group_id: groupId });

    // Fetch reply counts for each post
    const postsWithReplyCount = await Promise.all(posts.map(async (post) => {
      const replyCount = await DiscussionReply.countDocuments({ parent_id: post._id, parent_type: 'DiscussionPost' });
      return { ...post.toObject(), replyCount };
    }));

    res.json({
      posts: postsWithReplyCount,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
};


// View a single post (any group member)
const viewPost = async (req, res, next) => {
  try {
    const { postId, groupId } = req.params;
    
    // Validate IDs
    if (!ObjectId.isValid(postId) || !ObjectId.isValid(groupId)) {
      return errorResponse(res, 400, 'Invalid ID', 'Invalid post ID or group ID');
    }


    // Find post with necessary population
    const post = await DiscussionPost.findOne({
      _id: postId,
      group_id: groupId
    })
      .populate('created_by', 'name role')
      .populate('group_id', 'name')
      .populate({
        path: 'attachments',
        select: 'filename size webViewLink',
        match: { drive_file_id: { $exists: true } }
      });

    if (!post) {
      return errorResponse(res, 404, 'Not found', 'Post not found in specified group');
    }


    // Check group membership (admin bypass)
    if (req.user.role !== 'admin') {
      const membership = await GroupMembership.findOne({ 
        group_id: groupId, 
        user_id: req.user._id 
      });
      
      if (!membership) {
        return errorResponse(res, 403, 'Access denied', 'Not a group member');
      }
    }

    // Fetch replies
    const replies = await DiscussionReply.find({ 
      parent_id: postId, 
      parent_type: 'DiscussionPost' 
    })
      .populate('created_by', 'name role')
      .populate({
        path: 'attachments',
        select: 'filename size webViewLink',
        match: { drive_file_id: { $exists: true } }
      })
      .sort({ created_at: -1 });

    res.json({ post, replies });
  } catch (error) {
    next(error);
  }
};




// Update a post (post creator or admin/group creator)
const updatePost = async (req, res, next) => {
  try {
    const { postId, groupId } = req.params;
    const { content } = req.body;

    // Validate input
    if (!ObjectId.isValid(postId) || !ObjectId.isValid(groupId)) {
      return errorResponse(res, 400, 'Invalid ID', 'Invalid post ID or group ID');
    }
    if (!content) {
      return errorResponse(res, 400, 'Missing content', 'Content is required');
    }

    // Find post and verify group
    const post = await DiscussionPost.findOne({
      _id: postId,
      group_id: groupId
    });
    if (!post) {
      return errorResponse(res, 404, 'Not found', 'Post not found in specified group');
    }

    // Check permissions (creator, group creator, or admin)
    const isCreator = post.created_by.equals(req.user._id);
    const isAdmin = req.user.role === 'admin';
    let isGroupCreator = false;

    if (!isCreator && !isAdmin) {
      const group = await Group.findById(groupId);
      isGroupCreator = group?.created_by.equals(req.user._id) || 
                      group?.creators?.some(c => c.equals(req.user._id));
    }

    if (!isCreator && !isAdmin && !isGroupCreator) {
      return errorResponse(res, 403, 'Access denied', 'Not authorized to update this post');
    }

    // Update post
    post.content = content;
    await post.save();

    // Populate and return
    const populatedPost = await DiscussionPost.findById(post._id)
      .populate('created_by', 'name role')
      .populate('group_id', 'name')
      .populate({
        path: 'attachments',
        select: 'filename size webViewLink',
        match: { drive_file_id: { $exists: true } }
      });

    res.json({ 
      success: true,
      message: 'Post updated successfully',
      data: populatedPost 
    });
  } catch (error) {
    next(error);
  }
};

// Delete a post post creator or admin/group creator
const deletePost = async (req, res, next) => {
  try {
    const { postId, groupId } = req.params;

    // Validate IDs
    if (!ObjectId.isValid(postId) || !ObjectId.isValid(groupId)) {
      return errorResponse(res, 400, 'Invalid ID', 'Invalid post ID or group ID');
    }

    // Find post and verify group
    const post = await DiscussionPost.findOne({
      _id: postId,
      group_id: groupId
    });
    if (!post) {
      return errorResponse(res, 404, 'Not found', 'Post not found in specified group');
    }

    // Check permissions (creator, group creator, or admin)
    const isCreator = post.created_by.equals(req.user._id);
    const isAdmin = req.user.role === 'admin';
    let isGroupCreator = false;

    if (!isCreator && !isAdmin) {
      const group = await Group.findById(groupId);
      isGroupCreator = group?.created_by.equals(req.user._id) || 
                      group?.creators?.some(c => c.equals(req.user._id));
    }

    if (!isCreator && !isAdmin && !isGroupCreator) {
      return errorResponse(res, 403, 'Access denied', 'Not authorized to delete this post');
    }

    // Delete associated replies
    await DiscussionReply.deleteMany({ 
      parent_id: postId, 
      parent_type: 'DiscussionPost' 
    });

    // Delete post
    await DiscussionPost.findByIdAndDelete(postId);

    res.json({ 
      success: true,
      message: 'Post deleted successfully',
      data: { deletedPostId: postId }
    });
  } catch (error) {
    next(error);
  }
};



// Create a reply (any group member, to post or anouncement)
const createReply = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { content, parent_type, parentId } = req.body;
    const files = req.files || [];

    // Enhanced input validation
    const missingParams = [];
    if (!content) missingParams.push('content');
    if (!parent_type) missingParams.push('parent_type');
    if (!parentId) missingParams.push('parentId');
    
    if (missingParams.length > 0) {
      return errorResponse(
        res, 
        400, 
        'Missing parameters', 
        `Required: ${missingParams.join(', ')}`
      );
    }

    if (!['DiscussionPost', 'Announcement'].includes(parent_type)) {
      return errorResponse(
        res, 
        400, 
        'Invalid parent type', 
        'Must be DiscussionPost or Announcement'
      );
    }

    // Validate IDs
    const invalidIds = [];
    if (!ObjectId.isValid(groupId)) invalidIds.push('groupId');
    if (!ObjectId.isValid(parentId)) invalidIds.push('parentId');
    if (invalidIds.length > 0) {
      return errorResponse(
        res, 
        400, 
        'Invalid ID', 
        `Invalid: ${invalidIds.join(', ')}`
      );
    }

    // Check parent existence and group match in single query
    const ParentModel = parent_type === 'DiscussionPost' ? DiscussionPost : Announcement;
    const parent = await ParentModel.findOne({
      _id: parentId,
      group_id: groupId
    });

    if (!parent) {
      return errorResponse(
        res, 
        404, 
        'Not found', 
        `${parent_type} not found in specified group`
      );
    }

    // Check group membership (admin bypass)
    if (req.user.role !== 'admin') {
      const membership = await GroupMembership.findOne({ 
        group_id: groupId, 
        user_id: req.user._id 
      });
      if (!membership) {
        return errorResponse(
          res, 
          403, 
          'Access denied', 
          'Not a group member'
        );
      }
    }

    // Process file uploads to Google Drive
    const attachmentIds = [];
    for (const file of files) {
      try {
        
        const driveFile = await uploadToDrive(file);

        // Save file metadata in DB
        const fileDoc = new File({
          filename: driveFile.filename,
          drive_file_id: driveFile.fileId,
          webViewLink: driveFile.webViewLink,
          webContentLink: driveFile.webContentLink,
          size: driveFile.size,
          uploaded_by: req.user._id,
          group_id: groupId
        });
        await fileDoc.save();
        attachmentIds.push(fileDoc._id);
      } catch (driveError) {
        console.error('Error uploading file:', file.originalname, driveError);
        return errorResponse(
          res,
          500,
          'Upload failed',
          `Failed to upload ${file.originalname} to Google Drive`
        );
      }
    }


    // Create and save reply
    const reply = await DiscussionReply.create({
      content,
      group_id: groupId,
      created_by: req.user._id,
      parent_type,
      parent_id: parentId,
      attachments: attachmentIds
    });


    // Populate and return response
    const populatedReply = await DiscussionReply.findById(reply._id)
      .populate('created_by', 'name role')
      .populate({
        path: 'attachments',
        select: 'filename size webViewLink',
        match: { drive_file_id: { $exists: true } }
      });

    res.status(201).json({
      success: true,
      message: 'Reply created successfully',
      data: populatedReply
    });

  } catch (error) {
    next(error);
  }
};




// Update a reply (reply creator, group creator, or admin)
const updateReply = async (req, res, next) => {
  try {
    const { replyId, groupId } = req.params; 
    const { content } = req.body;

    // Validate input
    if (!content) {
      return errorResponse(res, 400, 'Missing content', 'Content is required');
    }
    if (!ObjectId.isValid(replyId) || !ObjectId.isValid(groupId)) {
      return errorResponse(res, 400, 'Invalid ID', 'Invalid reply ID or group ID');
    }

    // Find reply and validate group ownership in a single query
    const reply = await DiscussionReply.findOne({
      _id: replyId,
      group_id: groupId 
    });

    if (!reply) {
      return errorResponse(res, 404, 'Not found', 'Reply not found in this group');
    }

    // Check permissions (creator, group creator, or admin)
    const isCreator = reply.created_by.equals(req.user._id);
    const isAdmin = req.user.role === 'admin';
    let isGroupCreator = false;

    if (!isCreator && !isAdmin) {
      const group = await Group.findById(groupId);
      isGroupCreator = group?.created_by.equals(req.user._id) || 
                      group?.creators?.some(c => c.equals(req.user._id));
    }

    if (!isCreator && !isAdmin && !isGroupCreator) {
      return errorResponse(res, 403, 'Access denied', 'Not authorized to update this reply');
    }

    // Update reply
    reply.content = content;
    await reply.save();

    // Populate and return
    const populatedReply = await DiscussionReply.findById(reply._id)
      .populate('created_by', 'name role')
      .populate('attachments', 'filename size');

    res.json({ 
      success: true,
      message: 'Reply updated successfully',
      data: populatedReply 
    });

  } catch (error) {
    next(error);
  }
};




// Delete a reply (reply creator, group creator, or admin)
const deleteReply = async (req, res, next) => {
  try {
    const { replyId, groupId } = req.params; 

    // Validate IDs
    if (!ObjectId.isValid(replyId) || !ObjectId.isValid(groupId)) {
      return errorResponse(res, 400, 'Invalid ID', 'Invalid reply ID or group ID');
    }

    // Find reply and verify group in a single query
    const reply = await DiscussionReply.findOneAndDelete({
      _id: replyId,
      group_id: groupId
    });

    if (!reply) {
      return errorResponse(res, 404, 'Not found', 'Reply not found in specified group');
    }

    // Check permissions (creator, group creator, or admin)
    const isCreator = reply.created_by.equals(req.user._id);
    const isAdmin = req.user.role === 'admin';
    let isGroupCreator = false;

    if (!isCreator && !isAdmin) {
      const group = await Group.findById(groupId);
      isGroupCreator = group?.created_by.equals(req.user._id) || 
                      group?.creators?.some(c => c.equals(req.user._id));
    }

    if (!isCreator && !isAdmin && !isGroupCreator) {
      return errorResponse(res, 403, 'Access denied', 'Not authorized to delete this reply');
    }

    res.json({ 
      success: true,
      message: 'Reply deleted successfully',
      data: { deletedReplyId: replyId }
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPost,
  listPosts,
  viewPost,
  updatePost,
  deletePost,
  createReply,
  updateReply,
  deleteReply
};


