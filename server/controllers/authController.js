const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');

const register = async (req, res) => {
  try {
    const { fullName, email, password, role, contactInfo } = req.body;

    // Disallow admin registration
    if (role === 'admin') {
      return res.status(403).json({ message: 'Admin registration is not allowed' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (only students/teachers)
    const user = await User.create({
      fullName,
      email,
      password: hashedPassword,
      role,
      contactInfo,
      status: 'active',
      approvalStatus: 'pending', // All non-admin users need approval
    });

    // Create Student or Teacher record
    if (role === 'student') {
      await Student.create({
        userId: user._id,
        studentId: `STU${Date.now()}${Math.floor(Math.random() * 1000)}`,
        skillLevel: 'beginner',
        enrollmentDate: new Date(),
      });
    } else if (role === 'teacher') {
      await Teacher.create({
        userId: user._id,
        teacherId: `TCH${Date.now()}${Math.floor(Math.random() * 1000)}`,
      });
    }

    res.status(201).json({ message: 'User registered, awaiting approval' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check approval status (only for non-admins)
    if (user.role !== 'admin' && user.approvalStatus !== 'approved') {
      return res.status(403).json({ message: 'Account pending approval' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token, role: user.role });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { register, login };