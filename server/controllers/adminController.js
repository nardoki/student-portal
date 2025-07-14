const User = require('../models/User');
const Course = require('../models/Course');
const Class = require('../models/Class');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Middleware to verify admin role
const authAdmin = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: Admin role required' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};


// List all users with details
const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').lean();
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        if (user.role === 'student') {
          const student = await Student.findOne({ userId: user._id }).select('studentId skillLevel enrollmentDate');
          return { ...user, studentDetails: student || {} };
        } else if (user.role === 'teacher') {
          const teacher = await Teacher.findOne({ userId: user._id }).select('teacherId expertise qualification');
          return { ...user, teacherDetails: teacher || {} };
        }
        return user;
      })
    );
    res.json(enrichedUsers);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Approve single user
const approveUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot approve admin accounts' });
    }
    if (user.approvalStatus === 'approved') {
      return res.status(400).json({ message: 'User already approved' });
    }
    user.approvalStatus = 'approved';
    await user.save();
    res.json({ message: 'User approved', user: user.toObject() });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};


// Approve multiple users
const approveUsersBulk = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userIds } = req.body;

    // 1. Validate input format
    if (!Array.isArray(userIds)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT_TYPE',
          message: 'userIds must be an array',
          received: typeof userIds
        }
      });
    }

    // 2. Validate array not empty
    if (userIds.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMPTY_ARRAY',
          message: 'userIds array cannot be empty'
        }
      });
    }

    // 3. Validate all IDs are valid MongoDB IDs
    const invalidIds = userIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_IDS',
          message: 'Some user IDs are invalid',
          invalidIds,
          exampleValidId: new mongoose.Types.ObjectId()
        }
      });
    }

    // 4. Check all users exist
    const users = await User.find({ 
      _id: { $in: userIds } 
    }).session(session);

    if (users.length !== userIds.length) {
      await session.abortTransaction();
      const foundIds = users.map(u => u._id.toString());
      const missingIds = userIds.filter(id => !foundIds.includes(id));
      return res.status(404).json({
        success: false,
        error: {
          code: 'USERS_NOT_FOUND',
          message: 'Some users not found',
          missingIds
        }
      });
    }

    // 5. Separate users by approval eligibility
    const results = {
      approved: [],
      alreadyApproved: [],
      invalidRole: [],
      admins: []
    };

    users.forEach(user => {
      if (user.role === 'admin') {
        results.admins.push(user._id);
      } else if (user.approvalStatus !== 'pending') {
        results.alreadyApproved.push({
          userId: user._id,
          currentStatus: user.approvalStatus
        });
      } else if (!['student', 'teacher'].includes(user.role)) {
        results.invalidRole.push({
          userId: user._id,
          role: user.role
        });
      } else {
        results.approved.push(user._id);
      }
    });

    // 6. If no users to approve
    if (results.approved.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_APPROVABLE_USERS',
          message: 'No users require approval',
          details: {
            alreadyApproved: results.alreadyApproved,
            admins: results.admins,
            invalidRoles: results.invalidRole
          }
        }
      });
    }

    // 7. Process approvals
    await User.updateMany(
      { _id: { $in: results.approved } },
      { $set: { approvalStatus: 'approved' } },
      { session }
    );

    // 8. Get updated user data
    const updatedUsers = await User.find(
      { _id: { $in: results.approved } },
      { password: 0, __v: 0 } // Exclude sensitive fields
    ).session(session).lean();

    await session.commitTransaction();

    // 9. Format success response
    res.json({
      success: true,
      data: {
        approvedCount: results.approved.length,
        approvedUsers: updatedUsers.map(user => ({
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role
        })),
        skipped: {
          count: userIds.length - results.approved.length,
          alreadyApproved: results.alreadyApproved,
          admins: results.admins,
          invalidRoles: results.invalidRole
        }
      }
    });

  } catch (error) {
    await session.abortTransaction();
    
    console.error('[BULK APPROVAL ERROR]', {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      input: req.body
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to process bulk approval',
        ...(process.env.NODE_ENV === 'development' && {
          details: error.message,
          stack: error.stack
        })
      }
    });
  } finally {
    session.endSession();
  }
};



// Deactivate user
const deactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (user.role === 'admin') {
      return res.status(400).json({ message: 'Cannot deactivate admin accounts' });
    }
    if (user.status === 'inactive') {
      return res.status(400).json({ message: 'User already deactivated' });
    }
    user.status = 'inactive';
    await user.save();
    res.json({ message: 'User deactivated', user: user.toObject() });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};



