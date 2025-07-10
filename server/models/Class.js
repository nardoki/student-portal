const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ClassSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true, // e.g "Robotics 101 Cohort A"
  },
  courseId: {
    type: Schema.Types.ObjectId,
    ref: 'Course',
    required: true,
  },
  teacherId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    validate: {
      validator: async function (value) {
        const user = await mongoose.model('User').findById(value);
        return user && user.role === 'teacher';
      },
      message: 'TeacherId must reference a user with role "teacher"',
    },
  },
  studentIds: [{
    type: Schema.Types.ObjectId,
    ref: 'User',
    validate: {
      validator: async function (value) {
        const user = await mongoose.model('User').findById(value);
        return user && user.role === 'student';
      },
      message: 'StudentIds must reference users with role "student"',
    },
  }],
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
  },
  location: {
    type: String, // e.g"Addis Ababa Lab" or "Virtual"
  },
  meetingLink: {
    type: String, // e.g Zoom link for virtual classes
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'upcoming'],
    default: 'upcoming',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

ClassSchema.index({ teacherId: 1, courseId: 1, name: 1 });

module.exports = mongoose.model('Class', ClassSchema);
