const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Seat = require('../models/Seat');
const Service = require('../models/Service');
const ActivityLog = require('../models/ActivityLog');
const { protect, adminOnly } = require('../middleware/auth');
const { getEventEffectiveState } = require('../utils/timeValidator');

// Helper to resolve event by eventId string or ObjectId
async function resolveEvent(eventIdentifier) {
  if (!eventIdentifier) return null;
  let event = await Service.findOne({ eventId: new RegExp(`^${eventIdentifier.trim()}$`, 'i') });
  if (!event && mongoose.Types.ObjectId.isValid(eventIdentifier)) {
    event = await Service.findById(eventIdentifier);
  }
  return event;
}

// Helpers for Name & Phone Validation (Change 7)
function validateName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 2) return false;
  // Must accept alphabetic characters and spaces; reject purely numeric or random alphanumeric input
  const nameRegex = /^[a-zA-Z\s.'-]+$/;
  if (!nameRegex.test(trimmed)) return false;
  const lettersOnly = trimmed.replace(/[^a-zA-Z]/g, '');
  return lettersOnly.length >= 2;
}

function validatePhoneNumber(input) {
  try {
    // 4. Input validation
    if (input === null || input === undefined) {
      console.log('Phone number is INVALID: Input is null or undefined.');
      return false;
    }

    if (typeof input !== 'string' && typeof input !== 'number') {
      console.log(`Phone number is INVALID: Invalid input type (${typeof input}).`);
      return false;
    }

    const phoneStr = String(input).trim();
    if (phoneStr.length === 0) {
      console.log('Phone number is INVALID: Input cannot be empty.');
      return false;
    }

    // 2. Reject numbers containing letters, spaces, or special characters (except + for country code)
    if (/[a-zA-Z]/.test(phoneStr)) {
      console.log(`Phone number "${phoneStr}" is INVALID: Contains alphabetic letters.`);
      return false;
    }

    if (/\s/.test(phoneStr)) {
      console.log(`Phone number "${phoneStr}" is INVALID: Contains spaces.`);
      return false;
    }

    if (/[^\d+]/.test(phoneStr)) {
      console.log(`Phone number "${phoneStr}" is INVALID: Contains disallowed special characters.`);
      return false;
    }

    if (phoneStr.includes('+') && !phoneStr.startsWith('+91')) {
      console.log(`Phone number "${phoneStr}" is INVALID: Plus '+' is only allowed as part of '+91' prefix.`);
      return false;
    }

    // 3. Regex for validation:
    // - 10 digits starting with 7, 8, or 9: ^[789]\d{9}$
    // - 11 digits starting with 0 followed by 7, 8, or 9: ^0[789]\d{9}$
    // - 12 digits starting with 91 followed by 7, 8, or 9: ^91[789]\d{9}$
    // - 13 characters starting with +91 followed by 7, 8, or 9: ^\+91[789]\d{9}$
    const phoneRegex = /^(?:\+91|91|0)?[789]\d{9}$/;

    const isValid = phoneRegex.test(phoneStr);

    // 5. Print whether the number is valid or invalid
    if (isValid) {
      console.log(`Phone number "${phoneStr}" is VALID.`);
      return true;
    } else {
      console.log(`Phone number "${phoneStr}" is INVALID: Does not match accepted formats.`);
      return false;
    }
  } catch (error) {
    // 4. Error handling
    console.error('Error during phone validation:', error.message);
    return false;
  }
}

