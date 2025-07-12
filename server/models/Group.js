
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GroupSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true, // e.g., "Robot Arm Team"
  },
  classId: {
    type: Schema.Types.ObjectId,
    ref: 'Class',
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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

GroupSchema.index({ classId: 1, teacherId: 1, name: 1 });

module.exports = mongoose.model('Group', GroupSchema);

