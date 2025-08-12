const bcrypt = require('bcryptjs');
const User = require('../models/userSchema');
const Group = require('../models/groupSchema');
const GroupMembership = require('../models/groupMembershipSchema');

// Get all users (admin or teacher)
const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find({}, 'name email role status approvalStatus createdBy created_at');
    res.json(users);
  } catch (error) {
    next(error);
  }
};

// Approve pending student registration 
const approveUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.approvalStatus !== 'pending') {
      return res.status(400).json({ 
        error: 'Invalid approval operation',
        message: 'User is not pending approval' 
      });
    }

    user.approvalStatus = 'approved';
    await user.save();

    res.json({ 
      message: 'User approved successfully',
      userId: user._id,
      approvalStatus: user.approvalStatus 
    });
  } catch (error) {
    next(error);
  }
};

// Update user status (admin or teacher)
const updateUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const userId = req.params.id;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status value',
        message: 'Status must be active or inactive' 
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Teachers cannot deactivate admins
    if (req.user.role === 'teacher' && user.role === 'admin') {
      return res.status(403).json({ 
        error: 'Permission denied',
        message: 'Teachers cannot modify admin status' 
      });
    }

    user.status = status;
    await user.save();

    res.json({ 
      id: user._id, 
      status: user.status,
      message: 'User status updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Delete user (admin or teacher, with restrictions)
const deleteUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Teachers cannot delete admins
    if (req.user.role === 'teacher' && user.role === 'admin') {
      return res.status(403).json({ 
        error: 'Permission denied',
        message: 'Teachers cannot delete admin accounts' 
      });
    }

    await User.findByIdAndDelete(userId);
    res.json({ 
      message: 'User deleted successfully',
      deletedUserId: userId 
    });
  } catch (error) {
    next(error);
  }
};

// Create group (admin or teacher)
const createGroup = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ 
        error: 'Missing required field',
        message: 'Group name is required' 
      });
    }

    const group = new Group({
      name,
      description: description || '',
      created_by: req.user._id,
      creators: [req.user._id]
    });

    await group.save();

    // Add creator to group membership
    const membership = new GroupMembership({
      user_id: req.user._id,
      group_id: group._id,
      role_in_group: 'creator'
    });

    await membership.save();

    res.status(201).json({ 
      id: group._id, 
      name: group.name,
      description: group.description, 
      created_by: req.user._id,
      message: 'Group created successfully'
    });
  } catch (error) {
    next(error);
  }
};


// Delete group (admin or primary creator)
const deleteGroup = async (req, res, next) => {
  try {
    const groupId = req.params.groupId;
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Teachers can only delete groups they created
    if (req.user.role === 'teacher' && group.created_by.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        error: 'Permission denied',
        message: 'Teachers can only delete groups they created' 
      });
    }

    await Group.findByIdAndDelete(groupId);
    await GroupMembership.deleteMany({ group_id: groupId });

    res.json({ 
      message: 'Group deleted successfully',
      deletedGroupId: groupId 
    });
  } catch (error) {
    next(error);
  }
};

// new idea from mhret
// Get recent activity for admin dashboard
const getRecentActivity = async (req, res, next) => {
  try {
    // Get recent activities from various sources
    const [recentUsers, recentAnnouncements, recentReplies, recentGroups] = await Promise.all([
      User.find({}).sort({ createdAt: -1 }).limit(3).select('name email role createdAt'),
      Announcement.find({}).sort({ created_at: -1 }).limit(3).populate('created_by', 'name'),
      DiscussionReply.find({}).sort({ created_at: -1 }).limit(3).populate('created_by', 'name'),
      Group.find({}).sort({ createdAt: -1 }).limit(3).select('name createdAt')
    ]);

    const activities = [];

    // Add user activities
    recentUsers.forEach(user => {
      activities.push({
        id: `user_${user._id}`,
        text: `${user.name} (${user.email}) joined as ${user.role}`,
        time: user.createdAt,
        type: 'user_joined',
        icon: '👤'
      });
    });

    // Add announcement activities
    recentAnnouncements.forEach(announcement => {
      activities.push({
        id: `announcement_${announcement._id}`,
        text: `${announcement.created_by?.name || 'Admin'} created announcement: ${announcement.title || announcement.content.substring(0, 50)}`,
        time: announcement.created_at,
        type: 'announcement_created',
        icon: '📢'
      });
    });

    // Add reply activities
    recentReplies.forEach(reply => {
      activities.push({
        id: `reply_${reply._id}`,
        text: `${reply.created_by?.name || 'User'} replied to ${reply.parent_type}`,
        time: reply.created_at,
        type: 'reply_created',
        icon: '💬'
      });
    });

    // Add group activities
    recentGroups.forEach(group => {
      activities.push({
        id: `group_${group._id}`,
        text: `New group created: ${group.name}`,
        time: group.createdAt,
        type: 'group_created',
        icon: '👥'
      });
    });

    // Sort by time (most recent first) and take top 5
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    
    // Format time for display and limit to top 5
    const formattedActivities = activities.slice(0, 5).map(activity => ({
      ...activity,
      time: formatTimeAgo(activity.time)
    }));

    res.json({ activities: formattedActivities });
  } catch (error) {
    next(error);
  }
};

// Get activity feed with pagination
const getActivityFeed = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    // Similar logic to getRecentActivity but with pagination
    const [recentUsers, recentAnnouncements, recentReplies, recentGroups] = await Promise.all([
      User.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).select('name email role createdAt'),
      Announcement.find({}).sort({ created_at: -1 }).skip(skip).limit(limit).populate('created_by', 'name'),
      DiscussionReply.find({}).sort({ created_at: -1 }).skip(skip).limit(limit).populate('created_by', 'name'),
      Group.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).select('name createdAt')
    ]);

    // Combine and format activities (similar to getRecentActivity)
    const activities = [];
    // ... (same logic as getRecentActivity)

    res.json({ 
      activities: activities.slice(0, limit),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: activities.length
      }
    });
  } catch (error) {
    next(error);
  }
};

// Helper function to format time ago
const formatTimeAgo = (date) => {
  const now = new Date();
  const timeDiff = now - new Date(date);
  const minutes = Math.floor(timeDiff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr ago`;
  if (days < 7) return `${days} days ago`;
  return new Date(date).toLocaleDateString();
};




module.exports = {
  getAllUsers,
  approveUser,
  updateUserStatus,
  deleteUser,
  createGroup,
  deleteGroup,
  getRecentActivity,
  getActivityFeed
};




