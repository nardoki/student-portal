const express = require('express');
const router = express.Router();
const { authMiddleware, restrictTo } = require('../middleware/auth');
const { upload, handleUploadErrors } = require('../middleware/upload');
const fileController = require('../controllers/fileController');

// File upload route with proper middleware chaining
router.post(
  '/',
  authMiddleware,
  restrictTo('admin', 'teacher'),
  upload.array('files', 5),
  handleUploadErrors,
  fileController.uploadFile
);

// File listing 
router.get('/group/:groupId', authMiddleware, fileController.listFiles);

// File download 
router.get('/:fileId', authMiddleware, fileController.downloadFile);

// File deletion 
router.delete(
  '/:fileId',
  authMiddleware,
  restrictTo('admin', 'teacher'),
  fileController.deleteFile
);

module.exports = router;