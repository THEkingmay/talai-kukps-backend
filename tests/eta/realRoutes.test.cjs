const assert = require('node:assert/strict');
const { test } = require('node:test');
const routes = require('./fixtures/realRoutes.json');
const { calculateLocalNextStop } = require('../../src/eta/localStopProgress.ts');
const { getRouteStopOccurrences } = require('../../src/eta/stopOccurrences.ts');
const { distanceInMeters, toLocalMeters } = require('../../src/eta/geo.ts');

const fromLocal = (origin, x, y) => ({
  lat: origin.lat + y / 111320,
  lng: origin.lng + x / (111320 * Math.cos((origin.lat * Math.PI) / 180)),
});

// Positions along two laps, one every `step` metres, with GPS noise alternating
// to each side and short stops where GPS jitters in place.
const buildSamples = (route, { step, noise, pauses }) => {
  const samples = [];
  for (let lap = 0; lap < 2; lap += 1) {
    for (let i = 0; i < route.pathPoints.length - 1; i += 1) {
      const a = route.pathPoints[i];
      const end = toLocalMeters(a, route.pathPoints[i + 1]);
      const length = Math.hypot(end.x, end.y);
      const count = Math.max(1, Math.round(length / step));
      const nx = length ? -end.y / length : 0;
      const ny = length ? end.x / length : 0;
      for (let s = 0; s < count; s += 1) {
        const t = s / count;
        // Stop mid-segment only: right at a stop, jitter beyond the 5 m arrival
        // radius makes "arrived" and "not yet" both valid answers.
        const stopHere = pauses && t > 0 && samples.length % 7 === 0 ? 4 : 0;
        for (let pause = 0; pause < stopHere; pause += 1) {
          const jitter = pause % 2 ? 4 : -4;
          samples.push({
            lap,
            progress: i + t,
            location: fromLocal(a, end.x * t + jitter, end.y * t - jitter),
          });
        }
        const side = samples.length % 2 ? 1 : -1;
        samples.push({
          lap,
          progress: i + t,
          location: fromLocal(
            a,
            end.x * t + nx * noise * side,
            end.y * t + ny * noise * side,
          ),
        });
      }
    }
  }
  return samples;
};

// Feed positions from `from` to `to`, starting with no state like a freshly
// opened app. Returns the positions (as update counts since opening) where the
// next stop differs from the stop ahead of the car.
const replay = (route, samples, from, to) => {
  const stops = getRouteStopOccurrences(route);
  let state;
  const wrong = [];
  for (let order = from; order < to; order += 1) {
    const { progress, location } = samples[order];
    const result = calculateLocalNextStop(route, location, state);
    if (result) state = result.state;
    // The very first position cannot show the direction of travel.
    if (order === from) continue;
    let index = stops.findIndex((stop) => stop.pathIndex > progress);
    if (index < 0) index = 0;
    if (distanceInMeters(location, stops[index]) <= 5) {
      index = (index + 1) % stops.length;
    }
    // Right after a U-turn at the first stop the car is on the same road it
    // arrived on; a slow car may still show the first stop for a few updates.
    const justLeftFirstStop =
      index === 1 &&
      result?.nextStopPathIndex === stops[0].pathIndex &&
      distanceInMeters(location, stops[0]) <= 60;
    if (
      result?.nextStopPathIndex !== stops[index].pathIndex &&
      !justLeftFirstStop
    ) {
      wrong.push({
        update: order - from,
        progress: Number(progress.toFixed(2)),
        got: result?.nextStopSequence,
        expected: stops[index].sequence,
      });
    }
  }
  return wrong;
};

for (const route of routes) {
  for (const options of [
    { step: 10, noise: 0, pauses: false },
    { step: 15, noise: 5, pauses: false },
    { step: 25, noise: 3, pauses: false },
    { step: 40, noise: 5, pauses: false },
    { step: 25, noise: 3, pauses: true },
  ]) {
    const label = `${options.step} m steps, ${options.noise} m noise${options.pauses ? ', with stops' : ''}`;
    test(`${route.name}: next stop follows the car over two laps (${label})`, () => {
      const samples = buildSamples(route, options);
      assert.deepEqual(replay(route, samples, 0, samples.length), []);
    });
  }

  test(`${route.name}: opening the app anywhere recovers within a few updates`, () => {
    const samples = buildSamples(route, { step: 25, noise: 3, pauses: false });
    const lapLength = samples.findIndex((sample) => sample.lap === 1);
    // Where both legs share position and direction (the loop at stop 5 on
    // สายหอใน) the first guess can be the wrong leg until the legs split.
    const MAX_UPDATES_TO_RECOVER = 8;
    const late = [];
    for (let start = 0; start < lapLength; start += 1) {
      for (const wrong of replay(route, samples, start, start + lapLength)) {
        if (wrong.update > MAX_UPDATES_TO_RECOVER)
          late.push({ start, ...wrong });
      }
    }
    assert.deepEqual(late, []);
  });
}
