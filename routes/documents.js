const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

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

// @route   POST /api/documents
// @desc    Upload a document
// @access  Private
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
    
    // For memory storage, we don't have a file path
    // Instead, we need to create a virtual path or identifier
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const fileType = path.extname(req.file.originalname).substring(1);
    const virtualPath = `uploads/${fileName}`;
    
    // Create document record with virtual path
    const document = await Document.create({
      name: name || req.file.originalname,
      description,
      fileUrl: virtualPath, // Store a virtual path instead of actual file path
      fileType: fileType,
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
  } catch (error) {
    console.error('Document upload error:', error);
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
    
    // In serverless environment, we can't access the file system
    // Return a message for now
    res.status(200).json({ 
      message: 'Document download is not available in the serverless environment',
      document: document
    });
  } catch (error) {
    console.error('Document download error:', error);
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
    
    // In serverless environment, we can't access the file system
    // Just delete the document record
    await Document.deleteOne({ _id: document._id });
    
    res.json({ message: 'Document record removed (file remains in storage)' });
  } catch (error) {
    console.error('Document delete error:', error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;