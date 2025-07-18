const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const fileSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  path: {
    type: String,
    required: true // Path to file in cloud storage (e.g., S3 URL)
  },
  type: {
    type: String,
    trim: true,
    maxlength: 20 // e.g., 'pdf', 'docx', 'jpg'
  },
  uploaded_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  group_id: {
    type: Schema.Types.ObjectId,
    ref: 'Group',
    default: null // Nullable for discussion attachments
  },
  uploaded_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

fileSchema.index({ group_id: 1 });

module.exports = mongoose.model('File', fileSchema);