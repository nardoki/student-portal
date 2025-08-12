const express = require('express');
const router = express.Router();
const { authMiddleware, restrictTo, restrictDelete } = require('../middleware/auth');
const adminController = require('../controllers/adminController');


// Get recent activity
router.get('/activity/recent', authMiddleware, restrictTo('admin'), adminController.getRecentActivity);

// Get activity feed
router.get('/activity', authMiddleware, restrictTo('admin'), adminController.getActivityFeed);

// Get all users 
router.get('/users', authMiddleware, restrictTo('admin', 'teacher'), adminController.getAllUsers);

// Approve pending student registration (adminand teacher)
router.patch('/users/:id/approve', authMiddleware, restrictTo('admin','teacher'), adminController.approveUser);

// Update user status (admin or teacher)
router.patch('/users/:id/status', authMiddleware, restrictTo('admin', 'teacher'), adminController.updateUserStatus);

// Delete user  with restrictions
router.delete('/users/:id', authMiddleware, restrictTo('admin', 'teacher'), restrictDelete, adminController.deleteUser);

// Create group 
router.post('/groups', authMiddleware, restrictTo('admin', 'teacher'), adminController.createGroup);

// Delete group (admin or primary creator)
router.delete('/groups/:groupId', authMiddleware, restrictTo('admin', 'teacher'), restrictDelete, adminController.deleteGroup);

module.exports = router;