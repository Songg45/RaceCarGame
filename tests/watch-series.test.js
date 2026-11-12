import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { WatchSeries, WATCH_PLAN } from '../src/watch-series.js';

const STEP = 1 / 60;
const advance = (watch, seconds) => {
  for (let frame = 0; frame < Math.ceil(seconds / STEP); frame += 1) watch.update(STEP);
};

test('watch series uses requested Easy10/Medium15/Extreme20 and bounds individual update time', () => {
  assert.deepEqual(WATCH_PLAN.map(run => [run.name, run.difficulty, run.laps]), [['Easy', 0, 10], ['Medium', 50, 15], ['Extreme', 100, 20]]);
  const watch = new WatchSeries();
  watch.update(1000);
  assert.ok(watch.simulation.countdown >= 2.9 - 1e-6, 'a single delayed frame cannot fast-forward the race');
  const time = watch.simulation.countdown;
  watch.update(Number.NaN);
  assert.equal(watch.simulation.countdown, time);
});

test('pause freezes watch physics and stopping reports unfinished drivers honestly', () => {
  const watch = new WatchSeries();
  advance(watch, 8);
  watch.togglePause();
  const elapsed = watch.simulation.elapsed;
  const positions = watch.simulation.cars.map(car => [car.s, car.lateral, car.damage]);
  advance(watch, 6);
  assert.equal(watch.simulation.elapsed, elapsed);
  assert.deepEqual(watch.simulation.cars.map(car => [car.s, car.lateral, car.damage]), positions);
  watch.togglePause();
  advance(watch, 1);
  assert.ok(watch.simulation.elapsed > elapsed);
  watch.stop();
  const stoppedElapsed = watch.simulation.elapsed;
  advance(watch, 100);
  assert.equal(watch.phase, 'stopped');
  assert.equal(watch.simulation.elapsed, stoppedElapsed);
  assert.equal(watch.report.results.length, 0);
  assert.equal(watch.report.unfinishedRace.raceComplete, false);
  assert.equal(watch.report.unfinishedRace.standings.filter(car => car.status === 'racing').length, 20);
});

test('watch pauses stalled live traffic honestly and retries the same cars from the same positions', () => {
  const watch = new WatchSeries();
  const sim = watch.simulation;
  const originalAI = sim.aiControl.bind(sim);
  // A controlled failed-driver input policy creates zero progress through real
  // physics updates. It does not set finish, DNF, lap, time or terminal flags.
  sim.aiControl = () => ({ throttle: 0, brake: 1, steer: 0 });
  advance(watch, 50);
  assert.equal(watch.phase, 'stalled');
  assert.equal(watch.paused, true);
  assert.equal(sim.raceComplete, false);
  assert.equal(watch.results.length, 0);
  const poses = sim.cars.map(car => [car.id, car.s, car.lateral, car.damage, car.finished, car.wrecked]);
  const elapsed = sim.elapsed;
  advance(watch, 60);
  assert.equal(sim.elapsed, elapsed);
  assert.deepEqual(sim.cars.map(car => [car.id, car.s, car.lateral, car.damage, car.finished, car.wrecked]), poses);
  assert.equal(watch.nextRace(), false);
  assert.equal(watch.report.unfinishedRace.standings.filter(car => car.status === 'racing').length, 20);
  assert.equal(watch.report.unfinishedRace.raceComplete, false);
  sim.aiControl = originalAI;
  assert.equal(watch.retryStalledRace(), true);
  assert.equal(watch.simulation, sim);
  assert.deepEqual(sim.cars.map(car => [car.id, car.s, car.lateral, car.damage, car.finished, car.wrecked]), poses);
  advance(watch, 3);
  assert.equal(watch.phase, 'racing');
  assert.ok(sim.cars.some((car, index) => car.s > poses[index][1] + 0.1));
  assert.equal(watch.results.length, 0);
});

test('ongoing legitimate pit service does not trigger the watch no-progress guard', () => {
  const watch = new WatchSeries();
  const sim = watch.simulation;
  sim.aiControl = () => ({ throttle: 0, brake: 1, steer: 0 });
  advance(watch, 3.1);
  const bay = sim.getPitBay(sim.player);
  Object.assign(sim.player, { s: bay.s, lateral: bay.lateral, headingOffset: 0, lateralVelocity: 0, speed: 0, damage: 0.4 });
  sim.updateWorld(sim.player);
  sim.pit.serviceSeconds = 90;
  assert.equal(sim.requestPitService(), true);
  advance(watch, 50);
  assert.equal(watch.phase, 'racing');
  assert.equal(watch.paused, false);
  assert.equal(sim.player.pitState, 'servicing');
  assert.equal(sim.raceComplete, false);
});

test('complete watch controller matches the independent guaranteed-tire revision endurance', async () => {
  const independent = await Promise.all(['easy-10', 'medium-15', 'extreme-20'].map(slug => readFile(new URL(`../artifacts/guaranteed-pit-tires/endurance/${slug}.json`, import.meta.url), 'utf8').then(JSON.parse)));
  const watch = new WatchSeries({ seed: 20261112 });
  let observedPlayerTerminalBeforeWholeField = false;
  let observedIntermission = false;
  let frames = 0;
  const expectedDuration = independent.reduce((total, race) => total + race.simulatedRaceSeconds + 3, 0) + 2 * watch.intermissionSeconds;
  const maximumFrames = Math.ceil((expectedDuration + 30) / STEP);
  while (watch.phase !== 'complete' && frames < maximumFrames) {
    watch.update(STEP);
    frames += 1;
    if ((watch.simulation.player.finished || watch.simulation.player.wrecked) && !watch.simulation.raceComplete) {
      observedPlayerTerminalBeforeWholeField = true;
      assert.equal(watch.phase, 'racing', 'must keep watching after the player finishes or wrecks');
      assert.equal(watch.results.length, watch.index);
    }
    if (watch.phase === 'intermission') observedIntermission = true;
  }
  assert.equal(watch.phase, 'complete');
  assert.equal(observedPlayerTerminalBeforeWholeField, true);
  assert.equal(observedIntermission, true);
  assert.equal(watch.results.length, 3);
  for (const [index, actual] of watch.results.entries()) {
    const expected = independent[index];
    assert.equal(actual.raceComplete, true);
    assert.equal(actual.finishers, expected.finished);
    assert.equal(actual.dnfs, expected.dnf);
    assert.ok(Math.abs(actual.simulatedSeconds - expected.simulatedRaceSeconds) < 0.0001);
    assert.equal(actual.potholes, expected.potholes);
    assert.equal(actual.collisions, expected.collisionCount);
    assert.equal(actual.crossClassCollisions, expected.crossClassCollisions);
    assert.equal(actual.targetDistanceReached, expected.finished > 0);
    assert.equal(actual.standings.length, 20);
    for (const [position, car] of actual.standings.entries()) {
      const baseline = expected.cars[position];
      assert.equal(car.id, baseline.id);
      assert.equal(car.status, baseline.result === 'FINISHED' ? 'finished' : 'DNF');
      assert.equal(car.completedLaps, baseline.completedLaps);
      assert.equal(car.classPosition, baseline.classPosition);
      assert.equal(car.wreckReason, baseline.wreckReason);
      if (car.finishTime !== null) assert.ok(Math.abs(car.finishTime - baseline.finishTime) < 0.0001);
    }
  }
  assert.ok(watch.results.every(result => result.finishers + result.dnfs === 20));
});
