

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const {
  getProfile,
  updateProfile,
  changePassword,
} = require('../controllers/profileController');

//  routes need authentication then test
router.get('/me', authMiddleware, getProfile);
router.patch('/update', authMiddleware, updateProfile);
router.post('/change-password', authMiddleware, changePassword);

module.exports = router;