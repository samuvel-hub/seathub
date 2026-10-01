const assert = require('assert');
const { validateTimeRange, parseAndValidateTime } = require('../backend/utils/timeValidator');

console.log('=== STRICT TIME VALIDATION RULES TEST SUITE ===\n');

// 1. Valid 12-hour format from user prompt screenshot: Start: "09:00 AM", End: "10:30 AM"
const res1 = validateTimeRange('09:00 AM', '10:30 AM');
console.log('Test 1 (09:00 AM -> 10:30 AM):', JSON.stringify(res1, null, 2));
assert.strictEqual(res1.is_valid, true);
assert.strictEqual(res1.start_time_24h, '09:00');
assert.strictEqual(res1.end_time_24h, '10:30');
assert.strictEqual(res1.duration_minutes, 90);
assert.strictEqual(res1.error, null);
console.log('✓ Test 1 Passed\n');

// 2. Reject "4.99" (period instead of colon, 99 invalid minutes)
const res2 = validateTimeRange('4.99', '10:30 AM');
console.log('Test 2 (4.99 -> 10:30 AM):', JSON.stringify(res2, null, 2));
assert.strictEqual(res2.is_valid, false);
assert.strictEqual(res2.start_time_24h, null);
assert.strictEqual(res2.end_time_24h, null);
assert.strictEqual(res2.duration_minutes, null);
assert(typeof res2.error === 'string' && res2.error.includes('4.99'));
console.log('✓ Test 2 Passed\n');

// 3. Reject invalid minutes "04:99 AM"
const res3 = validateTimeRange('04:99 AM', '10:30 AM');
console.log('Test 3 (04:99 AM -> 10:30 AM):', JSON.stringify(res3, null, 2));
assert.strictEqual(res3.is_valid, false);
assert(res3.error.includes('Minutes must be between 00 and 59'));
console.log('✓ Test 3 Passed\n');

// 4. Valid 24-hour format: "14:30" -> "16:00"
const res4 = validateTimeRange('14:30', '16:00');
console.log('Test 4 (14:30 -> 16:00):', JSON.stringify(res4, null, 2));
assert.strictEqual(res4.is_valid, true);
assert.strictEqual(res4.start_time_24h, '14:30');
assert.strictEqual(res4.end_time_24h, '16:00');
assert.strictEqual(res4.duration_minutes, 90);
assert.strictEqual(res4.error, null);
console.log('✓ Test 4 Passed\n');

// 5. Reject End Time before or equal to Start Time
const res5 = validateTimeRange('11:00 AM', '09:00 AM');
console.log('Test 5 (11:00 AM -> 09:00 AM):', JSON.stringify(res5, null, 2));
assert.strictEqual(res5.is_valid, false);
assert.strictEqual(res5.duration_minutes, null);
assert.strictEqual(res5.error, 'End Time must occur after the Start Time.');
console.log('✓ Test 5 Passed\n');

const res5b = validateTimeRange('10:00 AM', '10:00 AM');
assert.strictEqual(res5b.is_valid, false);
assert.strictEqual(res5b.error, 'End Time must occur after the Start Time.');
console.log('✓ Test 5b Passed (Same start and end rejected)\n');

// 6. PM to PM
const res6 = validateTimeRange('01:15 PM', '03:45 PM');
assert.strictEqual(res6.is_valid, true);
assert.strictEqual(res6.start_time_24h, '13:15');
assert.strictEqual(res6.end_time_24h, '15:45');
assert.strictEqual(res6.duration_minutes, 150);
console.log('✓ Test 6 Passed (PM conversion and duration 150 mins)\n');

console.log('ALL TIME VALIDATION TESTS PASSED SUCCESSFULLY!');
