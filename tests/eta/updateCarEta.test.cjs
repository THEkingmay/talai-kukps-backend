const assert = require('node:assert/strict');
const { test, beforeEach } = require('node:test');
const { applyEtaData } = require('../../src/eta/eta-data.ts');
const { clearCarEtaState } = require('../../src/eta/car-eta-state.ts');
const { updateCarEta } = require('../../src/eta/update-car-eta.ts');

// สายทดสอบเป็นเส้นตรงไปทางตะวันออก มีจุดทุก 20 เมตร
// ป้าย 1 ที่ 0 ม. (pathIndex 0), ป้าย 2 ที่ 200 ม. (pathIndex 10), ป้าย 3 ที่ 400 ม. (pathIndex 20)
const ORIGIN = { lat: 14.02, lng: 99.97 };
const METERS_PER_DEGREE_LAT = 111320;
const METERS_PER_DEGREE_LNG =
  METERS_PER_DEGREE_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180);
const at = (x, y = 0) => ({
  lat: ORIGIN.lat + y / METERS_PER_DEGREE_LAT,
  lng: ORIGIN.lng + x / METERS_PER_DEGREE_LNG,
});

const STOP_NAMES = { 0: 'ป้าย 1', 200: 'ป้าย 2', 400: 'ป้าย 3' };
const pointsFor = (routeId) => {
  const points = [];
  for (let x = 0; x <= 400; x += 20) {
    let name = null;
    if (STOP_NAMES[x]) {
      name = STOP_NAMES[x];
    }
    points.push({ routeId, sequence: x, ...at(x), name, timeToNextSecs: 60 });
  }
  return points;
};

// สาย A กับสาย B เส้นทางเหมือนกัน แต่คนละ id
const ROUTE_ROWS = [
  { id: 'A', name: 'สาย A' },
  { id: 'B', name: 'สาย B' },
];
const POINT_ROWS = [...pointsFor('A'), ...pointsFor('B')];

const assignCar = (routeId) => {
  applyEtaData(ROUTE_ROWS, POINT_ROWS, [{ id: 'car', routeId }]);
};

// เวลาของตำแหน่ง: วินาทีที่ seconds หลัง 07:00:00 UTC
const time = (seconds) => new Date(Date.UTC(2026, 9, 28, 7, 0, seconds)).toISOString();

// ส่งตำแหน่งให้ updateCarEta เหมือนตัวรับ MQTT
const send = (x, seconds, y = 0) => updateCarEta('car', { ...at(x, y), createdAt: time(seconds) });

const NO_ETA = { nextStopPathIndex: null, originWaiting: false, nextStopStartedAt: null };

beforeEach(() => {
  clearCarEtaState('car');
  assignCar('A');
});

test('a car with no route, or an unknown car, has no ETA', () => {
  assignCar(null);
  assert.deepEqual(send(40, 0), NO_ETA);
  assert.deepEqual(updateCarEta('unknown', { ...at(40), createdAt: time(0) }), NO_ETA);
});

test('a car far from the route has no ETA', () => {
  assert.deepEqual(send(100, 0, 300), NO_ETA);
});

test('startedAt stays the same until the next stop changes', () => {
  const first = send(40, 0);
  assert.equal(first.nextStopPathIndex, 10);
  assert.equal(first.nextStopStartedAt, time(0));

  // วิ่งต่อ ป้ายถัดไปยังเป็นป้าย 2 → นับต่อจากเวลาเดิม
  for (let x = 50, seconds = 1; x <= 150; x += 10, seconds += 1) {
    const result = send(x, seconds);
    assert.equal(result.nextStopPathIndex, 10);
    assert.equal(result.nextStopStartedAt, time(0));
  }

  // ผ่านป้าย 2 → ป้ายถัดไปเป็นป้าย 3 และเริ่มนับใหม่จากตำแหน่งที่ผ่าน
  let passed;
  for (let x = 160, seconds = 12; x <= 260; x += 10, seconds += 1) {
    const result = send(x, seconds);
    if (result.nextStopPathIndex === 20) {
      passed = { result, seconds };
      break;
    }
  }
  assert.ok(passed, 'next stop should move to ป้าย 3');
  assert.equal(passed.result.nextStopStartedAt, time(passed.seconds));
});

test('waiting at the first stop does not count, departing starts the countdown', () => {
  // จอดนิ่งที่ป้ายแรกเกิน 6 วินาที
  let result;
  for (let seconds = 0; seconds <= 9; seconds += 3) {
    result = send(2, seconds);
  }
  assert.equal(result.originWaiting, true);
  assert.equal(result.nextStopStartedAt, null);

  // ออกจากที่จอด (ห่างเกิน 15 เมตร) → เริ่มนับจากเวลาที่ออก
  result = send(20, 12);
  assert.equal(result.originWaiting, false);
  assert.equal(result.nextStopStartedAt, time(12));

  result = send(30, 13);
  assert.equal(result.nextStopStartedAt, time(12));
});

test('moving the car to another route starts over instead of reusing the old state', () => {
  send(40, 0);
  send(50, 1);

  // Admin ย้ายรถไปสาย B (เส้นทางเหมือนกัน ป้ายถัดไปเหมือนเดิม)
  // ถ้ายังใช้ state ของสาย A อยู่ จะได้เวลาเดิม time(0)
  assignCar('B');
  const result = send(60, 2);
  assert.equal(result.nextStopPathIndex, 10);
  assert.equal(result.nextStopStartedAt, time(2));
});

test('removing the route assignment clears the state', () => {
  send(40, 0);
  send(50, 1);

  assignCar(null);
  assert.deepEqual(send(60, 2), NO_ETA);

  // กำหนดสาย A กลับมา → เริ่มนับใหม่ ไม่ใช้เวลาเดิม
  assignCar('A');
  assert.equal(send(70, 3).nextStopStartedAt, time(3));
});
