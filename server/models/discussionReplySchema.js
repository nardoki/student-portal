const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const discussionReplySchema = new Schema({
  post_id: {
    type: Schema.Types.ObjectId,
    ref: 'DiscussionPost',
    required: true
  },
  replied_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  attachments: [{
    type: Schema.Types.ObjectId,
    ref: 'File'
  }],
  replied_at: {
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

discussionReplySchema.index({ post_id: 1, replied_at: -1 });

module.exports = mongoose.model('DiscussionReply', discussionReplySchema);