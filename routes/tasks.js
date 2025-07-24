const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
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

// @route   GET /api/tasks
// @desc    Get all tasks (admin: all tasks, client: only their tasks)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    let tasks;
    
    if (req.user.role === 'admin') {
      tasks = await Task.find()
        .populate('client', 'name email phone')
        .populate('createdBy', 'name');
    } else {
      tasks = await Task.find({ client: req.user._id })
        .populate('createdBy', 'name');
    }
    
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/tasks/:id
// @desc    Get task by ID
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate('client', 'name email phone')
      .populate('createdBy', 'name');
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Check if user is authorized to view this task
    if (req.user.role !== 'admin' && task.client._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to access this task' });
    }
    
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/tasks
// @desc    Create a new task
// @access  Private/Admin
router.post('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { title, description, clientId, deadline } = req.body;
    
    // Validate client exists
    const client = await User.findById(clientId);
    if (!client || client.role !== 'client') {
      return res.status(404).json({ message: 'Client not found' });
    }
    
    const task = await Task.create({
      title,
      description,
      client: clientId,
      deadline: new Date(deadline),
      createdBy: req.user._id
    });
    
    // Send WhatsApp notification to client
    const notificationMessage = `New task assigned: ${title}\nDeadline: ${new Date(deadline).toLocaleDateString()}\nDescription: ${description}`;
    await sendWhatsAppNotification(client.phone, notificationMessage);
    
    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/tasks/:id
// @desc    Update task
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Admin can update any task, client can only update status of their own tasks
    if (req.user.role === 'client') {
      if (task.client.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to update this task' });
      }
      
      // Clients can only update the status
      task.status = req.body.status || task.status;
    } else {
      // Admin can update all fields
      task.title = req.body.title || task.title;
      task.description = req.body.description || task.description;
      task.status = req.body.status || task.status;
      task.deadline = req.body.deadline ? new Date(req.body.deadline) : task.deadline;
      
      if (req.body.clientId) {
        const client = await User.findById(req.body.clientId);
        if (!client || client.role !== 'client') {
          return res.status(404).json({ message: 'Client not found' });
        }
        task.client = req.body.clientId;
      }
    }
    
    const updatedTask = await task.save();
    
    // If status changed to completed, send notification
    if (req.body.status === 'completed' && task.status !== 'completed') {
      const client = await User.findById(task.client);
      const notificationMessage = `Task completed: ${task.title}`;
      await sendWhatsAppNotification(client.phone, notificationMessage);
    }
    
    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/tasks/:id
// @desc    Delete task
// @access  Private/Admin
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Updated to use deleteOne instead of remove
    await Task.deleteOne({ _id: task._id });
    res.json({ message: 'Task removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;