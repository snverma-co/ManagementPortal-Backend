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
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB with improved connection options for serverless environment
const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      console.log('MongoDB already connected');
      return mongoose.connection;
    }
    
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // Reduce from default 30s to fail faster
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      bufferCommands: false, // Disable buffering of commands
      autoCreate: false, // Don't create collections automatically
      maxPoolSize: 10, // Maintain up to 10 socket connections
      retryWrites: true,
      w: 'majority'
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn.connection;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    // Don't crash the server on connection error, just log it
    return null;
  }
};

// Replace this line:
// Connect to database
connectDB();

// With this code:
// Database connection with reconnection logic for serverless environment
let isConnected = false;

const connectToDatabase = async (req, res, next) => {
  try {
    // Check connection state more reliably
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
      isConnected = true;
      console.log('Database connected successfully');
    }
    next();
  } catch (error) {
    console.error('Failed to connect to database on request:', error);
    return res.status(500).json({ 
      error: 'Database connection failed', 
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
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

// Add this route to test database connection
app.get('/api/health', async (req, res) => {
  try {
    // Check MongoDB connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.json({
      status: 'ok',
      environment: process.env.NODE_ENV || 'development',
      mongodb: dbStatus
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});