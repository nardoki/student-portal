
require('dotenv').config();


const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Student = require('./models/Student');
const Teacher = require('./models/Teacher');
const Course = require('./models/Course');
const Class = require('./models/Class');



async function seedDB() {
  try {
    // Connect to MongoDB
    await connectDB();

    
   

    // Seed Teacher
    let teacherUser = await User.findOne({ email: 'jane@example.com' });
    if (!teacherUser) {
      teacherUser = await User.create({
        fullName: 'mo ambaye',
        email: 'mo@example.com',
        password: 'bbbb', 
        role: 'teacher',
        contactInfo: { phone: '+251912345678' },
        status: 'active',
      });
    }
    let teacher = await Teacher.findOne({ userId: teacherUser._id });
    if (!teacher) {
      teacher = await Teacher.create({
        userId: teacherUser._id,
        teacherId: `TCH${Date.now()}${Math.floor(Math.random() * 1000)}`, // Explicitly set teacherId
        expertise: ['Robotics', 'Python'],
        qualification: 'MSc in Robotics',
        schedule: [{ day: 'Monday', time: '10:00-12:00' }],
      });
    }

    // Add a new student
const newStudentEmail = 'newstudent@example.com';
let newStudentUser = await User.findOne({ email: newStudentEmail });
if (newStudentUser && newStudentUser.role !== 'student') {
  await User.deleteOne({ _id: newStudentUser._id });
  newStudentUser = null;
}
if (!newStudentUser) {
  newStudentUser = await User.create({
    fullName: 'New Student',
    email: newStudentEmail,
    password: 'hashed', // Replace with bcrypt.hash('password', 10) in production
    role: 'student',
    contactInfo: { phone: '+251912345679' },
    status: 'active',
  });
}
let newStudent = await Student.findOne({ userId: newStudentUser._id });
if (!newStudent) {
  newStudent = await Student.create({
    userId: newStudentUser._id,
    studentId: `STU${Date.now()}${Math.floor(Math.random() * 1000)}`,
    skillLevel: 'intermediate',
    enrollmentDate: new Date(),
    projects: [{ projectId: 'PROJ124', title: 'Build Drone', status: 'in-progress' }],
    certifications: [{ name: 'Python Basics', dateEarned: new Date() }],
  });
}

    // Seed Course
    let course = await Course.findOne({ code: 'ROB101' });
    if (!course) {
      course = await Course.create({
        name: 'Embedded Systems',
        code: 'ROB101',
        description: 'Intro to microcontrollers',
        type: 'certification',
        prerequisites: ['CS101'],
      });
    }

    // Seed Class
    let classDoc = await Class.findOne({ name: 'Robotics 101 Cohort A', courseId: course._id });
    if (!classDoc) {
      classDoc = await Class.create({
        name: 'Robotics 101 Cohort A',
        courseId: course._id,
        teacherId: teacherUser._id,
        studentIds: [newStudentUser._id],
        startDate: new Date(),
        location: 'adama  mebrat lab',
        status: 'active',
      });
    }

    // Update Student and Teacher with Class
   await Student.updateOne(
  { _id: newStudent._id, classIds: { $ne: classDoc._id } },
  { $push: { classIds: classDoc._id } }
);
    await Teacher.updateOne(
      { _id: teacher._id, classIds: { $ne: classDoc._id } },
      { $push: { classIds: classDoc._id } }
    );

    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Seeding error:', error);
  } finally {
    mongoose.connection.close();
  }
}

seedDB();