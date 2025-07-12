const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const FileSchema = new Schema({
  filename: {
    type: String,
    required: true,
    trim: true,
  },
  filePath: {
    type: String,
    required: true,
  },
  classId: {
    type: Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
  },
  groupId: {
    type: Schema.Types.ObjectId,
    ref: 'Group',
    optional: true,
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  contentType: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    enum: ['assignment', 'submission', 'lecture-note', 'code', 'schematic', 'other'],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

FileSchema.index({ classId: 1, groupId: 1, uploadedBy: 1, createdAt: -1 });

module.exports = mongoose.model('File', FileSchema);