const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  type: { type: String, default: 'Sunday Service' },
  isActive: { type: Boolean, default: false },
  attendanceTarget: { type: Number, default: 800 },
  notes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
