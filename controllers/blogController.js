const Blog = require('../models/Blog');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const cloudinary = require('cloudinary').v2;

// Helper function to validate required fields
const validateRequiredFields = (body, requiredFields, next) => {
  const missingFields = requiredFields.filter(field => !body[field]);
  if (missingFields.length > 0) {
    return next(new ErrorResponse(
      `The following fields are required: ${missingFields.join(', ')}`, 
      400
    ));
  }
  return true;
};

// @desc    Get all blogs
// @route   GET /api/blogs
// @access  Public
exports.getBlogs = asyncHandler(async (req, res, next) => {
  try {
    const results = res.advancedResults || {
      success: true,
      count: await Blog.countDocuments(),
      data: await Blog.find().select('-__v')
    };
    res.status(200).json(results);
  } catch (err) {
    console.error('Error fetching blogs:', err);
    next(new ErrorResponse('Failed to fetch blogs', 500));
  }
});

// @desc    Get single blog
// @route   GET /api/blogs/:id
// @access  Public
exports.getBlog = asyncHandler(async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id).select('-__v');
    
    if (!blog) {
      return next(new ErrorResponse(
        `Blog not found with id of ${req.params.id}`, 
        404
      ));
    }
    
    res.status(200).json({ 
      success: true, 
      data: blog 
    });
  } catch (err) {
    console.error('Error fetching blog:', err);
    next(new ErrorResponse('Failed to fetch blog', 500));
  }
});

// @desc    Create new blog
// @route   POST /api/blogs
// @access  Private/Admin
exports.createBlog = asyncHandler(async (req, res, next) => {
  try {
    // Validate required fields
    if (!validateRequiredFields(req.body, ['title', 'content'], next)) {
      return;
    }
    
    // Set author
    req.body.author = req.user?.id || 'admin';
    
    const blog = await Blog.create(req.body);
    
    res.status(201).json({
      success: true,
      data: blog
    });
  } catch (err) {
    console.error('Error creating blog:', err);
    next(new ErrorResponse('Failed to create blog', 500));
  }
});

// @desc    Update blog
// @route   PUT /api/blogs/:id
// @access  Private/Admin
exports.updateBlog = asyncHandler(async (req, res, next) => {
  try {
    let blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return next(new ErrorResponse(
        `Blog not found with id of ${req.params.id}`, 
        404
      ));
    }
    
    // Authorization check
    if (blog.author.toString() !== req.user?.id && req.user?.role !== 'admin') {
      return next(new ErrorResponse(
        'Not authorized to update this blog', 
        403
      ));
    }
    
    blog = await Blog.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    ).select('-__v');
    
    res.status(200).json({ 
      success: true, 
      data: blog 
    });
  } catch (err) {
    console.error('Error updating blog:', err);
    next(new ErrorResponse('Failed to update blog', 500));
  }
});

// @desc    Delete blog
// @route   DELETE /api/blogs/:id
// @access  Private/Admin
exports.deleteBlog = asyncHandler(async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return next(new ErrorResponse(
        `Blog not found with id of ${req.params.id}`, 
        404
      ));
    }
    
    // Authorization check
    if (blog.author.toString() !== req.user?.id && req.user?.role !== 'admin') {
      return next(new ErrorResponse(
        'Not authorized to delete this blog', 
        403
      ));
    }
    
    // Delete image from Cloudinary if exists
    if (blog.image?.public_id) {
      try {
        await cloudinary.uploader.destroy(blog.image.public_id);
      } catch (cloudinaryErr) {
        console.error('Error deleting Cloudinary image:', cloudinaryErr);
      }
    }
    
    await blog.deleteOne();
    
    res.status(200).json({ 
      success: true, 
      data: {} 
    });
  } catch (err) {
    console.error('Error deleting blog:', err);
    next(new ErrorResponse('Failed to delete blog', 500));
  }
});

// @desc    Upload image for blog
// @route   PUT /api/blogs/:id/image
// @access  Private/Admin
exports.uploadBlogImage = asyncHandler(async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return next(new ErrorResponse(
        `Blog not found with id of ${req.params.id}`, 
        404
      ));
    }
    
    // Authorization check
    if (blog.author.toString() !== req.user?.id && req.user?.role !== 'admin') {
      return next(new ErrorResponse(
        'Not authorized to update this blog', 
        403
      ));
    }
    
    if (!req.files?.file) {
      return next(new ErrorResponse(
        'Please upload an image file', 
        400
      ));
    }
    
    const file = req.files.file;
    const maxSize = process.env.MAX_FILE_UPLOAD || 5000000; // 5MB default
    
    // Validate image this is the image validation
    if (!file.mimetype.startsWith('image')) {
      return next(new ErrorResponse(
        'Please upload an image file (JPEG, PNG, etc.)', 
        400
      ));
    }
    
    if (file.size > maxSize) {
      return next(new ErrorResponse(
        `Image size must be less than ${maxSize/1000000}MB`, 
        400
      ));
    }
    
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      folder: 'coyolia/blogs',
      width: 1200,
      crop: 'fill',
      quality: 'auto',
      format: 'jpg'
    });
    
    // Delete old image if exists
    if (blog.image?.public_id) {
      try {
        await cloudinary.uploader.destroy(blog.image.public_id);
      } catch (cloudinaryErr) {
        console.error('Error deleting old Cloudinary image:', cloudinaryErr);
      }
    }
    
    // Update blog with new image
    blog.image = {
      public_id: result.public_id,
      url: result.secure_url
    };
    
    await blog.save();
    
    res.status(200).json({
      success: true,
      data: blog
    });
  } catch (err) {
    console.error('Error uploading blog image:', err);
    next(new ErrorResponse('Failed to upload image', 500));
  }
});