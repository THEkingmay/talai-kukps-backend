const assert = require('node:assert/strict');
const { test } = require('node:test');
const routes = require('./fixtures/realRoutes.json');
const recording = require('./fixtures/simulatorDormLap.json');
const { calculateLocalNextStop } = require('../../src/eta/localStopProgress.ts');
const { distanceInMeters } = require('../../src/eta/geo.ts');

const route = routes.find((r) => r.name === recording.route);

const replay = () => {
  let state;
  return recording.positions.map(([lat, lng]) => {
    const location = { lat, lng };
    const result = calculateLocalNextStop(route, location, state);
    if (result) state = result.state;
    return {
      next: result?.nextStopSequence,
      toStart: distanceInMeters(location, route.pathPoints[0]),
    };
  });
};

test('the next stop moves forward through the lap without flickering', () => {
  const changes = [];
  for (const { next } of replay()) {
    if (next !== changes.at(-1)) changes.push(next);
  }
  // Return leg 5 → 4 → 3 → 2 → 1, U-turn at the start, then outbound 2 → 6.
  assert.deepEqual(changes, [5, 4, 3, 2, 1, 2, 3, 4, 5, 6]);
});

test('after the U-turn at the start the next stop switches to stop 2 quickly', () => {
  const updates = replay();
  const closest = updates.reduce(
    (best, update, index) =>
      update.toStart < updates[best].toStart ? index : best,
    0,
  );
  const switched = updates.findIndex(
    (update, index) => index > closest && update.next === 2,
  );
  // The simulator turns around 18 m before the start and sends a position every second.
  assert.ok(
    switched - closest <= 3,
    `switched ${switched - closest} updates after the U-turn`,
  );
  assert.ok(updates[switched].toStart <= 30);
});
