const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const discussionPostSchema = new Schema({
  title: {
    type: String,
    trim: true,
    maxlength: 255,
    default: null
  },
  content: {
    type: String,
    required: true
  },
  posted_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  group_id: {
    type: Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  attachments: [{
    type: Schema.Types.ObjectId,
    ref: 'File'
  }],
  posted_at: {
    type: Date,
    default: Date.now
  },
  edited_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: false
});

discussionPostSchema.index({ group_id: 1, posted_at: -1 });

module.exports = mongoose.model('DiscussionPost', discussionPostSchema);