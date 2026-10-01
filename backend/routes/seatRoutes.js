const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Seat = require('../models/Seat');
const Service = require('../models/Service');
const Registration = require('../models/Registration');
const ActivityLog = require('../models/ActivityLog');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');

function isEventOwner(event, user) {
  if (!user) return false;
  if (user.email === 'admin@church.com') return true;
  if (event.createdBy && event.createdBy.toString() === user._id.toString()) return true;
  if (event.organizationId && event.organizationId === user._id.toString()) return true;
  if (user.organization && event.organization && event.organization.toLowerCase() === user.organization.toLowerCase()) return true;
  return false;
}

// Helper to resolve effective event document
async function resolveEvent(eventIdentifier, user = null) {
  if (!eventIdentifier || eventIdentifier === 'undefined' || eventIdentifier === 'null') {
    let query = { $or: [{ isActive: true }, { status: 'Active' }] };
    if (user && user.role === 'admin') {
      const orgFilter = [];
      if (user.organization) orgFilter.push({ organization: new RegExp(`^${user.organization.trim()}$`, 'i') });
      if (user._id) {
        orgFilter.push({ createdBy: user._id });
        orgFilter.push({ organizationId: user._id.toString() });
      }
      if (user.email === 'admin@church.com') {
        orgFilter.push({ organization: 'Grace Church' });
        orgFilter.push({ organization: { $exists: false } });
        orgFilter.push({ organization: null });
      }
      if (orgFilter.length > 0) {
        query = {
          $and: [
            { $or: [{ isActive: true }, { status: 'Active' }] },
            { $or: orgFilter }
          ]
        };
      }
    }
    let active = await Service.findOne(query);
    if (!active && user && user.role === 'admin') {
      const fallbackFilter = [];
      if (user.organization) fallbackFilter.push({ organization: new RegExp(`^${user.organization.trim()}$`, 'i') });
      if (user._id) {
        fallbackFilter.push({ createdBy: user._id });
        fallbackFilter.push({ organizationId: user._id.toString() });
      }
      if (fallbackFilter.length > 0) {
        active = await Service.findOne({ $or: fallbackFilter });
      }
    }
    return active;
  }
  // Try by eventId string (case-insensitive)
  let event = await Service.findOne({ eventId: new RegExp(`^${eventIdentifier.trim()}$`, 'i') });
  if (!event && mongoose.Types.ObjectId.isValid(eventIdentifier)) {
    event = await Service.findById(eventIdentifier);
  }
  return event;
}

