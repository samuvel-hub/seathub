const http = require('http');

function request(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : '';
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: `/api${path}`,
        method,
        headers,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const parsed = body ? JSON.parse(body) : {};
            resolve({ status: res.statusCode, headers: res.headers, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, headers: res.headers, raw: body });
          }
        });
      }
    );

    req.on('error', (e) => reject(e));
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('=== SEATHUB END-TO-END AUTOMATED VERIFICATION ===\n');
  let adminToken = '';
  let passed = 0;
  let failed = 0;

  function assert(condition, testName, detail = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} - ${detail}`);
      failed++;
    }
  }

  try {
    // 1. Existing Login
    console.log('1. Testing Admin Authentication...');
    const loginRes = await request('POST', '/auth/login', {
      email: 'admin@church.com',
      password: 'admin123',
    });
    assert(loginRes.status === 200, 'Login returns 200 OK');
    assert(Boolean(loginRes.data.token), 'Auth token generated');
    adminToken = loginRes.data.token;

    // 2. Test Church Event with Standard Layout & Booking Requirements
    console.log('\n2. Testing Church Event Creation (Standard Layout & Booking Reqs)...');
    const churchEventPayload = {
      name: 'Sunday Morning Worship',
      category: 'Church',
      stageLabel: 'STAGE / ALTAR',
      type: 'Service',
      date: '2026-10-04',
      startTime: '09:00 AM',
      endTime: '11:00 AM',
      seatingLayoutType: 'standard',
      bookingRequirements: {
        fields: [
          { id: 'fullName', label: 'Full Name', enabled: true, required: true },
          { id: 'phone', label: 'Phone Number', enabled: true, required: true },
          { id: 'email', label: 'Email Address', enabled: false, required: false },
          { id: 'memberId', label: 'Member ID', enabled: true, required: false },
        ],
        customFields: [
          { id: 'family_name', label: 'Family Name', type: 'text', enabled: true, required: true },
        ],
      },
    };

    const createChurchRes = await request('POST', '/events', churchEventPayload, adminToken);
    assert(createChurchRes.status === 201, 'Church Event created with 201 Created');
    const churchEvent = createChurchRes.data;
    assert(churchEvent.category === 'Church', 'Event category is Church');
    assert(churchEvent.stageLabel === 'STAGE / ALTAR', 'Stage label is STAGE / ALTAR');
    assert(churchEvent.seatingLayoutType === 'standard', 'Layout type is standard');
    assert(Boolean(churchEvent.eventId), `Event ID generated: ${churchEvent.eventId}`);

    // 3. Guest Endpoint reads that SAME layout (Single Source of Truth)
    console.log('\n3. Testing Guest Page Access to Event & Seating Layout...');
    const guestEventRes = await request('GET', `/events/${churchEvent.eventId}`);
    assert(guestEventRes.status === 200, 'Guest can load event by eventId');
    assert(guestEventRes.data.category === 'Church', 'Guest sees category Church');
    assert(guestEventRes.data.stageLabel === 'STAGE / ALTAR', 'Guest sees STAGE / ALTAR');
    assert(guestEventRes.data.bookingRequirements.customFields.length === 1, 'Guest gets dynamic customFields requirement');

    const guestSeatsRes = await request('GET', `/seats/${churchEvent.eventId}`);
    assert(guestSeatsRes.status === 200, 'Guest can load seats');
    assert(guestSeatsRes.data.length >= 40, `Guest loads ${guestSeatsRes.data.length} initial standard seats`);
    const seatA1 = guestSeatsRes.data.find((s) => s.seatNo === 'A1');
    assert(Boolean(seatA1), 'Seat A1 exists');
    assert(seatA1?.status === 'available', 'Seat A1 is available');

    // 4. Test Copy Row / Layout Update in Admin
    console.log('\n4. Testing Seating Layout Update (Copy Row E)...');
    const existingRows = [
      { row: 'A', seatsPerRow: 10 },
      { row: 'B', seatsPerRow: 10 },
      { row: 'C', seatsPerRow: 10 },
      { row: 'D', seatsPerRow: 10 },
      { row: 'E', seatsPerRow: 10 }, // New copied row!
    ];
    const newSeatsList = [];
    existingRows.forEach((r) => {
      for (let n = 1; n <= r.seatsPerRow; n++) {
        newSeatsList.push({
          seatNo: `${r.row}${n}`,
          row: r.row,
          number: n,
          section: 'Main Floor',
          sectionCode: 'MAIN',
          status: 'available',
        });
      }
    });

    const updateLayoutRes = await request(
      'PUT',
      `/events/${churchEvent._id}/layout`,
      {
        seatingLayoutType: 'standard',
        seatingLayoutConfig: { stageLabel: 'STAGE / ALTAR', rows: existingRows },
        stageLabel: 'STAGE / ALTAR',
        seats: newSeatsList,
      },
      adminToken
    );
    assert(updateLayoutRes.status === 200, 'Admin successfully saves updated seating layout');
    assert(updateLayoutRes.data.seats.length === 50, 'Total seats updated to 50 including Row E');

    // 5. Test Guest Dynamic Booking
    console.log('\n5. Testing Guest Booking with Dynamic Requirements...');
    const bookingPayload = {
      eventId: churchEvent.eventId,
      seatNo: 'A1',
      name: 'John Doe',
      fullName: 'John Doe',
      phone: '9876543210',
      customFields: {
        family_name: 'Doe Family',
      },
    };

    const bookRes = await request('POST', '/bookings', bookingPayload);
    assert(bookRes.status === 201, 'Guest booking confirmed with 201 Created');
    assert(bookRes.data.booking.seatNo === 'A1', 'Booking records Seat A1');
    assert(bookRes.data.booking.fullName === 'John Doe', 'Booking records attendee full name');
    assert(bookRes.data.booking.formData?.customFields?.family_name === 'Doe Family' || bookRes.data.booking.formData?.family_name === 'Doe Family', 'Booking records dynamic custom field value');

    // Verify seat status changed to occupied
    const verifySeatsRes = await request('GET', `/seats/${churchEvent.eventId}`);
    const updatedA1 = verifySeatsRes.data.find((s) => s.seatNo === 'A1');
    assert(updatedA1?.status === 'occupied', 'Seat A1 status changed to occupied');
    assert(updatedA1?.assignedName === 'John Doe', 'Seat A1 assignedName updated to John Doe');

    // 6. Test Booked-Seat Warning / Protection (Requirement 9)
    console.log('\n6. Testing Booked-Seat Protection & Warning Dialog...');
    // Attempt to save layout that omits Row A (which contains booked seat A1)
    const omittedRowA = [
      { row: 'B', seatsPerRow: 10 },
      { row: 'C', seatsPerRow: 10 },
      { row: 'D', seatsPerRow: 10 },
    ];
    const seatsWithoutA = [];
    omittedRowA.forEach((r) => {
      for (let n = 1; n <= r.seatsPerRow; n++) {
        seatsWithoutA.push({
          seatNo: `${r.row}${n}`,
          row: r.row,
          number: n,
          section: 'Main Floor',
          sectionCode: 'MAIN',
          status: 'available',
        });
      }
    });

    const attemptDeleteRes = await request(
      'PUT',
      `/events/${churchEvent._id}/layout`,
      {
        seatingLayoutType: 'standard',
        seatingLayoutConfig: { stageLabel: 'STAGE / ALTAR', rows: omittedRowA },
        stageLabel: 'STAGE / ALTAR',
        seats: seatsWithoutA,
        force: false,
      },
      adminToken
    );

    assert(attemptDeleteRes.status === 409, 'Returns 409 Conflict when omitting booked seat without force');
    assert(attemptDeleteRes.data.warning === true, 'Returns warning: true');
    assert(
      attemptDeleteRes.data.message.includes('This seat already has a booking'),
      'Warning message matches required text: "This seat already has a booking..."'
    );
    assert(
      attemptDeleteRes.data.bookedSeats?.some((s) => s.seatNo === 'A1'),
      'Warning response lists affected booked seat A1'
    );

    // Verify Seat A1 and its booking were NOT deleted!
    const checkStillSafe = await request('GET', `/seats/${churchEvent.eventId}`);
    const safeA1 = checkStillSafe.data.find((s) => s.seatNo === 'A1');
    assert(Boolean(safeA1), 'Booked Seat A1 was NOT deleted');
    assert(safeA1?.status === 'occupied', 'Booked Seat A1 remains occupied');

    // 7. Test Section-Based Layout (e.g. College / Fest)
    console.log('\n7. Testing Section-Based Layout (College / Fest)...');
    const collegeEventPayload = {
      name: 'College Cultural Fest 2026',
      category: 'College',
      stageLabel: 'AUDITORIUM STAGE',
      type: 'Event',
      date: '2026-10-15',
      startTime: '10:00 AM',
      endTime: '04:00 PM',
      seatingLayoutType: 'section_based',
    };

    const createCollegeRes = await request('POST', '/events', collegeEventPayload, adminToken);
    assert(createCollegeRes.status === 201, 'College Section-Based Event created with 201 Created');
    const collegeEvent = createCollegeRes.data;
    assert(collegeEvent.category === 'College', 'Category is College');
    assert(collegeEvent.seatingLayoutType === 'section_based', 'Layout is section_based');

    const collegeSeatsRes = await request('GET', `/seats/${collegeEvent.eventId}`);
    const sectionCodes = Array.from(new Set(collegeSeatsRes.data.map((s) => s.sectionCode)));
    assert(sectionCodes.includes('LEFT'), 'Includes LEFT section');
    assert(sectionCodes.includes('CENTER'), 'Includes CENTER section');
    assert(sectionCodes.includes('RIGHT'), 'Includes RIGHT section');

    // Book seat in section-based layout
    const bookCollegeSeat = await request('POST', '/bookings', {
      eventId: collegeEvent.eventId,
      seatNo: 'LEFT-A1',
      name: 'Student Leader',
      phone: '9988776655',
    });
    assert(bookCollegeSeat.status === 201, 'Booked seat LEFT-A1 in Section-Based layout');

    // 8. Test Custom Visual Layout (e.g. Conference / Seminar)
    console.log('\n8. Testing Custom Visual Layout (Conference)...');
    const confPayload = {
      name: 'Tech Conference 2026',
      category: 'Conference',
      stageLabel: 'PODIUM / STAGE',
      type: 'Meeting',
      date: '2026-11-01',
      startTime: '08:30 AM',
      endTime: '05:00 PM',
      seatingLayoutType: 'custom',
    };

    const createConfRes = await request('POST', '/events', confPayload, adminToken);
    assert(createConfRes.status === 201, 'Custom Visual Event created with 201 Created');
    const confEvent = createConfRes.data;
    assert(confEvent.category === 'Conference', 'Category is Conference');
    assert(confEvent.seatingLayoutType === 'custom', 'Layout is custom');

    const confSeatsRes = await request('GET', `/seats/${confEvent.eventId}`);
    assert(confSeatsRes.data.length > 0, 'Custom layout initialized with seats');
    const customSeat = confSeatsRes.data[0];
    assert(customSeat.x !== undefined && customSeat.y !== undefined, 'Custom seats contain x and y coordinates');

    // 9. Verify Existing Features Remained Untouched
    console.log('\n9. Verifying Existing Features & Data Integrity...');
    const statsRes = await request('GET', `/seats/stats?eventId=${churchEvent._id}`, null, adminToken);
    assert(statsRes.status === 200, 'Reports / Seats Stats API still works');
    assert(statsRes.data.occupied >= 1, 'Stats correctly count occupied seat');

    const activityRes = await request('GET', '/activity', null, adminToken);
    assert(activityRes.status === 200, 'Activity Logs API still works');

    const usersRes = await request('GET', '/users', null, adminToken);
    assert(usersRes.status === 200, 'Users API still works');
    assert(usersRes.data.some(u => u.email === 'admin@church.com'), 'Admin user data preserved');

    console.log('\n=================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('=================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runTests();
