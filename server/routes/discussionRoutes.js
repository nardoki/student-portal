const express = require('express');
const router = express.Router();
const { authMiddleware,restrictTo } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const discussionController = require('../controllers/discussionController');

router.post('/:groupId/posts', authMiddleware, upload.array('files', 5), discussionController.createPost);
router.get('/:groupId/posts', authMiddleware, discussionController.listPosts);
router.get('/:groupId/posts/:postId', authMiddleware, discussionController.viewPost);
router.patch('/:groupId/posts/:postId', authMiddleware, discussionController.updatePost);
router.delete('/:groupId/posts/:postId', authMiddleware, discussionController.deletePost);
router.post('/:groupId/replies', authMiddleware, upload.array('files', 5), discussionController.createReply);
router.patch(
  '/:groupId/replies/:replyId', 
  authMiddleware,
  discussionController.updateReply
);
router.delete(
  '/:groupId/replies/:replyId',
  authMiddleware,
  discussionController.deleteReply
);






// Get recent replies (admin only)
router.get('/replies/recent', authMiddleware, restrictTo('admin'), discussionController.getRecentReplies);

// Get recent posts (admin only)
router.get('/posts/recent', authMiddleware, restrictTo('admin'), discussionController.getRecentPosts);




module.exports = router;