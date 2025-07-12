const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const StudentSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    validate: {
      validator: async function (value) {
        const user = await mongoose.model('User').findById(value);
        return user && user.role === 'student';
      },
      message: 'UserId must reference a user with role "student"',
    },
  },
  studentId: {
    type: String,
    unique: true,
    required: true,
  },
  skillLevel: {
    type: String,
    enum: ['beginner', 'intermediate', 'advanced'],
  },
  enrollmentDate: {
    type: Date,
  },
  projects: [{
    projectId: { type: String },
    title: { type: String },
    status: { type: String, enum: ['in-progress', 'completed'] },
  }],
  certifications: [{
    name: { type: String },
    dateEarned: { type: Date },
  }],
  classIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Class',
  }],
  groupIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Group',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

StudentSchema.pre('save', function (next) {
  if (!this.studentId) {
    this.studentId = `STU${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
  next();
});

StudentSchema.index({ userId: 1, studentId: 1 });

module.exports = mongoose.model('Student', StudentSchema);