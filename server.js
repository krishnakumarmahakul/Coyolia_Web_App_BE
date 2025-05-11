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

// Route loaders
const loadRouter = (routePath) => {
  try {
    delete require.cache[require.resolve(routePath)];
    const router = require(routePath);
    
    if (typeof router !== 'function' || !router.stack) {
      throw new Error(`Invalid router from ${routePath}`);
    }
    
    return router;
  } catch (err) {
    console.error(`Error loading ${routePath}:`, err);
    process.exit(1);
  }
};

// Load and mount routes
const routeConfigs = [
  { path: './routes/authRoutes', basePath: '/api/v1/auth' },
  { path: './routes/blogRoutes', basePath: '/api/blogs' },
  { path: './routes/appointmentRoutes', basePath: '/api/appointments' }
];

routeConfigs.forEach(({ path, basePath }) => {
  try {
    const router = loadRouter(path);
    app.use(basePath, router);
    console.log(`Mounted routes for ${basePath}`);
  } catch (err) {
    console.error(`Failed to mount routes for ${basePath}:`, err);
    process.exit(1);
  }
});

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