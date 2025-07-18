const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const groupMembershipSchema = new Schema({
  user_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  group_id: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  role_in_group: {
    type: String,
    enum: ['member', 'creator'],
    required: true
  },
  joined_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

groupMembershipSchema.index({ user_id: 1, group_id: 1 }, { unique: true });

module.exports = mongoose.model('GroupMembership', groupMembershipSchema);