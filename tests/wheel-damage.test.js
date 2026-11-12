import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceSimulation, potholeRisk, sampleTrack } from '../src/simulation.js';

const STEP = 1 / 60;
function advance(sim, seconds, input = {}) {
  for (let i = 0; i < Math.ceil(seconds / STEP); i += 1) sim.update(STEP, input);
}
function isolated(playerClass = 'stock', seed = 17, trackId = 'daytona') {
  const sim = new RaceSimulation({ trackId, playerClass, vehicleId: 'civic', difficulty: 0, seed, laps: 3 });
  advance(sim, 3.05);
  sim.potholes = []; sim.potholeBuckets.clear();
  sim.cars.filter(car => !car.isPlayer).forEach((car, index) => {
    car.s = sim.track.length / 2 + index * 12;
    sim.wreckCar(car, 'Controlled traffic isolation');
  });
  Object.assign(sim.player, { s: 25, lateral: 0, speed: 0, lateralVelocity: 0 });
  return sim;
}
function wear(car) {
  car.damage = 0.55;
  car.wheels.forEach(wheel => { wheel.suspensionDamage = 0.5; wheel.suspensionStatus = 'worn'; wheel.bend = 0.45; });
}
function setupHole(sim, radius = 0.65, severity = 0.06, speed = 30) {
  const car = sim.player;
  Object.assign(car, { s: 300, lateral: 0, headingOffset: 0, speed });
  const contact = sim.wheelContactPosition(car, car.wheels.find(wheel => wheel.id === 'FL'));
  const point = sampleTrack(sim.track, contact.s, contact.lateral);
  const hole = { id: 'controlled-hole', s: contact.s, lateral: contact.lateral, radius, severity, ...point };
  sim.potholes = [hole];
  sim.potholeBuckets = new Map([[Math.floor(hole.s / 40), [hole]]]);
  return hole;
}
function repair(sim) {
  const bay = sim.getPitBay(sim.player);
  Object.assign(sim.player, { s: bay.s, lateral: bay.lateral, speed: 0, lateralVelocity: 0 });
  sim.updatePitInfo(sim.player);
  assert.equal(sim.requestPitService(), true);
  advance(sim, sim.pit.serviceSeconds + STEP);
  assert.equal(sim.player.pitState, 'complete');
}
function brakingDistance(sim) {
  Object.assign(sim.player, { s: 25, lateral: 0, speed: 25, lateralVelocity: 0 });
  const start = sim.player.s;
  for (let i = 0; i < 60 * 12 && sim.player.speed > 0.01; i += 1) sim.update(STEP, { brake: 1 });
  assert.ok(sim.player.speed <= 0.01, 'test braking maneuver must actually stop');
  return sim.player.s - start;
}
function steeringResponse(sim) {
  Object.assign(sim.player, { s: 25, lateral: 0, speed: 20, lateralVelocity: 0 });
  advance(sim, 0.5, { throttle: 0.2, steer: 0.6 });
  return sim.player.lateral;
}

test('pothole failure risks increase with crater radius and impact speed, with no stationary failure roll', () => {
  const wheel = { tire: 'intact', suspensionDamage: 0 };
  const small = potholeRisk({ radius: 0.65, severity: 0.06 }, 30, wheel);
  const large = potholeRisk({ radius: 2.0, severity: 0.06 }, 30, wheel);
  const fast = potholeRisk({ radius: 2.0, severity: 0.06 }, 70, wheel);
  const stationary = potholeRisk({ radius: 2.0, severity: 0.06 }, 0, wheel);
  for (const key of ['punctureChance', 'blowoutChance', 'bentWheelChance', 'suspensionBreakChance', 'assemblyChance']) {
    assert.ok(Number.isFinite(small[key]) && small[key] >= 0, key);
    assert.ok(large[key] >= small[key], `${key} must not fall for a larger crater`);
    assert.ok(fast[key] >= large[key], `${key} must not fall at higher speed`);
    assert.equal(stationary[key], 0);
  }
});

