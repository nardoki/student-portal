const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userSchema');



// Student self-registration (public)
const registerStudent = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;



    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }



    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }



    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);



    // Create new student with pending approval
    const user = new User({
      name,
      email,
      password_hash,
      role: 'student',
      status: 'active',
      approvalStatus: 'pending' // Requires admin approval
    });

    await user.save();

    res.status(201).json({
      message: 'Registration pending approval',
      userId: user._id
    });
  } catch (error) {
    next(error);
  }
};




// Admin/teacher user creation (protected)
const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    const creator = req.user;





    // Validate input
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }
    if (!['student', 'teacher', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be student, teacher, or admin' });
    }




    // Prevent creating admins unless creator is an admin
    if (role === 'admin' && creator.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create other admins' });
    }



    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }


    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);



    // Create user
    const user = new User({
      name,
      email,
      password_hash,
      role,
      status: 'active',
      approvalStatus: 'approved', // Auto-approved for admin/teacher-created users
      createdBy: creator._id
    });

    await user.save();

    res.status(201).json({
      id: user._id,
      name,
      email,
      role,
      status: user.status,
      approvalStatus: user.approvalStatus
    });
  } catch (error) {
    next(error);
  }
};




// Login for all roles
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;




    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }




    // Find user and explicitly include password_hash
    const user = await User.findOne({ email }).select('+password_hash');
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }




    // Check approval status
    if (user.approvalStatus !== 'approved') {
      return res.status(403).json({ error: 'Account pending approval' });
    }



    // Check status
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is inactive' });
    }



    // Verify password - using password_hash instead of password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }



    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        approvalStatus: user.approvalStatus
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};




// Get current user (protected)
const getCurrentUser = async (req, res, next) => {
  try {
    res.json({
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      status: req.user.status,
      approvalStatus: req.user.approvalStatus
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerStudent,
  createUser,
  login,
  getCurrentUser
};