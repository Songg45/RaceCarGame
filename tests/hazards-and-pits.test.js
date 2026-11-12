import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceSimulation } from '../src/simulation.js';

const STEP = 1 / 60;
function advance(sim, seconds, input = {}) {
  for (let tick = 0; tick < Math.ceil(seconds / STEP); tick += 1) sim.update(STEP, input);
}
function racing(options = {}) {
  const sim = new RaceSimulation({ trackId: 'daytona', laps: 3, difficulty: 0, seed: 1, ...options });
  advance(sim, 3.1);
  return sim;
}
function isolatePlayer(sim) {
  sim.cars.filter(car => !car.isPlayer).forEach((car, index) => {
    car.s = sim.track.length / 2 + index * 20;
    car.lateral = 0;
    car.speed = 0;
  });
}
function positionForService(sim, damage = 0.6) {
  isolatePlayer(sim);
  Object.assign(sim.player, { s: sim.pit.bayS, lateral: sim.pit.lateral, speed: 0, lateralVelocity: 0, damage });
  advance(sim, STEP);
}
function pitOutcome(difficulty, seed, damage = 0.6) {
  const sim = racing({ difficulty, seed });
  positionForService(sim, damage);
  assert.equal(sim.requestPitService(), true);
  advance(sim, sim.pit.serviceSeconds + 0.1);
  return sim;
}

test('difficulty adds substantially more randomly positioned potholes, repeatable with a seed', () => {
  for (const trackId of ['daytona', 'talladega', 'bristol']) {
    const easy = new RaceSimulation({ trackId, difficulty: 0, seed: 5 });
    const extreme = new RaceSimulation({ trackId, difficulty: 100, seed: 5 });
    const otherSeed = new RaceSimulation({ trackId, difficulty: 100, seed: 6 });
    const repeated = new RaceSimulation({ trackId, difficulty: 100, seed: 5 });
    assert.ok(easy.potholes.length > 0, 'Easy still has sparse potholes');
    assert.ok(extreme.potholes.length > easy.potholes.length * 5, 'Extreme must be substantially denser');
    assert.deepEqual(extreme.potholes, repeated.potholes);
    assert.notDeepEqual(extreme.potholes.map(hole => [hole.s, hole.lateral]), otherSeed.potholes.map(hole => [hole.s, hole.lateral]));
    for (const hole of extreme.potholes) {
      assert.ok(hole.s >= 0 && hole.s < extreme.track.length);
      assert.ok(Math.abs(hole.lateral) < extreme.track.width / 2);
      assert.ok(hole.radius > 0 && Number.isFinite(hole.x) && Number.isFinite(hole.z));
    }
  }
});

for (const playerClass of ['stock', 'civilian']) {
  test(`hitting a pothole harms the ${playerClass} player`, () => {
    const sim = racing({ playerClass, difficulty: 100, seed: 7 });
    isolatePlayer(sim);
    const hole = sim.potholes.find(item => item.s > 100 && item.s < sim.track.length / 3);
    assert.ok(hole);
    Object.assign(sim.player, { s: hole.s - hole.radius - 1, lateral: hole.lateral, speed: 30, damage: 0 });
    advance(sim, 0.3, { throttle: 1 });
    assert.ok(sim.player.damage > 0);
    assert.ok(sim.player.potholeHits > 0);
  });
}

test('a terminal wreck remains stationary, keeps its place in the field, and cannot recover or repair', () => {
  const sim = racing();
  isolatePlayer(sim);
  const car = sim.player;
  Object.assign(car, { s: 100, lateral: -2, speed: 40, damage: 1 });
  advance(sim, STEP);
  assert.equal(car.wrecked, true);
  assert.equal(car.finished, false);
  assert.equal(car.finishTime, null);
  assert.equal(car.status, 'wrecked');
  assert.equal(sim.state, 'finished');
  const wreckPosition = [car.s, car.lateral, car.x, car.y, car.z];
  const count = sim.cars.length;
  assert.equal(sim.recoverPlayer(), false);
  assert.equal(sim.requestPitService(), false);
  advance(sim, 20, { throttle: 1, steer: 1, service: true });
  assert.deepEqual([car.s, car.lateral, car.x, car.y, car.z], wreckPosition);
  assert.equal(car.speed, 0);
  assert.equal(car.damage, 1);
  assert.equal(sim.cars.length, count);
  assert.ok(sim.cars.includes(car));
});

test('a live car collides with a permanent wreck without displacing or reviving it', () => {
  const sim = racing();
  isolatePlayer(sim);
  const wreck = sim.cars.find(car => car.classId === 'civilian');
  Object.assign(wreck, { s: 100, lateral: 0, damage: 1 });
  advance(sim, STEP);
  assert.equal(wreck.wrecked, true);
  const location = [wreck.s, wreck.lateral];
  Object.assign(sim.player, { s: wreck.s - 4, lateral: wreck.lateral, speed: 50, damage: 0, contactCooldown: 0 });
  sim.resolveCollisions();
  assert.deepEqual([wreck.s, wreck.lateral], location);
  assert.equal(wreck.speed, 0);
  assert.equal(wreck.wrecked, true);
  assert.ok(sim.player.damage > 0);
  assert.ok(sim.player.speed < 50);
});

