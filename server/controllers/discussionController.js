

const DiscussionPost = require('../models/discussionPostSchema');
const DiscussionReply = require('../models/discussionReplySchema');
const Announcement = require('../models/announcementSchema');
const Group = require('../models/groupSchema');
const GroupMembership = require('../models/groupMembershipSchema');
const File = require('../models/fileSchema');



// Create a discussion post (any group member)
const createPost = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { content } = req.body;
    const files = req.files || [];
    const { ObjectId } = require('mongoose').Types;

    // Validate input
    if (!content || !groupId) {
      return res.status(400).json({ error: 'Content and group ID are required' });
    }
    if (!ObjectId.isValid(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    // Check group membership
    const membership = await GroupMembership.findOne({ group_id: groupId, user_id: req.user._id });
    if (!membership && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: not a group member' });
    }

    // Save file metadata
    const attachmentIds = [];
    for (const file of files) {
      const fileDoc = new File({
        filename: file.filename,
        path: file.path,
        size: file.size,
        uploaded_by: req.user._id,
        group_id: groupId
      });
      await fileDoc.save();
      attachmentIds.push(fileDoc._id);
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
      .populate('attachments', 'filename size');

    res.status(201).json({ message: 'Post created successfully', post: populatedPost });
  } catch (error) {
    next(error);
  }
};



// List posts in a group (any group member)
const listPosts = async (req, res, next) => {
  try {
    const { group_id, page = 1, limit = 10 } = req.query;

    if (!group_id) {
      return res.status(400).json({ error: 'Group ID is required' });
    }


     
    // Check group membership
    const membership = await GroupMembership.findOne({ group_id, user_id: req.user._id });
    if (!membership && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: not a group member' });
    }

    const skip = (page - 1) * limit;
    const posts = await DiscussionPost.find({ group_id })
      .populate('created_by', 'name  role')
      .populate('group_id', 'name')
      .populate('attachments', 'filename size')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await DiscussionPost.countDocuments({ group_id });



    // Fetch reply counts for each post
    const postsWithReplyCount = await Promise.all(posts.map(async (post) => {
      const replyCount = await DiscussionReply.countDocuments({ parent_id: post._id, parent_type: 'DiscussionPost' });
      return { ...post.toObject(), replyCount };
    }));

    res.json({
      posts: postsWithReplyCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};



// View a single post (any group member)
const viewPost = async (req, res, next) => {
  try {
    const { postId } = req.params;

    const post = await DiscussionPost.findById(postId)
      .populate('created_by', 'name  role')
      .populate('group_id', 'name')
      .populate('attachments', 'filename size');

    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }


    // Check group membership
    if (req.user.role !== 'admin') {
      const membership = await GroupMembership.findOne({ group_id: post.group_id, user_id: req.user._id });
      if (!membership) {
        return res.status(403).json({ error: 'Access denied: not a group member' });
      }
    }



    // Fetch replies
    const replies = await DiscussionReply.find({ parent_id: postId, parent_type: 'DiscussionPost' })
      .populate('created_by', 'name  role')
      .populate('attachments', 'filename size')
      .sort({ created_at: -1 });

    res.json({ post, replies });
  } catch (error) {
    next(error);
  }
};




// Update a post (post creator or admin/group creator)
const updatePost = async (req, res, next) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const post = await DiscussionPost.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }


    // Check permissions
    const group = await Group.findById(post.group_id);
    const isGroupCreator = group.created_by.toString() === req.user._id.toString() ||
      group.creators.some(creator => creator.toString() === req.user._id.toString());
    if (req.user.role !== 'admin' && post.created_by.toString() !== req.user._id.toString() && !isGroupCreator) {
      return res.status(403).json({ error: 'Access denied: only post creator or admin/group creator can update' });
    }

    post.content = content;
    await post.save();

    const populatedPost = await DiscussionPost.findById(postId)
      .populate('created_by', 'name  role')
      .populate('group_id', 'name')
      .populate('attachments', 'filename size');

    res.json({ message: 'Post updated successfully', post: populatedPost });
  } catch (error) {
    next(error);
  }
};




