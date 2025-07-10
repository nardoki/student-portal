const multer = require('multer');
const path = require('path');

const allowedTypes = /pdf|docx|doc|ppt|pptx/;

const fileFilter = (req, file, cb) => {
  const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  

 if (ext) {
  cb(null, true);
} else {
  cb(new Error('Only PDF, DOCX, DOC, PPT, and PPTX files are allowed'));
}

};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, 
});
