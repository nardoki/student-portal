const Group = require('../models/groupSchema');
const GroupMembership = require('../models/groupMembershipSchema');
const User = require('../models/userSchema');
const { ObjectId } = require('mongoose').Types;

//  error responses
const errorResponse = (res, status, error, message = null) => {
  return res.status(status).json({ 
    error,
    ...(message && { message }) 
  });
};

// Update group details (admin or group creator)
const updateGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;

    if (!ObjectId.isValid(groupId)) {
      return errorResponse(res, 400, 'Invalid ID', 'Invalid group ID format');
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return errorResponse(res, 404, 'Not found', 'Group not found');
    }

    // Check permissions
    const isCreator = group.creators.some(c => c.equals(req.user._id));
    if (req.user.role === 'teacher' && !isCreator && !group.created_by.equals(req.user._id)) {
      return errorResponse(res, 403, 'Permission denied', 'Teachers can only update groups they created');
    }

    // Update fields
    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    await group.save();

    res.json({ 
      id: group._id, 
      name: group.name, 
      description: group.description,
      message: 'Group updated successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Add user to group (admin or group creator)
const addUserToGroup = async (req, res, next) => {
  try {
    const { groupId, userId, role_in_group } = req.body;

    // Validate input
    if (!groupId || !userId || !role_in_group) {
      return errorResponse(res, 400, 'Missing fields', 'All fields are required');
    }
    if (!ObjectId.isValid(groupId) || !ObjectId.isValid(userId)) {
      return errorResponse(res, 400, 'Invalid ID', 'Invalid group or user ID format');
    }
    if (!['member', 'creator'].includes(role_in_group)) {
      return errorResponse(res, 400, 'Invalid role', 'Role must be member or creator');
    }

    const [group, user] = await Promise.all([
      Group.findById(groupId),
      User.findById(userId)
    ]);

    if (!group) return errorResponse(res, 404, 'Not found', 'Group not found');
    if (!user) return errorResponse(res, 404, 'Not found', 'User not found');

    // Role validation
    if (role_in_group === 'creator' && !['teacher', 'admin'].includes(user.role)) {
      return errorResponse(res, 400, 'Invalid role', 'Only teachers/admins can be creators');
    }

    // Permission check
    const isCreator = group.creators.some(c => c.equals(req.user._id));
    if (req.user.role === 'teacher' && !isCreator && !group.created_by.equals(req.user._id)) {
      return errorResponse(res, 403, 'Permission denied', 'Insufficient group permissions');
    }

    // Check existing membership
    const existingMembership = await GroupMembership.findOne({ 
      group_id: groupId, 
      user_id: userId 
    });
    if (existingMembership) {
      return errorResponse(res, 400, 'Duplicate entry', 'User already in group');
    }

    // Create membership
    const membership = new GroupMembership({
      user_id: userId,
      group_id: groupId,
      role_in_group
    });
    await membership.save();

    // Update creators 
    if (role_in_group === 'creator' && !group.creators.some(c => c.equals(userId))) {
      group.creators.push(userId);
      await group.save();
    }

    res.status(201).json({ 
      message: 'User added to group',
      membership: {
        id: membership._id,
        user_id: membership.user_id,
        group_id: membership.group_id,
        role: membership.role_in_group
      }
    });
  } catch (error) {
    next(error);
  }
};

// Remove user from group (admin or group creator)
const removeUserFromGroup = async (req, res, next) => {
  try {
    const { groupId, userId } = req.params;

    if (!ObjectId.isValid(groupId) || !ObjectId.isValid(userId)) {
      return errorResponse(res, 400, 'Invalid ID', 'Invalid group or user ID format');
    }

    const group = await Group.findById(groupId);
    if (!group) return errorResponse(res, 404, 'Not found', 'Group not found');

    // Permission check
    const isCreator = group.creators.some(c => c.equals(req.user._id));
    if (req.user.role === 'teacher' && !isCreator && !group.created_by.equals(req.user._id)) {
      return errorResponse(res, 403, 'Permission denied', 'Insufficient group permissions');
    }

    // Prevent removing primary creator
    if (group.created_by.equals(userId)) {
      return errorResponse(res, 400, 'Invalid operation', 'Cannot remove primary creator');
    }

    const membership = await GroupMembership.findOneAndDelete({ 
      group_id: groupId, 
      user_id: userId 
    });
    
    if (!membership) {
      return errorResponse(res, 404, 'Not found', 'Membership not found');
    }

    // Update creators 
    if (membership.role_in_group === 'creator') {
      group.creators = group.creators.filter(c => !c.equals(userId));
      await group.save();
    }

    res.json({ 
      message: 'User removed from group',
      removed_user_id: userId,
      group_id: groupId
    });
  } catch (error) {
    next(error);
  }
};



// List user's groups
const listUserGroups = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Math.max(1, page) - 1) * limit;
    const queryLimit = Math.min(parseInt(limit), 100);

    let query, total;
    if (req.user.role === 'admin') {
      query = Group.find({}).skip(skip).limit(queryLimit);
      total = await Group.countDocuments();
    } else {
      query = GroupMembership.find({ user_id: req.user._id })
        .populate('group_id')
        .skip(skip)
        .limit(queryLimit);
      total = await GroupMembership.countDocuments({ user_id: req.user._id });
    }

    const results = await query.exec();
    const groups = req.user.role === 'admin' 
      ? results 
      : results.map(m => m.group_id);

    res.json({ 
      groups,
      pagination: { 
        page: parseInt(page),
        limit: queryLimit,
        total,
        pages: Math.ceil(total / queryLimit) 
      }
    });
  } catch (error) {
    next(error);
  }
};


// List group members
const listGroupMembers = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const queryLimit = Math.min(parseInt(limit), 100);

    if (!ObjectId.isValid(groupId)) {
      return errorResponse(res, 400, 'Invalid ID', 'Invalid group ID format');
    }

    const group = await Group.findById(groupId);
    if (!group) return errorResponse(res, 404, 'Not found', 'Group not found');

    // Permission check
    if (req.user.role !== 'admin') {
      const isMember = await GroupMembership.exists({ 
        group_id: groupId, 
        user_id: req.user._id 
      });
      if (!isMember) {
        return errorResponse(res, 403, 'Permission denied', 'Not a group member');
      }
    }

    const skip = (Math.max(1, page) - 1) * queryLimit;
    const [memberships, total] = await Promise.all([
      GroupMembership.find({ group_id: groupId })
        .populate('user_id', 'name email role')
        .skip(skip)
        .limit(queryLimit),
      GroupMembership.countDocuments({ group_id: groupId })
    ]);

    const members = memberships.map(m => ({
      user_id: m.user_id._id,
      name: m.user_id.name,
      email: m.user_id.email,
      role: m.user_id.role,
      role_in_group: m.role_in_group
    }));

    res.json({
      group_name: group.name,
      members,
      pagination: { 
        page: parseInt(page),
        limit: queryLimit,
        total,
        pages: Math.ceil(total / queryLimit) 
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateGroup,
  addUserToGroup,
  removeUserFromGroup,
  listUserGroups,
  listGroupMembers
};