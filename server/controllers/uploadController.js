exports.uploadFile = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  res.status(201).json({
    message: 'File uploaded successfully',
    filename: req.file.filename,
    path: req.file.path
  });
};
