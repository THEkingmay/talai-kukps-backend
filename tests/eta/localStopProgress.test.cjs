const assert = require('node:assert/strict');
const { test } = require('node:test');
const { calculateLocalNextStop } = require('../../src/eta/localStopProgress.ts');
const { getRouteStopOccurrences } = require('../../src/eta/stopOccurrences.ts');

const ORIGIN = { lat: 14.02, lng: 99.97 };
const METERS_PER_DEGREE_LAT = 111320;
const METERS_PER_DEGREE_LNG =
  METERS_PER_DEGREE_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180);
const at = (x, y) => ({
  lat: ORIGIN.lat + y / METERS_PER_DEGREE_LAT,
  lng: ORIGIN.lng + x / METERS_PER_DEGREE_LNG,
});

const STOPS = [
  ['ป้าย 1', [0, 0]],
  ['ป้าย 2 ขาไป', [200, 0]],
  ['ป้าย 3 ขาไป', [400, 0]],
  ['ป้าย 4', [400, 200]],
  ['ป้าย 5', [600, 200]],
  ['ป้าย 6', [600, 0]],
  ['ป้าย 3 ขากลับ', [400, -4]],
  ['ป้าย 2 ขากลับ', [200, -4]],
  ['ป้าย 1', [0, -4]],
];
const STEPS_PER_LEG = 10;
const pathMeters = [];
const pathPoints = [];
STOPS.forEach(([name, [x, y]], stopIndex) => {
  if (stopIndex > 0) {
    const [previousX, previousY] = STOPS[stopIndex - 1][1];
    for (let step = 1; step < STEPS_PER_LEG; step += 1) {
      const t = step / STEPS_PER_LEG;
      const point = [
        previousX + (x - previousX) * t,
        previousY + (y - previousY) * t,
      ];
      pathMeters.push(point);
      pathPoints.push({ ...at(...point), name: null, timeToNextSecs: null });
    }
  }
  pathMeters.push([x, y]);
  pathPoints.push({ ...at(x, y), name, timeToNextSecs: 60 });
});
const route = { id: 'route', name: 'สายทดสอบ', pathPoints };
const occurrences = getRouteStopOccurrences(route);

const summarize = (result) =>
  result && {
    sequence: result.nextStopSequence,
    pathIndex: result.nextStopPathIndex,
  };

const drive = (positions, state) =>
  positions.map((position) => {
    const result = calculateLocalNextStop(route, at(...position), state);
    if (result) state = result.state;
    return summarize(result);
  });

test('repeated stops share a number but keep their own path index', () => {
  assert.deepEqual(
    occurrences.map((stop) => stop.sequence),
    [1, 2, 3, 4, 5, 6, 3, 2],
  );
  assert.deepEqual(
    occurrences.map((stop) => stop.pathIndex),
    [0, 10, 20, 30, 40, 50, 60, 70],
  );
});

const twoLapIndexes = [...pathMeters.keys(), ...pathMeters.keys()].filter(
  (index, order) => order > 0 && (order <= 80 || index > 0),
);
const twoLapExpected = twoLapIndexes.map((index) => {
  const ahead = occurrences.find((stop) => stop.pathIndex > index);
  const stop = ahead ?? (index === 80 ? occurrences[1] : occurrences[0]);
  return { sequence: stop.sequence, pathIndex: stop.pathIndex };
});

test('driving two full laps always targets the stop ahead', () => {
  assert.deepEqual(
    drive(twoLapIndexes.map((index) => pathMeters[index])),
    twoLapExpected,
  );
});

test('two laps with GPS 2.5 m toward the other lane on the shared road', () => {
  const noisy = (index) => {
    const [x, y] = pathMeters[index];
    if (index <= 20) return [x, y - 2.5];
    if (index >= 60) return [x, y + 2.5];
    return [x, y];
  };
  assert.deepEqual(drive(twoLapIndexes.map(noisy)), twoLapExpected);
});

test('first position on the outbound lane targets stop 2', () => {
  assert.deepEqual(drive([[100, 0]]), [{ sequence: 2, pathIndex: 10 }]);
});

test('first position exactly on the return lane targets stop 1', () => {
  assert.deepEqual(drive([[100, -4]]), [{ sequence: 1, pathIndex: 0 }]);
});

test('with 3 m GPS error on the return lane, the second position corrects the direction', () => {
  assert.deepEqual(
    drive([
      [100, -1],
      [80, -1],
    ]),
    [
      { sequence: 2, pathIndex: 10 },
      { sequence: 1, pathIndex: 0 },
    ],
  );
});

test('the car keeps heading back to stop 1 after that first position', () => {
  const results = drive([
    [100, -1],
    [80, -1],
    [60, -1],
    [40, -1],
  ]);
  assert.deepEqual(results.at(-1), { sequence: 1, pathIndex: 0 });
});

test('a car waiting in place keeps its first guess until it moves', () => {
  assert.deepEqual(
    drive([
      [100, -1],
      [103, -2],
      [98, -1],
    ]),
    [
      { sequence: 2, pathIndex: 10 },
      { sequence: 2, pathIndex: 10 },
      { sequence: 2, pathIndex: 10 },
    ],
  );
});

test('GPS wobble just past stop 3 does not jump to the return leg', () => {
  assert.deepEqual(
    drive([
      [400, 20],
      [400, 8],
      [400, -6],
    ]),
    [
      { sequence: 4, pathIndex: 30 },
      { sequence: 4, pathIndex: 30 },
      { sequence: 4, pathIndex: 30 },
    ],
  );
});

test('a car more than 100 m from the route gets no next stop', () => {
  assert.deepEqual(drive([[100, 150]]), [null]);
});

test('within 5 m of stop 4 the car has arrived and targets stop 5', () => {
  assert.deepEqual(
    drive([
      [400, 180],
      [400, 196],
    ]).at(-1),
    {
      sequence: 5,
      pathIndex: 40,
    },
  );
});

test('8 m before stop 4 the car has not arrived yet and still targets stop 4', () => {
  assert.deepEqual(
    drive([
      [400, 180],
      [400, 192],
    ]).at(-1),
    {
      sequence: 4,
      pathIndex: 30,
    },
  );
});
