const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  action: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userName: { type: String, default: 'System' },
  seatId: { type: String, default: '' },
  seatLabel: { type: String, default: '' },
  details: { type: String, default: '' },
  eventId: { type: String, default: '', index: true },
  organization: { type: String, default: '' },
  organizationId: { type: String, default: '', index: true },
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('ActivityLog', activityLogSchema);
