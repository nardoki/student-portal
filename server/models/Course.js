const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CourseSchema = new Schema({
  name: {
    type: String,
    required: [true, 'Course name is required'],
    trim: true,
    minlength: [3, 'Course name must be at least 3 characters'],
    maxlength: [100, 'Course name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Course code is required'],
    unique: true,
    trim: true,
    uppercase: true,
    match: [/^[A-Z0-9-]+$/, 'Course code can only contain letters, numbers, and hyphens'],
    minlength: [2, 'Course code must be at least 2 characters'],
    maxlength: [20, 'Course code cannot exceed 20 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  type: {
    type: String,
    required: [true, 'Course type is required'],
    trim: true,
    minlength: [2, 'Course type must be at least 2 characters'],
    maxlength: [50, 'Course type cannot exceed 50 characters']
  },
  prerequisites: [{
    type: Schema.Types.ObjectId,
    ref: 'Course',
    validate: {
      validator: async function(v) {
        const course = await mongoose.model('Course').findById(v);
        return course !== null;
      },
      message: 'Prerequisite course does not exist'
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Auto-update 'updatedAt' on save
CourseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster querying

CourseSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Course', CourseSchema);