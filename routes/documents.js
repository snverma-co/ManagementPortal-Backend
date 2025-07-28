const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

// WhatsApp notification function using Beta Blaster API
const sendWhatsAppNotification = async (phone, message) => {
  try {
    const response = await axios.post('https://api.betablaster.com/send', {
      apiKey: process.env.BETA_BLASTER_API_KEY,
      phone: phone,
      message: message
    });
    return response.data;
  } catch (error) {
    console.error('WhatsApp notification error:', error);
    return null;
  }
};

// @route   GET /api/documents
// @desc    Get all documents (admin: all docs, client: only their docs)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let documents;
    
    if (req.user.role === 'admin') {
      documents = await Document.find()
        .populate('client', 'name email')
        .populate('uploadedBy', 'name')
        .populate('task', 'title');
    } else {
      documents = await Document.find({ client: req.user._id })
        .populate('uploadedBy', 'name')
        .populate('task', 'title');
    }
    
    res.json(documents);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/documents/:id
// @desc    Get document by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id)
      .populate('client', 'name email')
      .populate('uploadedBy', 'name')
      .populate('task', 'title');
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Check if user is authorized to view this document
    if (req.user.role !== 'admin' && document.client._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to access this document' });
    }
    
    res.json(document);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/documents-
// @desc    Upload a document
// @access  Private

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

router.post('/', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Please upload a file' });
    }
    
    const { name, description, clientId, taskId } = req.body;
    
    // Determine the client ID
    let client;
    if (req.user.role === 'admin') {
      // Admin must specify a client
      if (!clientId) {
        return res.status(400).json({ message: 'Please specify a client' });
      }
      client = await User.findById(clientId);
      if (!client || client.role !== 'client') {
        return res.status(404).json({ message: 'Client not found' });
      }
    } else {
      // For client users, the client is themselves
      client = req.user;
    }
    
    // Upload to Cloudinary
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'portal_documents',
          resource_type: 'auto'
        },
        async (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            return res.status(500).json({ message: 'Error uploading file' });
          }
          
          try {
            // Create document record with Cloudinary URL
            const document = await Document.create({
              name: name || req.file.originalname,
              description,
              fileUrl: result.secure_url, // Use Cloudinary URL
              fileType: path.extname(req.file.originalname).substring(1),
              client: client._id,
              uploadedBy: req.user._id,
              task: taskId || null
            });
            
            // If admin uploaded a document for a client, send notification
            if (req.user.role === 'admin' && client._id.toString() !== req.user._id.toString()) {
              const notificationMessage = `New document uploaded: ${document.name}`;
              await sendWhatsAppNotification(client.phone, notificationMessage);
            }
            
            res.status(201).json(document);
          } catch (err) {
            console.error('Database error:', err);
            res.status(500).json({ message: err.message });
          }
        }
      );
      
      // Convert buffer to stream and pipe to Cloudinary
      streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
    });
  } catch (error) {
    console.error('Upload route error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update your download route to use Cloudinary URL
router.get('/download/:id', protect, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Check if user is authorized to download this document
    if (req.user.role !== 'admin' && document.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to download this document' });
    }
    
    // Get the original file name and extension
    const fileName = document.name;
    const fileType = document.fileType;
    
    // Set Content-Disposition header with the original filename
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.${fileType}"`);
    
    // Redirect to the Cloudinary URL
    res.redirect(document.fileUrl);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/documents/download/:id
// @desc    Download a document
// @access  Private
router.get('/download/:id', protect, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Check if user is authorized to download this document
    if (req.user.role !== 'admin' && document.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to download this document' });
    }
    
    const filePath = path.join(__dirname, '..', document.fileUrl);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Get the original file extension
    const fileExtension = path.extname(document.fileUrl);
    const fileName = `${document.name}${fileExtension}`;
    
    // Set Content-Type based on file extension
    const mimeType = getMimeType(fileExtension);
    if (mimeType) {
      res.setHeader('Content-Type', mimeType);
    }
    
    // Set Content-Disposition header with the original filename
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.download(filePath, fileName);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper function to get MIME type based on file extension
function getMimeType(extension) {
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.txt': 'text/plain'
    // Add more MIME types as needed
  };
  
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}

// @route   DELETE /api/documents/:id
// @desc    Delete a document
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }
    
    // Check if user is authorized to delete this document
    if (req.user.role !== 'admin' && document.client.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this document' });
    }
    
    // Extract public_id from Cloudinary URL
    // Cloudinary URLs typically look like: https://res.cloudinary.com/cloud_name/resource_type/upload/v123456789/public_id.ext
    const urlParts = document.fileUrl.split('/');
    const publicIdWithExtension = urlParts[urlParts.length - 1];
    const publicId = `portal_documents/${publicIdWithExtension.split('.')[0]}`;
    
    // Delete file from Cloudinary
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) {
        console.error('Error deleting from Cloudinary:', error);
      }
      console.log('Cloudinary deletion result:', result);
    });
    
    // Delete document record
    await Document.deleteOne({ _id: document._id });
    
    res.json({ message: 'Document removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;