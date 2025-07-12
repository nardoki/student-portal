const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TeacherSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    validate: {
      validator: async function (value) {
        const user = await mongoose.model('User').findById(value);
        return user && user.role === 'teacher';
      },
      message: 'UserId must reference a user with role "teacher"',
    },
  },
  teacherId: {
    type: String,
    unique: true,
    required: true,
  },
  expertise: [{
    type: String,
  }],
  qualification: {
    type: String,
  },
  schedule: [{
    day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
    time: { type: String },
  }],
  classIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Class',
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

TeacherSchema.pre('save', function (next) {
  if (!this.teacherId) {
    this.teacherId = `TCH${Date.now()}${Math.floor(Math.random() * 1000)}`;
  }
  next();
});

TeacherSchema.index({ userId: 1, teacherId: 1 });

module.exports = mongoose.model('Teacher', TeacherSchema);