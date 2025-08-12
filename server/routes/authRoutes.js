const express = require('express');
const router = express.Router();
const { authMiddleware, restrictTo } = require('../middleware/auth');
const authController = require('../controllers/authController');

// Student registration (public)
router.post('/register', authController.registerStudent);

// Admin/teacher user creation (protected)
router.post('/users', authMiddleware, restrictTo('admin', 'teacher'), authController.createUser);

// Login (public)
router.post('/login', authController.login);




// Get current user (protected)
router.get('/me', authMiddleware, authController.getCurrentUser);

module.exports = router;





