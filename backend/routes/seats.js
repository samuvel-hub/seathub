const express = require('express');
const router = express.Router();
const Seat = require('../models/Seat');
const ActivityLog = require('../models/ActivityLog');
const { protect } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    const seats = await Seat.find().sort({ sectionCode: 1, row: 1, number: 1 });
    res.json(seats);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/stats', protect, async (req, res) => {
  try {
    const total = await Seat.countDocuments();
    const available = await Seat.countDocuments({ status: 'available' });
    const occupied = await Seat.countDocuments({ status: 'occupied' });
    const reserved = await Seat.countDocuments({ status: 'reserved' });
    const held = await Seat.countDocuments({ status: 'held' });
    const blocked = await Seat.countDocuments({ status: 'blocked' });
    res.json({ total, available, occupied, reserved, held, blocked });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch('/:id', protect, async (req, res) => {
  try {
    const existing = await Seat.findOne({ seatId: req.params.id });

    // Only admins can block or unblock seats
    if (req.body.status === 'blocked' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can block seats.' });
    }
    if (existing && existing.status === 'blocked' && req.body.status && req.body.status !== 'blocked' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can unblock seats.' });
    }

    // Only admins can modify an already-occupied seat
    if (existing && existing.status === 'occupied' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can change an occupied seat.' });
    }

    const seat = await Seat.findOneAndUpdate({ seatId: req.params.id }, req.body, { new: true });
    if (!seat) return res.status(404).json({ message: 'Seat not found' });
    await ActivityLog.create({
      action: 'Seat ' + (req.body.status || 'updated'),
      userId: req.user._id,
      userName: req.user.name,
      seatId: seat.seatId,
      seatLabel: seat.section + ' - Row ' + seat.row + ' Seat ' + seat.number,
      details: req.body.notes || '',
    });
    res.json(seat);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/bulk-update', protect, async (req, res) => {
  try {
    const { seatIds, update } = req.body;
    await Seat.updateMany({ seatId: { $in: seatIds } }, update);
    const seats = await Seat.find({ seatId: { $in: seatIds } });
    res.json(seats);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

const ROWS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// POST /api/seats/add-rows — admin adds new rows to a section
router.post('/add-rows', protect, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { sectionCode, count } = req.body;
    if (!sectionCode || !count || count < 1) return res.status(400).json({ message: 'sectionCode and count required' });

    const existing = await Seat.find({ sectionCode });
    if (!existing.length) return res.status(404).json({ message: 'Section not found' });

    const sampleSeat = existing[0];
    const existingRows = [...new Set(existing.map(s => s.row))].sort();
    const lastRowLetter = existingRows[existingRows.length - 1];
    const lastRowIndex = ROWS.indexOf(lastRowLetter);
    const seatsPerRow = Math.max(...existing.filter(s => s.row === lastRowLetter).map(s => s.number));

    const newSeats = [];
    for (let i = 1; i <= count; i++) {
      const rowLetter = ROWS[lastRowIndex + i];
      if (!rowLetter) break;
      for (let n = 1; n <= seatsPerRow; n++) {
        newSeats.push({
          seatId: sectionCode + '-' + rowLetter + '-' + n,
          section: sampleSeat.section,
          sectionCode,
          row: rowLetter,
          number: n,
          status: 'available',
        });
      }
    }
    if (!newSeats.length) return res.status(400).json({ message: 'No more rows available (max Z reached)' });
    await Seat.insertMany(newSeats);
    res.json({ message: 'Added ' + count + ' row(s) with ' + seatsPerRow + ' seats each', added: newSeats.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/seats/add-columns — admin adds seats to every row in a section
router.post('/add-columns', protect, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { sectionCode, count } = req.body;
    if (!sectionCode || !count || count < 1) return res.status(400).json({ message: 'sectionCode and count required' });

    const existing = await Seat.find({ sectionCode });
    if (!existing.length) return res.status(404).json({ message: 'Section not found' });

    const sampleSeat = existing[0];
    const existingRows = [...new Set(existing.map(s => s.row))];

    const newSeats = [];
    for (const row of existingRows) {
      const rowSeats = existing.filter(s => s.row === row);
      const maxSeat = Math.max(...rowSeats.map(s => s.number));
      for (let n = maxSeat + 1; n <= maxSeat + count; n++) {
        newSeats.push({
          seatId: sectionCode + '-' + row + '-' + n,
          section: sampleSeat.section,
          sectionCode,
          row,
          number: n,
          status: 'available',
        });
      }
    }
    await Seat.insertMany(newSeats);
    res.json({ message: 'Added ' + count + ' seat(s) to each of ' + existingRows.length + ' rows', added: newSeats.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/seats/delete-rows — admin removes last N rows from a section
router.post('/delete-rows', protect, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { sectionCode, count } = req.body;
    if (!sectionCode || !count || count < 1) return res.status(400).json({ message: 'sectionCode and count required' });

    const existing = await Seat.find({ sectionCode });
    if (!existing.length) return res.status(404).json({ message: 'Section not found' });

    const existingRows = [...new Set(existing.map(s => s.row))].sort();
    if (count >= existingRows.length) {
      return res.status(400).json({ message: 'Cannot delete all rows. Keep at least 1 row.' });
    }

    // Get last N rows to delete
    const rowsToDelete = existingRows.slice(-count);

    // Check for occupied/reserved/held seats in those rows
    const blockedSeats = await Seat.find({
      sectionCode,
      row: { $in: rowsToDelete },
      status: { $in: ['occupied', 'reserved', 'held'] }
    });
    if (blockedSeats.length > 0) {
      return res.status(400).json({
        message: 'Cannot delete rows — ' + blockedSeats.length + ' seat(s) are occupied/reserved/held. Release them first.'
      });
    }

    const result = await Seat.deleteMany({ sectionCode, row: { $in: rowsToDelete } });
    res.json({ message: 'Deleted ' + rowsToDelete.length + ' row(s) (' + result.deletedCount + ' seats removed)', deleted: result.deletedCount });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/seats/delete-columns — admin removes last N seats from every row in a section
router.post('/delete-columns', protect, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  try {
    const { sectionCode, count } = req.body;
    if (!sectionCode || !count || count < 1) return res.status(400).json({ message: 'sectionCode and count required' });

    const existing = await Seat.find({ sectionCode });
    if (!existing.length) return res.status(404).json({ message: 'Section not found' });

    const existingRows = [...new Set(existing.map(s => s.row))];

    // Find the seat numbers to delete (last N per row) and check for conflicts
    const seatIdsToDelete = [];
    for (const row of existingRows) {
      const rowSeats = existing.filter(s => s.row === row).sort((a, b) => b.number - a.number);
      if (count >= rowSeats.length) {
        return res.status(400).json({ message: 'Cannot delete all seats in a row. Keep at least 1 seat per row.' });
      }
      const toDelete = rowSeats.slice(0, count);
      const blocked = toDelete.filter(s => ['occupied', 'reserved', 'held'].includes(s.status));
      if (blocked.length > 0) {
        return res.status(400).json({
          message: 'Cannot delete — ' + blocked.length + ' seat(s) in Row ' + row + ' are occupied/reserved/held. Release them first.'
        });
      }
      seatIdsToDelete.push(...toDelete.map(s => s.seatId));
    }

    const result = await Seat.deleteMany({ seatId: { $in: seatIdsToDelete } });
    res.json({ message: 'Deleted ' + count + ' seat(s) from each of ' + existingRows.length + ' rows', deleted: result.deletedCount });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;

