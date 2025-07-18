const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const groupSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100
  },
 description: {    
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },

  created_by: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  creators: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

module.exports = mongoose.model('Group', groupSchema);