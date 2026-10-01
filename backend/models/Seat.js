const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  seatId: { type: String, required: true },
  seatNo: { type: String, default: '', index: true, uppercase: true, trim: true },
  eventId: { type: String, default: '', index: true, uppercase: true, trim: true },
  serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', default: null },
  section: { type: String, required: true },
  sectionCode: { type: String, required: true },
  row: { type: String, required: true },
  number: { type: Number, required: true },
  category: {
    type: String,
    default: 'general'
  },
  status: {
    type: String,
    enum: ['available', 'occupied', 'reserved', 'held', 'blocked'],
    default: 'available'
  },
  assignedTo: { type: String, default: '' },
  assignedName: { type: String, default: '' },
  assignedId: { type: String, default: '' },
  groupSize: { type: Number, default: 1 },
  notes: { type: String, default: '' },
  reservationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', default: null },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
}, { timestamps: true });

seatSchema.index({ eventId: 1, seatNo: 1 });
seatSchema.index({ serviceId: 1, seatId: 1 }, { unique: false });
seatSchema.index({ serviceId: 1, sectionCode: 1, row: 1, number: 1 });

module.exports = mongoose.model('Seat', seatSchema);