test('one continuous wheel/hole overlap produces one roll, and a new physical pass can roll again', () => {
  const sim = isolated('stock', 41);
  setupHole(sim, 0.65, 0.001, 2);
  sim.hitPotholes(sim.player);
  assert.equal(sim.player.hazardRolls, 1);
  for (let repeat = 0; repeat < 120; repeat += 1) sim.hitPotholes(sim.player);
  assert.equal(sim.player.hazardRolls, 1, 'continuous overlap cannot retry the random outcome every frame');
  sim.player.speed = 0;
  for (let repeat = 0; repeat < 120; repeat += 1) sim.hitPotholes(sim.player);
  assert.equal(sim.player.hazardRolls, 1);
  sim.player.s += 20; sim.hitPotholes(sim.player);
  sim.player.s -= 20; sim.player.speed = 2; sim.hitPotholes(sim.player);
  assert.equal(sim.player.hazardRolls, 2);
  const parked = isolated('stock', 41);
  setupHole(parked, 2, 0.1, 0);
  for (let repeat = 0; repeat < 120; repeat += 1) parked.hitPotholes(parked.player);
  assert.equal(parked.player.hazardRolls, 0);
  assert.equal(parked.player.damage, 0);
});

test('puncture pressure really declines, pauses freeze it, and a blowout has a distinct immediate effect', () => {
  const sim = isolated();
  const wheel = sim.player.wheels.find(item => item.id === 'FL');
  Object.assign(wheel, { tire: 'punctured', pressure: 0.95, leakRate: 0.025 });
  sim.updateHandling(sim.player);
  const originalGrip = sim.player.handling.gripFactor;
  advance(sim, 4);
  assert.ok(wheel.pressure < 0.9 && wheel.pressure > 0.8);
  assert.ok(sim.player.handling.gripFactor < originalGrip);
  const pressure = wheel.pressure;
  sim.togglePause(); advance(sim, 10);
  assert.equal(wheel.pressure, pressure);
  sim.togglePause();
  const punctureGrip = sim.player.handling.gripFactor;
  Object.assign(wheel, { tire: 'blown', pressure: 0, leakRate: 0 });
  sim.updateHandling(sim.player);
  assert.ok(sim.player.handling.gripFactor < punctureGrip);
  assert.ok(sim.player.handling.limpSpeed > 0);
  assert.ok(Math.abs(sim.player.handling.pull) > 0);
  const collapse = isolated();
  Object.assign(collapse.player.wheels[0], { tire: 'punctured', pressure: 0.2, leakRate: 0.03 });
  const rolls = collapse.player.hazardRolls;
  advance(collapse, 1);
  assert.equal(collapse.player.wheels[0].tire, 'blown');
  assert.equal(collapse.player.wheels[0].pressure, 0);
  assert.equal(collapse.player.hazardRolls, rolls, 'pressure collapse should not invent another random impact roll');
});

test('bent wheels cause real vibration and lasting speed/steering loss; broken suspension remains a severe limp condition', () => {
  const sim = isolated();
  const healthy = { ...sim.player.handling };
  sim.player.wheels[0].bend = 0.8;
  sim.updateHandling(sim.player);
  assert.ok(sim.player.handling.steeringFactor < healthy.steeringFactor);
  assert.ok(sim.player.handling.topSpeedFactor < healthy.topSpeedFactor);
  Object.assign(sim.player, { speed: 20 });
  let vibration = 0;
  for (let frame = 0; frame < 120; frame += 1) {
    sim.update(STEP, { throttle: 0.2 });
    vibration = Math.max(vibration, Math.abs(sim.player.vibration || 0));
  }
  assert.ok(vibration > 0.001, 'bent wheel must affect moving physics, not only a status label');
  assert.ok(Math.abs(sim.player.lateral) > 0.001, 'vibration/asymmetric damage should perturb the car');
  sim.player.wheels[1].suspensionDamage = 0.95;
  sim.player.wheels[1].suspensionStatus = 'broken';
  sim.updateHandling(sim.player);
  assert.ok(sim.player.handling.brokenSuspensions > 0);
  assert.ok(sim.player.handling.gripFactor < healthy.gripFactor * 0.9);
  assert.ok(sim.player.handling.limpSpeed > 0);
  assert.equal(sim.player.wrecked, false, 'broken suspension is distinct from total assembly destruction');
});

