const Announcement = require('../models/announcementSchema');
const Group = require('../models/groupSchema');
const GroupMembership = require('../models/groupMembershipSchema');
const File = require('../models/fileSchema');
const DiscussionPost = require('../models/discussionPostSchema');
const DiscussionReply = require('../models/discussionReplySchema');
const fs = require('fs');
const { ObjectId } = require('mongoose').Types;



// Create announcement (admin or group creator)
const createAnnouncement = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { title, content, priority, pinned } = req.body;
    const files = req.files || [];


    // Validate input
    if (!title || !content || !groupId) {
      return res.status(400).json({ error: 'Title, content, and group ID are required' });
    }
    if (!ObjectId.isValid(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }
    if (priority && !['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({ error: 'Priority must be low, medium, or high' });
    }
    if (pinned !== undefined && typeof pinned !== 'boolean') {
      return res.status(400).json({ error: 'Pinned must be a boolean' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }


    // Teachers can only create announcements for groups they created or are creators of
    if (
      req.user.role === 'teacher' &&
      !group.creators.some(creator => creator.toString() === req.user._id.toString()) &&
      group.created_by.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'Teachers can only create announcements for groups they created or are assigned as creators' });
    }


    // Save file metadata if attachments exist
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

    res.status(201).json({
      id: announcement._id,
      title,
      content,
      group_id: announcement.group_id,
      created_by: req.user._id,
      priority: announcement.priority,
      pinned: announcement.pinned,
      created_at: announcement.created_at
    });
  } catch (error) {
    next(error);
  }
};




// List announcements (admin sees all, others see their groups' announcements, with pagination)
const listAnnouncements = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, parseInt(limit) || 10);

    if (groupId && !ObjectId.isValid(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    let query = {};
    if (req.user.role !== 'admin') {
      // Non-admins only see announcements in their groups
      const memberships = await GroupMembership.find({ user_id: req.user._id }).select('group_id');
      const groupIds = memberships.map(m => m.group_id);
      query.group_id = { $in: groupIds };
    }
    if (groupId) {
      query.group_id = groupId;
    }

    const announcements = await Announcement.find(query)
      .populate('created_by', 'name email')
      .populate('group_id', 'name')
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
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    const announcement = await Announcement.findById(id)
      .populate('created_by', 'name email')
      .populate('group_id', 'name')
      .populate('attachments', 'filename size');

    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }


    // Check if user is a group member or admin
    if (req.user.role !== 'admin') {
      const membership = await GroupMembership.findOne({ group_id: announcement.group_id, user_id: req.user._id });
      if (!membership) {
        return res.status(403).json({ error: 'Access denied: not a group member' });
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
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    const group = await Group.findById(announcement.group_id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }


    // Teachers can only update announcements in groups they created or are creators of
    if (
      req.user.role === 'teacher' &&
      announcement.created_by.toString() !== req.user._id.toString() &&
      !group.creators.some(creator => creator.toString() === req.user._id.toString()) &&
      group.created_by.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'Teachers can only update announcements in groups they created or are assigned as creators' });
    }

    if (title) announcement.title = title;
    if (content) announcement.content = content;
    if (priority && ['low', 'medium', 'high'].includes(priority)) {
      announcement.priority = priority;
    } else if (priority) {
      return res.status(400).json({ error: 'Priority must be low, medium, or high' });
    }
    if (typeof pinned === 'boolean') announcement.pinned = pinned;

    await announcement.save();

    res.json({
      id: announcement._id,
      title: announcement.title,
      content: announcement.content,
      group_id: announcement.group_id,
      priority: announcement.priority,
      pinned: announcement.pinned
    });
  } catch (error) {
    next(error);
  }
};




// Delete announcement (admin or announcement creator)
const deleteAnnouncement = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid announcement ID' });
    }

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    const group = await Group.findById(announcement.group_id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }


    // Teachers can only delete announcements in groups they created or are creators of
    if (
      req.user.role === 'teacher' &&
      announcement.created_by.toString() !== req.user._id.toString() &&
      !group.creators.some(creator => creator.toString() === req.user._id.toString()) &&
      group.created_by.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'Teachers can only delete announcements in groups they created or are assigned as creators' });
    }

    const attachments = announcement.attachments;
    await Announcement.findByIdAndDelete(id);


    
    // Delete unreferenced files
    for (const fileId of attachments) {
      const references = await Promise.all([
        Announcement.countDocuments({ attachments: fileId }),
        DiscussionPost.countDocuments({ attachments: fileId }),
        DiscussionReply.countDocuments({ attachments: fileId })
      ]);
      if (references.every(count => count === 0)) {
        const file = await File.findById(fileId);
        if (file && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
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