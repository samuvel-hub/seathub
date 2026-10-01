const assert = require('assert');

// 1. UNIT TEST OF THE VALIDATION FUNCTION (Matches Services.jsx and eventRoutes.js exactly)
function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (isNaN(hours) || isNaN(minutes) || minutes < 0 || minutes > 59) return null;
  const meridiem = match[3] ? match[3].toUpperCase() : null;

  if (meridiem === 'PM') {
    if (hours < 12) hours += 12;
  } else if (meridiem === 'AM') {
    if (hours === 12) hours = 0;
  }
  if (hours < 0 || hours > 23) return null;

  return hours * 60 + minutes;
}

function validateStartEndTime(startTime, endTime) {
  if (!startTime || !endTime) return '';
  const startMins = parseTimeToMinutes(startTime);
  const endMins = parseTimeToMinutes(endTime);

  if (startMins !== null && endMins !== null) {
    if (endMins <= startMins) {
      return 'End time must be later than start time.';
    }
  }
  return '';
}

console.log('=== TEST 1: UNIT TEST OF ALL TIME PAIRS SPECIFIED IN USER REQUIREMENT ===');

const testCases = [
  { start: '09:00 AM', end: '10:00 AM', expectedValid: true, desc: '09:00 AM -> 10:00 AM' },
  { start: '09:00 AM', end: '12:00 PM', expectedValid: true, desc: '09:00 AM -> 12:00 PM' },
  { start: '09:00 AM', end: '12:30 PM', expectedValid: true, desc: '09:00 AM -> 12:30 PM' },
  { start: '02:00 PM', end: '05:00 PM', expectedValid: true, desc: '02:00 PM -> 05:00 PM' },
  { start: '06:00 PM', end: '08:00 PM', expectedValid: true, desc: '06:00 PM -> 08:00 PM' },
  { start: '09:00 AM', end: '08:00 AM', expectedValid: false, desc: '09:00 AM -> 08:00 AM' },
  { start: '10:00 AM', end: '09:00 AM', expectedValid: false, desc: '10:00 AM -> 09:00 AM' },
  { start: '09:00 AM', end: '09:00 AM', expectedValid: false, desc: '09:00 AM -> 09:00 AM' },
  { start: '06:00 PM', end: '05:00 PM', expectedValid: false, desc: '06:00 PM -> 05:00 PM' },
  { start: '11:00 PM', end: '01:00 AM', expectedValid: false, desc: '11:00 PM -> 01:00 AM' },
];

let unitPasses = 0;
for (const tc of testCases) {
  const err = validateStartEndTime(tc.start, tc.end);
  const isValid = err === '';
  assert.strictEqual(isValid, tc.expectedValid, `Failed for ${tc.desc}`);
  if (!tc.expectedValid) {
    assert.strictEqual(err, 'End time must be later than start time.');
  }
  console.log(`  ✓ ${tc.desc} => ${isValid ? 'VALID' : 'INVALID (Error: "' + err + '")'}`);
  unitPasses++;
}
console.log(`Unit tests passed: ${unitPasses}/${testCases.length}\n`);

// 2. INTEGRATION TEST AGAINST BACKEND API (CREATE & EDIT)
const BASE_URL = 'http://localhost:5000/api';

async function req(path, options = {}) {
  const url = `${BASE_URL}${path}`;
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

async function runApiTests() {
  console.log('=== TEST 2: INTEGRATION TEST AGAINST LIVE BACKEND API ===');

  // Login
  const loginRes = await req('/auth/login', {
    method: 'POST',
    body: { email: 'admin@church.com', password: 'admin123' },
  });
  assert.strictEqual(loginRes.status, 200);
  const token = loginRes.data.token;
  const authHeader = { Authorization: `Bearer ${token}` };
  console.log('  ✓ Admin logged in');

  // Test 2A: Create Event with INVALID time (09:00 AM -> 08:00 AM)
  const inv1 = await req('/events', {
    method: 'POST',
    headers: authHeader,
    body: {
      name: 'Invalid Time Event 1',
      eventId: 'TIME-INV-1',
      category: 'Conference',
      startTime: '09:00 AM',
      endTime: '08:00 AM',
    },
  });
  assert.strictEqual(inv1.status, 400);
  assert.strictEqual(inv1.data.message, 'End time must be later than start time.');
  console.log('  ✓ Backend rejected invalid CREATE (09:00 AM -> 08:00 AM) with 400: "' + inv1.data.message + '"');

  // Test 2B: Create Event with EQUAL time (09:00 AM -> 09:00 AM)
  const inv2 = await req('/events', {
    method: 'POST',
    headers: authHeader,
    body: {
      name: 'Equal Time Event 2',
      eventId: 'TIME-INV-2',
      category: 'Conference',
      startTime: '09:00 AM',
      endTime: '09:00 AM',
    },
  });
  assert.strictEqual(inv2.status, 400);
  assert.strictEqual(inv2.data.message, 'End time must be later than start time.');
  console.log('  ✓ Backend rejected invalid CREATE (09:00 AM -> 09:00 AM) with 400: "' + inv2.data.message + '"');

  // Test 2C: Create Event with VALID times (09:00 AM -> 10:00 AM)
  const uniqueEventId = `TIME-VAL-${Date.now()}`;
  const val1 = await req('/events', {
    method: 'POST',
    headers: authHeader,
    body: {
      name: 'Valid Time Event 1',
      eventId: uniqueEventId,
      category: 'Conference',
      startTime: '09:00 AM',
      endTime: '10:00 AM',
    },
  });
  if (val1.status !== 201) {
    console.error('val1 failed:', val1.data);
  }
  assert.strictEqual(val1.status, 201);
  const createdEvent = val1.data.event || val1.data;
  console.log(`  ✓ Backend accepted valid CREATE (09:00 AM -> 10:00 AM) - ID: ${createdEvent._id}`);

  // Test 2D: Edit Event with INVALID times (Update to 10:00 AM -> 09:00 AM)
  const editInv = await req(`/events/${createdEvent._id}`, {
    method: 'PUT',
    headers: authHeader,
    body: {
      startTime: '10:00 AM',
      endTime: '09:00 AM',
    },
  });
  assert.strictEqual(editInv.status, 400);
  assert.strictEqual(editInv.data.message, 'End time must be later than start time.');
  console.log('  ✓ Backend rejected invalid EDIT (10:00 AM -> 09:00 AM) with 400: "' + editInv.data.message + '"');

  // Test 2E: Edit Event with VALID times (Update to 06:00 PM -> 08:00 PM)
  const editVal = await req(`/events/${createdEvent._id}`, {
    method: 'PUT',
    headers: authHeader,
    body: {
      startTime: '06:00 PM',
      endTime: '08:00 PM',
    },
  });
  assert.strictEqual(editVal.status, 200);
  assert.strictEqual(editVal.data.startTime, '06:00 PM');
  assert.strictEqual(editVal.data.endTime, '08:00 PM');
  console.log('  ✓ Backend accepted valid EDIT (06:00 PM -> 08:00 PM)');

  // Clean up created test event
  await req(`/events/${createdEvent._id}`, {
    method: 'DELETE',
    headers: authHeader,
  });
  console.log('  ✓ Test event cleaned up');

  console.log('\n======================================================');
  console.log('ALL TIME VALIDATION UNIT & INTEGRATION TESTS PASSED!');
  console.log('======================================================');
}

runApiTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
