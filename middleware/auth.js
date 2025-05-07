// middleware/auth.js
const jwt = require('jsonwebtoken');
const ErrorResponse = require('../utils/errorResponse');

// Make sure these are the exact export names
module.exports = {
  protect: async (req, res, next) => {
    let token;
    
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new ErrorResponse('Not authorized', 401));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded; // Make sure this includes role information
      next();
    } catch (err) {
      return next(new ErrorResponse('Not authorized', 401));
    }
  },

  authorize: (...roles) => {
    return (req, res, next) => {
      if (!req.user?.role || !roles.includes(req.user.role)) {
        return next(
          new ErrorResponse(`User role ${req.user?.role || 'undefined'} is not authorized`, 403)
        );
      }
      next();
    };
  }
};