// GET /api/seats/stats - Get seat counts for an event
router.get('/stats', optionalAuth, async (req, res) => {
  try {
    const event = await resolveEvent(req.query.eventId || req.query.serviceId, req.user);
    if (!event) {
      return res.json({ total: 0, available: 0, occupied: 0, reserved: 0, held: 0, blocked: 0 });
    }
    const filter = {
      $or: [
        { eventId: event.eventId },
        { serviceId: event._id },
      ]
    };
    const total = await Seat.countDocuments(filter);
    const available = await Seat.countDocuments({ ...filter, status: 'available' });
    const occupied = await Seat.countDocuments({ ...filter, status: 'occupied' });
    const reserved = await Seat.countDocuments({ ...filter, status: 'reserved' });
    const held = await Seat.countDocuments({ ...filter, status: 'held' });
    const blocked = await Seat.countDocuments({ ...filter, status: 'blocked' });
    res.json({ total, available, occupied, reserved, held, blocked });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/seats/:eventId - Get seats for a specific event (e.g. /api/seats/EVENT001)
// Public / Guest & Admin Accessible
router.get('/:eventId', async (req, res, next) => {
  const param = req.params.eventId;
  // If param is a known subroute like 'stats' or 'assign', pass to next
  if (['stats', 'assign', 'sections', 'rows', 'bulk-update'].includes(param)) {
    return next();
  }

  try {
    const event = await resolveEvent(param);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const seats = await Seat.find({
      $or: [
        { eventId: event.eventId },
        { serviceId: event._id }
      ]
    }).sort({ sectionCode: 1, row: 1, number: 1 });

    // Ensure all seats have seatNo and eventId populated in response
    const enriched = seats.map(s => {
      const doc = s.toObject();
      if (!doc.seatNo) doc.seatNo = `${s.row}${s.number}`;
      if (!doc.eventId) doc.eventId = event.eventId;
      return doc;
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/seats - Query seats by eventId or serviceId
router.get('/', optionalAuth, async (req, res) => {
  try {
    const event = await resolveEvent(req.query.eventId || req.query.serviceId, req.user);
    if (!event) {
      return res.json([]);
    }
    const filter = {
      $or: [
        { eventId: event.eventId },
        { serviceId: event._id }
      ]
    };
    const seats = await Seat.find(filter).sort({ sectionCode: 1, row: 1, number: 1 });
    const enriched = seats.map(s => {
      const doc = s.toObject();
      if (!doc.seatNo) doc.seatNo = `${s.row}${s.number}`;
      if (!doc.eventId) doc.eventId = event.eventId;
      return doc;
    });
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/seats/assign - Admin manual assignment
router.post('/assign', protect, adminOnly, async (req, res) => {
  try {
    const { eventId, registrationId, seatId, attendeeName, idNumber } = req.body;
    if (!seatId) return res.status(400).json({ message: 'seatId is required' });

    const event = await resolveEvent(eventId, req.user);
    if (!event) return res.status(400).json({ message: 'Event not found' });
    if (!isEventOwner(event, req.user)) {
      return res.status(403).json({ message: 'Forbidden: You do not own this event' });
    }

    const cleanSeat = seatId.trim().toUpperCase();

    // Atomically find and update ONLY if seat status is 'available'
    const seat = await Seat.findOneAndUpdate(
      {
        $or: [
          { eventId: event.eventId, seatNo: cleanSeat },
          { serviceId: event._id, seatId: seatId },
          { serviceId: event._id, seatNo: cleanSeat },
        ],
        status: 'available',
      },
      {
        $set: {
          status: 'occupied',
          assignedName: attendeeName || '',
          assignedId: idNumber || '',
          assignedTo: req.user._id ? String(req.user._id) : '',
        }
      },
      { new: true }
    );

    if (!seat) {
      return res.status(409).json({ message: 'Sorry, this seat has already been booked. Please select another seat.' });
    }

    let registration = null;
    const seatLabel = `${seat.section} - Row ${seat.row} Seat ${seat.number}`;

    if (registrationId) {
      registration = await Registration.findByIdAndUpdate(
        registrationId,
        {
          seatId: seat.seatId,
          seatLabel: seatLabel,
          status: 'assigned',
        },
        { new: true }
      );
    }

    try {
      await ActivityLog.create({
        action: 'Seat assigned',
        userId: mongoose.Types.ObjectId.isValid(req.user._id) ? req.user._id : undefined,
        userName: req.user.name,
        seatId: seat.seatId,
        seatLabel,
        details: `Assigned to ${attendeeName || 'User'} (ID: ${idNumber || 'N/A'}) in ${event.name}`,
      });
    } catch (e) {
      // Non-blocking log
    }

    res.json({
      message: 'Seat booked successfully',
      seat,
      registration,
      seatLabel,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/seats/sections - Admin adds custom section
router.post('/sections', protect, adminOnly, async (req, res) => {
  try {
    const { eventId, name, code } = req.body;
    if (!name || !code) return res.status(400).json({ message: 'Section name and code are required' });
    const event = await resolveEvent(eventId, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!isEventOwner(event, req.user)) {
      return res.status(403).json({ message: 'Forbidden: You do not own this event' });
    }

    const secCode = code.trim().toUpperCase();
    const exists = await Seat.findOne({
      $or: [{ eventId: event.eventId }, { serviceId: event._id }],
      sectionCode: secCode
    });
    if (exists) return res.status(400).json({ message: 'Section code already exists in this event' });

    const newSeats = [];
    for (let n = 1; n <= 10; n++) {
      newSeats.push({
        seatId: `${secCode}-A-${n}`,
        seatNo: `A${n}`,
        eventId: event.eventId,
        serviceId: event._id,
        section: name.trim(),
        sectionCode: secCode,
        row: 'A',
        number: n,
        category: 'general',
        status: 'available',
      });
    }
    await Seat.insertMany(newSeats);
    res.status(201).json({ message: 'Section created with default Row A (10 seats)', sectionCode: secCode, section: name.trim() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/seats/sections - Admin edits a section name
router.patch('/sections', protect, adminOnly, async (req, res) => {
  try {
    const { eventId, sectionCode, newName } = req.body;
    if (!sectionCode || !newName) return res.status(400).json({ message: 'sectionCode and newName required' });
    const event = await resolveEvent(eventId, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!isEventOwner(event, req.user)) {
      return res.status(403).json({ message: 'Forbidden: You do not own this event' });
    }

    const result = await Seat.updateMany(
      {
        $or: [{ eventId: event.eventId }, { serviceId: event._id }],
        sectionCode: sectionCode
      },
      { $set: { section: newName.trim() } }
    );
    res.json({ message: 'Section name updated', modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/seats/sections - Admin deletes a section
router.delete('/sections', protect, adminOnly, async (req, res) => {
  try {
    const { eventId, sectionCode } = req.body;
    if (!sectionCode) return res.status(400).json({ message: 'sectionCode is required' });
    const event = await resolveEvent(eventId, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!isEventOwner(event, req.user)) {
      return res.status(403).json({ message: 'Forbidden: You do not own this event' });
    }

    const occupiedSeats = await Seat.find({
      $or: [{ eventId: event.eventId }, { serviceId: event._id }],
      sectionCode,
      status: { $in: ['occupied', 'reserved', 'held'] },
    });
    if (occupiedSeats.length > 0) {
      return res.status(400).json({ message: `Cannot delete section: ${occupiedSeats.length} seat(s) are occupied or reserved.` });
    }

    const result = await Seat.deleteMany({
      $or: [{ eventId: event.eventId }, { serviceId: event._id }],
      sectionCode
    });
    res.json({ message: 'Section deleted successfully', deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/seats/rows - Admin adds a custom row
router.post('/rows', protect, adminOnly, async (req, res) => {
  try {
    const { eventId, sectionCode, rowName, seatCount } = req.body;
    if (!sectionCode || !rowName || !seatCount) {
      return res.status(400).json({ message: 'sectionCode, rowName, and seatCount are required' });
    }
    const count = parseInt(seatCount, 10);
    if (isNaN(count) || count < 1) {
      return res.status(400).json({ message: 'seatCount must be at least 1' });
    }
    const event = await resolveEvent(eventId, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!isEventOwner(event, req.user)) {
      return res.status(403).json({ message: 'Forbidden: You do not own this event' });
    }
    const cleanRow = rowName.trim().toUpperCase();

    const sampleSeat = await Seat.findOne({
      $or: [{ eventId: event.eventId }, { serviceId: event._id }],
      sectionCode
    });
    if (!sampleSeat) return res.status(404).json({ message: 'Section not found' });

    const rowExists = await Seat.findOne({
      $or: [{ eventId: event.eventId }, { serviceId: event._id }],
      sectionCode,
      row: cleanRow
    });
    if (rowExists) {
      return res.status(400).json({ message: `Row ${cleanRow} already exists in this section` });
    }

    const newSeats = [];
    for (let n = 1; n <= count; n++) {
      newSeats.push({
        seatId: `${sectionCode}-${cleanRow}-${n}`,
        seatNo: `${cleanRow}${n}`,
        eventId: event.eventId,
        serviceId: event._id,
        section: sampleSeat.section,
        sectionCode,
        row: cleanRow,
        number: n,
        category: 'general',
        status: 'available',
      });
    }

    await Seat.insertMany(newSeats);
    res.status(201).json({ message: `Added Row ${cleanRow} with ${count} seats`, added: newSeats.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/seats/rows - Admin edits row
router.patch('/rows', protect, adminOnly, async (req, res) => {
  try {
    const { eventId, sectionCode, rowName, newRowName, newSeatCount } = req.body;
    if (!sectionCode || !rowName) return res.status(400).json({ message: 'sectionCode and rowName are required' });

    const event = await resolveEvent(eventId, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!isEventOwner(event, req.user)) {
      return res.status(403).json({ message: 'Forbidden: You do not own this event' });
    }

    const existingSeats = await Seat.find({
      $or: [{ eventId: event.eventId }, { serviceId: event._id }],
      sectionCode,
      row: rowName
    }).sort({ number: 1 });
    if (!existingSeats.length) return res.status(404).json({ message: 'Row not found' });

    const targetRowName = newRowName ? newRowName.trim().toUpperCase() : rowName;
    const currentCount = existingSeats.length;
    const targetCount = newSeatCount ? parseInt(newSeatCount, 10) : currentCount;

    if (targetRowName !== rowName) {
      const conflict = await Seat.findOne({
        $or: [{ eventId: event.eventId }, { serviceId: event._id }],
        sectionCode,
        row: targetRowName
      });
      if (conflict) return res.status(400).json({ message: `Row ${targetRowName} already exists` });
    }

    if (targetCount < currentCount) {
      const seatsToRemove = existingSeats.slice(targetCount);
      const occupied = seatsToRemove.filter(s => ['occupied', 'reserved', 'held'].includes(s.status));
      if (occupied.length > 0) {
        return res.status(400).json({
          message: `Cannot reduce row: ${occupied.length} seat(s) being removed are occupied or reserved.`
        });
      }
      const idsToRemove = seatsToRemove.map(s => s._id);
      await Seat.deleteMany({ _id: { $in: idsToRemove } });
    } else if (targetCount > currentCount) {
      const sample = existingSeats[0];
      const addedSeats = [];
      for (let n = currentCount + 1; n <= targetCount; n++) {
        addedSeats.push({
          seatId: `${sectionCode}-${targetRowName}-${n}`,
          seatNo: `${targetRowName}${n}`,
          eventId: event.eventId,
          serviceId: event._id,
          section: sample.section,
          sectionCode,
          row: targetRowName,
          number: n,
          category: 'general',
          status: 'available',
        });
      }
      await Seat.insertMany(addedSeats);
    }

    if (targetRowName !== rowName) {
      const remaining = await Seat.find({
        $or: [{ eventId: event.eventId }, { serviceId: event._id }],
        sectionCode,
        row: rowName
      });
      for (const s of remaining) {
        s.row = targetRowName;
        s.seatNo = `${targetRowName}${s.number}`;
        s.seatId = `${sectionCode}-${targetRowName}-${s.number}`;
        await s.save();
      }
    }

    res.json({ message: `Row ${targetRowName} updated to ${targetCount} seats` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/seats/rows - Admin deletes a row
router.delete('/rows', protect, adminOnly, async (req, res) => {
  try {
    const { eventId, sectionCode, rowName } = req.body;
    if (!sectionCode || !rowName) return res.status(400).json({ message: 'sectionCode and rowName required' });
    const event = await resolveEvent(eventId, req.user);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!isEventOwner(event, req.user)) {
      return res.status(403).json({ message: 'Forbidden: You do not own this event' });
    }

    const existingSeats = await Seat.find({
      $or: [{ eventId: event.eventId }, { serviceId: event._id }],
      sectionCode,
      row: rowName
    });
    if (!existingSeats.length) return res.status(404).json({ message: 'Row not found' });

    const occupied = existingSeats.filter(s => ['occupied', 'reserved', 'held'].includes(s.status));
    if (occupied.length > 0) {
      return res.status(400).json({ message: `Cannot delete row: ${occupied.length} seat(s) are occupied or reserved.` });
    }

    const result = await Seat.deleteMany({
      $or: [{ eventId: event.eventId }, { serviceId: event._id }],
      sectionCode,
      row: rowName
    });
    res.json({ message: `Row ${rowName} deleted (${result.deletedCount} seats removed)` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/seats/:id - Update seat details
router.patch('/:id', optionalAuth, async (req, res) => {
  try {
    const seatParam = req.params.id;
    const requestedEventId = req.query.eventId || req.body.eventId;
    let query = {};

    if (mongoose.Types.ObjectId.isValid(seatParam)) {
      query._id = seatParam;
    } else {
      query.seatId = seatParam;
      const event = await resolveEvent(requestedEventId, req.user);
      if (event) {
        query.$or = [{ eventId: event.eventId }, { serviceId: event._id }];
      }
    }

    let targetSeat = await Seat.findOne(query);
    if (!targetSeat) {
      targetSeat = await Seat.findOne({ seatId: seatParam });
      if (!targetSeat) return res.status(404).json({ message: 'Seat not found' });
    }

    const user = req.user || { role: 'guest' };

    // Guest updates
    if (user.role !== 'admin') {
      if (req.body.status === 'blocked' || req.body.status === 'reserved') {
        return res.status(403).json({ message: 'Guests cannot block or reserve seats.' });
      }
      if (req.body.status === 'available') {
        return res.status(403).json({ message: 'Only administrators can release seats.' });
      }
      if (['occupied', 'reserved', 'blocked'].includes(targetSeat.status)) {
        return res.status(403).json({ message: 'This seat is already occupied or restricted. Only an admin can reassign or unblock it.' });
      }

      const updateData = {
        status: req.body.status || 'occupied',
        assignedName: req.body.assignedName || 'Guest Attendee',
        assignedId: req.body.assignedId || req.body.idNumber || '',
        assignedTo: user._id ? String(user._id) : 'Guest',
        notes: req.body.notes || '',
      };
      if (req.body.category) updateData.category = req.body.category;

      const seat = await Seat.findOneAndUpdate(
        {
          _id: targetSeat._id,
          status: { $in: ['available', 'held'] },
        },
        { $set: updateData },
        { new: true }
      );

      if (!seat) {
        return res.status(409).json({ message: 'Sorry, this seat has already been booked. Please select another seat.' });
      }

      return res.json(seat);
    }

    // Admin updates: verify ownership
    const event = await resolveEvent(targetSeat.eventId || targetSeat.serviceId, user);
    if (event && !isEventOwner(event, user)) {
      return res.status(403).json({ message: 'Forbidden: You do not own this event' });
    }

    const seat = await Seat.findByIdAndUpdate(targetSeat._id, req.body, { new: true });
    if (!seat) return res.status(404).json({ message: 'Seat not found' });
    res.json(seat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/seats/bulk-update - Bulk update seats (Admin Only)
router.post('/bulk-update', protect, adminOnly, async (req, res) => {
  try {
    const { seatIds, update } = req.body;
    if (seatIds && seatIds.length > 0) {
      const sample = await Seat.findOne({ seatId: { $in: seatIds } });
      if (sample) {
        const event = await resolveEvent(sample.eventId || sample.serviceId, req.user);
        if (event && !isEventOwner(event, req.user)) {
          return res.status(403).json({ message: 'Forbidden: You do not own this event' });
        }
      }
    }
    await Seat.updateMany({ seatId: { $in: seatIds } }, update);
    const seats = await Seat.find({ seatId: { $in: seatIds } });
    res.json(seats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
