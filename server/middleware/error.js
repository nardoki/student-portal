const winston = require('winston');
const multer = require('multer');

// Configure Winston logger
const logger = winston.createLogger({
  level: 'error',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log' }),
    new winston.transports.Console()
  ]
});

// Error handling middleware
const errorMiddleware = (err, req, res, next) => {
  // Log the error
  logger.error({
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    user: req.user ? req.user._id : 'unauthenticated'
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation error',
      details: Object.values(err.errors).map(e => e.message)
    });
  }

  if (err.name === 'MongoServerError' && err.code === 11000) {
    return res.status(400).json({
      error: 'Duplicate key error',
      details: err.keyValue
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (err instanceof multer.MulterError) {
    return res.status(400).json({ 
      error: 'File upload error',
      message: err.message 
    });
  }

  // Generic error response
  res.status(err.status || 500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
};

module.exports = errorMiddleware;