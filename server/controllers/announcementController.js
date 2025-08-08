const Announcement = require('../models/announcementSchema');
const Group = require('../models/groupSchema');
const GroupMembership = require('../models/groupMembershipSchema');
const File = require('../models/fileSchema');
const DiscussionPost = require('../models/discussionPostSchema');
const DiscussionReply = require('../models/discussionReplySchema');
const { ObjectId } = require('mongoose').Types;
const { errorResponse } = require('../middleware/auth');
const { uploadToDrive, deleteFromDrive } = require('../utils/uploadToDrive');



// Create announcement (admin or group creator)
const createAnnouncement = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { title, content, priority, pinned } = req.body;
    const files = req.files || [];

    // Validate input
    if (!title || !content || !groupId) {
      return errorResponse(res, 400, 'Title, content, and group ID are required');
    }
    if (!ObjectId.isValid(groupId)) {
      return errorResponse(res, 400, 'Invalid group ID');
    }
    if (priority && !['low', 'medium', 'high'].includes(priority)) {
      return errorResponse(res, 400, 'Priority must be low, medium, or high');
    }
    if (pinned !== undefined && typeof pinned !== 'boolean') {
      return errorResponse(res, 400, 'Pinned must be a boolean');
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return errorResponse(res, 404, 'Group not found');
    }



    // Teachers can only create announcements for groups they created or are creators of
    if (
      req.user.role === 'teacher' &&
      !group.creators.some(creator => creator.toString() === req.user._id.toString()) &&
      group.created_by.toString() !== req.user._id.toString()
    ) {
      return errorResponse(res, 403, 'Teachers can only create announcements for groups they created or are assigned as creators');
    }

    // Save file metadata to Google Drive
    const attachmentIds = [];
    for (const file of files) {
      try {

        // Upload to Gogle Drive
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

    // Create announcement
    const announcement = new Announcement({
      title,
      content,
      group_id: groupId,
      created_by: req.user._id,
      attachments: attachmentIds,
      priority: priority || 'medium',
      pinned: pinned || false
    });

    await announcement.save();

    // Populate the response
    const populatedAnnouncement = await Announcement.findById(announcement._id)
      .populate('created_by', 'name email')
      .populate('group_id', 'name')
      .populate({
        path: 'attachments',
        select: 'filename size webViewLink webContentLink',
        match: { drive_file_id: { $exists: true } }
      });

    res.status(201).json(populatedAnnouncement);
  } catch (error) {
    next(error);
  }
};

