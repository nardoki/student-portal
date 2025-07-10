const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CourseSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true, // e.g., "Embedded Systems"
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true, // e.g., "ROB101"
  },
  description: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
    enum: ['workshop', 'certification', 'full-program'], // e.g., workshop for short courses
  },
  prerequisites: [{
    type: String, // e.g., ["ROB100", "CS101"]
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

CourseSchema.index({ code: 1 });

module.exports = mongoose.model('Course', CourseSchema);
