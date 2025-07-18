const jwt = require('jsonwebtoken');
const User = require('../models/userSchema');




// Middleware to verify JWT and attach user to request
const authMiddleware = async (req, res, next) => {
  try {

    // Get token from Authorization header (Bearer token)
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      throw new Error('Authentication required');
    }


    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    

    // Find user by ID and ensure they are active
    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new Error('User not found');
    }
    if (user.status !== 'active') {
      throw new Error('User account is inactive');
    }



    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
};



// Middleware to restrict access based on role
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    next();
  };
};



// Middleware to check group creator or admin access
const restrictToGroupCreatorOrAdmin = async (req, res, next) => {
  try {
    const groupId = req.params.groupId || req.body.group_id;
    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }

    const Group = require('../models/groupSchema');
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }



    // Admins have full access
    if (req.user.role === 'admin') {
      return next();
    }



    // Check if user is the primary creator or in the creators array
    if (req.user.role === 'teacher' && 
        (group.created_by.toString() === req.user._id.toString() || 
         group.creators.some(creator => creator.toString() === req.user._id.toString()))) {
      return next();
    }

    res.status(403).json({ error: 'Access denied: not a group creator or admin' });
  } catch (error) {
    res.status(500).json({ error: 'Server error during group access check' });
  }
};



// Middleware to prevent teachers from deleting admins or groups they don't own
const restrictDelete = async (req, res, next) => {
  try {
    const userId = req.params.id; // For user deletion
    const groupId = req.params.groupId; // For group deletion

    if (userId) {
      const userToDelete = await User.findById(userId);
      if (!userToDelete) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (req.user.role === 'teacher' && userToDelete.role === 'admin') {
        return res.status(403).json({ error: 'Teachers cannot delete admins' });
      }
    }

    if (groupId) {
      const Group = require('../models/groupSchema');
      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }
      if (req.user.role === 'teacher' && group.created_by.toString() !== req.user._id.toString()) {
        return res.status(403).json({ error: 'Teachers can only delete groups they created' });
      }
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Server error during delete restriction check' });
  }
};

module.exports = {
  authMiddleware,
  restrictTo,
  restrictToGroupCreatorOrAdmin,
  restrictDelete
};