const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

const allowedOrigins = ['http://localhost:3000', 'http://localhost:5173'];
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
  credentials: true,
}));
app.use(express.json());

const { ensureEventIdsAndSeats } = require('./utils/initDb');

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/seats', require('./routes/seatRoutes'));
app.use('/api/services', require('./routes/eventRoutes'));
app.use('/api/events', require('./routes/eventRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/activity', require('./routes/activity'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/church-seating';

mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected');
    await ensureEventIdsAndSeats();
    app.listen(PORT, () => console.log('Server running on http://localhost:' + PORT));
  })
  .catch(err => { console.error('MongoDB connection error:', err); process.exit(1); });