// List announcements - admin sees all, others see only their group announcements (with pagination)
const listAnnouncements = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 10);

    if (groupId && !ObjectId.isValid(groupId)) {
      return errorResponse(res, 400, 'Invalid group ID');
    }

    let query = {};

    // Non-admins: only see announcements in their groups
    if (req.user.role !== 'admin') {
      const memberships = await GroupMembership.find({ user_id: req.user._id }).select('group_id');
      const groupIds = memberships.map(m => m.group_id);
      query.group_id = { $in: groupIds };
    }

    // If groupId param provided, narrow down to that group
    if (groupId) {
      query.group_id = groupId;
    }

    const announcements = await Announcement.find(query)
      .populate('created_by', 'name email')
      .populate('group_id', 'name')
      .populate({
        path: 'attachments',
        select: 'filename size webViewLink webContentLink',
        match: { drive_file_id: { $exists: true } }
      })
      .populate({
        path: 'replies', // populate replies directly
        populate: [
          { path: 'created_by', select: 'name email' },
          {
            path: 'attachments',
            select: 'filename size webViewLink webContentLink',
            match: { drive_file_id: { $exists: true } }
          }
        ]
      })
      .sort({ pinned: -1, created_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await Announcement.countDocuments(query);

    res.json({
      announcements,
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




// View single announcement (admin or group members)
const viewAnnouncement = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return errorResponse(res, 400, 'Invalid announcement ID');
    }

    const announcement = await Announcement.findById(id)
      .populate('created_by', 'name email')
      .populate('group_id', 'name')
      .populate({
        path: 'attachments',
        select: 'filename size webViewLink webContentLink',
        match: { drive_file_id: { $exists: true } }
      });

    if (!announcement) {
      return errorResponse(res, 404, 'Announcement not found');
    }



    // Check if user is a group member or admin
    if (req.user.role !== 'admin') {
      const membership = await GroupMembership.findOne({ 
        group_id: announcement.group_id, 
        user_id: req.user._id 
      });
      if (!membership) {
        return errorResponse(res, 403, 'Access denied: not a group member');
      }
    }

    res.json(announcement);
  } catch (error) {
    next(error);
  }
};



// Update announcement (admin or announcement creator)
const updateAnnouncement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content, priority, pinned } = req.body;

    if (!ObjectId.isValid(id)) {
      return errorResponse(res, 400, 'Invalid announcement ID');
    }

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return errorResponse(res, 404, 'Announcement not found');
    }

    const group = await Group.findById(announcement.group_id);
    if (!group) {
      return errorResponse(res, 404, 'Group not found');
    }



    // Teachers can only update announcements in groups they created or are creators of
    if (
      req.user.role === 'teacher' &&
      announcement.created_by.toString() !== req.user._id.toString() &&
      !group.creators.some(creator => creator.toString() === req.user._id.toString()) &&
      group.created_by.toString() !== req.user._id.toString()
    ) {
      return errorResponse(res, 403, 'Teachers can only update announcements in groups they created or are assigned as creators');
    }

    if (title) announcement.title = title;
    if (content) announcement.content = content;
    if (priority && ['low', 'medium', 'high'].includes(priority)) {
      announcement.priority = priority;
    } else if (priority) {
      return errorResponse(res, 400, 'Priority must be low, medium, or high');
    }
    if (typeof pinned === 'boolean') announcement.pinned = pinned;

    await announcement.save();



    // Populate the response
    const populatedAnnouncement = await Announcement.findById(announcement._id)
      .populate('created_by', 'name email')
      .populate('group_id', 'name')
      .populate({
        path: 'attachments',
        select: 'filename size webViewLink webContentLink',
        match: { drive_file_id: { $exists: true } }
      });

    res.json(populatedAnnouncement);
  } catch (error) {
    next(error);
  }
};



// Delete announcement (admin or announcement creator)
const deleteAnnouncement = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return errorResponse(res, 400, 'Invalid announcement ID');
    }

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return errorResponse(res, 404, 'Announcement not found');
    }

    const group = await Group.findById(announcement.group_id);
    if (!group) {
      return errorResponse(res, 404, 'Group not found');
    }



    // Teachers can only delete announcements in groups they created or are creators of
    if (
      req.user.role === 'teacher' &&
      announcement.created_by.toString() !== req.user._id.toString() &&
      !group.creators.some(creator => creator.toString() === req.user._id.toString()) &&
      group.created_by.toString() !== req.user._id.toString()
    ) {
      return errorResponse(res, 403, 'Teachers can only delete announcements in groups they created or are assigned as creators');
    }

    const attachments = announcement.attachments;
    await Announcement.findByIdAndDelete(id);

    
    // Delete unreferenced files from Drive and DB
    for (const fileId of attachments) {
      const references = await Promise.all([
        Announcement.countDocuments({ attachments: fileId }),
        DiscussionPost.countDocuments({ attachments: fileId }),
        DiscussionReply.countDocuments({ attachments: fileId })
      ]);
      
      if (references.every(count => count === 0)) {
        const file = await File.findById(fileId);
        if (file && file.drive_file_id) {
          try {
            await deleteFromDrive(file.drive_file_id);
          } catch (err) {
            console.warn('File not found on Drive during deletion:', file.drive_file_id);
          }
        }
        await File.findByIdAndDelete(fileId);
      }
    }

    res.json({ message: 'Announcement deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createAnnouncement,
  listAnnouncements,
  viewAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
};