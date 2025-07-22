const express = require('express');
const router = express.Router();
const { authMiddleware, restrictTo } = require('../middleware/auth');
const groupController = require('../controllers/groupController');


// Update group details (admin or group creator)
router.patch('/:groupId', authMiddleware, restrictTo('admin', 'teacher'), groupController.updateGroup);

// Add user to group (admin or group creator)
router.post('/add-member', authMiddleware, restrictTo('admin', 'teacher'), groupController.addUserToGroup);


// Remove user from group (admin or group creator)
router.delete('/:groupId/members/:userId', authMiddleware, restrictTo('admin', 'teacher'), groupController.removeUserFromGroup);



// List user's groups (all roles: admin sees all, others see their groups)
router.get('/', authMiddleware, groupController.listUserGroups);


// List group members (admin or group members)
router.get('/:groupId/members', authMiddleware, groupController.listGroupMembers);

module.exports = router;