for (const playerClass of ['stock', 'civilian']) {
  test(`${playerClass}: wear measurably harms steering, grip and braking; Easy repair restores them`, () => {
    const healthySteer = isolated(playerClass);
    const damagedSteer = isolated(playerClass); wear(damagedSteer.player); damagedSteer.updateHandling(damagedSteer.player);
    const repairedSteer = isolated(playerClass); wear(repairedSteer.player); repairedSteer.updateHandling(repairedSteer.player); repair(repairedSteer);
    const healthyResponse = steeringResponse(healthySteer);
    const damagedResponse = steeringResponse(damagedSteer);
    const repairedResponse = steeringResponse(repairedSteer);
    assert.ok(damagedResponse < healthyResponse * 0.95, `damaged steering must change movement (${damagedResponse} vs ${healthyResponse})`);
    assert.ok(Math.abs(repairedResponse - healthyResponse) < 0.01);
    const healthyBrake = isolated(playerClass);
    const damagedBrake = isolated(playerClass); wear(damagedBrake.player); damagedBrake.updateHandling(damagedBrake.player);
    const repairedBrake = isolated(playerClass); wear(repairedBrake.player); repairedBrake.updateHandling(repairedBrake.player); repair(repairedBrake);
    const healthyDistance = brakingDistance(healthyBrake);
    const damagedDistance = brakingDistance(damagedBrake);
    const repairedDistance = brakingDistance(repairedBrake);
    assert.ok(damagedDistance > healthyDistance * 1.1, 'damaged brakes should require a longer physical stop');
    assert.ok(Math.abs(repairedDistance - healthyDistance) < 0.02);
    const curvature = 1 / healthyBrake.track.radius;
    assert.ok(damagedBrake.cornerSpeed(damagedBrake.player, curvature) < healthyBrake.cornerSpeed(healthyBrake.player, curvature));
    assert.ok(Math.abs(repairedBrake.cornerSpeed(repairedBrake.player, curvature) - healthyBrake.cornerSpeed(healthyBrake.player, curvature)) < 0.01);
  });
}

test('Easy service restores pressure, punctures, blowouts, bent wheels and broken suspension together', () => {
  const sim = isolated();
  sim.player.damage = 0.55;
  Object.assign(sim.player.wheels[0], { tire: 'punctured', pressure: 0.4, leakRate: 0.02 });
  Object.assign(sim.player.wheels[1], { tire: 'blown', pressure: 0 });
  Object.assign(sim.player.wheels[2], { bend: 0.8 });
  Object.assign(sim.player.wheels[3], { suspensionDamage: 0.95, suspensionStatus: 'broken' });
  sim.updateHandling(sim.player);
  repair(sim);
  assert.equal(sim.player.damage, 0);
  for (const wheel of sim.player.wheels) {
    assert.equal(wheel.tire, 'intact'); assert.equal(wheel.pressure, 1); assert.equal(wheel.leakRate, 0);
    assert.equal(wheel.bend, 0); assert.equal(wheel.suspensionDamage, 0); assert.equal(wheel.suspensionStatus, 'healthy');
    assert.equal(wheel.assembly, 'intact');
  }
  assert.equal(sim.player.handling.gripFactor, 1);
  assert.equal(sim.player.handling.steeringFactor, 1);
  assert.equal(sim.player.handling.brakingFactor, 1);
  assert.equal(sim.player.handling.limpSpeed, null);
});

test('seeded small/large real impacts produce different failure frequencies and assembly destruction stays permanent', () => {
  const tally = { small: 0, large: 0 };
  const observedFailures = new Set();
  let destroyed = null;
  const signatures = [];
  for (let seed = 1; seed <= 512; seed += 1) {
    for (const [size, radius] of [['small', 0.65], ['large', 2]]) {
      const sim = new RaceSimulation({ trackId: 'daytona', playerClass: 'stock', difficulty: 0, seed });
      setupHole(sim, radius, 0.06, 70);
      sim.hitPotholes(sim.player);
      const failures = sim.player.wheels.filter(wheel => wheel.tire !== 'intact' || wheel.bend > 0 || wheel.suspensionStatus === 'broken' || wheel.assembly === 'destroyed').length;
      for (const wheel of sim.player.wheels) {
        if (wheel.tire === 'punctured') observedFailures.add('puncture');
        if (wheel.tire === 'blown') observedFailures.add('blowout');
        if (wheel.bend > 0) observedFailures.add('bend');
        if (wheel.suspensionStatus === 'broken') observedFailures.add('suspension');
        if (wheel.assembly === 'destroyed') observedFailures.add('assembly');
      }
      tally[size] += failures;
      if (sim.player.wheels.some(wheel => wheel.assembly === 'destroyed') && !destroyed) destroyed = sim;
      if (seed === 47 && size === 'large') signatures.push(JSON.stringify(sim.player.wheels));
    }
  }
  assert.ok(tally.large > tally.small * 2, `large impacts should be materially more dangerous: ${JSON.stringify(tally)}`);
  assert.deepEqual([...observedFailures].sort(), ['assembly', 'bend', 'blowout', 'puncture', 'suspension']);
  assert.ok(destroyed, 'seeded actual large impacts must exercise permanent assembly failure');
  const car = destroyed.player;
  const location = [car.s, car.lateral];
  assert.equal(car.wrecked, true);
  assert.equal(destroyed.recoverPlayer(), false);
  assert.equal(destroyed.requestPitService(), false);
  advance(destroyed, 10, { throttle: 1, steer: 1, service: true });
  assert.deepEqual([car.s, car.lateral], location);
  assert.equal(car.speed, 0);
  assert.ok(car.wheels.some(wheel => wheel.assembly === 'destroyed'));
  const replay = new RaceSimulation({ trackId: 'daytona', playerClass: 'stock', difficulty: 0, seed: 47 });
  setupHole(replay, 2, 0.06, 70); replay.hitPotholes(replay.player);
  assert.equal(JSON.stringify(replay.player.wheels), signatures[0]);
});

