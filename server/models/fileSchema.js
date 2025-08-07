const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const fileSchema = new Schema({
  filename: {
    type: String,
    required: true,
    trim: true
  },
  drive_file_id: {
    type: String,
    required: true
  },
  webViewLink: {
    type: String,
    required: true
  },
  webContentLink: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  uploaded_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  group_id: {
    type: Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('File', fileSchema);

