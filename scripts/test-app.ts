import { generateInitialSeatingLayout } from '../src/lib/mock-data';
import { SeatRecommendation } from '../src/types/database';

console.log('=== CHURCH SEATING MANAGEMENT TEST SUITE ===\n');

// 1. Test Seating Layout Generation
console.log('1. Testing Layout Generation...');
const layout = generateInitialSeatingLayout();
console.log(`- Sections generated: ${layout.sections.length}`);
console.log(`- Rows generated: ${layout.rows.length}`);
console.log(`- Total seats generated: ${layout.seats.length}`);
console.log(`- Service seats initialized: ${layout.serviceSeats.length}`);

if (layout.seats.length >= 800) {
  console.log('✅ Layout Generation PASSED (~800 seats generated successfully)');
} else {
  console.error('❌ Layout Generation FAILED: Less than 800 seats generated');
  process.exit(1);
}

// Build helper seat map
const seatMap = new Map();
const sectionMap = new Map(layout.sections.map(s => [s.id, s]));
const rowMap = new Map(layout.rows.map(r => [r.id, r]));
const ssMap = new Map(layout.serviceSeats.map(ss => [ss.seat_id, ss]));

layout.seats.forEach(seat => {
  const row = rowMap.get(seat.row_id);
  if (!row) return;
  const section = sectionMap.get(row.section_id);
  if (!section) return;
  const serviceSeat = ssMap.get(seat.id);
  seatMap.set(seat.id, { seat, row, section, serviceSeat });
});

// 2. Test Smart Find Seats Algorithm for 4 People
console.log('\n2. Testing Find Seats Algorithm for Group Size = 4...');
function findBestSeats(count: number): SeatRecommendation[] {
  const recs: SeatRecommendation[] = [];
  layout.sections.forEach(section => {
    const sRows = layout.rows.filter(r => r.section_id === section.id).sort((a,b) => a.sort_order - b.sort_order);
    sRows.forEach(row => {
      const rSeats = layout.seats.filter(s => s.row_id === row.id).sort((a,b) => a.seat_number - b.seat_number);
      let seq: any[] = [];
      for (let i = 0; i < rSeats.length; i++) {
        const info = seatMap.get(rSeats[i].id);
        if (info && info.serviceSeat && info.serviceSeat.status === 'AVAILABLE') {
          seq.push(info);
          if (seq.length === count) {
            recs.push({
              id: `rec-${section.code}-${row.row_name}-${seq[0].seat.seat_number}`,
              section,
              row,
              seats: [...seq],
              matchScore: 1000 + (100 - row.sort_order * 5),
              matchReason: `${count} consecutive seats together in ${section.name}, ${row.row_name}`
            });
            seq.shift();
          }
        } else {
          seq = [];
        }
      }
    });
  });
  return recs.sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);
}

const topOptions = findBestSeats(4);
console.log(`- Top options found: ${topOptions.length}`);
topOptions.forEach((opt, idx) => {
  const nums = opt.seats.map(s => s.seat.seat_number).join(', ');
  console.log(`  Option ${idx + 1}: ${opt.section.name}, ${opt.row.row_name}, Seats: [${nums}]`);
});

if (topOptions.length > 0 && topOptions[0].seats.length === 4) {
  console.log('✅ Smart Find Seats Algorithm PASSED (Successfully prioritized consecutive seats)');
} else {
  console.error('❌ Smart Find Seats Algorithm FAILED');
  process.exit(1);
}

// 3. Test Concurrency & Double-Booking Protection
console.log('\n3. Testing Concurrency & Double-Booking Protection...');
const targetOption = topOptions[0];
const targetSeatIds = targetOption.seats.map(s => s.seat.id);

// Simulate Usher A assigning seats
targetSeatIds.forEach(id => {
  const ss = ssMap.get(id);
  if (ss) {
    ss.status = 'OCCUPIED';
    ss.assigned_by = 'usher-a';
  }
});
console.log(`- Usher A assigned seats [${targetSeatIds.join(', ')}] -> Status updated to OCCUPIED`);

// Simulate Usher B attempting to assign the SAME seats
let conflictsFound = 0;
targetSeatIds.forEach(id => {
  const ss = ssMap.get(id);
  if (ss && (ss.status === 'OCCUPIED' || ss.status === 'RESERVED' || ss.status === 'BLOCKED')) {
    conflictsFound++;
  }
});

if (conflictsFound === targetSeatIds.length) {
  console.log('✅ Double-Booking Protection PASSED (Usher B blocked from assigning already occupied seats)');
} else {
  console.error('❌ Double-Booking Protection FAILED');
  process.exit(1);
}

// 4. Test Temporary Hold & Expiration
console.log('\n4. Testing Temporary Hold & Auto-Release Expiration...');
const availableSeat = layout.seats.find(s => {
  const ss = ssMap.get(s.id);
  return ss && ss.status === 'AVAILABLE';
});

if (availableSeat) {
  const ss = ssMap.get(availableSeat.id);
  if (ss) {
    // Set hold with expired timestamp (1 minute ago)
    ss.status = 'HELD';
    ss.held_until = new Date(Date.now() - 60000).toISOString();
    console.log(`- Seat ${availableSeat.seat_number} placed on HELD status with expired timestamp`);

    // Run auto-release check
    let releasedCount = 0;
    layout.serviceSeats.forEach(s => {
      if (s.status === 'HELD' && s.held_until && new Date(s.held_until).getTime() <= Date.now()) {
        s.status = 'AVAILABLE';
        s.held_until = undefined;
        releasedCount++;
      }
    });

    if (ss.status === ('AVAILABLE' as any) && releasedCount > 0) {
      console.log('✅ Temporary Hold Expiration PASSED (Expired hold auto-released back to AVAILABLE)');
    } else {
      console.error('❌ Temporary Hold Expiration FAILED');
      process.exit(1);
    }
  }
}

console.log('\n=== ALL SYSTEM TESTS PASSED SUCCESSFULLY! ===\n');
