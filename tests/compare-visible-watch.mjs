import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const directory = new URL('../artifacts/endurance/', import.meta.url);
const actual = JSON.parse(await readFile(new URL('visible-watch-baseline.json', directory), 'utf8'));
const comparisons = [];
assert.equal(actual.current.phase, 'complete');
assert.equal(actual.results.length, 3);
assert.equal(actual.seed, 20261112);
assert.equal(actual.stoppedAt, null);
for (const [index, slug] of ['easy-10', 'medium-15', 'extreme-20'].entries()) {
  const expected = JSON.parse(await readFile(new URL(`${slug}.json`, directory), 'utf8'));
  const observed = actual.results[index];
  assert.equal(observed.name, expected.scenario.name);
  assert.equal(observed.difficulty, expected.scenario.difficulty);
  assert.equal(observed.laps, expected.scenario.laps);
  assert.equal(observed.raceComplete, true);
  assert.equal(observed.finishers, expected.finished);
  assert.equal(observed.dnfs, expected.dnf);
  assert.equal(observed.potholes, expected.potholes);
  assert.equal(observed.collisions, expected.collisionCount);
  assert.equal(observed.crossClassCollisions, expected.crossClassCollisions);
  assert.ok(Math.abs(observed.simulatedSeconds - expected.simulatedRaceSeconds) < 0.0001);
  assert.equal(observed.standings.length, 20);
  for (const [rank, car] of observed.standings.entries()) {
    const baseline = expected.cars[rank];
    for (const property of ['id', 'classId', 'completedLaps', 'overallPosition', 'classPosition', 'wreckReason']) assert.equal(car[property], baseline[property], `${slug}/${car.id}/${property}`);
    assert.equal(car.status, baseline.result === 'FINISHED' ? 'finished' : 'DNF');
    for (const property of ['finishTime', 'wreckTime']) {
      if (baseline[property] === null) assert.equal(car[property], null);
      else assert.ok(Math.abs(car[property] - baseline[property]) < 0.0001, `${slug}/${car.id}/${property}`);
    }
    assert.equal(car.potholeHits, baseline.potholeHitsAtFieldCompletion);
    assert.ok(Math.abs(car.damage - baseline.damage) < 0.0001);
  }
  comparisons.push({ name: observed.name, matchedCars: 20, finishers: observed.finishers, dnfs: observed.dnfs, simulatedSeconds: observed.simulatedSeconds, actualRaceStartedAt: observed.raceStartedAt, actualRaceEndedAt: observed.endedAt });
}
const result = { matched: true, matchedCars: 60, toleranceSeconds: 0.0001, actualStartedAt: actual.startedAt, actualCompletedAt: actual.completedAt, actualWallSeconds: (Date.parse(actual.completedAt) - Date.parse(actual.startedAt)) / 1000, comparisons };
await writeFile(new URL('visible-watch-comparison.json', directory), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
