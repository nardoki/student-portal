const express = require('express');
const router = express.Router();
const { authMiddleware, restrictTo } = require('../middleware/auth');
const groupController = require('../controllers/groupController');


// Update group details 
router.patch('/:groupId', authMiddleware, restrictTo('admin', 'teacher'), groupController.updateGroup);

// Add user to group 
router.post('/add-member', authMiddleware, restrictTo('admin', 'teacher'), groupController.addUserToGroup);


// Remove user from group 
router.delete('/:groupId/members/:userId', authMiddleware, restrictTo('admin', 'teacher'), groupController.removeUserFromGroup);



// List user's groups  admin sees all, others see their groups
router.get('/', authMiddleware, groupController.listUserGroups);


// List group members 
router.get('/:groupId/members', authMiddleware, groupController.listGroupMembers);

module.exports = router;