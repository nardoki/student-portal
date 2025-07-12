const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CourseSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
    enum: ['workshop', 'certification', 'full-program'],
  },
  prerequisites: [{
    type: String,
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

CourseSchema.index({ code: 1 });

module.exports = mongoose.model('Course', CourseSchema);