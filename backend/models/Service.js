const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  eventId: { type: String, uppercase: true, trim: true, index: true },
  name: { type: String, required: true },
  organization: { type: String, default: '', trim: true, index: true },
  organizationId: { type: String, default: '', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, required: true },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
  time: { type: String, required: true },
  startTime: { type: String, default: '' },
  endTime: { type: String, default: '' },
  type: { type: String, default: 'Service' },
  isActive: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['Upcoming', 'Active', 'Inactive'],
    default: 'Upcoming'
  },
  eventState: {
    type: String,
    enum: ['NOT STARTED', 'STARTED', 'ENDED'],
    default: 'NOT STARTED',
  },
  attendanceTarget: { type: Number, default: 800 },
  notes: { type: String, default: '' },
  manuallyActivated: { type: Boolean, default: false },
  category: {
    type: String,
    default: 'College / Academic',
    trim: true,
  },
  stageLabel: { type: String, default: 'STAGE / PODIUM' },
  seatingLayoutType: {
    type: String,
    enum: ['standard', 'section_based'],
    default: 'standard'
  },
  seatingLayoutConfig: { type: mongoose.Schema.Types.Mixed, default: null },
  bookingRequirements: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true });

module.exports = mongoose.model('Service', serviceSchema);
