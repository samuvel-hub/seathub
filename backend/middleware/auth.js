const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === 'guest' || decoded.isGuest) {
      req.user = {
        _id: decoded.id,
        name: decoded.name || 'Guest Attendee',
        role: 'guest',
        isGuest: true,
      };
      return next();
    }
    req.user = await User.findById(decoded.id).select('-password');
    if (!req.user) return res.status(401).json({ message: 'User not found' });
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token invalid' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ message: 'Admin access required' });
};

const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role === 'guest' || decoded.isGuest) {
      req.user = {
        _id: decoded.id,
        name: decoded.name || 'Guest Attendee',
        role: 'guest',
        isGuest: true,
      };
    } else {
      req.user = await User.findById(decoded.id).select('-password');
    }
  } catch (err) {
    // Non-blocking for optional auth
  }
  next();
};

module.exports = { protect, adminOnly, optionalAuth };