// create course
const createCourse = async (req, res) => {
  try {
    const { name, code, description, type, prerequisites } = req.body;

    // 1. Check for existing course (case-insensitive)
    const existingCourse = await Course.findOne({ 
      code: { $regex: new RegExp(`^${code}$`, 'i') } 
    });
    if (existingCourse) {
      return res.status(400).json({ message: 'Course code already exists' });
    }

    // 2. Validate prerequisites (if provided)
    if (prerequisites && prerequisites.length > 0) {
      const validPrerequisites = await Course.countDocuments({ 
        _id: { $in: prerequisites } 
      });
      if (validPrerequisites !== prerequisites.length) {
        return res.status(400).json({ message: 'One or more prerequisites are invalid' });
      }
    }

    // 3. Create course (auto-uppercase code, normalize type)
    const course = await Course.create({
      name: name.trim(),
      code: code.trim().toUpperCase(), // Ensures consistent formatting
      description: description?.trim(),
      type: type.trim().charAt(0).toUpperCase() + type.trim().slice(1).toLowerCase(),
      prerequisites: prerequisites || []
    });

    res.status(201).json({ 
      message: 'Course created successfully',
      course: {
        _id: course._id,
        code: course.code,
        type: course.type
      }
    });

  } catch (error) {
    // Handle specific errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: Object.values(error.errors).map(err => err.message) 
      });
    }
    res.status(500).json({ 
      message: 'Failed to create course',
      error: process.env.NODE_ENV === 'development' ? error.message : null 
    });
  }
};




// Update course
const updateCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { name, description, type, prerequisites } = req.body;

    // 1. Find course and validate existence
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // 2. Validate prerequisites (if provided)
    if (prerequisites && prerequisites.length > 0) {
      const validPrerequisites = await Course.countDocuments({ 
        _id: { $in: prerequisites } 
      });
      if (validPrerequisites !== prerequisites.length) {
        return res.status(400).json({ message: 'Invalid prerequisite course IDs' });
      }
    }

    // 3. Apply updates with sanitization
    if (name) course.name = name.trim();
    if (description) course.description = description.trim();
    if (type) {
      course.type = type.trim().charAt(0).toUpperCase() + 
                   type.trim().slice(1).toLowerCase();
    }
    if (prerequisites) course.prerequisites = prerequisites;

    // 4. Save and handle concurrent updates
    const updatedCourse = await course.save();

    res.json({ 
      message: 'Course updated successfully',
      course: {
        _id: updatedCourse._id,
        code: updatedCourse.code,
        name: updatedCourse.name,
        type: updatedCourse.type,
        updatedAt: updatedCourse.updatedAt
      }
    });

  } catch (error) {
    // Handle specific error types
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid course ID format' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Validation failed',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    res.status(500).json({
      message: 'Failed to update course',
      error: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
};




// Delete course
const deleteCourse = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { courseId } = req.params;

    // 1. Validate course ID format
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false,
        error: 'Invalid course ID format' 
      });
    }

    // 2. Find and validate course exists
    const course = await Course.findById(courseId).session(session);
    if (!course) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        error: 'Course not found' 
      });
    }

    // 3. Cascade delete operations
    await Promise.all([
      Class.deleteMany({ courseId }).session(session),
      Course.updateMany(
        { prerequisites: courseId },
        { $pull: { prerequisites: courseId } },
        { session }
      )
    ]);

    // 4. Delete the course (with error handling)
    const deletionResult = await Course.deleteOne({ _id: courseId }).session(session);
    
    if (deletionResult.deletedCount === 0) {
      throw new Error('Failed to delete course');
    }

    await session.commitTransaction();
    
    res.json({ 
      success: true,
      message: 'Course deleted successfully',
      data: {
        deletedId: courseId,
        code: course.code,
        classesRemoved: deletionResult.deletedCount
      }
    });

  } catch (error) {
    await session.abortTransaction();
    
    console.error('Course deletion error:', {
      error: error.message,
      stack: error.stack,
      courseId: req.params.courseId,
      timestamp: new Date()
    });

    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'development' 
        ? error.message 
        : 'Course deletion failed',
      ...(process.env.NODE_ENV === 'development' && {
        details: error.stack
      })
    });
  } finally {
    session.endSession();
  }
};


