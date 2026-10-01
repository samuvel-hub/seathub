const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Seat = require('./models/Seat');
const Service = require('./models/Service');
const Booking = require('./models/Booking');
const Registration = require('./models/Registration');
const ActivityLog = require('./models/ActivityLog');
const Reservation = require('./models/Reservation');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Clear all existing data for a completely clean slate
  await Promise.all([
    User.deleteMany({}),
    Seat.deleteMany({}),
    Service.deleteMany({}),
    Booking.deleteMany({}),
    Registration.deleteMany({}),
    ActivityLog.deleteMany({}),
    Reservation.deleteMany({}),
  ]);
  console.log('Cleared all existing data (all events, seats, bookings, logs)');

  // Seed Admin user only (No default events)
  const admin = await User.create({
    name: 'Pastor Sarah Jenkins',
    email: 'admin@church.com',
    password: 'admin123',
    role: 'admin',
    organization: 'Grace Church',
  });
  admin.organizationId = admin._id.toString();
  await admin.save();
  console.log('Seeded 1 admin user (Pastor Sarah Jenkins - Grace Church)');

  console.log('\nSeed complete!');
  console.log('  Admin: admin@church.com / admin123');
  console.log('  Default events: None (Ready for Admin to create custom events via UI)');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
