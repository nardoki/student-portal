const express = require('express');
const router = express.Router();
const { authMiddleware, restrictToGroupCreatorOrAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const discussionController = require('../controllers/discussionController');

router.post('/:groupId/posts', authMiddleware, upload.array('files', 5), discussionController.createPost);
router.get('/:groupId/posts', authMiddleware, discussionController.listPosts);
router.get('/:postId', authMiddleware, discussionController.viewPost);
router.patch('/:postId', authMiddleware, restrictToGroupCreatorOrAdmin, discussionController.updatePost);
router.delete('/:postId', authMiddleware, restrictToGroupCreatorOrAdmin, discussionController.deletePost);
router.post('/:groupId/replies', authMiddleware, upload.array('files', 5), discussionController.createReply);
router.patch('/:postId/replies/:replyId', authMiddleware, restrictToGroupCreatorOrAdmin, discussionController.updateReply);
router.delete('/:postId/replies/:replyId', authMiddleware, restrictToGroupCreatorOrAdmin, discussionController.deleteReply);

module.exports = router;