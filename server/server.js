const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const multer = require('multer');
const path = require('path');
const connectDB = require('./config/db');
const errorMiddleware = require('./middleware/error');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const fileRoutes = require('./routes/fileRoutes');
const groupRoutes = require('./routes/groupRoutes');
const announcementRoutes = require('./routes/announcementRoutes');


dotenv.config();
const app = express();


// Middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(compression());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
app.use(errorMiddleware);
// Connect to MongoDB
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/announcements', announcementRoutes);



// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Ethronics Student Portal API' });
});

// Global error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: 'File upload error', error: err.message });
  }
  console.error(err.stack);
  res.status(500).json({ message: 'Server error', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));