const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Configure upload directory
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Sanitize filename helper
const sanitizeFilename = (filename) => {
  return filename.replace(/[^a-zA-Z0-9-_.]/g, '').replace(/\s+/g, '_');
};

// File storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const sanitizedOriginalName = sanitizeFilename(file.originalname);
    cb(null, `${uuidv4()}-${sanitizedOriginalName}`);
  }
});

// Allowed file types
const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip'
];

// File filter
const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError(
      'LIMIT_UNEXPECTED_FILE',
      `Invalid file type. Allowed types: ${allowedMimeTypes.map(t => t.split('/')[1]).join(', ')}`
    ), false);
  }
};

// Multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
    files: 5,
    fields: 10
  }
});

// Middleware for handling upload errors
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        message: 'Maximum file size is 20MB'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Too many files',
        message: 'Maximum 5 files allowed'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Invalid file type',
        message: err.message || 'Unsupported file format'
      });
    }
  }
  next(err);
};

module.exports = { 
  upload,
  handleUploadErrors,
  uploadDir
};