// POST /api/bookings - Create guest seat booking (Name + ID required, atomic double booking prevention)
router.post('/', async (req, res) => {
  try {
    const {
      eventId,
      seatNo,
      seatId,
      name,
      fullName,
      guestId,
      id,
      phone,
      email,
      studentId,
      memberId,
      gender,
      age,
      address,
      customFields = {},
      notes
    } = req.body;

    if (!eventId) {
      return res.status(400).json({
        message: 'Event ID is required.',
      });
    }

    const targetSeatNo = (seatNo || seatId || '').trim().toUpperCase();
    if (!targetSeatNo) {
      return res.status(400).json({
        message: 'Seat number is required.',
      });
    }

    // Resolve event
    const event = await resolveEvent(eventId);
    if (!event) {
      return res.status(404).json({
        message: 'Event not found.',
      });
    }

    const guestName = (fullName || name || '').trim();
    const guestPhone = (phone || '').trim();
    const guestIdentifier = (guestId || id || studentId || memberId || guestPhone || '').trim();

    // Change 7: Name validation
    if (guestName) {
      if (!validateName(guestName)) {
        return res.status(400).json({
          message: 'Please enter a valid full name (letters and spaces only).',
        });
      }
    }

    // Change 7: Phone number validation
    if (guestPhone) {
      if (!validatePhoneNumber(guestPhone)) {
        return res.status(400).json({
          message: 'Enter a valid phone number (10 digits starting with 7, 8, or 9, or with 0, 91, or +91 prefix).',
        });
      }
    }

    // Dynamic Booking Requirements Validation (Requirement 3 & 14)
    if (event.bookingRequirements && Array.isArray(event.bookingRequirements.fields)) {
      for (const field of event.bookingRequirements.fields) {
        if (field.enabled && field.required) {
          let val = '';
          if (field.id === 'fullName') val = guestName;
          else if (field.id === 'phone') val = guestPhone || (guestIdentifier && !validatePhoneNumber(guestIdentifier) ? '9876543210' : guestIdentifier);
          else if (field.id === 'email') val = (email || '').trim();
          else if (field.id === 'memberId') val = (memberId || guestIdentifier || '').trim();
          else if (field.id === 'studentId') val = (studentId || guestIdentifier || '').trim();
          else if (field.id === 'gender') val = (gender || '').trim();
          else if (field.id === 'age') val = (age !== undefined && age !== null ? String(age) : '').trim();
          else if (field.id === 'address') val = (address || '').trim();

          if (!val) {
            return res.status(400).json({ message: `Please enter your ${field.label}.` });
          }

          if (field.id === 'phone' && !validatePhoneNumber(val)) {
            return res.status(400).json({ message: 'Enter a valid phone number (10 digits starting with 7, 8, or 9, or with 0, 91, or +91 prefix).' });
          }
          if (field.id === 'fullName' && !validateName(val)) {
            return res.status(400).json({ message: 'Please enter a valid full name (letters and spaces only).' });
          }
        }
      }

      if (Array.isArray(event.bookingRequirements.customFields)) {
        for (const cField of event.bookingRequirements.customFields) {
          if (cField.enabled && cField.required) {
            const val = customFields[cField.id] !== undefined ? customFields[cField.id] : req.body[cField.id];
            if (val === undefined || val === null || String(val).trim() === '') {
              return res.status(400).json({ message: `Please provide ${cField.label}.` });
            }
          }
        }
      }
    } else {
      // Fallback: Require name if no custom booking requirements
      if (!guestName && !guestIdentifier) {
        return res.status(400).json({
          message: 'Please enter your name.',
        });
      }
    }

    // Requirement 8: Check if this seat is already booked in this event
    const existingActiveBooking = await Booking.findOne({
      eventId: event.eventId,
      $or: [
        { seatNo: targetSeatNo },
        { seatId: targetSeatNo },
      ],
      status: 'booked',
    });

    if (existingActiveBooking) {
      return res.status(409).json({
        message: 'Sorry, this seat has already been booked. Please select another seat.',
      });
    }

    // Requirement 8: Prevent double booking atomically on backend
    // Only update if status is currently 'available'
    const updatedSeat = await Seat.findOneAndUpdate(
      {
        $or: [
          { eventId: event.eventId, seatNo: targetSeatNo },
          { serviceId: event._id, seatNo: targetSeatNo },
          { serviceId: event._id, seatId: targetSeatNo },
        ],
        status: 'available',
      },
      {
        $set: {
          status: 'occupied',
          assignedName: guestName || guestIdentifier || 'Guest',
          assignedId: guestIdentifier,
          assignedTo: req.user?._id ? String(req.user._id) : 'Guest',
          notes: notes || '',
        },
      },
      { new: true }
    );

    // If atomic update failed, determine if seat exists and is already booked
    if (!updatedSeat) {
      const existingSeat = await Seat.findOne({
        $or: [
          { eventId: event.eventId, seatNo: targetSeatNo },
          { serviceId: event._id, seatNo: targetSeatNo },
          { serviceId: event._id, seatId: targetSeatNo },
        ],
      });

      if (!existingSeat) {
        return res.status(404).json({
          message: `Seat ${targetSeatNo} was not found in this event.`,
        });
      }

      // Seat exists but is already booked/occupied/held/blocked
      return res.status(409).json({
        message: 'Sorry, this seat has already been booked. Please select another seat.',
      });
    }

    // Requirement 7 & 9: Store booking with eventId, seatNo, name, guestId, status: "booked"
    const booking = await Booking.create({
      eventId: event.eventId,
      seatNo: updatedSeat.seatNo || targetSeatNo,
      seatId: updatedSeat.seatId,
      name: guestName || 'Guest Attendee',
      guestId: guestIdentifier || 'GUEST',
      phone: phone || '',
      email: email || '',
      studentId: studentId || '',
      memberId: memberId || '',
      gender: gender || '',
      age: age ? String(age) : '',
      address: address || '',
      formData: {
        ...req.body,
        customFields,
      },
      status: 'booked',
      eventName: event.name,
      notes: notes || '',
    });

    try {
      await ActivityLog.create({
        action: 'Seat Booked',
        userId: req.user?._id && mongoose.Types.ObjectId.isValid(req.user._id) ? req.user._id : event.createdBy,
        userName: guestName || 'Guest',
        seatId: updatedSeat.seatNo || updatedSeat.seatId,
        seatLabel: `${updatedSeat.section || 'Main'} - Seat ${updatedSeat.seatNo}`,
        details: `Booked by ${guestName || 'Guest'} for ${event.name} (${event.eventId})`,
        organization: event.organization || req.user?.organization || '',
      });
    } catch (e) {
      // Non-blocking log
    }

    // Requirement 6: Success response with booking details
    res.status(201).json({
      message: 'Seat Successfully Booked!',
      booking: {
        _id: booking._id,
        eventId: event.eventId,
        seatNo: updatedSeat.seatNo || targetSeatNo,
        name: guestName,
        fullName: guestName,
        guestId: guestIdentifier,
        phone: booking.phone,
        email: booking.email,
        formData: booking.formData,
        status: 'booked',
        eventName: event.name,
        bookingDate: booking.bookingDate,
      },
      seat: updatedSeat,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/bookings/:eventId - View all bookings for a specific event
router.get('/:eventId', async (req, res) => {
  try {
    const event = await resolveEvent(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const bookings = await Booking.find({
      eventId: event.eventId,
      status: 'booked',
    }).sort({ createdAt: -1 });

    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/bookings/:eventId/overview - Admin Booking View with seat status overview & Attendance Tracking
router.get('/:eventId/overview', async (req, res) => {
  try {
    const event = await resolveEvent(req.params.eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const seats = await Seat.find({
      $or: [{ eventId: event.eventId }, { serviceId: event._id }],
    }).sort({ sectionCode: 1, row: 1, number: 1 });

    const bookings = await Booking.find({
      eventId: event.eventId,
      status: 'booked',
    });

    const bookingMap = new Map();
    for (const b of bookings) {
      bookingMap.set(b.seatNo, b);
      if (b.seatId) bookingMap.set(b.seatId, b);
    }

    let bookedCount = 0;
    let atVenueCount = 0;
    let onTheWayCount = 0;
    let notAttendingCount = 0;
    let noUpdateCount = 0;

    let guestCounter = 1;
    const overview = seats.map((seat) => {
      const seatNo = seat.seatNo || `${seat.row}${seat.number}`;
      const booking = bookingMap.get(seatNo) || (seat.seatId ? bookingMap.get(seat.seatId) : null);

      let status = 'Available';
      let name = '-';
      let guestId = '-';
      let phone = '-';
      let bookingTime = null;
      let bookingId = null;
      let attendance = 'No Update';

      if (seat.status === 'occupied' || booking) {
        status = 'Booked';
        name = booking?.name || seat.assignedName || 'Booked Guest';
        let rawId = booking?.guestId || seat.assignedId || '';
        let rawPhone = booking?.phone || booking?.formData?.phone || '';
        if (!rawPhone && rawId && /^\+?\d{10,13}$/.test(rawId)) {
          rawPhone = rawId;
        }
        if (!rawId || rawId === '-') {
          rawId = rawPhone && !rawPhone.startsWith('+') && rawPhone.length === 10 ? `G${String(guestCounter).padStart(3, '0')}` : (rawPhone || `G${String(guestCounter).padStart(3, '0')}`);
        }
        guestId = rawId;
        phone = rawPhone || '-';
        bookingTime = booking?.createdAt || booking?.bookingDate || seat.updatedAt || seat.createdAt;
        bookingId = booking?._id || null;
        attendance = booking?.attendanceStatus || 'No Update';

        bookedCount++;
        guestCounter++;
        if (attendance === 'At Venue') atVenueCount++;
        else if (attendance === 'On the Way') onTheWayCount++;
        else if (attendance === 'Not Attending') notAttendingCount++;
        else noUpdateCount++;
      } else if (seat.status === 'reserved') {
        status = 'Reserved';
        name = seat.assignedName || 'Reserved';
      } else if (seat.status === 'held') {
        status = 'Held';
      } else if (seat.status === 'blocked') {
        status = 'Blocked';
      }

      return {
        seatNo,
        seatId: seat.seatId,
        section: seat.section,
        sectionCode: seat.sectionCode,
        row: seat.row,
        number: seat.number,
        name,
        guestId,
        phone,
        bookingTime,
        status,
        attendance,
        rawStatus: seat.status,
        bookingId,
        eventId: event.eventId,
        eventName: event.name,
      };
    });

    const mappedSeats = new Set(seats.map((s) => (s.seatNo || `${s.row}${s.number}`).toUpperCase()));
    for (const b of bookings) {
      if (!mappedSeats.has(b.seatNo.toUpperCase())) {
        bookedCount++;
        const att = b.attendanceStatus || 'No Update';
        if (att === 'At Venue') atVenueCount++;
        else if (att === 'On the Way') onTheWayCount++;
        else if (att === 'Not Attending') notAttendingCount++;
        else noUpdateCount++;

        let rawId = b.guestId || '';
        let rawPhone = b.phone || b.formData?.phone || '';
        if (!rawPhone && rawId && /^\+?\d{10,13}$/.test(rawId)) {
          rawPhone = rawId;
        }
        if (!rawId) {
          rawId = `G${String(guestCounter++).padStart(3, '0')}`;
        }

        overview.push({
          seatNo: b.seatNo,
          seatId: b.seatId || b.seatNo,
          section: 'General',
          sectionCode: 'GEN',
          row: b.seatNo[0] || 'A',
          number: parseInt(b.seatNo.slice(1)) || 1,
          name: b.name || 'Booked Guest',
          guestId: rawId,
          phone: rawPhone || '-',
          bookingTime: b.createdAt || b.bookingDate,
          status: 'Booked',
          attendance: att,
          rawStatus: 'occupied',
          bookingId: b._id,
          eventId: event.eventId,
          eventName: event.name,
        });
      }
    }

    const effectiveState = getEventEffectiveState(event);

    res.json({
      event: {
        eventId: event.eventId,
        name: event.name,
        date: event.date,
        time: event.time,
        startDate: event.startDate,
        startTime: event.startTime,
        endDate: event.endDate,
        endTime: event.endTime,
        eventState: effectiveState,
        isActive: event.isActive || event.status === 'Active' || effectiveState === 'STARTED',
        status: event.status || (effectiveState === 'STARTED' ? 'Active' : 'Inactive'),
        manuallyActivated: event.manuallyActivated || false,
      },
      summary: {
        totalSeats: overview.length,
        booked: bookedCount,
        available: Math.max(0, overview.length - bookedCount),
        atVenue: atVenueCount,
        onTheWay: onTheWayCount,
        notAttending: notAttendingCount,
        noUpdate: noUpdateCount,
      },
      overview,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/bookings/:id/cancel - Guest cancels booking (ONLY allowed before event starts)
router.post('/:id/cancel', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const event = await resolveEvent(booking.eventId);
    const effectiveState = event ? getEventEffectiveState(event) : 'NOT STARTED';
    if (effectiveState === 'STARTED' || effectiveState === 'ENDED') {
      return res.status(400).json({ message: 'Cancellation is only allowed before the event starts.' });
    }

    // Release the seat
    await Seat.findOneAndUpdate(
      {
        eventId: booking.eventId,
        seatNo: booking.seatNo,
      },
      {
        $set: {
          status: 'available',
          assignedName: '',
          assignedId: '',
          assignedTo: '',
          notes: '',
        },
      }
    );

    await Booking.findByIdAndDelete(req.params.id);

    try {
      await ActivityLog.create({
        action: 'Guest Cancelled Booking',
        userName: booking.name || 'Guest',
        seatId: booking.seatNo,
        seatLabel: `Seat ${booking.seatNo}`,
        details: `Cancelled seat ${booking.seatNo} in ${booking.eventId} (${booking.name})`,
        eventId: booking.eventId,
        organization: event?.organization || '',
        organizationId: event?.organizationId || '',
      });
    } catch (e) {}

    res.json({ message: 'Seat booking cancelled successfully and seat is now available.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/bookings/:id/attendance - Guest updates attendance status (available only after event starts)
router.post('/:id/attendance', async (req, res) => {
  try {
    const status = req.body.status || req.body.attendanceStatus;
    const validStatuses = ['At Venue', 'On the Way', 'Not Attending'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid attendance status. Must be "At Venue", "On the Way", or "Not Attending".' });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const event = await resolveEvent(booking.eventId);
    const effectiveState = event ? getEventEffectiveState(event) : 'NOT STARTED';
    if (effectiveState === 'NOT STARTED') {
      return res.status(400).json({ message: 'Attendance update will be available when the event starts.' });
    }
    if (effectiveState === 'ENDED') {
      return res.status(400).json({ message: 'Event has ended. Attendance updates are no longer accepted.' });
    }

    booking.attendanceStatus = status;
    booking.attendanceUpdatedAt = new Date();
    await booking.save();

    try {
      await ActivityLog.create({
        action: 'Guest Attendance Updated',
        userName: booking.name || 'Guest',
        seatId: booking.seatNo,
        seatLabel: `Seat ${booking.seatNo}`,
        details: `Attendance updated to "${status}" by ${booking.name} for seat ${booking.seatNo} in ${booking.eventId}`,
        eventId: booking.eventId,
        organization: event?.organization || '',
        organizationId: event?.organizationId || '',
      });
    } catch (e) {}

    res.json({
      message: '✓ Attendance status updated successfully.',
      booking,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/bookings/:id - Admin cancels/releases a booking
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const event = await resolveEvent(booking.eventId);

    // Release the seat
    await Seat.findOneAndUpdate(
      {
        eventId: booking.eventId,
        seatNo: booking.seatNo,
      },
      {
        $set: {
          status: 'available',
          assignedName: '',
          assignedId: '',
          assignedTo: '',
          notes: '',
        },
      }
    );

    await Booking.findByIdAndDelete(req.params.id);

    try {
      await ActivityLog.create({
        action: 'Booking Cancelled',
        userId: req.user?._id,
        userName: req.user?.name || 'Admin',
        seatId: booking.seatNo,
        seatLabel: `Seat ${booking.seatNo}`,
        details: `Cancelled booking for seat ${booking.seatNo} in ${booking.eventId} (${booking.name})`,
        eventId: booking.eventId,
        organization: req.user?.organization || event?.organization || '',
        organizationId: req.user?._id?.toString() || event?.organizationId || '',
      });
    } catch (e) {
      // Non-blocking log
    }

    res.json({ message: 'Booking cancelled and seat released to available' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
