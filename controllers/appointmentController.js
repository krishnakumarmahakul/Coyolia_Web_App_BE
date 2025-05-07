const Appointment = require('../models/Appointment');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const sendEmail = require('../utils/emailService');

// @desc    Get all appointments
// @route   GET /api/appointments
// @access  Private/Admin
exports.getAppointments = asyncHandler(async (req, res, next) => {
  res.status(200).json(res.advancedResults);
});

// @desc    Get single appointment
// @route   GET /api/appointments/:id
// @access  Private
exports.getAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findById(req.params.id).populate([
    'user',
    'counselor'
  ]);

  if (!appointment) {
    return next(
      new ErrorResponse(`Appointment not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is appointment owner or admin
  if (
    appointment.user._id.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to access this appointment`,
        401
      )
    );
  }

  res.status(200).json({ success: true, data: appointment });
});

// @desc    Create new appointment
// @route   POST /api/appointments
// @access  Private
exports.createAppointment = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.user = req.user.id;

  // Check for existing appointment at the same time
  const existingAppointment = await Appointment.findOne({
    counselor: req.body.counselor,
    date: req.body.date,
    time: req.body.time
  });

  if (existingAppointment) {
    return next(
      new ErrorResponse(
        `There is already an appointment booked at ${req.body.time} on ${req.body.date}`,
        400
      )
    );
  }

  const appointment = await Appointment.create(req.body);

  // Send confirmation email
  const message = `Your ${appointment.type} career counseling appointment has been scheduled for ${appointment.date} at ${appointment.time}.`;

  try {
    await sendEmail({
      email: req.user.email,
      subject: 'Career Counseling Appointment Confirmation',
      message
    });
  } catch (err) {
    console.error('Email could not be sent');
  }

  res.status(201).json({
    success: true,
    data: appointment
  });
});

// @desc    Update appointment
// @route   PUT /api/appointments/:id
// @access  Private
exports.updateAppointment = asyncHandler(async (req, res, next) => {
  let appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return next(
      new ErrorResponse(`Appointment not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is appointment owner or admin
  if (
    appointment.user.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to update this appointment`,
        401
      )
    );
  }

  appointment = await Appointment.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({ success: true, data: appointment });
});

// @desc    Delete appointment
// @route   DELETE /api/appointments/:id
// @access  Private
exports.deleteAppointment = asyncHandler(async (req, res, next) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return next(
      new ErrorResponse(`Appointment not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is appointment owner or admin
  if (
    appointment.user.toString() !== req.user.id &&
    req.user.role !== 'admin'
  ) {
    return next(
      new ErrorResponse(
        `User ${req.user.id} is not authorized to delete this appointment`,
        401
      )
    );
  }

  await appointment.remove();

  res.status(200).json({ success: true, data: {} });
});

// @desc    Get appointments for counselor
// @route   GET /api/appointments/counselor/:id
// @access  Private/Admin
exports.getCounselorAppointments = asyncHandler(async (req, res, next) => {
  const appointments = await Appointment.find({
    counselor: req.params.id
  }).populate('user');

  res.status(200).json({
    success: true,
    count: appointments.length,
    data: appointments
  });
});