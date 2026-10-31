const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  getLocationTimeMs,
  updateOriginWait,
} = require('../../src/eta/originWait.ts');

const firstStop = { lat: 14, lng: 99 };
// 0.00001 องศาละติจูด ≈ 1.1 เมตร
const north = (meters) => ({ lat: 14 + meters / 111320, lng: 99 });

// ป้อนตำแหน่งทีละรอบ (ห่างกัน 3 วินาที) แล้วคืน phase ของแต่ละรอบ
const run = (positions) => {
  let state;
  return positions.map((position, index) => {
    state = updateOriginWait(state, firstStop, position, index * 3000);
    return state.phase;
  });
};

test('car that drives in and stays still for 6 seconds is waiting', () => {
  assert.deepEqual(run([north(25), north(10), north(8), north(6)]), [
    'checking',
    'checking',
    'checking',
    'waiting',
  ]);
});

test('car that passes through the radius without stopping never waits', () => {
  assert.deepEqual(
    run([north(28), north(14), north(0), north(-14), north(-28), north(-40)]),
    ['checking', 'checking', 'checking', 'checking', 'checking', 'away'],
  );
});

test('GPS jitter while parked does not count as departure', () => {
  const phases = run([
    north(5),
    north(6),
    north(4),
    north(12),
    north(-2),
    north(14),
  ]);
  assert.equal(phases.at(-1), 'waiting');
});

test('slow creep away from the parked point is a departure', () => {
  // 4 เมตรต่อรอบ: วัดจากตำแหน่งล่าสุดจะไม่เคยเกิน 15 เมตร แต่จุดที่จอดคงที่
  const phases = run([
    north(0),
    north(0),
    north(0),
    north(-4),
    north(-8),
    north(-12),
    north(-16),
  ]);
  assert.deepEqual(phases.slice(2), [
    'waiting',
    'waiting',
    'waiting',
    'waiting',
    'departed',
  ]);
});

test('after departing, the car must leave the radius before waiting again', () => {
  const phases = run([
    north(0),
    north(0),
    north(0),
    north(20),
    north(20),
    north(20),
    north(20),
    north(40),
    north(25),
  ]);
  assert.deepEqual(phases.slice(3), [
    'departed',
    'departed',
    'departed',
    'departed',
    'away',
    'checking',
  ]);
});

test('location time uses createdAt and falls back to now', () => {
  assert.equal(
    getLocationTimeMs('2026-10-22T03:00:00.000Z'),
    Date.parse('2026-10-22T03:00:00.000Z'),
  );
  const before = Date.now();
  const fallback = getLocationTimeMs(null);
  assert.ok(fallback >= before && fallback <= Date.now());
  assert.ok(getLocationTimeMs('not a date') >= before);
});
