const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  seatId: { type: String, required: true, unique: true },
  section: { type: String, required: true },
  sectionCode: { type: String, required: true },
  row: { type: String, required: true },
  number: { type: Number, required: true },
  status: {
    type: String,
    enum: ['available', 'occupied', 'reserved', 'held', 'blocked'],
    default: 'available'
  },
  assignedTo: { type: String, default: '' },
  assignedName: { type: String, default: '' },
  groupSize: { type: Number, default: 1 },
  notes: { type: String, default: '' },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', default: null },
}, { timestamps: true });

module.exports = mongoose.model('Seat', seatSchema);