// Get course details
const getCourseDetails = async (req, res) => {
  try {
    const { courseId } = req.params;

    // 1. Validate course ID format
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Invalid course ID format' });
    }

    // 2. Find course with populated data
    const course = await Course.findById(courseId)
      .select('-__v -createdAt') // Exclude internal fields
      .populate({
        path: 'prerequisites',
        select: 'code name -_id', // Only get code and name
        options: { lean: true }
      })
      .lean(); // Convert to plain JS object

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // 3. Get related classes count (optional)
    const classCount = await Class.countDocuments({ courseId });

    // 4. Format response
    const response = {
      ...course,
      metadata: {
        classCount,
        lastUpdated: course.updatedAt
      }
    };

    res.json(response);

  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid course ID format' });
    }
    res.status(500).json({
      message: 'Failed to fetch course details',
      error: process.env.NODE_ENV === 'development' ? error.message : null
    });
  }
};




// Create class
const createClass = async (req, res) => {
  try {
    const { name, courseId, teacherId, studentIds, startDate, endDate, location, meetingLink } = req.body;
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    const teacher = await User.findById(teacherId);
    if (!teacher || teacher.role !== 'teacher' || teacher.approvalStatus !== 'approved' || teacher.status !== 'active') {
      return res.status(400).json({ message: 'Invalid, unapproved, or inactive teacher' });
    }
    const students = await User.find({ _id: { $in: studentIds }, role: 'student', approvalStatus: 'approved', status: 'active' });
    if (students.length !== studentIds.length) {
      return res.status(400).json({ message: 'Some students are invalid, unapproved, or inactive' });
    }
    const classDoc = await Class.create({
      name,
      courseId,
      teacherId,
      studentIds,
      startDate,
      endDate,
      location,
      meetingLink,
      status: 'upcoming',
    });
    await Teacher.updateOne({ userId: teacherId }, { $push: { classIds: classDoc._id } });
    await Student.updateMany({ userId: { $in: studentIds } }, { $push: { classIds: classDoc._id } });
    res.status(201).json({ message: 'Class created', class: classDoc });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};




// Update class
const updateClass = async (req, res) => {
  try {
    const { classId } = req.params;
    const { name, courseId, teacherId, studentIds, startDate, endDate, location, meetingLink, status } = req.body;
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' });
    }
    if (courseId) {
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }
      classDoc.courseId = courseId;
    }
    if (teacherId) {
      const teacher = await User.findById(teacherId);
      if (!teacher || teacher.role !== 'teacher' || teacher.approvalStatus !== 'approved' || teacher.status !== 'active') {
        return res.status(400).json({ message: 'Invalid, unapproved, or inactive teacher' });
      }
      await Teacher.updateOne({ userId: classDoc.teacherId }, { $pull: { classIds: classId } });
      await Teacher.updateOne({ userId: teacherId }, { $push: { classIds: classId } });
      classDoc.teacherId = teacherId;
    }
    if (studentIds) {
      const students = await User.find({ _id: { $in: studentIds }, role: 'student', approvalStatus: 'approved', status: 'active' });
      if (students.length !== studentIds.length) {
        return res.status(400).json({ message: 'Some students are invalid, unapproved, or inactive' });
      }
      await Student.updateMany({ userId: { $in: classDoc.studentIds } }, { $pull: { classIds: classId } });
      await Student.updateMany({ userId: { $in: studentIds } }, { $push: { classIds: classId } });
      classDoc.studentIds = studentIds;
    }
    classDoc.name = name || classDoc.name;
    classDoc.startDate = startDate || classDoc.startDate;
    classDoc.endDate = endDate || classDoc.endDate;
    classDoc.location = location || classDoc.location;
    classDoc.meetingLink = meetingLink || classDoc.meetingLink;
    classDoc.status = status || classDoc.status;
    await classDoc.save();
    res.json({ message: 'Class updated', class: classDoc });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteClass = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { classId } = req.params;

    // 1. Validate ID format
    if (!mongoose.Types.ObjectId.isValid(classId)) {
      return res.status(400).json({ message: 'Invalid class ID format' });
    }

    // 2. Verify class exists
    const classDoc = await Class.findById(classId).session(session);
    if (!classDoc) {
      return res.status(404).json({ message: 'Class not found' });
    }

    // 3. Cascade delete references
    await Promise.all([
      Teacher.updateMany(
        { userId: classDoc.teacherId },
        { $pull: { classIds: classId } }
      ).session(session),
      
      Student.updateMany(
        { userId: { $in: classDoc.studentIds } },
        { $pull: { classIds: classId } }
      ).session(session),
      

    ]);


    
    // 4. Delete class
    await Class.findByIdAndDelete(classId).session(session);

    await session.commitTransaction();
    
    res.json({ 
      message: 'Class and all references deleted successfully',
      deleted: {
        classId: classDoc._id,
        name: classDoc.name
      }
    });

  } catch (error) {
    await session.abortTransaction();
    
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid ID format' });
    }
    res.status(500).json({
      message: 'Failed to delete class',
      error: process.env.NODE_ENV === 'development' ? error.message : null
    });
  } finally {
    session.endSession();
  }
};



