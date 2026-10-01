const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  fullName: { type: String, required: true },
  idNumber: { type: String, required: true },
  seatId: { type: String, default: '' },
  seatLabel: { type: String, default: '' },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'cancelled'],
    default: 'pending'
  },
  registrationTime: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
}, { timestamps: true });

registrationSchema.index({ eventId: 1, idNumber: 1 });

module.exports = mongoose.model('Registration', registrationSchema);
