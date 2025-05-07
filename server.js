require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use(limiter);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Enhanced router loader with debugging
const loadRouterWithDebug = (routePath) => {
  console.log(`Attempting to load router from: ${path.resolve(__dirname, routePath)}`);
  
  try {
    // Clear cache first to ensure fresh load
    delete require.cache[require.resolve(routePath)];
    
    const router = require(routePath);
    console.log(`Successfully required ${routePath}`);
    
    if (typeof router !== 'function' || !router.stack) {
      console.error('Loaded router is invalid. Structure:', router);
      throw new Error(`Invalid router from ${routePath}`);
    }
    
    console.log(`Router from ${routePath} is valid`);
    return router;
  } catch (err) {
    console.error(`CRITICAL ERROR loading ${routePath}:`, err);
    console.error('Full error stack:', err.stack);
    process.exit(1);
  }
};

// Load routes with debugging and validation
console.log('Before loading blogRoutes');
const blogRoutes = loadRouterWithDebug('./routes/blogRoutes');
console.log('Blog routes loaded:', blogRoutes);

console.log('Before loading appointmentRoutes');
const appointmentRoutes = loadRouterWithDebug('./routes/appointmentRoutes');
console.log('Appointment routes loaded:', appointmentRoutes);

// Mount routes with additional validation
try {
  console.log('Mounting blogRoutes...');
  if (typeof blogRoutes === 'function' && blogRoutes.stack) {
    app.use('/api/blogs', blogRoutes);
    console.log('blogRoutes mounted successfully');
  } else {
    throw new Error('blogRoutes is not a valid Express router');
  }

  console.log('Mounting appointmentRoutes...');
  if (typeof appointmentRoutes === 'function' && appointmentRoutes.stack) {
    app.use('/api/appointments', appointmentRoutes);
    console.log('appointmentRoutes mounted successfully');
  } else {
    throw new Error('appointmentRoutes is not a valid Express router');
  }
} catch (err) {
  console.error('FATAL ERROR mounting routes:', err);
  process.exit(1);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK',
    dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler (must be last middleware)
app.use(errorHandler);

// Server setup
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`MongoDB Connected: ${mongoose.connection.host}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

// Clean shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

module.exports = server;