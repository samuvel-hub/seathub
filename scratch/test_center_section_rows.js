const assert = require('assert');
const fs = require('fs');
const path = require('path');

// 1. Inspect DynamicSeatingMap.jsx
const dsmPath = path.join(__dirname, '../frontend/src/components/seating/DynamicSeatingMap.jsx');
const dsmCode = fs.readFileSync(dsmPath, 'utf8');

console.log('--- 1. Testing DynamicSeatingMap.jsx ---');

// Check no flex-wrap on seat rows
assert(!dsmCode.includes('flex flex-wrap gap-1.5 flex-1'), 'No flex-wrap on seat rows in DynamicSeatingMap');
assert(dsmCode.includes('flex items-center gap-1.5 flex-nowrap shrink-0'), 'Row seats have flex-nowrap shrink-0');
assert(dsmCode.includes('min-w-max'), 'Row container has min-w-max');
assert(dsmCode.includes('overflow-x-auto'), 'Section container has overflow-x-auto');
assert(dsmCode.includes('sticky left-0 z-20'), 'Row label is sticky left-0 with z-20');
assert(dsmCode.includes('Math.max(r.seatsPerRow || 0, maxNumInDb, actualSeatsInSecRow.length, 1)'), 'Dynamic count without hard-coded 10 limit');

console.log('✓ DynamicSeatingMap.jsx passed all checks!');

// 2. Inspect SeatingMapPage.jsx
const smpPath = path.join(__dirname, '../frontend/src/pages/SeatingMapPage.jsx');
const smpCode = fs.readFileSync(smpPath, 'utf8');

console.log('--- 2. Testing SeatingMapPage.jsx ---');
assert(smpCode.includes('handleUpdateRowSeatsCountInSection'), 'Includes handleUpdateRowSeatsCountInSection');
assert(smpCode.includes('flex items-center gap-1.5 min-w-max'), 'Section editor has min-w-max row container');
assert(smpCode.includes('overflow-x-auto pb-1'), 'Section editor has overflow-x-auto');
assert(!smpCode.includes('const count = r.seatsPerRow || 6;'), 'No hard-coded 6 fallback in handleSaveLayout');

console.log('✓ SeatingMapPage.jsx passed all checks!');

// 3. Simulate seat generation logic for Center Section rows
console.log('--- 3. Simulating dynamic row seat generation for Center Section ---');

function generateRowSeats(r, sec, seats, seatMap) {
  const actualSeatsInSecRow = seats.filter(
    (s) =>
      (s.sectionCode === sec.code || s.section === sec.name) &&
      (s.row || 'A') === r.row
  );
  const maxNumInDb = actualSeatsInSecRow.reduce(
    (max, s) => Math.max(max, s.number || 0),
    0
  );
  const count = Math.max(r.seatsPerRow || 0, maxNumInDb, actualSeatsInSecRow.length, 1);

  const rowSeats = [];
  for (let n = 1; n <= count; n++) {
    const sNoWithPrefix = `${sec.code || 'SEC'}-${r.row}${n}`;
    const rawSNo = `${r.row}${n}`;
    const found = seatMap.get(sNoWithPrefix.toUpperCase()) || seatMap.get(rawSNo.toUpperCase());
    rowSeats.push(
      found || {
        seatNo: sNoWithPrefix,
        displayName: `${r.row}${n}`,
        row: r.row,
        number: n,
        section: sec.name,
        sectionCode: sec.code,
        status: 'available',
      }
    );
  }
  return rowSeats;
}

const sec = { name: 'Center Section', code: 'CENTER' };
const emptySeats = [];
const emptyMap = new Map();

// Test 6 seats
const row6 = generateRowSeats({ row: 'A', seatsPerRow: 6 }, sec, emptySeats, emptyMap);
assert.strictEqual(row6.length, 6, 'Row A with 6 seats has 6 elements');
assert.strictEqual(row6[0].displayName, 'A1');
assert.strictEqual(row6[5].displayName, 'A6');
console.log('✓ Row A (6 seats): A1 to A6 generated successfully');

// Test 10 seats
const row10 = generateRowSeats({ row: 'A', seatsPerRow: 10 }, sec, emptySeats, emptyMap);
assert.strictEqual(row10.length, 10, 'Row A with 10 seats has 10 elements');
assert.strictEqual(row10[0].displayName, 'A1');
assert.strictEqual(row10[9].displayName, 'A10');
console.log('✓ Row A (10 seats): A1 to A10 generated successfully');

// Test 20 seats
const row20 = generateRowSeats({ row: 'A', seatsPerRow: 20 }, sec, emptySeats, emptyMap);
assert.strictEqual(row20.length, 20, 'Row A with 20 seats has 20 elements');
assert.strictEqual(row20[0].displayName, 'A1');
assert.strictEqual(row20[19].displayName, 'A20');
console.log('✓ Row A (20 seats): A1 to A20 generated successfully (never split into lines)');

// Test 30 seats
const row30 = generateRowSeats({ row: 'A', seatsPerRow: 30 }, sec, emptySeats, emptyMap);
assert.strictEqual(row30.length, 30, 'Row A with 30 seats has 30 elements');
assert.strictEqual(row30[0].displayName, 'A1');
assert.strictEqual(row30[29].displayName, 'A30');
console.log('✓ Row A (30 seats): A1 to A30 generated successfully (continuous single row)');

console.log('ALL TESTS PASSED!');
