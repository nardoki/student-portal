const express = require('express');
const router = express.Router();
const { authMiddleware, restrictTo } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const fileController = require('../controllers/fileController');

// Upload file to a group (admin or group creator)
router.post('/', 
  authMiddleware, 
  restrictTo('admin', 'teacher'), 
  upload.array('files', 5), 
  fileController.uploadFile
);
//list files

router.get('/group/:groupId', authMiddleware, fileController.listFiles);


// Download file (admin or group member)
router.get('/:fileId', 
  authMiddleware, 
  fileController.downloadFile
);

// Delete file (admin or file uploader)
router.delete('/:fileId', 
  authMiddleware, 
  restrictTo('admin', 'teacher'), 
  fileController.deleteFile
);

module.exports = router;