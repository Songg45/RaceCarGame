import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceSimulation, sampleTrack } from '../src/simulation.js';
import { TRACKS, ROAD_CARS } from '../src/catalog.js';

const STEP = 1 / 60;
const advance = (sim, seconds, input = {}) => {
  for (let tick = 0; tick < Math.ceil(seconds / STEP); tick += 1) {
    sim.update(STEP, typeof input === 'function' ? input(sim) : input);
  }
};
const racing = (options = {}) => {
  const sim = new RaceSimulation({ seed: 42, trackId: 'bristol', laps: 3, ...options });
  advance(sim, 4);
  assert.equal(sim.state, 'racing');
  return sim;
};
const parkOtherCarsFarAway = (sim) => {
  sim.cars.filter(car => !car.isPlayer).forEach((car, index) => {
    car.s = sim.track.length * 0.5 + index * 9;
    car.lateral = index % 2 ? -3 : 3;
    car.speed = 0;
  });
};

for (const playerClass of ['stock', 'civilian']) {
  test(`${playerClass} selection keeps exactly ten cars in each class and one player`, () => {
    const sim = new RaceSimulation({ playerClass, vehicleId: 'civic', seed: 1 });
    assert.equal(sim.cars.length, 20);
    assert.equal(new Set(sim.cars.map(car => car.id)).size, 20);
    assert.equal(sim.cars.filter(car => car.classId === 'stock').length, 10);
    assert.equal(sim.cars.filter(car => car.classId === 'civilian').length, 10);
    assert.equal(sim.cars.filter(car => car.isPlayer).length, 1);
    assert.equal(sim.player.classId, playerClass);
    assert.equal(sim.getStandings(playerClass).length, 10);
    assert.equal(sim.getStandings().length, 20);
  });
}

test('race laps accept every integer from three through the selected event limit', () => {
  const expected = { daytona: 200, talladega: 188, bristol: 500 };
  for (const [trackId, maximum] of Object.entries(expected)) {
    for (const requested of [3, 4, 37, maximum]) {
      assert.equal(new RaceSimulation({ trackId, laps: requested }).laps, requested);
    }
    assert.equal(new RaceSimulation({ trackId, laps: 1 }).laps, 3);
    assert.equal(new RaceSimulation({ trackId, laps: -100 }).laps, 3);
    assert.equal(new RaceSimulation({ trackId, laps: maximum + 100 }).laps, maximum);
    assert.ok(Number.isInteger(new RaceSimulation({ trackId, laps: 3.7 }).laps));
    const invalid = new RaceSimulation({ trackId, laps: Number.NaN });
    assert.ok(Number.isFinite(invalid.laps) && invalid.laps >= 3 && invalid.laps <= maximum);
  }
});

test('road roster supplies ten distinct ordinary road-car models', () => {
  assert.equal(ROAD_CARS.length, 10);
  assert.equal(new Set(ROAD_CARS.map(car => car.id)).size, 10);
});

test('track samples form a continuous closed circuit at the start line', () => {
  for (const track of TRACKS) {
    const start = sampleTrack(track, 0, 0);
    const lap = sampleTrack(track, track.length, 0);
    for (const axis of ['x', 'y', 'z']) {
      assert.ok(Number.isFinite(start[axis]), `${track.id} ${axis} should be finite`);
      assert.ok(Math.abs(start[axis] - lap[axis]) < 0.001, `${track.id} ${axis} must close`);
    }
  }
});

test('oval turns left and outward steering agrees with the driver camera right', () => {
  for (const track of TRACKS) {
    for (const distance of [0, track.straightLength / 2 + track.radius * 0.4, track.length / 2, track.length * 0.8]) {
      const point = sampleTrack(track, distance, 0);
      const cameraRight = { x: -point.tz, z: point.tx };
      assert.ok(point.nx * cameraRight.x + point.nz * cameraRight.z > 0.999, `${track.id}: positive lateral must be screen right`);
      const left = sampleTrack(track, distance, -2);
      assert.ok((left.x - point.x) * cameraRight.x + (left.z - point.z) * cameraRight.z < -1.99);
      if (point.curvature > 0) {
        const next = sampleTrack(track, distance + 0.1, 0);
        assert.ok((next.tx - point.tx) * cameraRight.x + (next.tz - point.tz) * cameraRight.z < 0, `${track.id}: forward circuit must turn left`);
      }
    }
  }
});

test('car visual heading turns toward its actual steering velocity', () => {
  const sim = racing({ trackId: 'daytona' });
  parkOtherCarsFarAway(sim);
  Object.assign(sim.player, { s: 25, lateral: 0, speed: 20 });
  advance(sim, 0.3, { throttle: 1, steer: 1 });
  const car = sim.player;
  const road = sampleTrack(sim.track, car.s, car.lateral);
  const vx = road.tx * car.speed + road.nx * car.lateralVelocity;
  const vz = road.tz * car.speed + road.nz * car.lateralVelocity;
  const heading = car.heading + car.headingOffset;
  const alignment = (Math.sin(heading) * vx + Math.cos(heading) * vz) / Math.hypot(vx, vz);
  assert.ok(alignment > 0.999, 'model body should point along its velocity');
});

test('countdown is stationary and the opening start-line crossing is not a completed lap', () => {
  const sim = new RaceSimulation({ trackId: 'bristol', laps: 3, seed: 4 });
  const initial = sim.cars.map(car => car.s);
  advance(sim, 1, { throttle: 1 });
  assert.equal(sim.state, 'countdown');
  assert.deepEqual(sim.cars.map(car => car.s), initial);
  advance(sim, 3);
  parkOtherCarsFarAway(sim);
  sim.player.s = -0.05;
  sim.player.speed = 10;
  sim.player.lateral = 0;
  advance(sim, 0.1, { throttle: 1 });
  assert.ok(sim.player.s > 0);
  assert.equal(sim.player.completedLaps, 0);
});

