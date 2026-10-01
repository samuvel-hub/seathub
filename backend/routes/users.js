const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const filter = {};
    if (req.user && req.user.email !== 'admin@church.com') {
      filter.$or = [
        { organization: req.user.organization },
        { _id: req.user._id }
      ];
    }
    const users = await User.find(filter).sort({ createdAt: -1 });
    res.json(users);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (role && role !== 'admin') {
      return res.status(400).json({
        message: 'Normal-user account creation has been disabled. Attendees access the system directly as Guests without an account.'
      });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'Email already exists' });
    const user = await User.create({
      name,
      email,
      password: password || 'password123',
      role: 'admin',
      organization: req.user.organization || 'General Organization',
      organizationId: req.user.organizationId || req.user._id.toString(),
    });
    res.status(201).json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.patch('/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
