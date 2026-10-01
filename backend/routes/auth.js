const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const generateToken = (id, role = 'admin') => jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });

// POST /api/auth/register - Admin Registration with Organization
router.post('/register', async (req, res) => {
  try {
    const { name, organization, email, password } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Admin name is required' });
    }
    if (!organization || !organization.trim()) {
      return res.status(400).json({ message: 'Organization name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email address is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    const user = await User.create({
      name: name.trim(),
      organization: organization.trim(),
      email: cleanEmail,
      password,
      role: 'admin',
    });

    res.status(201).json({
      message: 'Admin account created successfully',
      token: generateToken(user._id, user.role),
      user,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/login - Admin Login Only
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Only administrators can log in here. Please use Continue as Guest.' });
    }
    res.json({ token: generateToken(user._id, user.role), user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/auth/guest-login - Instant frictionless Guest Session
router.post('/guest-login', async (req, res) => {
  try {
    const guestId = new mongoose.Types.ObjectId().toString();
    const guestUser = {
      _id: guestId,
      name: 'Guest Attendee',
      role: 'guest',
      isGuest: true,
    };
    const token = jwt.sign(
      { id: guestId, name: 'Guest Attendee', role: 'guest', isGuest: true },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ token, user: guestUser });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/auth/me - Verify current session (Admin or Guest)
router.get('/me', protect, async (req, res) => {
  res.json(req.user);
});

module.exports = router;
