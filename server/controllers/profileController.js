
const User = require('../models/userSchema');
const bcrypt = require('bcryptjs');
const { errorResponse } = require('../middleware/auth');


// Get current user profile all roles
exports.getProfile = async (req, res) => {
  try {
    const user = req.user;
    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    });
  } catch (error) {
    errorResponse(res, 500, 'Failed to fetch profile', error.message);
  }
};


// Update profile (name & email)
exports.updateProfile = async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = req.user;

    // Validate that at least one field 
    if (!name && !email) {
      return errorResponse(res, 400, 'At least one field (name or email) is required');
    }

    // Update only the provided fields
    if (name) user.name = name;
    if (email) {

      // Check if new email is already taken
      const existingUser = await User.findOne({ email, _id: { $ne: user._id } });
      if (existingUser) {
        return errorResponse(res, 400, 'Email already in use');
      }
      user.email = email;
    }

    await user.save();

    res.status(200).json({
      message: 'Profile updated successfully',
      name: user.name,
      email: user.email,
    });
  } catch (error) {
    errorResponse(res, 500, 'Failed to update profile', error.message);
  }
};


// Change password we can verify old password first
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id; 

    // Validate input
    if (!currentPassword || !newPassword) {
      return errorResponse(res, 400, 'Current and new password are required');
    }

    // Find user and  include password_hash
    const user = await User.findById(userId).select('+password_hash');
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return errorResponse(res, 401, 'Current password is incorrect');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    errorResponse(res, 500, 'Failed to change password', error.message);
  }
};