// List all courses
const getCourses = async (req, res) => {
  try {
    // 1. Parse query parameters
    const { 
      page = 1, 
      limit = 20,
      type, 
      search 
    } = req.query;

    // 2. Build query
    const query = {};
    if (type) query.type = type;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }

    // 3. Fetch courses with pagination
    const courses = await Course.find(query)
      .select('-__v -createdAt') // Exclude internal fields
      .sort({ code: 1 }) // Alphabetical by course code
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // 4. Get total count
    const total = await Course.countDocuments(query);

    // 5. Format response
    res.json({
      success: true,
      count: courses.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: courses
    });

  } catch (error) {
    console.error('[GET COURSES ERROR]', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'Failed to retrieve courses',
        ...(process.env.NODE_ENV === 'development' && {
          stack: error.stack
        })
      }
    });
  }
};




// List all classes
const getClasses = async (req, res) => {
  try {
    // 1. Parse query parameters (pagination/filtering)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status; // Optional status filter

    // 2. Build query
    const query = {};
    if (status && ['active', 'completed', 'upcoming'].includes(status)) {
      query.status = status;
    }

    // 3. Fetch classes with optimized population
    const classes = await Class.find(query)
      .select('-__v -createdAt') // Exclude internal fields
      .populate({
        path: 'courseId',
        select: 'name code -_id', // Only return name and code
        options: { lean: true }
      })
      .populate({
        path: 'teacherId',
        select: 'fullName email -_id',
        options: { lean: true }
      })
      .populate({
        path: 'studentIds',
        select: 'fullName -_id',
        perDocumentLimit: 3, // Only get 3 students per class
        options: { lean: true }
      })
      .sort({ startDate: -1 }) // Newest first
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // 4. Get total count for pagination
    const total = await Class.countDocuments(query);

    // 5. Format response
    res.json({
      success: true,
      count: classes.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: classes.map(cls => ({
        ...cls,
        studentCount: cls.studentIds?.length || 0
      }))
    });

  } catch (error) {
    console.error('Failed to fetch classes:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: process.env.NODE_ENV === 'development' 
          ? error.message 
          : 'Failed to retrieve classes'
      }
    });
  }
};

// create user by admin 
const createUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { fullName, email, password, role, contactInfo, expertise, qualification } = req.body;

    // 1. Basic Validation - Keep it simple for now
    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const validRoles = ['student', 'teacher', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // 2. Check for existing user
    const existingUser = await User.findOne({ email }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Email already exists' });
    }

    // 3. Hash password (basic security)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Create user
    const user = await User.create([{
      fullName,
      email,
      password: hashedPassword,
      role,
      contactInfo: contactInfo || { phone: '' },
      status: 'active',
      approvalStatus: 'approved' // Admin-created users are auto-approved
    }], { session });

    // 5. Create role-specific records (except for admin)
    if (role === 'student') {
      await Student.create([{
        userId: user[0]._id,
        studentId: `STU-${Date.now().toString().slice(-6)}`, // Simple temporary ID
        skillLevel: 'beginner',
        enrollmentDate: new Date()
      }], { session });
    } 
    else if (role === 'teacher') {
      await Teacher.create([{
        userId: user[0]._id,
        teacherId: `TCH-${Date.now().toString().slice(-6)}`, // Simple temporary ID
        expertise: expertise || [],
        qualification: qualification || 'Not specified'
      }], { session });
    }
    // Admins don't need additional records

    await session.commitTransaction();

    // 6. Return safe user data (without password)
    const userData = {
      _id: user[0]._id,
      fullName: user[0].fullName,
      email: user[0].email,
      role: user[0].role,
      status: user[0].status
    };

    res.status(201).json({ 
      success: true,
      message: `${role} created successfully`,
      user: userData
    });

  } catch (error) {
    await session.abortTransaction();
    
    console.error('User creation error:', error);
    
    // Basic error differentiation
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        error: error.message 
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'User creation failed',
      error: error.message // Basic error for now
    });
  } finally {
    session.endSession();
  }
};


module.exports = {
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
  createUser,
};

