const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const announcementSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 100
  },
  content: {
    type: String,
    required: true,
    trim: true,
    minlength: 10
  },
  group_id: {
    type: Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  created_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  attachments: [{
    type: Schema.Types.ObjectId,
    ref: 'File',
    default: []
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  pinned: {
    type: Boolean,
    default: false
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});


announcementSchema.index({ group_id: 1, pinned: -1, created_at: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);