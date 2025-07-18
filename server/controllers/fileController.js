const File = require('../models/fileSchema');
const GroupMembership = require('../models/groupMembershipSchema');
const DiscussionPost = require('../models/discussionPostSchema');
const DiscussionReply = require('../models/discussionReplySchema');

const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { group_id } = req.body; // Optional for discussion attachments

    // If group_id is provided, verify user is a group member or creator
    if (group_id) {
      const membership = await GroupMembership.findOne({
        user_id: req.user._id,
        group_id
      });
      if (!membership) {
        return res.status(403).json({ error: 'Not a member of this group' });
      }
      // Teachers/admins can upload to groups
      if (req.user.role !== 'admin' && membership.role_in_group !== 'creator') {
        return res.status(403).json({ error: 'Only teachers or admins can upload to groups' });
      }
    }

    // Create file record
    const file = new File({
      name: req.file.originalname,
      path: `/uploads/${req.file.filename}`,
      type: req.file.mimetype,
      uploaded_by: req.user._id,
      group_id: group_id || null
    });

    await file.save();

    res.status(201).json({
      id: file._id,
      name: file.name,
      path: file.path,
      type: file.type,
      uploaded_at: file.uploaded_at
    });
  } catch (error) {
    next(error);
  }
};

const downloadFile = async (req, res, next) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check access: group members or discussion participants
    let hasAccess = false;

    if (file.group_id) {
      const membership = await GroupMembership.findOne({
        user_id: req.user._id,
        group_id: file.group_id
      });
      if (membership) {
        hasAccess = true;
      }
    } else {
      // Check if file is attached to a discussion post or reply
      const post = await DiscussionPost.findOne({ attachments: file._id });
      const reply = await DiscussionReply.findOne({ attachments: file._id });

      if (post) {
        const membership = await GroupMembership.findOne({
          user_id: req.user._id,
          group_id: post.group_id
        });
        if (membership) {
          hasAccess = true;
        }
      } else if (reply) {
        const parentPost = await DiscussionPost.findById(reply.post_id);
        const membership = await GroupMembership.findOne({
          user_id: req.user._id,
          group_id: parentPost.group_id
        });
        if (membership) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied: not authorized to download this file' });
    }

    // Serve the file (assumes local storage we can update for cloud storage)
    res.download(file.path, file.name, (err) => {
      if (err) {
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadFile,
  downloadFile
};