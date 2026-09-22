const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');
const Seat = require('./models/Seat');
const Service = require('./models/Service');
const ActivityLog = require('./models/ActivityLog');
const Reservation = require('./models/Reservation');

const SECTIONS = [
  { name: 'Main Floor - Center', code: 'SEC-A', rows: 12, seatsPerRow: 20 },
  { name: 'Main Floor - Left',   code: 'SEC-B', rows: 10, seatsPerRow: 15 },
  { name: 'Main Floor - Right',  code: 'SEC-C', rows: 10, seatsPerRow: 15 },
  { name: 'Balcony',             code: 'SEC-D', rows: 8,  seatsPerRow: 20 },
];

const ROWS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  await Promise.all([
    User.deleteMany({}),
    Seat.deleteMany({}),
    Service.deleteMany({}),
    ActivityLog.deleteMany({}),
    Reservation.deleteMany({}),
  ]);
  console.log('Cleared existing data');

  // Users
  const admin = await User.create({ name: 'Pastor Sarah Jenkins', email: 'admin@church.com', password: 'admin123', role: 'admin' });
  await User.create({ name: 'John Helper', email: 'user@church.com', password: 'user123', role: 'user' });
  await User.create({ name: 'Mary Smith', email: 'mary@church.com', password: 'user123', role: 'user' });
  console.log('Seeded 3 users');

  // Services
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() + (7 - now.getDay()) % 7);

  const s1 = await Service.create({ name: 'Sunday Morning Service', date: sunday, time: '9:00 AM', type: 'Sunday Service', isActive: true, attendanceTarget: 800 });
  await Service.create({ name: 'Sunday Evening Service', date: sunday, time: '6:00 PM', type: 'Sunday Service', isActive: false, attendanceTarget: 500 });
  await Service.create({ name: 'Wednesday Bible Study', date: new Date(now.getTime() + 3*24*60*60*1000), time: '7:00 PM', type: 'Bible Study', isActive: false, attendanceTarget: 200 });
  console.log('Seeded 3 services');

  // Seats
  const seats = [];
  for (const sec of SECTIONS) {
    for (let r = 0; r < sec.rows; r++) {
      const rowLetter = ROWS[r];
      for (let n = 1; n <= sec.seatsPerRow; n++) {
        const rand = Math.random();
        let status = 'available';
        if (rand < 0.015) status = 'occupied';
        else if (rand < 0.025) status = 'reserved';
        else if (rand < 0.030) status = 'held';
        else if (rand < 0.033) status = 'blocked';
        seats.push({
          seatId: sec.code + '-' + rowLetter + '-' + n,
          section: sec.name,
          sectionCode: sec.code,
          row: rowLetter,
          number: n,
          status,
          assignedName: status === 'occupied' ? 'Visitor' : '',
        });
      }
    }
  }
  await Seat.insertMany(seats);
  console.log('Seeded ' + seats.length + ' seats');

  // Sample reservation
  const reservedSeats = await Seat.find({ status: 'reserved' }).limit(3);
  if (reservedSeats.length > 0) {
    await Reservation.create({
      serviceId: s1._id,
      guestName: 'Johnson Family',
      guestPhone: '555-0101',
      groupSize: reservedSeats.length,
      seatIds: reservedSeats.map(s => s.seatId),
      status: 'confirmed',
      createdBy: admin._id,
    });
    console.log('Seeded sample reservation');
  }

  console.log('\nSeed complete!');
  console.log('  Admin: admin@church.com / admin123');
  console.log('  User:  user@church.com  / user123');
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
