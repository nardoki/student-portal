const File = require('../models/fileSchema');
const Group = require('../models/groupSchema');
const GroupMembership = require('../models/groupMembershipSchema');
const { uploadToDrive, deleteFromDrive } = require('../utils/uploadToDrive');

const uploadFile = async (req, res, next) => {
  try {
    const { group_id } = req.body;
    if (!group_id) {
      return res.status(400).json({ error: 'Group ID is required' });
    }

    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'At least one file is required' });
    }

    const group = await Group.findById(group_id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (
      req.user.role === 'teacher' &&
      !group.creators.some(c => c.toString() === req.user._id.toString()) &&
      group.created_by.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'Unauthorized to upload to this group' });
    }

    const savedFiles = [];

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
          group_id
        });

        await fileDoc.save();

        savedFiles.push({
          id: fileDoc._id,
          filename: fileDoc.filename,
          size: fileDoc.size,
          uploaded_by: fileDoc.uploaded_by,
          group_id: fileDoc.group_id,
          webViewLink: fileDoc.webViewLink,
          webContentLink: fileDoc.webContentLink,
          created_at: fileDoc.created_at
        });
      } catch (error) {
        console.error('Error uploading file:', file.originalname, error.message);
        return res.status(500).json({
          error: 'Internal server error',
          message: `Failed to upload ${file.originalname} to Google Drive`
        });
      }
    }

    res.status(201).json({
      message: 'Files uploaded to Google Drive',
      files: savedFiles
    });
  } catch (error) {
    console.error('Error in uploadFile:', error);
    next(error);
  }
};

const listFiles = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    if (req.user.role !== 'admin') {
      const membership = await GroupMembership.findOne({ group_id: groupId, user_id: req.user._id });
      if (!membership) return res.status(403).json({ error: 'Access denied: not a group member' });
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

const downloadFile = async (req, res, next) => {
  try {
    const { fileId } = req.params;

    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    if (req.user.role !== 'admin') {
      const membership = await GroupMembership.findOne({ group_id: file.group_id, user_id: req.user._id });
      if (!membership) return res.status(403).json({ error: 'Access denied: not a group member' });
    }

    res.redirect(file.webContentLink);
  } catch (error) {
    next(error);
  }
};

const deleteFile = async (req, res, next) => {
  try {
    const { fileId } = req.params;

    const file = await File.findById(fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    if (req.user.role === 'teacher' && file.uploaded_by.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Teachers can only delete files they uploaded' });
    }

    try {
      await deleteFromDrive(file.drive_file_id);
    } catch (err) {
      console.warn('File not found on Drive during deletion:', file.drive_file_id);
    }

    await File.findByIdAndDelete(fileId);
    res.json({ message: 'File deleted from Google Drive and DB' });
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