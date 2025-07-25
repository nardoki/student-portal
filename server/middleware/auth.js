const jwt = require('jsonwebtoken');
const User = require('../models/userSchema');
const Group = require('../models/groupSchema');
const DiscussionPost = require('../models/discussionPostSchema');
const DiscussionReply = require('../models/discussionReplySchema');

// Standard error response format
const errorResponse = (res, status, error, message = null) => {
  return res.status(status).json({ 
    error,
    ...(message && { message }) 
  });
};

// Middleware to verify JWT and attach user to request
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header (Bearer token)
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return errorResponse(res, 401, 'Authentication required', 'No token provided');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user by ID and ensure they are active
    const user = await User.findById(decoded.userId);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    if (user.status !== 'active') {
      return errorResponse(res, 403, 'Account inactive', 'User account is not active');
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 401, 'Invalid token', 'Authentication failed');
    }
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 401, 'Token expired', 'Please log in again');
    }
    errorResponse(res, 500, 'Authentication error', error.message);
  }
};

// Middleware to restrict access based on role
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return errorResponse(
        res, 
        403, 
        'Access denied', 
        `Required roles: ${roles.join(', ')}`
      );
    }
    next();
  };
};

// Middleware to check group creator or admin access
const restrictToGroupCreatorOrAdmin = async (req, res, next) => {
  try {
    const { groupId, postId, replyId } = req.params;
    if (!groupId) {
      return errorResponse(res, 400, 'Missing parameter', 'Group ID is required');
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return errorResponse(res, 404, 'Not found', 'Group not found');
    }

    // Initialize creators array if not exists
    group.creators = group.creators || [];
    
    // Admins have full access
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user is the primary creator or in creators array
    const isGroupCreator = group.created_by.equals(req.user._id) || 
      group.creators.some(creator => creator.equals(req.user._id));

    // Check post permissions
    if (postId) {
      const post = await DiscussionPost.findById(postId);
      if (!post) {
        return errorResponse(res, 404, 'Not found', 'Post not found');
      }
      if (post.group_id.toString() !== groupId) {
        return errorResponse(res, 400, 'Invalid group', 'Post does not belong to the specified group');
      }
      if (req.user.role === 'teacher' && (post.created_by.equals(req.user._id) || isGroupCreator)) {
        return next();
      }
    }
    // Check reply permissions
    else if (replyId) {
      const reply = await DiscussionReply.findById(replyId);
      if (!reply) {
        return errorResponse(res, 404, 'Not found', 'Reply not found');
      }
      if (reply.group_id.toString() !== groupId) {
        return errorResponse(res, 400, 'Invalid group', 'Reply does not belong to the specified group');
      }
      if (req.user.role === 'teacher' && (reply.created_by.equals(req.user._id) || isGroupCreator)) {
        return next();
      }
    }
    // General group creator check
    else if (req.user.role === 'teacher' && isGroupCreator) {
      return next();
    }

    return errorResponse(
      res, 
      403, 
      'Access denied', 
      'Not a group creator or admin'
    );
  } catch (error) {
    errorResponse(res, 500, 'Server error', 'Failed to verify group access');
  }
};

// Middleware to prevent teachers from deleting admins or groups they don't own
const restrictDelete = async (req, res, next) => {
  try {
    const { id: userId, groupId } = req.params;

    if (userId) {
      const userToDelete = await User.findById(userId);
      if (!userToDelete) {
        return errorResponse(res, 404, 'Not found', 'User not found');
      }
      if (req.user.role === 'teacher' && userToDelete.role === 'admin') {
        return errorResponse(
          res, 
          403, 
          'Access denied', 
          'Teachers cannot delete admin accounts'
        );
      }
    }

    if (groupId) {
      const group = await Group.findById(groupId);
      if (!group) {
        return errorResponse(res, 404, 'Not found', 'Group not found');
      }
      if (req.user.role === 'teacher' && group.created_by.toString() !== req.user._id.toString()) {
        return errorResponse(
          res, 
          403, 
          'Access denied', 
          'Teachers can only delete groups they created'
        );
      }
    }

    next();
  } catch (error) {
    errorResponse(res, 500, 'Server error', 'Failed to verify delete permissions');
  }
};

module.exports = {
  authMiddleware,
  restrictTo,
  restrictToGroupCreatorOrAdmin,
  restrictDelete,
  errorResponse 
};