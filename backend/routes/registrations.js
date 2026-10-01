const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Registration = require('../models/Registration');
const Seat = require('../models/Seat');
const Service = require('../models/Service');
const { protect, adminOnly } = require('../middleware/auth');

// POST /api/registrations - User registers for an Other event
router.post('/', protect, async (req, res) => {
  try {
    const { eventId, fullName, idNumber, notes } = req.body;
    if (!eventId || !fullName || !idNumber) {
      return res.status(400).json({ message: 'eventId, fullName, and idNumber are required' });
    }

    const event = await Service.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Check if user already registered for this event with this idNumber
    const existing = await Registration.findOne({ eventId, idNumber: idNumber.trim() });
    if (existing) {
      return res.status(400).json({
        message: 'A registration with this ID already exists for this event.',
        registration: existing
      });
    }

    const validUserId = (req.user?._id && mongoose.Types.ObjectId.isValid(req.user._id) && !req.user.isGuest)
      ? req.user._id
      : null;

    const registration = await Registration.create({
      eventId,
      userId: validUserId,
      fullName: fullName.trim(),
      idNumber: idNumber.trim(),
      status: 'pending',
      notes: notes || '',
    });

    res.status(201).json({
      message: 'Registration submitted successfully. Pending Admin seat assignment.',
      registration
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/registrations - Admin views all registrations for an event
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { eventId } = req.query;
    if (!eventId) return res.status(400).json({ message: 'eventId query parameter is required' });

    const event = await Service.findById(eventId);
    if (event && req.user.email !== 'admin@church.com') {
      const isOwner = (event.createdBy && event.createdBy.toString() === req.user._id.toString()) ||
        (event.organization && req.user.organization && event.organization.toLowerCase() === req.user.organization.toLowerCase());
      if (!isOwner) {
        return res.status(403).json({ message: 'Forbidden: You do not own this event' });
      }
    }

    const registrations = await Registration.find({ eventId }).sort({ createdAt: -1 });
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/registrations/my - User checks their own registration & booking for an event
router.get('/my', protect, async (req, res) => {
  try {
    const { eventId, idNumber } = req.query;
    if (!eventId) return res.status(400).json({ message: 'eventId is required' });

    let query = { eventId };
    if (idNumber) {
      query.idNumber = idNumber.trim();
    } else if (req.user?._id && mongoose.Types.ObjectId.isValid(req.user._id) && !req.user.isGuest) {
      query.$or = [{ userId: req.user._id }, { fullName: req.user.name }];
    } else if (req.user?.name && req.user.name !== 'Guest Attendee') {
      query.fullName = req.user.name;
    }

    const registration = await Registration.findOne(query).sort({ createdAt: -1 });
    res.json(registration || null);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/registrations/:id - Admin cancels registration
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const reg = await Registration.findById(req.params.id);
    if (!reg) return res.status(404).json({ message: 'Registration not found' });

    // If a seat was assigned, release it
    if (reg.seatId && reg.eventId) {
      await Seat.findOneAndUpdate(
        { serviceId: reg.eventId, seatId: reg.seatId },
        { status: 'available', assignedName: '', assignedId: '', assignedTo: '' }
      );
    }

    await Registration.findByIdAndDelete(req.params.id);
    res.json({ message: 'Registration deleted and seat released' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
