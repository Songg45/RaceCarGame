import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceSimulation, sampleTrack } from '../src/simulation.js';

const step = 1 / 60;
function scenario(playerClass, obstructed = false, trackId = 'daytona') {
  const sim = new RaceSimulation({ trackId, laps: 3, difficulty: 100, seed: 23, playerClass });
  for (let i = 0; i < 181; i += 1) sim.update(step);
  const car = sim.player;
  const obstacles = [];
  sim.cars.filter(other => other !== car).forEach((other, index) => {
    Object.assign(other, { s: sim.track.length / 2 + index * 12, lateral: 0, speed: 0 });
    sim.wreckCar(other, 'Controlled distant traffic isolation');
  });
  if (obstructed) {
    // The tempting outside escape lane has a real permanent obstacle. A safe
    // route still exists on the inner paved half, without entering the pits.
    const blocker = sim.cars.find(other => other !== car);
    Object.assign(blocker, { s: 95, lateral: 5.5 }); sim.updateWorld(blocker);
    obstacles.push(blocker);
  }
  Object.assign(car, { s: 15, lateral: 0, targetLateral: 0, speed: 24, lateralVelocity: 0, headingOffset: 0, aiTimer: 0 });
  sim.potholes = [
    { s: 75, lateral: 0, radius: 1.4 },
    { s: 88, lateral: 4.3, radius: 1.4 },
    { s: 105, lateral: 0.2, radius: 1.5 },
    { s: 140, lateral: 4.8, radius: 1.3 },
  ].map((hole, index) => ({ ...hole, id: `fixture-${index}`, severity: 0.08, ...sampleTrack(sim.track, hole.s, hole.lateral) }));
  sim.potholeBuckets.clear();
  for (const hole of sim.potholes) {
    const key = Math.floor(hole.s / 40);
    if (!sim.potholeBuckets.has(key)) sim.potholeBuckets.set(key, []);
    sim.potholeBuckets.get(key).push(hole);
  }
  sim.updateWorld(car); sim.updateHandling(car);
  return { sim, car, obstacles };
}

for (const trackId of ['daytona', 'talladega', 'bristol']) test(`${trackId}: hazard scanning crosses the partial final bucket and lap boundary`, () => {
  const { sim, car } = scenario('stock', false, trackId);
  assert.ok(sim.track.length % 40 > 1e-6, 'fixture requires a partial final spatial bucket');
  Object.assign(car, { s: sim.track.length - 45, lateral: 0, targetLateral: 0, speed: 20, aiTimer: 0 });
  sim.potholes = [
    { s: sim.track.length - 10, lateral: 0 },
    { s: 8, lateral: 4.3 },
    { s: 25, lateral: 0 },
  ].map((hole, index) => ({ ...hole, id: `wrap-${index}`, radius: 1.4, severity: 0.08, ...sampleTrack(sim.track, hole.s, hole.lateral) }));
  sim.potholeBuckets.clear();
  for (const hole of sim.potholes) {
    const bucket = Math.floor(hole.s / 40);
    if (!sim.potholeBuckets.has(bucket)) sim.potholeBuckets.set(bucket, []);
    sim.potholeBuckets.get(bucket).push(hole);
  }
  for (let frame = 0; frame < 60 * 15 && car.s < sim.track.length + 70 && !car.wrecked; frame += 1) {
    sim.update(step, sim.aiControl(car, step));
    assert.ok(Math.abs(car.lateral) + car.spec.width / 2 <= sim.track.width / 2);
  }
  assert.ok(car.s > sim.track.length + 70, 'the car must pass the wrapped hazards');
  assert.equal(car.potholeHits, 0);
  assert.equal(car.damage, 0);
});

test('adjacent moving traffic makes the driver brake or yield rather than dodge into another car', () => {
  const { sim, car } = scenario('stock');
  const neighbors = sim.cars.filter(other => other !== car).slice(0, 2);
  neighbors.forEach((other, index) => {
    Object.assign(other, { s: car.s, lateral: index ? 2.4 : -2.4, speed: 24, lateralVelocity: 0, headingOffset: 0, damage: 0, wrecked: false, wreckReason: '', status: 'racing' });
    sim.updateHandling(other); sim.updateWorld(other);
  });
  const ordinaryAI = sim.aiControl.bind(sim);
  sim.aiControl = (driver, dt) => neighbors.includes(driver) ? { throttle: 0, brake: 0, steer: 0 } : ordinaryAI(driver, dt);
  const hole = { id: 'traffic-constrained-hole', s: 48, lateral: 0, radius: 1.5, severity: 0.08, ...sampleTrack(sim.track, 48, 0) };
  sim.potholes = [hole]; sim.potholeBuckets = new Map([[1, [hole]]]);
  let braked = false;
  for (let frame = 0; frame < 60 * 1.25; frame += 1) {
    const input = sim.aiControl(car, step); braked ||= input.brake > 0.1;
    sim.update(step, input);
    assert.equal(car.wrecked, false);
    assert.ok(Math.abs(car.lateral) + car.spec.width / 2 <= sim.track.width / 2);
  }
  assert.ok(braked, 'a blocked lateral maneuver requires a real braking response');
  assert.equal(sim.collisionCount, 0, 'the driver must not trade a pothole for a traffic impact');
  assert.ok(car.speed < 23, 'brake commands must reduce actual speed');
});

for (const playerClass of ['stock', 'civilian']) {
  for (const obstructed of [false, true]) test(`${playerClass}: ordinary AI passes a multi-hole stretch${obstructed ? ' with a blocked escape lane' : ''} on the paved road`, () => {
    const { sim, car, obstacles } = scenario(playerClass, obstructed);
    const poses = obstacles.map(other => [other.s, other.lateral]);
    let maximumStep = 0, grassSeconds = 0;
    for (let frame = 0; frame < 60 * 20 && car.s < 190 && !car.wrecked; frame += 1) {
      const before = [car.s, car.lateral];
      sim.update(step, sim.aiControl(car, step));
      maximumStep = Math.max(maximumStep, Math.hypot(car.s - before[0], car.lateral - before[1]));
      if (car.offTrack) grassSeconds += step;
      assert.ok(Math.abs(car.lateral) + car.spec.width / 2 <= sim.track.width / 2, 'avoidance must stay physically on the racing surface');
    }
    assert.ok(car.s >= 190, 'driver must make forward progress through the hazard stretch');
    assert.equal(car.wrecked, false);
    assert.equal(car.potholeHits, 0, 'a clear paved corridor must avoid every wheel footprint, not just the car center');
    assert.equal(sim.collisionCount, 0, 'avoiding a pothole must not ram the blocked lane');
    assert.equal(grassSeconds, 0);
    assert.equal(car.damage, 0);
    assert.ok(maximumStep < 2, 'movement remains continuous');
    assert.deepEqual(obstacles.map(other => [other.s, other.lateral]), poses, 'permanent obstacles remain in place');
  });

  test(`${playerClass}: unavoidable direct wheel impacts still produce damage with avoidance enabled`, () => {
    const { sim, car } = scenario(playerClass);
    const hole = sim.potholes[0];
    Object.assign(car, { s: hole.s - 12, lateral: 0, speed: 24, targetLateral: 0 });
    for (let frame = 0; frame < 45; frame += 1) sim.update(step, { throttle: 1, steer: 0 });
    assert.ok(car.potholeHits > 0);
    assert.ok(car.damage > 0, 'the shared hazard physics must remain harmful');
  });
}
