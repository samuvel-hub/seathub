const express = require('express');
const router = express.Router();
const Reservation = require('../models/Reservation');
const Seat = require('../models/Seat');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const reservations = await Reservation.find()
      .populate('serviceId', 'name date time')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json(reservations);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { seatIds, ...data } = req.body;
    const reservation = await Reservation.create({ ...data, seatIds, createdBy: req.user._id });
    if (seatIds && seatIds.length > 0) {
      await Seat.updateMany(
        { seatId: { $in: seatIds } },
        { status: 'reserved', reservationId: reservation._id, assignedName: data.guestName }
      );
    }
    res.status(201).json(reservation);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch('/:id', protect, adminOnly, async (req, res) => {
  try {
    const reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!reservation) return res.status(404).json({ message: 'Reservation not found' });
    if (req.body.status === 'cancelled' && reservation.seatIds) {
      await Seat.updateMany(
        { seatId: { $in: reservation.seatIds } },
        { status: 'available', reservationId: null, assignedName: '' }
      );
    }
    res.json(reservation);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
