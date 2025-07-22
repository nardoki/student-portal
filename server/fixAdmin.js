require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/userSchema');

const fixAdmin = async () => {
  try {
    // Connect to MongoDB (removed deprecated options)
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB...');

    // Admin credentials
    const adminEmail = "boby@gmail.com"; // Note: changed to lowercase
    const newPassword = "admin123";
    const adminData = {
      name: "Admin Boby",
      email: adminEmail,
      role: "admin",
      isVerified: true
    };

    // Check if user exists
    let adminUser = await User.findOne({ email: adminEmail });

    // Generate password hash
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(newPassword, salt);

    if (adminUser) {
      // Update existing admin
      const result = await User.updateOne(
        { email: adminEmail },
        { $set: { password_hash } }
      );
      console.log(`\nAdmin password updated for ${adminEmail}`);
    } else {
      // Create new admin
      adminUser = await User.create({
        ...adminData,
        password_hash
      });
      console.log(`\nNew admin created for ${adminEmail}`);
    }

    console.log(`Email: ${adminEmail}`);
    console.log(`Password: ${newPassword}`);
    console.log('WARNING: This is a development password - change in production!\n');
    
  } catch (error) {
    console.error('\nError in admin setup:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

fixAdmin();