const express = require('express');
const router = express.Router();
const uploadMiddleware = require('../middleware/upload');
const { authMiddleware, restrictToGroupCreatorOrAdmin } = require('../middleware/auth');
const fileController = require('../controllers/fileController');

// Upload file (teachers/admins to groups, users to discussions)
router.post('/', authMiddleware, uploadMiddleware, fileController.uploadFile);

// Download file (group members only)
router.get('/:id', authMiddleware, fileController.downloadFile);

module.exports = router;

