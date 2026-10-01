const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Service = require('../models/Service');
const Seat = require('../models/Seat');
const Booking = require('../models/Booking');
const Registration = require('../models/Registration');
const ActivityLog = require('../models/ActivityLog');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');
const { generateNextEventId } = require('../utils/initDb');
const { validateTimeRange, parseAndValidateTime } = require('../utils/timeValidator');

function parseTimeToMinutes(timeStr) {
  const parsed = parseAndValidateTime(timeStr);
  return parsed.valid ? parsed.totalMinutes : null;
}

function combineDateAndTime(dateStr, timeStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const parsed = parseAndValidateTime(timeStr);
    if (parsed.valid) {
      d.setHours(parsed.hours, parsed.minutes, 0, 0);
    }
    return d;
  } catch (e) {
    return null;
  }
}

function validateStartEndDateTime(startDate, startTime, endDate, endTime) {
  if (!startTime || !endTime) return '';
  const result = validateTimeRange(startTime, endTime, startDate, endDate);
  return result.is_valid ? '' : result.error;
}

function getEventEffectiveState(event) {
  if (!event) return 'NOT STARTED';

  // If explicitly active or manually activated, the event is ACTIVE / STARTED
  if (event.isActive === true || event.manuallyActivated === true) {
    return 'STARTED';
  }

  if (event.eventState === 'ENDED') return 'ENDED';

  const now = new Date();
  const sDate = event.startDate || (event.date ? new Date(event.date).toISOString().split('T')[0] : '');
  const eDate = event.endDate || sDate;
  const startDt = combineDateAndTime(sDate, event.startTime || event.time);
  const endDt = combineDateAndTime(eDate, event.endTime);

  // Automatic End: current date/time >= configured end date/time
  if (endDt && now.getTime() >= endDt.getTime()) {
    return 'ENDED';
  }

  // If manually started, it's currently STARTED
  if (event.eventState === 'STARTED') {
    return 'STARTED';
  }

  // Automatic Start: current date/time >= configured start date/time
  if (startDt && now.getTime() >= startDt.getTime()) {
    return 'STARTED';
  }

  return 'NOT STARTED';
}

// POST /api/events/validate-time - Strict Time Range Validator (JSON Output)
router.post('/validate-time', (req, res) => {
  const { startTime, endTime, startDate, endDate } = req.body;
  const result = validateTimeRange(startTime, endTime, startDate, endDate);
  res.json(result);
});