for (const playerClass of ['stock', 'civilian']) {
  test(`${playerClass}: a blown tire prioritizes the assigned pit, respects limp speed and leaves fully repaired on Easy`, () => {
    const sim = isolated(playerClass, 27, 'daytona');
    Object.assign(sim.player, { s: sim.pit.entryS - 100, lateral: -3.2, speed: 16, damage: 0.1 });
    Object.assign(sim.player.wheels[0], { tire: 'blown', pressure: 0 });
    sim.updateHandling(sim.player);
    let serviced = false, repaired = false, exited = false;
    for (let frame = 0; frame < 60 * 180; frame += 1) {
      const input = sim.state === 'racing' && !sim.player.wrecked ? sim.aiControl(sim.player, STEP) : {};
      sim.update(STEP, input);
      if (sim.player.handling.blownTires > 0) assert.ok(sim.player.speed <= sim.player.handling.limpSpeed + 0.01);
      serviced ||= sim.player.pitState === 'servicing';
      repaired ||= serviced && sim.player.wheels.every(wheel => wheel.tire === 'intact' && wheel.pressure === 1);
      exited ||= repaired && !sim.player.inPit && !sim.player.pitTarget;
      if (exited) break;
    }
    assert.ok(serviced && repaired && exited, `blown tire must trigger and complete a real pit visit: ${JSON.stringify({ serviced, repaired, exited, s: sim.player.s, lateral: sim.player.lateral, speed: sim.player.speed, route: sim.player.pitRoute })}`);
    assert.equal(sim.player.wrecked, false);
  });
}

test('harder pit outcomes keep tire pressure, component status and derived handling coherent', () => {
  for (const difficulty of [50, 100]) for (let seed = 1; seed <= 12; seed += 1) {
    const sim = isolated('stock', seed);
    sim.difficultyLevel = difficulty;
    wear(sim.player);
    Object.assign(sim.player.wheels[0], { tire: 'punctured', pressure: 0.6, leakRate: 0.02 });
    Object.assign(sim.player.wheels[1], { tire: 'blown', pressure: 0 });
    sim.updateHandling(sim.player);
    repair(sim);
    const reported = { ...sim.player.handling };
    assert.deepEqual(sim.updateHandling(sim.player), reported, 'repair must immediately refresh handling');
    assert.equal(reported.blownTires, sim.player.wheels.filter(wheel => wheel.tire === 'blown').length);
    for (const wheel of sim.player.wheels) {
      assert.ok(wheel.pressure >= 0 && wheel.pressure <= 1);
      assert.ok(wheel.bend >= 0 && wheel.bend <= 1);
      assert.ok(wheel.suspensionDamage >= 0 && wheel.suspensionDamage <= 1);
      if (wheel.tire === 'blown') assert.equal(wheel.pressure, 0);
      if (wheel.tire === 'intact') assert.equal(wheel.leakRate, 0);
      if (wheel.assembly === 'destroyed') assert.equal(sim.player.wrecked, true);
    }
    if (sim.player.repairMessage.includes('fully restored')) {
      assert.equal(sim.player.damage, 0);
      assert.ok(sim.player.wheels.every(wheel => wheel.pressure === 1 && wheel.tire === 'intact' && wheel.bend === 0 && wheel.suspensionDamage === 0));
    }
  }
});
