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
    required: true, // e.g., "/uploads/123456-file.pdf"
  },
  classId: {
    type: Schema.Types.ObjectId,
    ref: 'Class',
    required: true,
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  contentType: {
    type: String,
    required: true, // e.g., "application/pdf"
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
    enum: ['assignment', 'lecture-note', 'code', 'schematic', 'other'], // e.g., for robotics resources
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

FileSchema.index({ classId: 1, uploadedBy: 1, createdAt: -1 });

module.exports = mongoose.model('File', FileSchema);
