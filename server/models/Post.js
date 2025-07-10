const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PostSchema = new Schema({
  classId: {
    type: Schema.Types.ObjectId,
    ref: 'Class',
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

PostSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

PostSchema.index({ classId: 1, createdAt: -1 });

module.exports = mongoose.model('Post', PostSchema);
