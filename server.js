const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: ['https://management-portal-frontend-three.vercel.app', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB with improved connection options for serverless environment
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // These options help with serverless environments
      bufferCommands: false, // Disable mongoose buffering
      autoCreate: false,     // Don't auto-create collections
      maxPoolSize: 10,       // Limit connection pool size
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    // Don't exit the process in serverless environment
    // Instead, we'll handle the error in the request handlers
  }
};

// Replace this line:
// Connect to database
connectDB();

// With this code:
// Database connection with reconnection logic for serverless environment
let isConnected = false;

const connectToDatabase = async (req, res, next) => {
  // Skip if already connected
  if (isConnected) {
    return next();
  }
  
  try {
    // Only attempt to connect if not already connected
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
      isConnected = true;
    }
    next();
  } catch (error) {
    console.error('Failed to connect to database on request:', error);
    return res.status(500).json({ error: 'Database connection failed' });
  }
};

// Apply the database connection middleware to all routes
app.use(connectToDatabase);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/documents', require('./routes/documents'));

// Basic route for testing
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Enhanced error handling middleware for serverless environment
app.use((err, req, res, next) => {
  // Log the full error for serverless logs
  console.error('Error details:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params
  });
  
  // Send a detailed error response in development, simplified in production
  const errorResponse = {
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? 'Server error' : err.message,
    path: req.path,
    requestId: req.headers['x-request-id'] || 'unknown'
  };
  
  res.status(500).send(errorResponse);
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

// Export for serverless
module.exports = app;