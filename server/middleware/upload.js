
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure /uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    cb(null, `${uniqueSuffix}_${file.originalname}`);
  },
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['application/pdf', 'application/zip', 'text/x-python', 'application/x-python-code', 'model/stl'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed: PDF, ZIP, Python, STL'), false);
  }
};

// Multer upload configuration
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter,
});

module.exports = upload;
