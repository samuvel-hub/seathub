const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  name: { type: String, required: true, trim: true },
  organization: { type: String, default: '', trim: true, index: true },
  organizationId: { type: String, default: '', index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, default: Date.now },
  startDate: { type: String, default: '' },
  endDate: { type: String, default: '' },
  time: { type: String, default: '09:00 AM' },
  startTime: { type: String, default: '09:00 AM' },
  endTime: { type: String, default: '10:30 AM' },
  type: { type: String, default: 'Event' },
  isActive: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['Upcoming', 'Active', 'Inactive'],
    default: 'Upcoming',
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

module.exports = mongoose.models.Event || mongoose.model('Event', eventSchema, 'services');
