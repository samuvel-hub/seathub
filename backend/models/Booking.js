const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  seatNo: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  seatId: {
    type: String,
    default: '',
  },
  name: {
    type: String,
    default: '',
    trim: true,
  },
  guestId: {
    type: String,
    default: '',
    trim: true,
  },
  phone: { type: String, default: '', trim: true },
  email: { type: String, default: '', trim: true },
  studentId: { type: String, default: '', trim: true },
  memberId: { type: String, default: '', trim: true },
  gender: { type: String, default: '', trim: true },
  age: { type: String, default: '', trim: true },
  address: { type: String, default: '', trim: true },
  formData: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: {
    type: String,
    enum: ['booked', 'cancelled'],
    default: 'booked',
  },
  attendanceStatus: {
    type: String,
    enum: ['At Venue', 'On the Way', 'Not Attending', 'No Update'],
    default: 'No Update',
  },
  attendanceUpdatedAt: {
    type: Date,
  },
  eventName: {
    type: String,
    default: '',
  },
  bookingDate: {
    type: Date,
    default: Date.now,
  },
  notes: {
    type: String,
    default: '',
  },
}, { timestamps: true });

// Compound index for querying event bookings and preventing race conditions
bookingSchema.index({ eventId: 1, seatNo: 1, status: 1 });

module.exports = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
