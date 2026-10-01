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
  console.log('=== SEATING LAYOUT SIMPLIFICATION VERIFICATION ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, name, detail = '') {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name} - ${detail}`);
      failed++;
    }
  }

  try {
    // 1. Login
    console.log('1. Admin Authentication...');
    const loginRes = await request('POST', '/auth/login', {
      email: 'admin@church.com',
      password: 'admin123',
    });
    assert(loginRes.status === 200, 'Admin login 200 OK');
    const token = loginRes.data.token;

    // 2. Section-Based Layout: Create Event
    console.log('\n2. Testing Simplified Section-Based Layout Flow...');
    const secEventPayload = {
      name: 'Annual Gala Night',
      category: 'Fest / Cultural',
      stageLabel: 'MAIN STAGE',
      type: 'Event',
      date: '2026-12-25',
      startTime: '06:00 PM',
      endTime: '10:00 PM',
      seatingLayoutType: 'section_based',
    };

    const createSecRes = await request('POST', '/events', secEventPayload, token);
    assert(createSecRes.status === 201, 'Section-Based Event created with 201 Created');
    const secEvent = createSecRes.data;

    // 3. Admin updates layout with exact 2 sections: Main Floor (3 rows x 10) & VIP (2 rows x 6)
    console.log('3. Admin saves exact Section-Based Layout (Main Floor 3x10, VIP 2x6)...');
    const mainRows = ['A', 'B', 'C'].map((r) => ({ row: r, seatsPerRow: 10 }));
    const vipRows = ['A', 'B'].map((r) => ({ row: r, seatsPerRow: 6 }));

    const generatedSecSeats = [];
    // Main Floor seats
    for (const r of mainRows) {
      for (let n = 1; n <= r.seatsPerRow; n++) {
        generatedSecSeats.push({
          seatId: `MAIN-${r.row}-${n}`,
          seatNo: `MAIN-${r.row}${n}`,
          section: 'Main Floor',
          sectionCode: 'MAIN',
          row: r.row,
          number: n,
          status: 'available',
        });
      }
    }
    // VIP seats
    for (const r of vipRows) {
      for (let n = 1; n <= r.seatsPerRow; n++) {
        generatedSecSeats.push({
          seatId: `VIP-${r.row}-${n}`,
          seatNo: `VIP-${r.row}${n}`,
          section: 'VIP',
          sectionCode: 'VIP',
          row: r.row,
          number: n,
          status: 'available',
        });
      }
    }

    const saveSecLayoutRes = await request(
      'PUT',
      `/events/${secEvent._id}/layout`,
      {
        seatingLayoutType: 'section_based',
        stageLabel: 'MAIN STAGE',
        seatingLayoutConfig: {
          stageLabel: 'MAIN STAGE',
          sections: [
            { id: 'sec-main', name: 'Main Floor', code: 'MAIN', rows: mainRows },
            { id: 'sec-vip', name: 'VIP', code: 'VIP', rows: vipRows },
          ],
        },
        seats: generatedSecSeats,
      },
      token
    );
    assert(saveSecLayoutRes.status === 200, 'Saved Section-Based layout successfully');
    assert(saveSecLayoutRes.data.seats.length === 42, 'Total seats in DB is 30 (Main) + 12 (VIP) = 42');

    // 4. Verify Guest sees the EXACT same layout data
    console.log('4. Verifying Guest reads the EXACT same Section-Based Layout...');
    const guestSecEventRes = await request('GET', `/events/${secEvent.eventId}`);
    assert(guestSecEventRes.status === 200, 'Guest retrieves event');
    const guestSections = guestSecEventRes.data.seatingLayoutConfig?.sections;
    assert(guestSections?.length === 2, 'Guest gets exactly 2 sections');
    assert(guestSections[0].name === 'Main Floor', 'First section is Main Floor');
    assert(guestSections[0].rows.length === 3, 'Main Floor has 3 rows');
    assert(guestSections[1].name === 'VIP', 'Second section is VIP');
    assert(guestSections[1].rows.length === 2, 'VIP has 2 rows');

    const guestSecSeatsRes = await request('GET', `/seats/${secEvent.eventId}`);
    assert(guestSecSeatsRes.data.length === 42, 'Guest loads 42 seats from backend');
    const vipA1 = guestSecSeatsRes.data.find((s) => s.seatNo === 'VIP-A1');
    assert(Boolean(vipA1), 'VIP Seat A1 exists');
    assert(vipA1?.section === 'VIP', 'VIP Seat section is VIP');

    // Guest books VIP-A1
    const bookVipRes = await request('POST', '/bookings', {
      eventId: secEvent.eventId,
      seatNo: 'VIP-A1',
      name: 'Alice VIP',
      phone: '1122334455',
    });
    assert(bookVipRes.status === 201, 'Guest successfully booked VIP-A1');

    // 5. Custom Visual Layout: Create Event
    console.log('\n5. Testing Simplified Custom Visual Layout Flow...');
    const custEventPayload = {
      name: 'Design Summit 2026',
      category: 'Conference',
      stageLabel: 'KEYNOTE PODIUM',
      type: 'Meeting',
      date: '2026-11-20',
      startTime: '10:00 AM',
      endTime: '05:00 PM',
      seatingLayoutType: 'custom',
    };

    const createCustRes = await request('POST', '/events', custEventPayload, token);
    assert(createCustRes.status === 201, 'Custom Visual Event created with 201 Created');
    const custEvent = createCustRes.data;

    // 6. Admin bulk deletes seats A1, A2, B1, B2 and saves Custom Visual Layout
    console.log('6. Admin performs bulk delete on A1, A2, B1, B2 and saves Custom Layout...');
    const customRowsAfterDelete = [
      {
        id: 'row-A',
        rowLetter: 'A',
        section: 'Main',
        seats: [3, 4, 5, 6, 7, 8].map((n) => ({
          id: `seat-A${n}`,
          seatNo: `A${n}`,
          row: 'A',
          number: n,
          status: 'available',
        })),
      },
      {
        id: 'row-B',
        rowLetter: 'B',
        section: 'Main',
        seats: [3, 4, 5, 6, 7, 8].map((n) => ({
          id: `seat-B${n}`,
          seatNo: `B${n}`,
          row: 'B',
          number: n,
          status: 'available',
        })),
      },
      {
        id: 'row-C',
        rowLetter: 'C',
        section: 'Main',
        seats: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
          id: `seat-C${n}`,
          seatNo: `C${n}`,
          row: 'C',
          number: n,
          status: 'available',
        })),
      },
    ];

    const generatedCustomSeats = [];
    customRowsAfterDelete.forEach((r, rIdx) => {
      r.seats.forEach((s, colIdx) => {
        generatedCustomSeats.push({
          seatId: s.id,
          seatNo: s.seatNo,
          row: s.row,
          number: s.number,
          section: 'Main',
          sectionCode: 'MAIN',
          status: 'available',
          x: 100 + colIdx * 50,
          y: 100 + rIdx * 60,
        });
      });
    });

    const saveCustRes = await request(
      'PUT',
      `/events/${custEvent._id}/layout`,
      {
        seatingLayoutType: 'custom',
        stageLabel: 'KEYNOTE PODIUM',
        seatingLayoutConfig: {
          stageLabel: 'KEYNOTE PODIUM',
          customRows: customRowsAfterDelete,
          elements: [{ id: 'aisle-1', type: 'aisle', label: 'AISLE', afterRow: 'B' }],
        },
        seats: generatedCustomSeats,
      },
      token
    );
    assert(saveCustRes.status === 200, 'Saved Custom Visual layout successfully');
    assert(saveCustRes.data.seats.length === 20, 'Total seats is 6 (A) + 6 (B) + 8 (C) = 20 seats');

    // 7. Verify Guest receives the exact Custom Layout without A1, A2, B1, B2
    console.log('7. Verifying Guest reads the EXACT same Custom Visual Layout...');
    const guestCustEventRes = await request('GET', `/events/${custEvent.eventId}`);
    assert(guestCustEventRes.status === 200, 'Guest retrieves custom event');
    const guestCustomRows = guestCustEventRes.data.seatingLayoutConfig?.customRows;
    assert(guestCustomRows?.length === 3, 'Guest gets 3 custom rows');
    assert(guestCustomRows[0].seats.length === 6, 'Row A has exactly 6 seats');
    assert(guestCustomRows[0].seats[0].seatNo === 'A3', 'First seat in Row A is A3 (A1 & A2 are absent)');
    assert(guestCustomRows[1].seats[0].seatNo === 'B3', 'First seat in Row B is B3 (B1 & B2 are absent)');

    const guestCustSeatsRes = await request('GET', `/seats/${custEvent.eventId}`);
    assert(guestCustSeatsRes.data.length === 20, 'Guest retrieves exactly 20 seats from DB');
    assert(!guestCustSeatsRes.data.some((s) => s.seatNo === 'A1'), 'Seat A1 does not exist in DB');
    assert(!guestCustSeatsRes.data.some((s) => s.seatNo === 'B2'), 'Seat B2 does not exist in DB');

    // Guest books seat A3
    const bookCustRes = await request('POST', '/bookings', {
      eventId: custEvent.eventId,
      seatNo: 'A3',
      name: 'Bob Attendee',
      phone: '9988776655',
    });
    assert(bookCustRes.status === 201, 'Guest successfully booked Seat A3');

    console.log('\n=================================================');
    console.log(`CUSTOM VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('=================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (e) {
    console.error('Test error:', e);
    process.exit(1);
  }
}

runTests();
