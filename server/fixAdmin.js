
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/userSchema');

const fixAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    const email = "boby@example.com";
    const newPassword = "TempAdminPass123!";
    
    //  hash
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);
    
    // Update 
    const result = await User.updateOne(
      { email },
      { $set: { password_hash } }
    );
    
    console.log(`Admin ${email} updated. New password: ${newPassword}`);
    console.log('Please change this password immediately after login!');
    
  } catch (error) {
    console.error('Error fixing admin:', error);
  } finally {
    mongoose.disconnect();
  }
};

fixAdmin();