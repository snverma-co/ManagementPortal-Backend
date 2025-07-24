const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/clients
// @desc    Get all clients
// @access  Private/Admin
router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const clients = await User.find({ role: 'client' }).select('-password');
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/clients/:id
// @desc    Get client by ID
// @access  Private/Admin
router.get('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const client = await User.findById(req.params.id).select('-password');
    
    if (!client || client.role !== 'client') {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/clients
// @desc    Create a new client
// @access  Private/Admin
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check if client already exists
    const clientExists = await User.findOne({ email });
    if (clientExists) {
      return res.status(400).json({ message: 'Client already exists' });
    }

    // Create new client
    const client = await User.create({
      name,
      email,
      password,
      phone,
      role: 'client'
    });

    if (client) {
      res.status(201).json({
        _id: client._id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        role: client.role
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/clients/:id
// @desc    Update client
// @access  Private/Admin
router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    
    const client = await User.findById(req.params.id);
    
    if (!client || client.role !== 'client') {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    client.name = name || client.name;
    client.email = email || client.email;
    client.phone = phone || client.phone;
    
    // If password is provided, it will be hashed by the pre-save hook
    if (req.body.password) {
      client.password = req.body.password;
    }
    
    const updatedClient = await client.save();
    
    res.json({
      _id: updatedClient._id,
      name: updatedClient.name,
      email: updatedClient.email,
      phone: updatedClient.phone,
      role: updatedClient.role
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/clients/:id
// @desc    Delete client
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const client = await User.findById(req.params.id);
    
    if (!client || client.role !== 'client') {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    // Updated to use deleteOne instead of remove
    await User.deleteOne({ _id: client._id });
    res.json({ message: 'Client removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;