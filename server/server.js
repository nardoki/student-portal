const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const connectDB = require('./config/db');
const errorMiddleware = require('./middleware/error');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const fileRoutes = require('./routes/fileRoutes');
const groupRoutes = require('./routes/groupRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const discussionRoutes = require('./routes/discussionRoutes');
const profileRoutes = require('./routes/profileRoutes');


dotenv.config();
const app = express();





// Middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(compression());
const allowedOrigins = ["http://192.168.1.5:5174", "http://localhost:5174", "http://192.168.1.22:5173"];
app.use(cors({
  origin: function(origin, callback){
    if (!origin || allowedOrigins.includes(origin)){
      callback(null, true);
    }else{
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials:true
}));



app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));



// Database Connection
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/discussions', discussionRoutes);
app.use('/api/profile', profileRoutes);



// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Ethronics Student Portal API' });
});

// 404 Handler 
app.use((req, res, next) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist` 
  });
});

// Global Error Handler 
app.use(errorMiddleware);



const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
