const express = require('express');
const router = express.Router();
const {
  authAdmin,
  getUsers,
  approveUser,
  approveUsersBulk,
  deactivateUser,
  createCourse,
  updateCourse,
  deleteCourse,
  getCourseDetails,
  createClass,
  updateClass,
  deleteClass,
  getCourses,
  getClasses,
} = require('../controllers/adminController');
/*const {
  validateCreateCourse,
  validateUpdateCourse,
  validateCreateClass,
  validateUpdateClass,
  validateBulkApprove,
  validateDeactivateUser,
} = require('../middleware/validateAdmin');*/

// Apply admin middleware globally
router.use(authAdmin);

// User Management
router.get('/users', getUsers);
router.patch('/users/:userId/approve', approveUser);
router.patch('/users/:userId/deactivate', /*validateDeactivateUser,*/ deactivateUser);
router.post('/users/bulk-approve', /*validateBulkApprove, */approveUsersBulk);

// Course Management
router.post('/courses', /*validateCreateCourse,*/ createCourse);
router.patch('/courses/:courseId', /*validateUpdateCourse,*/ updateCourse);
router.delete('/courses/:courseId', deleteCourse);
router.get('/courses', getCourses);
router.get('/courses/:courseId', getCourseDetails);

// Class Management
router.post('/classes', /*validateCreateClass,*/ createClass);
router.patch('/classes/:classId', /*validateUpdateClass,*/ updateClass);
router.delete('/classes/:classId', deleteClass);
router.get('/classes', getClasses);

module.exports = router;