import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceSimulation } from '../src/simulation.js';

const STEP = 1 / 60;
const clamp = value => Math.max(-1, Math.min(1, value));
function fixture(playerClass = 'stock', difficulty = 0, seed = 41) {
  // The long oval provides enough uninterrupted grass before the next paved
  // pit section to distinguish sustained exposure from repeated cooling laps.
  const sim = new RaceSimulation({ trackId: 'daytona', playerClass, vehicleId: 'civic', difficulty, seed, laps: 20 });
  for (let frame = 0; frame < 190; frame += 1) sim.update(STEP);
  sim.potholes = []; sim.potholeBuckets.clear();
  sim.cars.filter(car => car !== sim.player).forEach((car, index) => {
    car.s = sim.track.length * 0.5 + index * 8; car.lateral = 8;
    sim.wreckCar(car, 'Controlled outer-lane traffic isolation');
  });
  Object.assign(sim.player, { s: sim.pit.exitS + 30, lateral: -sim.track.width / 2 - 6, speed: 5, lateralVelocity: 0, headingOffset: 0, damage: 0.25 });
  sim.updateWorld(sim.player);
  return sim;
}
function grassDrive(sim, seconds, stop = () => false) {
  const target = -sim.track.width / 2 - 6;
  for (let frame = 0; frame < Math.ceil(seconds / STEP); frame += 1) {
    sim.update(STEP, { throttle: 1, steer: clamp((target - sim.player.lateral) * 0.5 - sim.player.lateralVelocity * 0.2) });
    if (stop()) break;
  }
}

for (const playerClass of ['stock', 'civilian']) {
  test(`${playerClass}: a short actual grass excursion is survivable, prolonged driving warns, wears and permanently burns the engine`, () => {
    const sim = fixture(playerClass), car = sim.player;
    const driveStartedAt = sim.elapsed;
    grassDrive(sim, 5);
    assert.ok(car.engine.heat > 0 && car.engine.heat < 0.55);
    assert.equal(car.engine.wear, 0);
    assert.equal(car.wrecked, false);
    let warned = false, wearing = false, warnedAt = null, wearAt = null, bodyBeforeBurn = car.damage, wheelsBeforeBurn = JSON.stringify(car.wheels);
    for (let frame = 0; frame < 60 * 600 && !car.wrecked; frame += 1) {
      bodyBeforeBurn = car.damage; wheelsBeforeBurn = JSON.stringify(car.wheels);
      grassDrive(sim, STEP);
      warned ||= car.engine.heat >= 0.55;
      wearing ||= car.engine.wear > 0;
      if (warned && warnedAt === null) warnedAt = sim.elapsed - driveStartedAt;
      if (wearing && wearAt === null) wearAt = sim.elapsed - driveStartedAt;
    }
    assert.ok(warned && wearing, 'thermal warning and persistent wear must precede failure');
    assert.equal(car.engine.status, 'burnt', JSON.stringify({ engine: car.engine, wreckReason: car.wreckReason })); assert.equal(car.engine.wear, 1);
    assert.equal(car.wrecked, true); assert.match(car.wreckReason, /engine/i);
    console.log(JSON.stringify({ thermalDrive: playerClass, warningSeconds: warnedAt, wearSeconds: wearAt, burnSeconds: sim.elapsed - driveStartedAt, grassDrivingSeconds: car.engine.grassDrivingSeconds }));
    assert.equal(car.damage, bodyBeforeBurn, 'engine-only failure must not fabricate chassis damage');
    assert.equal(JSON.stringify(car.wheels), wheelsBeforeBurn, 'engine-only failure must not replace wheel conditions');
    assert.equal(sim.requestPitService(), false); assert.equal(sim.recoverPlayer(), false);
    const stopped = [car.s, car.lateral];
    for (let frame = 0; frame < 600; frame += 1) sim.update(STEP, { throttle: 1, steer: 1, service: true });
    assert.deepEqual([car.s, car.lateral], stopped); assert.equal(car.speed, 0);
    assert.equal(sim.cars.length, 20);
  });
}

