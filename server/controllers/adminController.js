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




// Create user (admin or teacher)
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const creator = req.user;

    // Validate input
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }
    if (!['student', 'teacher', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be student, teacher, or admin' });
    }




    // Prevent creating admins unless creator is an admin
    if (role === 'admin' && creator.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create other admins' });
    }




    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }




    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);



    // Create user
    const user = new User({
      name,
      email,
      password_hash,
      role,
      status: 'active',
      approvalStatus: 'approved', // Auto-approved for admin/teacher cretae

      createdBy: creator._id
    });

    await user.save();

    res.status(201).json({
      id: user._id,
      name,
      email,
      role,
      status: user.status,
      approvalStatus: user.approvalStatus
    });
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
      return res.status(400).json({ error: 'User is not pending approval' });
    }

    user.approvalStatus = 'approved';
    await user.save();

    res.json({ message: 'User approved successfully', userId });
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
      return res.status(400).json({ error: 'Status must be active or inactive' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }



    // Teachers cannot deactivate admins
    if (req.user.role === 'teacher' && user.role === 'admin') {
      return res.status(403).json({ error: 'Teachers cannot modify admin status' });
    }

    user.status = status;
    await user.save();

    res.json({ id: user._id, status: user.status });
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
      return res.status(403).json({ error: 'Teachers cannot delete admins' });
    }

    await User.findByIdAndDelete(userId);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};




// Create group (admin or teacher)
const createGroup = async (req, res, next) => {
  try {
    const { name, description  } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Group name is required' });
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

    res.status(201).json({ id: group._id, name, description: group.description, created_by: req.user._id });
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
      return res.status(403).json({ error: 'Teachers can only delete groups they created' });
    }

    await Group.findByIdAndDelete(groupId);
    await GroupMembership.deleteMany({ group_id: groupId });

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    next(error);
  }
};


module.exports = {
  getAllUsers,
  createUser,
  approveUser,
  updateUserStatus,
  deleteUser,
  createGroup,
  deleteGroup
};