// GET /api/events - List events (Filtered by Organization for Admins; isolated)
router.get('/', optionalAuth, async (req, res) => {
  try {
    let filter = {};

    // Multi-tenant organization isolation:
    // If an Admin is logged in, they ONLY see their own organization's events!
    if (req.user && req.user.role === 'admin') {
      const orgName = req.user.organization || '';
      const userId = req.user._id;
      const orgFilter = [
        { createdBy: userId },
        { organizationId: userId.toString() },
      ];
      if (orgName && orgName !== 'General Organization') {
        orgFilter.push({ organization: orgName });
      }
      // If legacy default admin (Pastor Sarah), also include legacy unassigned events
      if (req.user.email === 'admin@church.com') {
        orgFilter.push(
          { createdBy: null },
          { createdBy: { $exists: false } },
          { organizationId: '' },
          { organizationId: { $exists: false } },
          { organization: 'Grace Church' }
        );
      }
      filter = { $or: orgFilter };
    }

    const services = await Service.find(filter).sort({ date: -1, createdAt: -1 });

    // Check and auto-update eventState (NOT STARTED -> STARTED -> ENDED) & ensure eventId exists
    const updatedServices = await Promise.all(
      services.map(async (s) => {
        let changed = false;
        const effectiveState = getEventEffectiveState(s);
        if (s.eventState !== effectiveState) {
          s.eventState = effectiveState;
          if (effectiveState === 'ENDED') {
            s.status = 'Inactive';
            s.isActive = false;
          } else if (effectiveState === 'STARTED') {
            s.status = 'Active';
            s.isActive = true;
          }
          changed = true;
        }
        if (!s.eventId) {
          s.eventId = await generateNextEventId();
          changed = true;
        }
        if (changed) {
          await Service.updateOne(
            { _id: s._id },
            { $set: { status: s.status, isActive: s.isActive, eventState: s.eventState, eventId: s.eventId } }
          );
        }
        return s;
      })
    );

    res.json(updatedServices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/events/:eventId - Get single event by eventId (e.g. EVENT001) or _id (Public / Guest & Admin)
router.get('/:eventId', async (req, res) => {
  try {
    const param = req.params.eventId;
    let service = null;

    if (param) {
      // Try by eventId first (case-insensitive)
      service = await Service.findOne({ eventId: new RegExp(`^${param.trim()}$`, 'i') });
      
      // Fallback by MongoDB _id if valid
      if (!service && mongoose.Types.ObjectId.isValid(param)) {
        service = await Service.findById(param);
      }
    }

    if (!service) {
      return res.status(404).json({ message: 'Event not found' });
    }

    let changed = false;
    if (!service.eventId) {
      service.eventId = await generateNextEventId();
      changed = true;
    }

    const effectiveState = getEventEffectiveState(service);
    if (service.eventState !== effectiveState) {
      service.eventState = effectiveState;
      if (effectiveState === 'ENDED') {
        service.status = 'Inactive';
        service.isActive = false;
      } else if (effectiveState === 'STARTED') {
        service.status = 'Active';
        service.isActive = true;
      }
      changed = true;
    }

    if (changed) {
      await Service.updateOne(
        { _id: service._id },
        { $set: { eventId: service.eventId, eventState: service.eventState, status: service.status, isActive: service.isActive } }
      );
    }

    res.json(service);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/events - Create Event (Admin Only)
function generateInitialLayout(type = 'standard', category = 'Church', customConfig = null, eventId, serviceId) {
  let defaultStageLabel = 'STAGE / PODIUM';
  if (category === 'Church') defaultStageLabel = 'STAGE / ALTAR';
  else if (category === 'College') defaultStageLabel = 'AUDITORIUM STAGE';
  else if (category === 'Conference' || category === 'Seminar') defaultStageLabel = 'PODIUM / STAGE';

  if (type === 'section_based') {
    const config = customConfig || {
      stageLabel: defaultStageLabel,
      sections: [
        {
          name: 'Left Section',
          code: 'LEFT',
          rows: [
            { row: 'A', seatsPerRow: 6 },
            { row: 'B', seatsPerRow: 6 },
            { row: 'C', seatsPerRow: 6 },
          ]
        },
        {
          name: 'Center Section',
          code: 'CENTER',
          rows: [
            { row: 'A', seatsPerRow: 10 },
            { row: 'B', seatsPerRow: 10 },
            { row: 'C', seatsPerRow: 10 },
            { row: 'D', seatsPerRow: 10 },
          ]
        },
        {
          name: 'Right Section',
          code: 'RIGHT',
          rows: [
            { row: 'A', seatsPerRow: 6 },
            { row: 'B', seatsPerRow: 6 },
            { row: 'C', seatsPerRow: 6 },
          ]
        }
      ]
    };
    const seats = [];
    for (const sec of config.sections) {
      for (const r of sec.rows) {
        for (let n = 1; n <= r.seatsPerRow; n++) {
          seats.push({
            seatId: `${sec.code}-${r.row}-${n}`,
            seatNo: `${sec.code}-${r.row}${n}`,
            eventId,
            serviceId,
            section: sec.name,
            sectionCode: sec.code,
            row: r.row,
            number: n,
            category: 'general',
            status: 'available',
          });
        }
      }
    }
    return { config, seats };
  } else {
    // Standard Row & Column
    const config = customConfig || {
      stageLabel: defaultStageLabel,
      rows: [
        { row: 'A', seatsPerRow: 10 },
        { row: 'B', seatsPerRow: 10 },
        { row: 'C', seatsPerRow: 10 },
        { row: 'D', seatsPerRow: 10 },
      ]
    };
    const seats = [];
    for (const r of config.rows) {
      for (let n = 1; n <= r.seatsPerRow; n++) {
        seats.push({
          seatId: `SEC-A-${r.row}-${n}`,
          seatNo: `${r.row}${n}`,
          eventId,
          serviceId,
          section: 'Main Floor',
          sectionCode: 'SEC-A',
          row: r.row,
          number: n,
          category: 'general',
          status: 'available',
        });
      }
    }
    return { config, seats };
  }
}

// POST /api/events - Create Event (Admin Only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const {
      name,
      eventId,
      category,
      type,
      date,
      startDate,
      endDate,
      startTime,
      endTime,
      attendanceTarget,
      notes,
      stageLabel,
      seatingLayoutType,
      seatingLayoutConfig,
      bookingRequirements
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Event name is required' });
    }

    const finalStartDate = startDate || (date ? new Date(date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    const finalEndDate = endDate || finalStartDate;

    const timeErr = validateStartEndDateTime(finalStartDate, startTime || '09:00 AM', finalEndDate, endTime || '10:30 AM');
    if (timeErr) {
      return res.status(400).json({ message: timeErr });
    }

    let finalEventId = '';
    if (eventId && eventId.trim()) {
      finalEventId = eventId.trim().toUpperCase();
      const existing = await Service.findOne({ eventId: finalEventId });
      if (existing) {
        return res.status(400).json({ message: `Event ID "${finalEventId}" already exists. Please choose a unique ID.` });
      }
    } else {
      finalEventId = await generateNextEventId();
    }

    const eventDate = date ? new Date(date) : new Date(finalStartDate);
    const chosenType = (seatingLayoutType === 'section_based') ? 'section_based' : 'standard';
    const chosenCategory = category || 'College / Academic';

    // Default booking requirements if not provided
    const defaultBookingReqs = bookingRequirements || {
      fields: [
        { id: 'fullName', label: 'Full Name', type: 'text', enabled: true, required: true },
        { id: 'phone', label: 'Phone Number', type: 'phone', enabled: true, required: true },
        { id: 'email', label: 'Email Address', type: 'email', enabled: false, required: false },
        { id: 'memberId', label: 'Member ID', type: 'text', enabled: false, required: false },
        { id: 'studentId', label: 'Student ID', type: 'text', enabled: false, required: false },
        { id: 'gender', label: 'Gender', type: 'dropdown', options: ['Male', 'Female', 'Other'], enabled: false, required: false },
        { id: 'age', label: 'Age', type: 'number', enabled: false, required: false },
        { id: 'address', label: 'Address', type: 'text', enabled: false, required: false }
      ],
      customFields: []
    };

    const initialEffectiveState = getEventEffectiveState({
      startDate: finalStartDate,
      endDate: finalEndDate,
      date: eventDate,
      startTime: startTime || '09:00 AM',
      endTime: endTime || '10:30 AM',
      eventState: 'NOT STARTED',
    });

    const service = await Service.create({
      eventId: finalEventId,
      name: name.trim(),
      organization: req.user.organization || 'General Organization',
      organizationId: req.user._id.toString(),
      createdBy: req.user._id,
      category: chosenCategory,
      type: type || 'Event',
      date: eventDate,
      startDate: finalStartDate,
      endDate: finalEndDate,
      time: startTime || '09:00 AM',
      startTime: startTime || '09:00 AM',
      endTime: endTime || '10:30 AM',
      eventState: initialEffectiveState,
      status: initialEffectiveState === 'ENDED' ? 'Inactive' : (initialEffectiveState === 'STARTED' ? 'Active' : 'Upcoming'),
      isActive: initialEffectiveState === 'STARTED',
      attendanceTarget: attendanceTarget || 800,
      notes: notes || '',
      manuallyActivated: false,
      stageLabel: stageLabel || '',
      seatingLayoutType: chosenType,
      bookingRequirements: defaultBookingReqs,
    });

    // Generate initial layout & seats based on chosen layout template
    const { config, seats } = generateInitialLayout(
      chosenType,
      chosenCategory,
      seatingLayoutConfig,
      service.eventId,
      service._id
    );

    service.seatingLayoutConfig = config;
    if (!service.stageLabel) service.stageLabel = config.stageLabel || 'STAGE / PODIUM';
    await service.save();

    if (seats.length > 0) {
      await Seat.insertMany(seats);
    }

    try {
      await ActivityLog.create({
        action: 'Event Created',
        userId: req.user._id,
        userName: req.user.name,
        details: `Created ${chosenCategory} event "${service.name}" (${service.eventId})`,
        eventId: service.eventId,
        organization: service.organization || req.user.organization || '',
        organizationId: service.organizationId || req.user._id.toString(),
      });
    } catch (e) {
      // Non-blocking log
    }

    res.status(201).json(service);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/events/:id/layout - Save Seating Layout Configuration & Sync Seats (Admin Only)
router.put('/:id/layout', protect, adminOnly, async (req, res) => {
  try {
    const param = req.params.id;
    let query = {};
    if (mongoose.Types.ObjectId.isValid(param)) {
      query._id = param;
    } else {
      query.eventId = param.toUpperCase();
    }

    const service = await Service.findOne(query);
    if (!service) return res.status(404).json({ message: 'Event not found' });

    // Multi-tenant authorization check
    const isOwner = service.createdBy && service.createdBy.toString() === req.user._id.toString();
    const isSameOrg = service.organization && service.organization === req.user.organization;
    const isDefaultAdmin = req.user.email === 'admin@church.com';
    if (!isOwner && !isSameOrg && !isDefaultAdmin) {
      return res.status(403).json({ message: 'Forbidden: You do not own this event' });
    }

    const { seatingLayoutType, seatingLayoutConfig, stageLabel, seats: newSeatsList, force } = req.body;

    // Check for booked seats in current database for this event
    const currentBookedSeats = await Seat.find({
      $or: [{ eventId: service.eventId }, { serviceId: service._id }],
      status: { $in: ['occupied', 'reserved'] },
    });

    const newSeatNos = new Set((newSeatsList || []).map(s => (s.seatNo || `${s.row}${s.number}`).toUpperCase()));
    const missingBookedSeats = currentBookedSeats.filter(s => !newSeatNos.has(s.seatNo.toUpperCase()));

    // Requirement 9: Booked seat warning protection
    if (missingBookedSeats.length > 0 && force !== true) {
      return res.status(409).json({
        warning: true,
        message: 'Warning: This seat already has a booking. Changing or deleting this seat may affect the existing booking. Are you sure you want to continue?',
        bookedSeats: missingBookedSeats.map(s => ({ seatNo: s.seatNo, name: s.assignedName, status: s.status })),
      });
    }

    // Update event layout configuration
    if (seatingLayoutType) service.seatingLayoutType = (seatingLayoutType === 'section_based') ? 'section_based' : 'standard';
    if (seatingLayoutConfig) service.seatingLayoutConfig = seatingLayoutConfig;
    if (stageLabel) service.stageLabel = stageLabel;
    await service.save();

    // Synchronize seats in database while strictly preserving booked seat details
    const existingSeats = await Seat.find({
      $or: [{ eventId: service.eventId }, { serviceId: service._id }],
    });
    const existingSeatMap = new Map();
    existingSeats.forEach(s => existingSeatMap.set(s.seatNo.toUpperCase(), s));

    const bulkOps = [];
    const processedSeatNos = new Set();

    for (const s of (newSeatsList || [])) {
      const cleanSeatNo = (s.seatNo || `${s.row}${s.number}`).toUpperCase();
      processedSeatNos.add(cleanSeatNo);

      const existing = existingSeatMap.get(cleanSeatNo);
      if (existing) {
        // If seat exists, preserve occupied / reserved status and assigned names!
        const updates = {
          section: s.section || existing.section,
          sectionCode: s.sectionCode || existing.sectionCode,
          row: s.row || existing.row,
          number: s.number || existing.number,
          x: s.x !== undefined ? s.x : existing.x,
          y: s.y !== undefined ? s.y : existing.y,
        };
        // Only update status if it's currently available or if admin explicitly blocked it
        if (existing.status === 'available' && s.status) {
          updates.status = s.status;
        }
        bulkOps.push({
          updateOne: {
            filter: { _id: existing._id },
            update: { $set: updates },
          },
        });
      } else {
        // Insert new seat
        bulkOps.push({
          insertOne: {
            document: {
              seatId: s.seatId || `SEC-${s.sectionCode || 'A'}-${s.row || 'A'}-${s.number || 1}`,
              seatNo: cleanSeatNo,
              eventId: service.eventId,
              serviceId: service._id,
              section: s.section || 'Main Floor',
              sectionCode: s.sectionCode || 'SEC-A',
              row: s.row || 'A',
              number: s.number || 1,
              category: s.category || 'general',
              status: s.status || 'available',
              x: s.x || 0,
              y: s.y || 0,
            },
          },
        });
      }
    }

    // Delete removed seats (unless they are booked and force is not set)
    for (const [seatNo, existing] of existingSeatMap.entries()) {
      if (!processedSeatNos.has(seatNo)) {
        if (existing.status !== 'occupied' && existing.status !== 'reserved' || force === true) {
          bulkOps.push({
            deleteOne: {
              filter: { _id: existing._id },
            },
          });
        }
      }
    }

    if (bulkOps.length > 0) {
      await Seat.bulkWrite(bulkOps);
    }

    const updatedSeats = await Seat.find({
      $or: [{ eventId: service.eventId }, { serviceId: service._id }],
    }).sort({ sectionCode: 1, row: 1, number: 1 });

    try {
      await ActivityLog.create({
        action: 'Layout Updated',
        userId: req.user._id,
        userName: req.user.name,
        details: `Updated seating layout for "${service.name}" (${service.eventId})`,
        organization: service.organization || req.user.organization || '',
      });
    } catch (e) {
      // Non-blocking log
    }

    res.json({
      message: 'Seating layout and seats synchronized successfully',
      event: service,
      seats: updatedSeats,
    });
  } catch (err) {
    console.error('Error saving event layout:', err);
    res.status(500).json({ message: err.message });
  }
});

// PATCH & PUT /api/events/:id - Edit Event (Admin Only - Organization Protected)
const updateEventHandler = async (req, res) => {
  try {
    const param = req.params.id;
    let query = {};
    if (mongoose.Types.ObjectId.isValid(param)) {
      query._id = param;
    } else {
      query.eventId = param.toUpperCase();
    }

    const existingService = await Service.findOne(query);
    if (!existingService) return res.status(404).json({ message: 'Event not found' });

    // Multi-tenant check: Only owner/same organization or default admin can modify
    const isOwner = existingService.createdBy && existingService.createdBy.toString() === req.user._id.toString();
    const isSameOrg = existingService.organization && existingService.organization === req.user.organization;
    const isDefaultAdmin = req.user.email === 'admin@church.com';
    if (!isOwner && !isSameOrg && !isDefaultAdmin) {
      return res.status(403).json({ message: 'You are not authorized to modify events from another organization.' });
    }

    if (req.body.eventId) {
      req.body.eventId = req.body.eventId.trim().toUpperCase();
      // Verify not conflicting with another event
      const conflict = await Service.findOne({ eventId: req.body.eventId, _id: { $ne: existingService._id } });
      if (conflict) {
        return res.status(400).json({ message: `Event ID "${req.body.eventId}" is already in use.` });
      }
    }

    const targetStartDate = req.body.startDate !== undefined ? req.body.startDate : (existingService.startDate || (existingService.date ? new Date(existingService.date).toISOString().split('T')[0] : ''));
    const targetEndDate = req.body.endDate !== undefined ? req.body.endDate : (existingService.endDate || targetStartDate);
    const targetStartTime = req.body.startTime !== undefined ? req.body.startTime : (existingService.startTime || existingService.time);
    const targetEndTime = req.body.endTime !== undefined ? req.body.endTime : existingService.endTime;

    const timeErr = validateStartEndDateTime(targetStartDate, targetStartTime, targetEndDate, targetEndTime);
    if (timeErr) {
      return res.status(400).json({ message: timeErr });
    }

    if (req.body.startTime && !req.body.time) {
      req.body.time = req.body.startTime;
    }

    if (req.body.isActive === true) {
      req.body.status = 'Active';
      req.body.eventState = 'STARTED';
      req.body.manuallyActivated = true;
    } else if (req.body.isActive === false) {
      req.body.status = 'Inactive';
      req.body.manuallyActivated = false;
      const eDate = targetEndDate || targetStartDate;
      const endDt = combineDateAndTime(eDate, targetEndTime);
      const isPast = endDt && new Date().getTime() >= endDt.getTime();
      req.body.eventState = isPast ? 'ENDED' : 'NOT STARTED';
    }

    const updatedEffectiveState = getEventEffectiveState({
      ...existingService.toObject(),
      ...req.body,
      startDate: targetStartDate,
      endDate: targetEndDate,
      startTime: targetStartTime,
      endTime: targetEndTime,
    });
    if (!req.body.eventState) {
      req.body.eventState = updatedEffectiveState;
    }

    const service = await Service.findByIdAndUpdate(existingService._id, req.body, { new: true });

    if (req.body.isActive === true) {
      const orgFilter = service.organization ? { organization: service.organization } : { createdBy: req.user._id };
      await Service.updateMany(
        { ...orgFilter, _id: { $ne: service._id }, isActive: true },
        { $set: { isActive: false, status: 'Inactive', manuallyActivated: false } }
      );
    }

    // If eventId changed, sync seats and bookings
    if (req.body.eventId) {
      await Seat.updateMany({ serviceId: service._id }, { $set: { eventId: service.eventId } });
      await Booking.updateMany({ eventId: existingService.eventId }, { $set: { eventId: service.eventId } });
    }

    try {
      await ActivityLog.create({
        action: 'Event Updated',
        userId: req.user._id,
        userName: req.user.name,
        details: `Updated event "${service.name}" (${service.eventId})`,
        eventId: service.eventId,
        organization: service.organization || req.user.organization || '',
        organizationId: service.organizationId || req.user._id.toString(),
      });
    } catch (e) {
      // Non-blocking log
    }

    res.json(service);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
router.patch('/:id', protect, adminOnly, updateEventHandler);
router.put('/:id', protect, adminOnly, updateEventHandler);

// POST /api/events/:id/start - Manual start event (Admin Only)
router.post('/:id/start', protect, adminOnly, async (req, res) => {
  try {
    const param = req.params.id;
    let query = {};
    if (mongoose.Types.ObjectId.isValid(param)) {
      query._id = param;
    } else {
      query.eventId = param.toUpperCase();
    }

    const service = await Service.findOne(query);
    if (!service) return res.status(404).json({ message: 'Event not found' });

    const isOwner = service.createdBy && service.createdBy.toString() === req.user._id.toString();
    const isSameOrg = service.organization && service.organization === req.user.organization;
    const isDefaultAdmin = req.user.email === 'admin@church.com';
    if (!isOwner && !isSameOrg && !isDefaultAdmin) {
      return res.status(403).json({ message: 'Forbidden: You do not own this event' });
    }

    service.eventState = 'STARTED';
    service.status = 'Active';
    service.isActive = true;
    service.manuallyActivated = true;
    await service.save();

    try {
      await ActivityLog.create({
        action: 'Event Started',
        userId: req.user._id,
        userName: req.user.name,
        details: `Started event "${service.name}" (${service.eventId})`,
        eventId: service.eventId,
        organization: service.organization || req.user.organization || '',
        organizationId: service.organizationId || req.user._id.toString(),
      });
    } catch (e) {}

    res.json({ message: 'Event started successfully', event: service });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/events/:id/end - Manual end event (Admin Only)
router.post('/:id/end', protect, adminOnly, async (req, res) => {
  try {
    const param = req.params.id;
    let query = {};
    if (mongoose.Types.ObjectId.isValid(param)) {
      query._id = param;
    } else {
      query.eventId = param.toUpperCase();
    }

    const service = await Service.findOne(query);
    if (!service) return res.status(404).json({ message: 'Event not found' });

    const isOwner = service.createdBy && service.createdBy.toString() === req.user._id.toString();
    const isSameOrg = service.organization && service.organization === req.user.organization;
    const isDefaultAdmin = req.user.email === 'admin@church.com';
    if (!isOwner && !isSameOrg && !isDefaultAdmin) {
      return res.status(403).json({ message: 'Forbidden: You do not own this event' });
    }

    service.eventState = 'ENDED';
    service.status = 'Inactive';
    service.isActive = false;
    service.manuallyActivated = false;
    await service.save();

    try {
      await ActivityLog.create({
        action: 'Event Ended',
        userId: req.user._id,
        userName: req.user.name,
        details: `Ended event "${service.name}" (${service.eventId})`,
        eventId: service.eventId,
        organization: service.organization || req.user.organization || '',
        organizationId: service.organizationId || req.user._id.toString(),
      });
    } catch (e) {}

    res.json({ message: 'Event ended successfully', event: service });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/events/:id - Delete Event (Admin Only - Organization Protected)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const param = req.params.id;
    let service = null;
    if (mongoose.Types.ObjectId.isValid(param)) {
      service = await Service.findById(param);
    } else {
      service = await Service.findOne({ eventId: param.toUpperCase() });
    }

    if (!service) return res.status(404).json({ message: 'Event not found' });

    // Multi-tenant check: Only owner/same organization or default admin can delete
    const isOwner = service.createdBy && service.createdBy.toString() === req.user._id.toString();
    const isSameOrg = service.organization && service.organization === req.user.organization;
    const isDefaultAdmin = req.user.email === 'admin@church.com';
    if (!isOwner && !isSameOrg && !isDefaultAdmin) {
      return res.status(403).json({ message: 'You are not authorized to delete events from another organization.' });
    }

    await Service.deleteOne({ _id: service._id });
    await Seat.deleteMany({ $or: [{ serviceId: service._id }, { eventId: service.eventId }] });
    await Booking.deleteMany({ eventId: service.eventId });
    await Registration.deleteMany({ eventId: service._id });

    try {
      await ActivityLog.create({
        action: 'Event Deleted',
        userId: req.user._id,
        userName: req.user.name,
        details: `Deleted event "${service.name}" (${service.eventId})`,
        organization: service.organization || req.user.organization || '',
      });
    } catch (e) {
      // Non-blocking log
    }

    res.json({ message: 'Event, associated seats, and bookings deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
