
const express = require('express');
const router = express.Router();
const { authMiddleware, restrictTo } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const announcementController = require('../controllers/announcementController');


// Create announcement (admin or group creator, with file uploads)
router.post('/', 
  authMiddleware, 
  restrictTo('admin', 'teacher'), 
  upload.array('attachments', 5), 
  announcementController.createAnnouncement
);


// List announcements (all roles, with pagination)
router.get('/', authMiddleware, announcementController.listAnnouncements);


// View single announcement (admin or group members)
router.get('/:id', authMiddleware, announcementController.viewAnnouncement);


// Update announcement (admin or announcement creator)
router.patch('/:id', 
  authMiddleware, 
  restrictTo('admin', 'teacher'), 
  announcementController.updateAnnouncement
);


// Delete announcement (admin or announcement creator)
router.delete('/:id', 
  authMiddleware, 
  restrictTo('admin', 'teacher'), 
  announcementController.deleteAnnouncement
);

module.exports = router;