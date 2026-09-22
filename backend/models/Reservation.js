const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  guestName: { type: String, required: true },
  guestPhone: { type: String, default: '' },
  groupSize: { type: Number, required: true, default: 1 },
  seats: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Seat' }],
  seatIds: [{ type: String }],
  status: { type: String, enum: ['confirmed', 'pending', 'cancelled'], default: 'confirmed' },
  notes: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Reservation', reservationSchema);