test('paved road and pit lane cool the engine without erasing accumulated wear', () => {
  for (const location of ['road', 'pit']) {
    const sim = fixture(), car = sim.player;
    Object.assign(car, { s: 0, lateral: location === 'pit' ? sim.pit.throughLateral : 0, speed: 10 });
    Object.assign(car.engine, { heat: 0.85, wear: 0.35 });
    const eventsBefore = sim.events.length;
    for (let frame = 0; frame < 600; frame += 1) sim.updateEngine(car, { throttle: 1 }, STEP);
    assert.ok(car.engine.heat < 0.5, `${location} must cool under throttle`);
    assert.equal(car.engine.wear, 0.35);
    assert.equal(car.engine.cooling, true);
    assert.equal(sim.events.slice(eventsBefore).filter(event => /overheat|return.*pavement|leave.*grass/i.test(event.text || '')).length, 0, 'cooling must not announce new overheating');
  }
});

test('idle grass does not create driving heat and pause freezes all engine state', () => {
  const sim = fixture(), car = sim.player;
  car.speed = 0;
  for (let frame = 0; frame < 60 * 180; frame += 1) sim.updateEngine(car, { throttle: 1 }, STEP);
  assert.equal(car.engine.heat, 0); assert.equal(car.engine.wear, 0); assert.equal(car.engine.grassDrivingSeconds, 0);
  Object.assign(car.engine, { heat: 0.6, wear: 0.2 });
  sim.togglePause(); const paused = { ...car.engine };
  for (let frame = 0; frame < 600; frame += 1) sim.update(STEP, { throttle: 1 });
  assert.deepEqual(car.engine, paused);
});

test('engine wear degrades usable power and legitimate Easy service restores heat, wear and performance', () => {
  const sim = fixture(), car = sim.player;
  const healthy = { ...sim.updateHandling(car) };
  Object.assign(car.engine, { heat: 0.8, wear: 0.6 });
  const worn = { ...sim.updateHandling(car) };
  assert.ok(worn.accelerationFactor < healthy.accelerationFactor && worn.topSpeedFactor < healthy.topSpeedFactor);
  const bay = sim.getPitBay(car);
  Object.assign(car, { s: bay.s, lateral: bay.lateral, speed: 0, lateralVelocity: 0, headingOffset: 0 });
  sim.updateWorld(car);
  assert.equal(sim.requestPitService(), true);
  for (let frame = 0; frame < 310; frame += 1) sim.update(STEP);
  assert.equal(car.pitState, 'complete'); assert.equal(car.engine.heat, 0); assert.equal(car.engine.wear, 0);
  assert.equal(car.engine.status, 'normal');
  assert.equal(car.handling.accelerationFactor, 1); assert.equal(car.handling.topSpeedFactor, 1);
});

test('Extreme pit mistakes can worsen engine wear or burn it without fabricating a full structural wreck', () => {
  let worsened = false, burnt = false;
  for (let seed = 1; seed <= 24; seed += 1) {
    const sim = fixture('stock', 100, seed), car = sim.player, bay = sim.getPitBay(car);
    Object.assign(car, { s: bay.s, lateral: bay.lateral, speed: 0, lateralVelocity: 0, headingOffset: 0, damage: 0.1 });
    Object.assign(car.engine, { heat: 0.2, wear: 0.99 }); sim.updateWorld(car);
    assert.equal(sim.requestPitService(), true);
    for (let frame = 0; frame < 310; frame += 1) sim.update(STEP);
    worsened ||= car.engine.wear > 0.99;
    if (car.engine.status === 'burnt') {
      burnt = true; assert.equal(car.wrecked, true); assert.ok(car.damage < 1);
      assert.equal(sim.requestPitService(), false); assert.equal(sim.recoverPlayer(), false);
    }
  }
  assert.ok(worsened && burnt, 'seeded Extreme service must exercise worsening and permanent engine failure');
});
