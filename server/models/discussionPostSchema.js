const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const discussionPostSchema = new Schema({
  content: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 1000
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
  created_at: {
    type: Date,
    default: Date.now
  }
});


discussionPostSchema.index({ group_id: 1, created_at: -1 });

module.exports = mongoose.model('DiscussionPost', discussionPostSchema);