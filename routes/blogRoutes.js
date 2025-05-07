const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const blogController = require('../controllers/blogController');
const upload = require('../utils/upload');

// Public routes
router.get('/', blogController.getBlogs);
router.get('/:id', blogController.getBlog);

// Protected admin routes
router.post('/', 
  protect,
  authorize('admin'),
  blogController.createBlog
);

router.put('/:id', 
  protect,
  authorize('admin'),
  blogController.updateBlog
);

router.delete('/:id', 
  protect,
  authorize('admin'),
  blogController.deleteBlog
);

// Image upload route
router.put('/:id/image', 
  protect,
  authorize('admin'),
  upload.single('file'),
  blogController.uploadBlogImage
);

module.exports = router;