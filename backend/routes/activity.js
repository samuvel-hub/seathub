const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');
const Service = require('../models/Service');
const { protect, adminOnly } = require('../middleware/auth');

// GET /api/activity - Scoped strictly to authenticated Admin and their events (Change 10)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const org = req.user.organization ? req.user.organization.trim() : '';
    const userId = req.user._id;

    // 1. Gather all events belonging to this admin / organization
    const eventQueryConditions = [
      { createdBy: userId },
      { organizationId: userId.toString() },
    ];
    if (org && org !== 'General Organization') {
      eventQueryConditions.push({ organization: new RegExp(`^${org}$`, 'i') });
    }
    // For legacy default admin (Pastor Sarah), also include legacy unassigned events
    if (req.user.email === 'admin@church.com') {
      eventQueryConditions.push(
        { organization: 'Grace Church' },
        { createdBy: null },
        { createdBy: { $exists: false } }
      );
    }

    const ownedEvents = await Service.find({ $or: eventQueryConditions }).select('eventId name');
    const ownedEventIds = ownedEvents.map(e => e.eventId).filter(Boolean);
    const ownedEventNames = ownedEvents.map(e => e.name).filter(Boolean);

    // 2. Build ActivityLog filter: Only logs by this admin OR for this admin's events OR organization
    const orConditions = [
      { userId: userId },
      { organizationId: userId.toString() },
    ];

    if (org && org !== 'General Organization') {
      orConditions.push({ organization: new RegExp(`^${org}$`, 'i') });
    } else if (req.user.email === 'admin@church.com') {
      orConditions.push({ organization: 'Grace Church' });
    }

    if (ownedEventIds.length > 0) {
      orConditions.push({ eventId: { $in: ownedEventIds } });
      ownedEventIds.forEach(eid => {
        orConditions.push({ details: new RegExp(`\\(${eid}\\)`, 'i') });
      });
    }

    ownedEventNames.forEach(ename => {
      orConditions.push({ details: new RegExp(`"${ename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i') });
    });

    const logs = await ActivityLog.find({ $or: orConditions }).sort({ timestamp: -1 }).limit(limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
