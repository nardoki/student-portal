const Group = require('../models/groupSchema');
const GroupMembership = require('../models/groupMembershipSchema');
const User = require('../models/userSchema');
const { ObjectId } = require('mongoose').Types;



// Update group details (admin or group creator)
const updateGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { name, description } = req.body;

    // Validate ObjectId
    if (!ObjectId.isValid(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }


    // Teachers can only update groups they created or are creators of
    if (
      req.user.role === 'teacher' &&
      !group.creators.some(creator => creator.toString() === req.user._id.toString()) &&
      group.created_by.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'Teachers can only update groups they created or are assigned as creators' });
    }

    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    await group.save();

    res.json({ id: group._id, name: group.name, description: group.description, created_by: group.created_by });
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
      return res.status(400).json({ error: 'Group ID, user ID, and role in group are required' });
    }
    if (!ObjectId.isValid(groupId) || !ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid group ID or user ID' });
    }
    if (!['member', 'creator'].includes(role_in_group)) {
      return res.status(400).json({ error: 'Role in group must be member or creator' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }


    // Only admins or teachers can be creators
    if (role_in_group === 'creator' && user.role !== 'teacher' && user.role !== 'admin') {
      return res.status(400).json({ error: 'Only teachers or admins can be group creators' });
    }


    // Teachers can only add to groups they created or are creators of
    if (
      req.user.role === 'teacher' &&
      !group.creators.some(creator => creator.toString() === req.user._id.toString()) &&
      group.created_by.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'Teachers can only add users to groups they created or are assigned as creators' });
    }


    // Check if user is already a member
    const existingMembership = await GroupMembership.findOne({ group_id: groupId, user_id: userId });
    if (existingMembership) {
      return res.status(400).json({ error: 'User is already a member of this group' });
    }


    // Create membership
    const membership = new GroupMembership({
      user_id: userId,
      group_id: groupId,
      role_in_group
    });
    await membership.save();



    // Update group creators array if role is creator
    if (role_in_group === 'creator' && !group.creators.includes(userId)) {
      group.creators.push(userId);
      await group.save();
    }

    res.status(201).json({ message: 'User added to group', membership });
  } catch (error) {
    next(error);
  }
};


// Remove user from group (admin or group creator)
const removeUserFromGroup = async (req, res, next) => {
  try {
    const { groupId, userId } = req.params;


    // Validate ObjectId
    if (!ObjectId.isValid(groupId) || !ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid group ID or user ID' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }



    // Teachers can only remove from groups they created or are creators of
    if (
      req.user.role === 'teacher' &&
      !group.creators.some(creator => creator.toString() === req.user._id.toString()) &&
      group.created_by.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ error: 'Teachers can only remove users from groups they created or are assigned as creators' });
    }


    // Prevent removing the primary creator
    if (group.created_by.toString() === userId) {
      return res.status(400).json({ error: 'Cannot remove the primary group creator' });
    }

    const membership = await GroupMembership.findOneAndDelete({ group_id: groupId, user_id: userId });
    if (!membership) {
      return res.status(404).json({ error: 'User is not a member of this group' });
    }


    // Remove from creators array if applicable
    if (membership.role_in_group === 'creator') {
      group.creators = group.creators.filter(creator => creator.toString() !== userId);
      await group.save();
    }

    res.json({ message: 'User removed from group' });
  } catch (error) {
    next(error);
  }
};




// List user’s groups (admin sees all, others see their groups)
const listUserGroups = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    let groups;
    let total;
    if (req.user.role === 'admin') {
      groups = await Group.find({}).skip(skip).limit(parseInt(limit));
      total = await Group.countDocuments();
    } else {
      const memberships = await GroupMembership.find({ user_id: req.user._id })
        .select('group_id')
        .skip(skip)
        .limit(parseInt(limit));
      const groupIds = memberships.map(m => m.group_id);
      groups = await Group.find({ _id: { $in: groupIds } });
      total = await GroupMembership.countDocuments({ user_id: req.user._id });
    }

    res.json({ groups, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};



// List group members (admin or group members)
const listGroupMembers = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { page = 1, limit = 10 } = req.query;


    // Validate ObjectId
    if (!ObjectId.isValid(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    
    // Check if user is a group member or admin
    if (req.user.role !== 'admin') {
      const membership = await GroupMembership.findOne({ group_id: groupId, user_id: req.user._id });
      if (!membership) {
        return res.status(403).json({ error: 'Access denied: not a group member' });
      }
    }

    const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);
    const memberships = await GroupMembership.find({ group_id: groupId })
      .populate('user_id', 'name role')
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await GroupMembership.countDocuments({ group_id: groupId });

    const members = memberships.map(m => ({
      user_id: m.user_id._id,
      name: m.user_id.name,
      role: m.user_id.role,
      role_in_group: m.role_in_group
    }));

    res.json({
      group_name: group.name,
      members_count: members.length,
      members,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
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