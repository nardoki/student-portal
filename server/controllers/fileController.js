const File = require('../models/fileSchema');
const Group = require('../models/groupSchema');
const GroupMembership = require('../models/groupMembershipSchema');
const path = require('path');
const fs = require('fs').promises; // Changed to use promises API

// Upload file to a group (admin or group creator)
const uploadFile = async (req, res, next) => {
  try {
    const { group_id } = req.body;
    const files = req.files || [];

    // Validate input
    if (!group_id) {
      return res.status(400).json({ error: 'Group ID is required' });
    }
    if (files.length === 0) {
      return res.status(400).json({ error: 'At least one file is required' });
    }

    const group = await Group.findById(group_id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Teachers can only upload to groups they created or are creators of
    if (req.user.role === 'teacher' && 
        !group.creators.some(creator => creator.toString() === req.user._id.toString()) &&
        group.created_by.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Teachers can only upload files to groups they created or are assigned as creators' });
    }

    // Save file metadata
    const savedFiles = [];
    for (const file of files) {
      const fileDoc = new File({
        filename: file.filename,
        path: file.path,
        size: file.size,
        uploaded_by: req.user._id,
        group_id
      });
      await fileDoc.save();
      savedFiles.push({
        id: fileDoc._id,
        filename: fileDoc.filename,
        size: fileDoc.size,
        uploaded_by: fileDoc.uploaded_by,
        group_id: fileDoc.group_id,
        created_at: fileDoc.created_at
      });
    }

    res.status(201).json({ message: 'Files uploaded successfully', files: savedFiles });
  } catch (error) {
    next(error);
  }
};

// list files
const listFiles = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (req.user.role !== 'admin') {
      const membership = await GroupMembership.findOne({ group_id: groupId, user_id: req.user._id });
      if (!membership) {
        return res.status(403).json({ error: 'Access denied: not a group member' });
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const files = await File.find({ group_id: groupId })
      .populate('uploaded_by', 'name email')
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await File.countDocuments({ group_id: groupId });

    res.json({
      files,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

// Download file (admin or group member)
const downloadFile = async (req, res, next) => {
  try {
    const { fileId } = req.params;

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Check if user is a group member or admin
    if (req.user.role !== 'admin') {
      const membership = await GroupMembership.findOne({ group_id: file.group_id, user_id: req.user._id });
      if (!membership) {
        return res.status(403).json({ error: 'Access denied: not a group member' });
      }
    }

    const filePath = path.resolve(file.path);
    try {
      await fs.access(filePath); // Check if file exists using promises
      res.download(filePath, file.filename);
    } catch (err) {
      return res.status(404).json({ error: 'File not found on server' });
    }
  } catch (error) {
    next(error);
  }
};

// Delete file (admin or file uploader)
const deleteFile = async (req, res, next) => {
  try {
    const { fileId } = req.params;

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Teachers can only delete files they uploaded
    if (req.user.role === 'teacher' && file.uploaded_by.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Teachers can only delete files they uploaded' });
    }

    // Delete file from disk
    const filePath = path.resolve(file.path);
    try {
      await fs.access(filePath); // Check if file exists
      await fs.unlink(filePath); // Changed to async unlink
    } catch (err) {
      // File doesn't exist or couldn't be accessed, but we'll still delete the record
      console.warn('File not found on disk during deletion:', filePath);
    }
    
    // Delete file metadata
    await File.findByIdAndDelete(fileId);

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadFile,
  listFiles,
  downloadFile,
  deleteFile
};