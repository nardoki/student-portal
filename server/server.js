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
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('swagger.yaml');

dotenv.config();
const app = express();

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

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

// Database Connection
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/discussions', discussionRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Ethronics Student Portal API' });
});

// 404 Handler (must be after all routes but before error middleware)
app.use((req, res, next) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist` 
  });
});

// Global Error Handler (must be last middleware)
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));



