const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

const BASE_HOST = 'localhost';
const BASE_PORT = 5000;

function post(path, body, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return request({
    host: BASE_HOST,
    port: BASE_PORT,
    path,
    method: 'POST',
    headers,
  }, body);
}

function get(path, token = null) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return request({
    host: BASE_HOST,
    port: BASE_PORT,
    path,
    method: 'GET',
    headers,
  });
}

function patch(path, body, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return request({
    host: BASE_HOST,
    port: BASE_PORT,
    path,
    method: 'PATCH',
    headers,
  }, body);
}

function del(path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return request({
    host: BASE_HOST,
    port: BASE_PORT,
    path,
    method: 'DELETE',
    headers,
  }, body);
}

async function runTests() {
  console.log('=== Starting SeatHub Multi-Tenant Organization Isolation Tests ===\n');
  const timestamp = Date.now();

  const orgAEmail = `admin_alpha_${timestamp}@alpha.com`;
  const orgBEmail = `admin_beta_${timestamp}@beta.com`;

  // 1. Register Admin A for "Alpha University"
  console.log('1. Registering Admin A for "Alpha University"...');
  const regARes = await post('/api/auth/register', {
    name: 'Alice Director',
    organization: 'Alpha University',
    email: orgAEmail,
    password: 'password123',
  });
  console.log(`Status: ${regARes.status}`);
  if (regARes.status !== 201) throw new Error(`Admin A reg failed: ${JSON.stringify(regARes.data)}`);
  const tokenA = regARes.data.token;
  console.log(`Admin A registered: org="${regARes.data.user.organization}"\n`);

  // 2. Register Admin B for "Beta Tech Corp"
  console.log('2. Registering Admin B for "Beta Tech Corp"...');
  const regBRes = await post('/api/auth/register', {
    name: 'Bob Manager',
    organization: 'Beta Tech Corp',
    email: orgBEmail,
    password: 'password123',
  });
  console.log(`Status: ${regBRes.status}`);
  if (regBRes.status !== 201) throw new Error(`Admin B reg failed: ${JSON.stringify(regBRes.data)}`);
  const tokenB = regBRes.data.token;
  console.log(`Admin B registered: org="${regBRes.data.user.organization}"\n`);

  // 3. Admin A creates Event ALPHA001
  const eventIdA = `ALPHA_${timestamp}`;
  console.log(`3. Admin A creates event "${eventIdA}"...`);
  const eventARes = await post('/api/events', {
    eventId: eventIdA,
    name: 'Alpha Annual Convocation',
    type: 'College Seminar',
    date: '2026-10-15',
    time: '10:00 AM',
    capacity: 100,
  }, tokenA);
  console.log(`Status: ${eventARes.status}`);
  if (eventARes.status !== 201) throw new Error(`Create event A failed: ${JSON.stringify(eventARes.data)}`);
  const eventADoc = eventARes.data;
  console.log(`Event A created: id=${eventADoc._id}, org=${eventADoc.organization}\n`);

  // 4. Admin B creates Event BETA001
  const eventIdB = `BETA_${timestamp}`;
  console.log(`4. Admin B creates event "${eventIdB}"...`);
  const eventBRes = await post('/api/events', {
    eventId: eventIdB,
    name: 'Beta Global AI Summit',
    type: 'Tech Workshop',
    date: '2026-11-20',
    time: '02:00 PM',
    capacity: 100,
  }, tokenB);
  console.log(`Status: ${eventBRes.status}`);
  if (eventBRes.status !== 201) throw new Error(`Create event B failed: ${JSON.stringify(eventBRes.data)}`);
  const eventBDoc = eventBRes.data;
  console.log(`Event B created: id=${eventBDoc._id}, org=${eventBDoc.organization}\n`);

  // 5. Test Event Isolation in Event Listing
  console.log('5. Testing Event Listing Isolation...');
  const listARes = await get('/api/events', tokenA);
  const eventsForA = listARes.data;
  const hasEventAInA = eventsForA.some(e => e.eventId === eventIdA);
  const hasEventBInA = eventsForA.some(e => e.eventId === eventIdB);
  console.log(`Admin A sees Event A? ${hasEventAInA} (expected: true)`);
  console.log(`Admin A sees Event B? ${hasEventBInA} (expected: false)`);
  if (!hasEventAInA || hasEventBInA) {
    throw new Error('FAILED: Admin A event isolation breached!');
  }

  const listBRes = await get('/api/events', tokenB);
  const eventsForB = listBRes.data;
  const hasEventAInB = eventsForB.some(e => e.eventId === eventIdA);
  const hasEventBInB = eventsForB.some(e => e.eventId === eventIdB);
  console.log(`Admin B sees Event B? ${hasEventBInB} (expected: true)`);
  console.log(`Admin B sees Event A? ${hasEventAInB} (expected: false)`);
  if (!hasEventBInB || hasEventAInB) {
    throw new Error('FAILED: Admin B event isolation breached!');
  }
  console.log('PASSED: Event listing isolation strictly verified.\n');

  // 6. Test Cross-Tenant Mutation Rejection (Admin B attempts to edit Admin A's event)
  console.log("6. Testing Cross-Tenant Event Edit Rejection...");
  const illegalPatchRes = await patch(`/api/events/${eventADoc._id}`, {
    name: 'Hacked Event Name by Beta',
  }, tokenB);
  console.log(`Status: ${illegalPatchRes.status} (expected: 403)`);
  if (illegalPatchRes.status !== 403) {
    throw new Error(`FAILED: Cross-tenant patch allowed with status ${illegalPatchRes.status}`);
  }
  console.log('PASSED: Unauthorized edit correctly blocked with 403 Forbidden.\n');

  // 7. Test Cross-Tenant Event Delete Rejection (Admin B attempts to delete Admin A's event)
  console.log("7. Testing Cross-Tenant Event Delete Rejection...");
  const illegalDelRes = await del(`/api/events/${eventADoc._id}`, null, tokenB);
  console.log(`Status: ${illegalDelRes.status} (expected: 403)`);
  if (illegalDelRes.status !== 403) {
    throw new Error(`FAILED: Cross-tenant delete allowed with status ${illegalDelRes.status}`);
  }
  console.log('PASSED: Unauthorized delete correctly blocked with 403 Forbidden.\n');

  // 8. Test Cross-Tenant Seat Section Creation Rejection
  console.log("8. Testing Cross-Tenant Section Creation Rejection...");
  const illegalSecRes = await post('/api/seats/sections', {
    eventId: eventIdA,
    name: 'Rogue Section',
    code: 'ROGUE',
  }, tokenB);
  console.log(`Status: ${illegalSecRes.status} (expected: 403)`);
  if (illegalSecRes.status !== 403) {
    throw new Error(`FAILED: Cross-tenant section creation allowed with status ${illegalSecRes.status}`);
  }
  console.log('PASSED: Cross-tenant section creation blocked with 403 Forbidden.\n');

  // 9. Independent Guest Bookings for Event A and Event B on identical seat "A1"
  console.log('9. Testing Independent Guest Booking across the two events...');
  // Guest booking for Event A
  const guestBookARes = await post('/api/bookings', {
    eventId: eventIdA,
    seatNo: 'A1',
    name: 'David Attendee A',
    guestId: 'ID-ALPHA-001',
  });
  console.log(`Guest book in Event A: status=${guestBookARes.status}`);
  if (guestBookARes.status !== 200 && guestBookARes.status !== 201) {
    throw new Error(`Guest book in Event A failed: ${JSON.stringify(guestBookARes.data)}`);
  }

  // Guest booking for Event B (same seat A1!)
  const guestBookBRes = await post('/api/bookings', {
    eventId: eventIdB,
    seatNo: 'A1',
    name: 'Elena Attendee B',
    guestId: 'ID-BETA-001',
  });
  console.log(`Guest book in Event B: status=${guestBookBRes.status}`);
  if (guestBookBRes.status !== 200 && guestBookBRes.status !== 201) {
    throw new Error(`Guest book in Event B failed: ${JSON.stringify(guestBookBRes.data)}`);
  }

  // 10. Verify Seat Data Isolation
  console.log('10. Verifying Seat Map Separation...');
  const seatsARes = await get(`/api/seats/${eventIdA}`);
  const seatA1_in_A = seatsARes.data.find(s => s.seatNo === 'A1' || s.seatId?.endsWith('A-1'));
  console.log(`Event A Seat A1 booked to: "${seatA1_in_A?.assignedName}" (ID: ${seatA1_in_A?.assignedId})`);

  const seatsBRes = await get(`/api/seats/${eventIdB}`);
  const seatA1_in_B = seatsBRes.data.find(s => s.seatNo === 'A1' || s.seatId?.endsWith('A-1'));
  console.log(`Event B Seat A1 booked to: "${seatA1_in_B?.assignedName}" (ID: ${seatA1_in_B?.assignedId})`);

  if (seatA1_in_A?.assignedName !== 'David Attendee A' || seatA1_in_B?.assignedName !== 'Elena Attendee B') {
    throw new Error('FAILED: Guest bookings conflicted across events!');
  }
  console.log('PASSED: Seat maps and bookings are completely independent.\n');

  // 11. Verify default admin (admin@church.com) still logs in and works
  console.log('11. Verifying Default Admin Login (admin@church.com)...');
  const defaultLoginRes = await post('/api/auth/login', {
    email: 'admin@church.com',
    password: 'admin123',
  });
  console.log(`Default admin login status: ${defaultLoginRes.status}`);
  if (defaultLoginRes.status !== 200) {
    throw new Error(`Default admin login failed: ${JSON.stringify(defaultLoginRes.data)}`);
  }
  console.log(`Default admin logged in: ${defaultLoginRes.data.user.email}, org: ${defaultLoginRes.data.user.organization}\n`);

  console.log('=================================================================');
  console.log('ALL MULTI-TENANT ORGANIZATION ISOLATION TESTS PASSED PERFECTLY!');
  console.log('=================================================================');
}

runTests().catch(err => {
  console.error('\nTEST RUN FAILED:', err);
  process.exit(1);
});
