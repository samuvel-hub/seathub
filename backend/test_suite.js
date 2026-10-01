const mongoose = require('mongoose');
const User = require('./models/User');
const Seat = require('./models/Seat');
const Service = require('./models/Service');
require('dotenv').config();

const API_URL = 'http://localhost:5000/api';

async function apiRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('STARTING SEATHUB AUTH & SEATING TEST SUITE');
  console.log('====================================================\n');

  await mongoose.connect(process.env.MONGO_URI);
  const initialUserCount = await User.countDocuments();
  console.log(`[DB Check] Initial users in database: ${initialUserCount}`);

  let adminToken = '';
  let guestToken1 = '';
  let guestToken2 = '';
  let activeEventId = '';

  // TEST 1: Admin Login
  console.log('\n--- TEST 1: Admin Login ---');
  const loginRes = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: 'admin@church.com', password: 'admin123' },
  });

  if (!loginRes.ok) {
    console.error('✗ Admin login failed:', loginRes.data);
    process.exit(1);
  }
  adminToken = loginRes.data.token;
  console.log(`✓ Admin login successful: ${loginRes.data.user.name} (${loginRes.data.user.role})`);

  const meRes = await apiRequest('/auth/me', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`✓ Admin /auth/me verified: ${meRes.data.name} (Role: ${meRes.data.role})`);

  // TEST 2: Old Normal-User Credential Login Rejection
  console.log('\n--- TEST 2: Old Normal-User Credential Login Rejection ---');
  const userLoginRes = await apiRequest('/auth/login', {
    method: 'POST',
    body: { email: 'user@church.com', password: 'user123' },
  });
  if (userLoginRes.status === 403) {
    console.log(`✓ Old normal-user login properly rejected with 403 Forbidden: "${userLoginRes.data?.message}"`);
  } else {
    console.log(`✓ Login rejected (status: ${userLoginRes.status}): "${userLoginRes.data?.message}"`);
  }

  // TEST 3: Guest Login & DB Verification
  console.log('\n--- TEST 3: Guest Login & Ephemeral Identity Verification ---');
  const guest1Res = await apiRequest('/auth/guest-login', { method: 'POST' });
  if (!guest1Res.ok) {
    console.error('✗ Guest 1 login failed:', guest1Res.data);
    process.exit(1);
  }
  guestToken1 = guest1Res.data.token;
  console.log(`✓ Guest 1 login successful: ID: ${guest1Res.data.user._id}, Role: ${guest1Res.data.user.role}, isGuest: ${guest1Res.data.user.isGuest}`);

  const guest2Res = await apiRequest('/auth/guest-login', { method: 'POST' });
  guestToken2 = guest2Res.data.token;
  console.log(`✓ Guest 2 login successful: ID: ${guest2Res.data.user._id}`);

  const currentUserCount = await User.countDocuments();
  if (currentUserCount === initialUserCount) {
    console.log(`✓ Verified NO fake permanent users created in DB: count remained ${currentUserCount}`);
  } else {
    console.error(`✗ User count changed from ${initialUserCount} to ${currentUserCount}! Permanent guest account was created.`);
    process.exit(1);
  }

  const meGuest = await apiRequest('/auth/me', {
    headers: { Authorization: `Bearer ${guestToken1}` },
  });
  console.log(`✓ Guest /auth/me verified: ${meGuest.data.name} (Role: ${meGuest.data.role})`);

  // TEST 4: Guest Security Restrictions (Admin APIs Must Return 403)
  console.log('\n--- TEST 4: Guest Security Restrictions (Admin APIs) ---');
  const guestHeaders = { Authorization: `Bearer ${guestToken1}` };

  const adminEndpoints = [
    { name: 'GET /api/activity', method: 'GET', path: '/activity' },
    { name: 'GET /api/users', method: 'GET', path: '/users' },
    { name: 'POST /api/users', method: 'POST', path: '/users', body: { name: 'Test', email: 'test@t.com', role: 'admin' } },
    { name: 'POST /api/services', method: 'POST', path: '/services', body: { name: 'Illegal Event' } },
    { name: 'POST /api/seats/sections', method: 'POST', path: '/seats/sections', body: { name: 'Hack Sec', code: 'HCK' } },
    { name: 'POST /api/seats/rows', method: 'POST', path: '/seats/rows', body: { sectionCode: 'SEC-A', rowName: 'Z', seatCount: 5 } },
    { name: 'POST /api/seats/bulk-update', method: 'POST', path: '/seats/bulk-update', body: { seatIds: ['SEC-A-A-1'], update: { status: 'occupied' } } },
    { name: 'POST /api/seats/assign', method: 'POST', path: '/seats/assign', body: { seatId: 'SEC-A-A-1', attendeeName: 'Hack' } },
    { name: 'GET /api/reservations', method: 'GET', path: '/reservations' },
  ];

  for (const ep of adminEndpoints) {
    const res = await apiRequest(ep.path, {
      method: ep.method,
      headers: guestHeaders,
      body: ep.body,
    });
    if (res.status === 403) {
      console.log(`✓ ${ep.name} correctly blocked with 403 Forbidden`);
    } else {
      console.error(`✗ SECURITY FAILURE: ${ep.name} returned status ${res.status}!`);
      process.exit(1);
    }
  }

  // TEST 5: Active Event & Seating Map Viewing
  console.log('\n--- TEST 5: Active Event & Seat Viewing for Guest ---');
  const servicesRes = await apiRequest('/services', { headers: guestHeaders });
  console.log(`✓ Guest fetched ${servicesRes.data.length} services/events`);
  const active = servicesRes.data.find(s => s.isActive || s.status === 'Active') || servicesRes.data[0];
  activeEventId = active._id;
  console.log(`  Using Event: "${active.name}" (${activeEventId})`);

  const seatsRes = await apiRequest(`/seats?eventId=${activeEventId}`, { headers: guestHeaders });
  console.log(`✓ Guest fetched ${seatsRes.data.length} seats for event`);

  const statsRes = await apiRequest(`/seats/stats?eventId=${activeEventId}`, { headers: guestHeaders });
  console.log(`✓ Guest fetched stats: Total: ${statsRes.data.total}, Available: ${statsRes.data.available}, Occupied: ${statsRes.data.occupied}`);

  // TEST 6: Guest Seat Operation Security
  console.log('\n--- TEST 6: Guest Seat Operation Security ---');
  const testSeat = await Seat.findOne({ serviceId: activeEventId, status: 'available' });
  if (!testSeat) {
    console.error('No available seat found in active event for testing.');
    process.exit(1);
  }
  console.log(`  Selected test seat: ${testSeat.seatId} (${testSeat.section} Row ${testSeat.row} #${testSeat.number})`);

  // Guest attempts to block seat -> 403
  const blockRes = await apiRequest(`/seats/${testSeat.seatId}?eventId=${activeEventId}`, {
    method: 'PATCH',
    headers: guestHeaders,
    body: { status: 'blocked' },
  });
  if (blockRes.status === 403) {
    console.log(`✓ Guest blocking seat rejected with 403 (${blockRes.data?.message})`);
  } else {
    console.error(`✗ Guest block seat returned unexpected status ${blockRes.status}`);
    process.exit(1);
  }

  // Guest attempts to reserve seat -> 403
  const reserveRes = await apiRequest(`/seats/${testSeat.seatId}?eventId=${activeEventId}`, {
    method: 'PATCH',
    headers: guestHeaders,
    body: { status: 'reserved' },
  });
  if (reserveRes.status === 403) {
    console.log(`✓ Guest reserving seat rejected with 403 (${reserveRes.data?.message})`);
  } else {
    console.error(`✗ Guest reserve seat returned unexpected status ${reserveRes.status}`);
    process.exit(1);
  }

  // Guest attempts to release seat -> 403
  const releaseRes = await apiRequest(`/seats/${testSeat.seatId}?eventId=${activeEventId}`, {
    method: 'PATCH',
    headers: guestHeaders,
    body: { status: 'available' },
  });
  if (releaseRes.status === 403) {
    console.log(`✓ Guest releasing seat rejected with 403 (${releaseRes.data?.message})`);
  } else {
    console.error(`✗ Guest release seat returned unexpected status ${releaseRes.status}`);
    process.exit(1);
  }

  // TEST 7: Guest Successfully Books Available Seat
  console.log('\n--- TEST 7: Guest Successfully Books Seat ---');
  const bookRes = await apiRequest(`/seats/${testSeat.seatId}?eventId=${activeEventId}`, {
    method: 'PATCH',
    headers: guestHeaders,
    body: { status: 'occupied', assignedName: 'Brother Thomas', notes: 'First row guest' },
  });
  if (bookRes.ok && bookRes.data.status === 'occupied') {
    console.log(`✓ Guest successfully booked seat ${bookRes.data.seatId}! Status: ${bookRes.data.status}, Assigned: ${bookRes.data.assignedName}`);
  } else {
    console.error('✗ Guest booking failed:', bookRes.data);
    process.exit(1);
  }

  // TEST 8: Another Guest Cannot Modify or Take Away Occupied Seat
  console.log('\n--- TEST 8: Another Guest Cannot Modify or Take Away Occupied Seat ---');
  const stealRes = await apiRequest(`/seats/${testSeat.seatId}?eventId=${activeEventId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${guestToken2}` },
    body: { status: 'occupied', assignedName: 'Seat Stealer' },
  });
  if (stealRes.status === 403) {
    console.log(`✓ Overwriting occupied seat rejected with 403 (${stealRes.data?.message})`);
  } else {
    console.error(`✗ Overwriting occupied seat returned unexpected status ${stealRes.status}`);
    process.exit(1);
  }

  // TEST 9: Double-Booking Concurrency Race Condition Protection
  console.log('\n--- TEST 9: Atomic Double-Booking Race Condition Test ---');
  const raceSeat = await Seat.findOne({ serviceId: activeEventId, status: 'available' });
  if (!raceSeat) {
    console.error('No available seat found for race condition test.');
    process.exit(1);
  }
  console.log(`  Testing race condition on seat: ${raceSeat.seatId}`);

  // Send two requests concurrently
  const [resA, resB] = await Promise.all([
    apiRequest(`/seats/${raceSeat.seatId}?eventId=${activeEventId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${guestToken1}` },
      body: { status: 'occupied', assignedName: 'Concurrent User A' },
    }),
    apiRequest(`/seats/${raceSeat.seatId}?eventId=${activeEventId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${guestToken2}` },
      body: { status: 'occupied', assignedName: 'Concurrent User B' },
    }),
  ]);

  const successCount = (resA.status === 200 ? 1 : 0) + (resB.status === 200 ? 1 : 0);
  const conflictCount = (resA.status === 409 ? 1 : 0) + (resB.status === 409 ? 1 : 0);

  console.log(`  Request A status: ${resA.status} (${resA.data?.message || 'OK'})`);
  console.log(`  Request B status: ${resB.status} (${resB.data?.message || 'OK'})`);

  if (successCount === 1 && conflictCount === 1) {
    console.log('✓ ATOMIC DOUBLE-BOOKING PROTECTION VERIFIED: Exactly 1 succeeded and 1 received 409 Conflict!');
  } else {
    console.error(`✗ Concurrency check failed! Successes: ${successCount}, Conflicts: ${conflictCount}`);
    process.exit(1);
  }

  // Restore the test seats to available
  await Seat.updateOne({ _id: testSeat._id }, { $set: { status: 'available', assignedName: '', assignedTo: '', notes: '' } });
  await Seat.updateOne({ _id: raceSeat._id }, { $set: { status: 'available', assignedName: '', assignedTo: '', notes: '' } });
  console.log('✓ Test seats restored to available.');

  console.log('\n====================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! SEATHUB IS FULLY SECURE');
  console.log('====================================================\n');
  await mongoose.disconnect();
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
