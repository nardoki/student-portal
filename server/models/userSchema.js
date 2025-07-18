const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  password_hash: {  // Changed from 'password' to 'password_hash' for consistency
    type: String,
    required: true,
    select: false  // Important: Excludes this field by default from queries
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved'],
    default: 'pending'
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: {  // Changed from created_at to createdAt for consistency
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

module.exports = mongoose.model('User', userSchema);