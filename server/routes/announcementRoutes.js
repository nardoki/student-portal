const express = require('express');
const router = express.Router();
const { authMiddleware, restrictTo, restrictToGroupCreatorOrAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const announcementController = require('../controllers/announcementController');

router.post('/:groupId/announcements', 
  authMiddleware, 
  restrictTo('admin', 'teacher'), 
  restrictToGroupCreatorOrAdmin, 
  upload.array('files', 5), 
  announcementController.createAnnouncement
);

router.get('/:groupId/announcements', authMiddleware, announcementController.listAnnouncements);
router.get('/:id', authMiddleware, announcementController.viewAnnouncement);
router.patch('/:id', authMiddleware, restrictTo('admin', 'teacher'), announcementController.updateAnnouncement);
router.delete('/:id', authMiddleware, restrictTo('admin', 'teacher'), announcementController.deleteAnnouncement);

module.exports = router;