test('AI blocked by a wreck physically works past it instead of remaining stopped forever', () => {
  const sim = racing();
  const driver = sim.cars.find(car => !car.isPlayer && car.classId === 'stock');
  const obstacle = sim.cars.find(car => car.classId === 'civilian');
  sim.cars.filter(car => car !== driver && car !== obstacle).forEach((car, index) => {
    car.s = sim.track.length / 2 + index * 12;
    sim.wreckCar(car, 'QA parking');
  });
  Object.assign(obstacle, { s: 108, lateral: 0 });
  sim.wreckCar(obstacle, 'QA obstacle');
  Object.assign(driver, { s: 100, lateral: 0, targetLateral: 0, speed: 0 });
  const position = [obstacle.s, obstacle.lateral];
  advance(sim, 20);
  assert.deepEqual([obstacle.s, obstacle.lateral], position);
  assert.ok(driver.s > 110 || driver.damage > 0 || driver.wrecked, 'AI must physically pass or collide, not silently wait forever');
});

test('all cars finished or wrecked terminates the race; a new race clears wrecks', () => {
  const sim = racing();
  sim.cars.forEach((car, index) => {
    if (index % 2) { car.finished = true; car.status = 'finished'; car.finishTime = 100 + index; }
    else car.damage = 1;
  });
  advance(sim, STEP);
  assert.equal(sim.raceComplete, true);
  assert.ok(sim.cars.every(car => car.finished || car.wrecked));
  const fresh = sim.restart();
  assert.equal(fresh.cars.length, 20);
  assert.ok(fresh.cars.every(car => !car.wrecked && !car.finished && car.damage === 0));
});

test('finished classification survives later damage while the remaining field races', () => {
  const sim = racing();
  const car = sim.cars.find(item => !item.isPlayer);
  Object.assign(car, { finished: true, status: 'finished', finishTime: 50, completedLaps: 3, damage: 1 });
  advance(sim, STEP);
  assert.equal(car.finished, true);
  assert.equal(car.status, 'finished');
  assert.equal(car.finishTime, 50);
});

test('pit service requires the physical bay, low speed, and the full service duration', () => {
  const sim = racing();
  sim.player.damage = 0.6;
  assert.equal(sim.requestPitService(), false, 'racing surface is not a repair zone');
  positionForService(sim);
  sim.player.speed = 5;
  assert.equal(sim.requestPitService(), false, 'must stop before service');
  sim.player.speed = 0;
  assert.equal(sim.requestPitService(), true);
  assert.equal(sim.player.pitState, 'servicing');
  advance(sim, sim.pit.serviceSeconds / 2);
  assert.equal(sim.player.damage, 0.6);
  assert.equal(sim.player.pitState, 'servicing');
  advance(sim, sim.pit.serviceSeconds / 2 + 0.1);
  assert.equal(sim.player.damage, 0);
  assert.equal(sim.player.pitState, 'complete');
});

test('Easy always restores full condition and repeated requests cannot reroll one pit visit', () => {
  for (const seed of [1, 5, 27, 99]) {
    const sim = pitOutcome(0, seed);
    assert.equal(sim.player.damage, 0);
    const message = sim.player.repairMessage;
    sim.player.damage = 0.3;
    for (let i = 0; i < 10; i += 1) assert.equal(sim.requestPitService(), false);
    advance(sim, 6, { service: true });
    assert.equal(sim.player.damage, 0.3);
    assert.equal(sim.player.repairMessage, message);
  }
});

test('higher difficulty worsens expected pit quality and Extreme can add damage or wreck a car', () => {
  const outcomes = new Map();
  for (const level of [0, 35, 70, 100]) {
    outcomes.set(level, Array.from({ length: 24 }, (_, index) => pitOutcome(level, index + 1).player.damage));
  }
  const mean = level => outcomes.get(level).reduce((sum, value) => sum + value, 0) / outcomes.get(level).length;
  assert.equal(mean(0), 0);
  assert.ok(mean(35) < mean(70));
  assert.ok(mean(70) < mean(100));
  assert.ok(outcomes.get(100).some(value => value > 0.6), 'Extreme must sometimes worsen incoming damage');
  const worsenedToWreck = Array.from({ length: 24 }, (_, index) => pitOutcome(100, index + 1, 0.98)).find(sim => sim.player.wrecked);
  assert.ok(worsenedToWreck, 'an extreme repair accident can destroy a nearly wrecked car');
  assert.equal(worsenedToWreck.requestPitService(), false);
  assert.equal(worsenedToWreck.recoverPlayer(), false);
});

for (const trackId of ['daytona', 'talladega', 'bristol']) {
  for (const playerClass of ['stock', 'civilian']) {
    test(`${trackId} ${playerClass}: physically drive from road to pit bay, stop, repair, and exit`, () => {
      const sim = racing({ trackId, playerClass, seed: 18 });
      // A controlled starting scenario places traffic safely away and the
      // damaged driver on the approach. All subsequent movement is physics.
      sim.cars.filter(car => !car.isPlayer).forEach((car, index) => {
        car.s = sim.track.length / 2 + index * 9;
        sim.wreckCar(car, 'QA parking away from pit approach');
      });
      Object.assign(sim.player, { s: sim.pit.entryS - 100, lateral: -3.2, speed: 25, damage: 0.6 });
      let entered = false, serviced = false, repaired = false, exited = false;
      for (let tick = 0; tick < 60 * 180; tick += 1) {
        sim.update(STEP, sim.aiControl(sim.player, STEP));
        entered ||= sim.player.inPit;
        serviced ||= sim.player.pitState === 'servicing';
        repaired ||= serviced && sim.player.damage === 0;
        exited ||= repaired && !sim.player.inPit && !sim.player.pitTarget;
        if (exited) break;
      }
      assert.ok(entered, 'physically entered pit lane');
      assert.ok(serviced, 'reached bay slowly enough to begin service');
      assert.ok(repaired, 'received full Easy repair after service');
      assert.ok(exited, 'returned to racing surface under driving controls');
      assert.equal(sim.player.wrecked, false);
    });
  }
}