// Delete a post (post creator or admin/group creator)
const deletePost = async (req, res, next) => {
  try {
    const { postId } = req.params;

    const post = await DiscussionPost.findById(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }


    // Check permissions
    const group = await Group.findById(post.group_id);
    const isGroupCreator = group.created_by.toString() === req.user._id.toString() ||
      group.creators.some(creator => creator.toString() === req.user._id.toString());
    if (req.user.role !== 'admin' && post.created_by.toString() !== req.user._id.toString() && !isGroupCreator) {
      return res.status(403).json({ error: 'Access denied: only post creator or admin/group creator can delete' });
    }



    // Delete associated replies
    await DiscussionReply.deleteMany({ parent_id: postId, parent_type: 'DiscussionPost' });


    // Delete post (files are not deleted, as they may be referenced elsewhere)
    await DiscussionPost.findByIdAndDelete(postId);

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    next(error);
  }
};




// Create a reply (any group member, to post or announcement)
const createReply = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { content, parent_type, parentId } = req.body;
    const files = req.files || [];
    const { ObjectId } = require('mongoose').Types;

    // Validate input
    if (!content || !groupId || !parent_type || !parentId) {
      return res.status(400).json({ error: 'Content, group ID, parent type, and parent ID are required' });
    }
    if (!['DiscussionPost', 'Announcement'].includes(parent_type)) {
      return res.status(400).json({ error: 'Parent type must be DiscussionPost or Announcement' });
    }
    if (!ObjectId.isValid(groupId) || !ObjectId.isValid(parentId)) {
      return res.status(400).json({ error: 'Invalid group ID or parent ID' });
    }

    // Check parent exists and group matches
    const ParentModel = parent_type === 'DiscussionPost' ? DiscussionPost : Announcement;
    const parent = await ParentModel.findById(parentId);
    if (!parent) {
      return res.status(404).json({ error: `${parent_type} not found` });
    }
    if (parent.group_id.toString() !== groupId) {
      return res.status(400).json({ error: 'Group ID does not match parent group' });
    }

    // Check group membership
    const membership = await GroupMembership.findOne({ group_id: groupId, user_id: req.user._id });
    if (!membership && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: not a group member' });
    }

    // Save file metadata
    const attachmentIds = [];
    for (const file of files) {
      const fileDoc = new File({
        filename: file.filename,
        path: file.path,
        size: file.size,
        uploaded_by: req.user._id,
        group_id: groupId
      });
      await fileDoc.save();
      attachmentIds.push(fileDoc._id);
    }

    // Create reply
    const reply = new DiscussionReply({
      content,
      group_id: groupId,
      created_by: req.user._id,
      parent_type,
      parent_id: parentId,
      attachments: attachmentIds
    });
    await reply.save();

    const populatedReply = await DiscussionReply.findById(reply._id)
      .populate('created_by', 'name role')
      .populate('attachments', 'filename size');

    res.status(201).json({ message: 'Reply created successfully', reply: populatedReply });
  } catch (error) {
    next(error);
  }
};




// Update a reply (reply creator or admin/group creator)
const updateReply = async (req, res, next) => {
  try {
    const { postId, replyId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const reply = await DiscussionReply.findById(replyId);
    if (!reply) {
      return res.status(404).json({ error: 'Reply not found' });
    }


    // Check group permissions
    const group = await Group.findById(reply.group_id);
    const isGroupCreator = group.created_by.toString() === req.user._id.toString() ||
      group.creators.some(creator => creator.toString() === req.user._id.toString());
    if (req.user.role !== 'admin' && reply.created_by.toString() !== req.user._id.toString() && !isGroupCreator) {
      return res.status(403).json({ error: 'Access denied: only reply creator or admin/group creator can update' });
    }

    reply.content = content;
    await reply.save();

    const populatedReply = await DiscussionReply.findById(replyId)
      .populate('created_by', 'name  role')
      .populate('attachments', 'filename size');

    res.json({ message: 'Reply updated successfully', reply: populatedReply });
  } catch (error) {
    next(error);
  }
};




// Delete a reply (reply creator or admin/group creator)
const deleteReply = async (req, res, next) => {
  try {
    const { postId, replyId } = req.params;

    const reply = await DiscussionReply.findById(replyId);
    if (!reply) {
      return res.status(404).json({ error: 'Reply not found' });
    }


    
    // Check group permissions
    const group = await Group.findById(reply.group_id);
    const isGroupCreator = group.created_by.toString() === req.user._id.toString() ||
      group.creators.some(creator => creator.toString() === req.user._id.toString());
    if (req.user.role !== 'admin' && reply.created_by.toString() !== req.user._id.toString() && !isGroupCreator) {
      return res.status(403).json({ error: 'Access denied: only reply creator or admin/group creator can delete' });
    }

    await DiscussionReply.findByIdAndDelete(replyId);

    res.json({ message: 'Reply deleted successfully' });
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