test('pause freezes the complete field and race clock until resumed', () => {
  const sim = racing();
  advance(sim, 2, { throttle: 1 });
  sim.togglePause();
  assert.equal(sim.state, 'paused');
  const clock = sim.elapsed;
  const positions = sim.cars.map(car => [car.s, car.lateral, car.speed, car.damage]);
  advance(sim, 8, { throttle: 1, steer: 1 });
  assert.equal(sim.elapsed, clock);
  assert.deepEqual(sim.cars.map(car => [car.s, car.lateral, car.speed, car.damage]), positions);
  sim.togglePause();
  advance(sim, 0.5, { throttle: 1 });
  assert.equal(sim.state, 'racing');
  assert.ok(sim.elapsed > clock);
});

test('braking materially reduces speed compared with coasting from the same state', () => {
  const brakeSim = racing({ seed: 11 });
  const coastSim = racing({ seed: 11 });
  for (const sim of [brakeSim, coastSim]) {
    parkOtherCarsFarAway(sim);
    sim.player.s = 25;
    sim.player.speed = 30;
    sim.player.lateral = 0;
  }
  advance(brakeSim, 1, { brake: 1 });
  advance(coastSim, 1);
  assert.ok(brakeSim.player.speed < coastSim.player.speed - 3);
});

test('seeded runs are repeatable for reproducible physics investigations', () => {
  const first = new RaceSimulation({ seed: 239, trackId: 'daytona', playerClass: 'civilian' });
  const second = new RaceSimulation({ seed: 239, trackId: 'daytona', playerClass: 'civilian' });
  advance(first, 12, { throttle: 1, steer: 0.1 });
  advance(second, 12, { throttle: 1, steer: 0.1 });
  assert.deepEqual(first.cars.map(car => [car.s, car.lateral, car.speed, car.damage]), second.cars.map(car => [car.s, car.lateral, car.speed, car.damage]));
});

test('stock and civilian collisions exchange momentum and damage both cars', () => {
  const sim = racing({ trackId: 'daytona' });
  const stock = sim.player;
  const civilian = sim.cars.find(car => car.classId === 'civilian');
  parkOtherCarsFarAway(sim);
  Object.assign(stock, { s: 50, lateral: 0, speed: 50, damage: 0, contactCooldown: 0 });
  Object.assign(civilian, { s: 54, lateral: 0, speed: 20, damage: 0, contactCooldown: 0 });
  const before = sim.crossClassCollisions;
  sim.resolveCollisions();
  assert.ok(stock.speed < 50, 'faster stock car should lose speed');
  assert.ok(civilian.speed > 20, 'slower civilian car should receive impact momentum');
  assert.ok(stock.damage > 0 && civilian.damage > 0, 'both classes must take damage');
  assert.equal(sim.crossClassCollisions, before + 1);
});

test('stock acceleration exceeds a common civilian car on the same clear straight', () => {
  const stock = racing({ trackId: 'daytona', playerClass: 'stock' });
  const road = racing({ trackId: 'daytona', playerClass: 'civilian', vehicleId: 'corolla' });
  for (const sim of [stock, road]) {
    parkOtherCarsFarAway(sim);
    Object.assign(sim.player, { s: 25, lateral: 0, speed: 0 });
  }
  advance(stock, 4, { throttle: 1 });
  advance(road, 4, { throttle: 1 });
  assert.ok(stock.player.speed > road.player.speed * 1.3);
  assert.ok(stock.player.s > road.player.s);
});

test('reverse or repeated timing-line crossings cannot increment the same lap twice', () => {
  const sim = racing();
  const car = sim.player;
  car.crossedStart = true;
  car.lapStartTime = 0;
  sim.elapsed = 30;
  car.previousS = sim.track.length + 1;
  car.s = sim.track.length - 1;
  sim.countLaps(car, STEP);
  assert.equal(car.completedLaps, 0, 'reverse crossing is not a lap');
  car.previousS = sim.track.length - 1;
  car.s = sim.track.length + 1;
  sim.countLaps(car, STEP);
  assert.equal(car.completedLaps, 1);
  car.previousS = sim.track.length - 1;
  car.s = sim.track.length + 1;
  sim.countLaps(car, STEP);
  assert.equal(car.completedLaps, 1, 'recrossing an already counted line is not another lap');
});

for (const playerClass of ['stock', 'civilian']) {
  test(`${playerClass} completes a genuine three-lap simulation through normal driving updates`, () => {
    const sim = new RaceSimulation({ trackId: 'bristol', playerClass, vehicleId: 'civic', laps: 3, seed: 23, difficulty: 0 });
    let previousLap = 0;
    const observedLaps = [];
    for (let tick = 0; tick < 60 * 300 && !sim.player.finished; tick += 1) {
      // A test driver uses the existing AI controls. No distance/lap values are
      // injected: the player must physically travel the entire race distance.
      sim.update(STEP, sim.aiControl(sim.player, STEP));
      if (sim.player.completedLaps !== previousLap) {
        observedLaps.push(sim.player.completedLaps);
        previousLap = sim.player.completedLaps;
      }
    }
    assert.equal(sim.player.finished, true);
    assert.deepEqual(observedLaps, [1, 2, 3]);
    assert.equal(sim.state, 'finished');
    assert.ok(sim.player.finishTime > 0);
    assert.ok(sim.player.bestLap > 0);
    assert.equal(sim.getStandings(playerClass).length, 10);
    assert.equal(sim.getStandings().length, 20);
  });
}
