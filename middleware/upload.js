const multer = require('multer');

// Use memory storage instead of disk storage for serverless environment
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB max file size
});

module.exports = upload;