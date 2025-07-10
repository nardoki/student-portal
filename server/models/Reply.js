const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ReplySchema = new Schema({
  postId: {
    type: Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
  },
  authorId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  attachments: [{
    type: Schema.Types.ObjectId,
    ref: 'File',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

ReplySchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

ReplySchema.index({ postId: 1, createdAt: -1 });

module.exports = mongoose.model('Reply', ReplySchema);