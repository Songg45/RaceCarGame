import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceSimulation, sampleTrack, TRUCK_SAFE_SPEED } from '../src/simulation.js';
import { ROAD_CARS, STREET_CLASSES } from '../src/catalog.js';

const step = 1 / 120;
const roles = ['sports', 'sedan', 'suv', 'truck'];
const advance = (sim, seconds, input = {}) => { for (let i = 0; i < Math.ceil(seconds / step); i += 1) sim.update(step, input); };
function isolated(streetClassId = 'sedan', seed = 17) {
  const sim = new RaceSimulation({ trackId: 'daytona', playerClass: 'civilian', streetClassId, difficulty: 0, seed, laps: 3 });
  advance(sim, 3.02);
  sim.cars.filter(car => !car.isPlayer).forEach((car, index) => {
    car.s = sim.track.length * 0.65 + index * 12; sim.wreckCar(car, 'Controlled class comparison isolation');
  });
  sim.potholes = []; sim.potholeBuckets.clear();
  Object.assign(sim.player, { s: -450, lateral: 0, speed: 0, lateralVelocity: 0, headingOffset: 0 });
  sim.updateWorld(sim.player);
  return sim;
}
function setHole(sim, { speed = 35, radius = 1.6, severity = 0.08, gap = 0 } = {}) {
  const car = sim.player;
  Object.assign(car, { s: 300, lateral: 0, speed, lateralVelocity: 0, headingOffset: 0 });
  const contact = sim.wheelContactPosition(car, car.wheels[0]);
  const hole = { id: 'matched-wheel-impact', s: contact.s + gap, lateral: contact.lateral, radius, severity };
  Object.assign(hole, sampleTrack(sim.track, hole.s, hole.lateral));
  sim.potholes = [hole]; sim.potholeBuckets = new Map([[Math.floor(hole.s / 40), [hole]]]);
  return hole;
}

test('four performance classes preserve a ten-stock/ten-street roster and remain separate from visual body shape', () => {
  assert.deepEqual(STREET_CLASSES.map(role => role.id).sort(), [...roles].sort());
  const charger = ROAD_CARS.find(car => car.id === 'charger');
  assert.equal(charger.streetClassId, 'sports');
  assert.equal(charger.body, 'sedan', 'a four-door muscle car can retain its sedan-shaped artwork');
  for (const streetClassId of roles) {
    const sim = new RaceSimulation({ playerClass: 'civilian', streetClassId, seed: 11 });
    assert.equal(sim.player.streetClassId, streetClassId);
    assert.equal(sim.cars.length, 20);
    assert.equal(sim.cars.filter(car => car.classId === 'stock').length, 10);
    assert.equal(sim.cars.filter(car => car.classId === 'civilian').length, 10);
    assert.equal(sim.cars.filter(car => car.isPlayer).length, 1);
    assert.deepEqual([...new Set(sim.cars.filter(car => car.classId === 'civilian').map(car => car.streetClassId))].sort(), [...roles].sort());
  }
});

test('actual clear-straight acceleration follows Sports, Sedan, SUV, Truck ordering; Sedan brakes well', t => {
  const measurements = roles.map(role => {
    const sim = isolated(role), car = sim.player, start = car.s;
    advance(sim, 15, { throttle: 1 });
    const acceleration = { role, speed: car.speed, distance: car.s - start, limit: car.spec.maxSpeed };
    assert.equal(car.damage, 0); assert.equal(car.offTrack, false);
    Object.assign(car, { s: 0, lateral: 0, speed: 25, lateralVelocity: 0, headingOffset: 0 });
    advance(sim, 5, { brake: 1 });
    assert.equal(car.speed, 0);
    return { ...acceleration, brakingDistance: car.s };
  });
  for (let index = 1; index < measurements.length; index += 1) {
    assert.ok(measurements[index - 1].speed > measurements[index].speed, JSON.stringify(measurements));
    assert.ok(measurements[index - 1].distance > measurements[index].distance);
    assert.ok(measurements[index - 1].limit > measurements[index].limit);
  }
  const sedan = measurements.find(item => item.role === 'sedan');
  assert.ok(sedan.brakingDistance < measurements.find(item => item.role === 'suv').brakingDistance);
  assert.ok(sedan.brakingDistance < measurements.find(item => item.role === 'truck').brakingDistance);
  t.diagnostic(JSON.stringify({ classPerformance: measurements }));
});

test('matched-speed matched-hole seeded impacts follow Sports, Sedan, SUV, Truck vulnerability order', t => {
  const totals = Object.fromEntries(roles.map(role => [role, { body: 0, suspension: 0, tireFailures: 0 }]));
  for (let seed = 1; seed <= 64; seed += 1) for (const role of roles) {
    const sim = isolated(role, seed), car = sim.player;
    setHole(sim, { radius: 1.2 });
    // Pair the same stratified impact draw across roles. Constructor/AI draw
    // consumption differs with roster selection and is not the risk under test.
    sim.random = () => (seed - 0.5) / 64;
    sim.hitPotholes(car);
    assert.equal(car.potholeHits, 1, 'the comparison must expose exactly one wheel in every class, despite different wheel-track widths');
    totals[role].body += car.damage;
    totals[role].suspension += car.wheels.reduce((sum, wheel) => sum + wheel.suspensionDamage, 0);
    totals[role].tireFailures += car.wheels.filter(wheel => wheel.tire !== 'intact' || wheel.assembly === 'destroyed').length;
  }
  for (let index = 1; index < roles.length; index += 1) {
    assert.ok(totals[roles[index - 1]].body > totals[roles[index]].body, JSON.stringify(totals));
    assert.ok(totals[roles[index - 1]].suspension > totals[roles[index]].suspension, JSON.stringify(totals));
  }
  assert.ok(totals.sports.tireFailures > totals.truck.tireFailures, JSON.stringify(totals));
  t.diagnostic(JSON.stringify({ pairedSingleWheelImpacts: totals, trialsPerClass: 64, impactSpeed: 35, radius: 1.2 }));
});

test('Truck immunity is strict actual speed below 15 mph, not at the boundary or a rounded HUD value', () => {
  assert.equal(TRUCK_SAFE_SPEED, 15 * 0.44704);
  for (const [label, speed, protectedExpected] of [['below', TRUCK_SAFE_SPEED - 0.001, true], ['exact', TRUCK_SAFE_SPEED, false], ['above', TRUCK_SAFE_SPEED + 0.001, false]]) {
    const sim = isolated('truck'), car = sim.player;
    setHole(sim, { speed });
    const before = { damage: car.damage, speed: car.speed, lateralVelocity: car.lateralVelocity, wheels: structuredClone(car.wheels), hits: car.potholeHits, rolls: car.hazardRolls };
    assert.equal(sim.isPotholeProtected(car), protectedExpected, label);
    sim.hitPotholes(car);
    if (protectedExpected) {
      assert.equal(car.damage, before.damage); assert.equal(car.speed, before.speed); assert.equal(car.lateralVelocity, before.lateralVelocity);
      assert.deepEqual(car.wheels, before.wheels); assert.equal(car.potholeHits, before.hits); assert.equal(car.hazardRolls, before.rolls);
    } else assert.ok(car.potholeHits > before.hits && car.damage > before.damage, `${label}: the actual threshold must allow damage`);
  }
});

test('Truck physically crosses a pothole below the speed limit without any new hazard effects or healing old wear', () => {
  const sim = isolated('truck'), car = sim.player;
  const hole = setHole(sim, { speed: 5.5, gap: 6 });
  car.damage = 0.15; car.wheels[0].suspensionDamage = 0.2; car.wheels[0].bend = 0.1;
  car.engine.wear = 0.2; sim.updateHandling(car);
  const before = { s: car.s, damage: car.damage, wheels: structuredClone(car.wheels), wear: car.engine.wear, hits: car.potholeHits, rolls: car.hazardRolls };
  let closestWheel = Infinity;
  for (let tick = 0; tick < 3 / step; tick += 1) {
    sim.update(step);
    const contact = sim.wheelContactPosition(car, car.wheels[0]);
    closestWheel = Math.min(closestWheel, Math.hypot(sim.relativeDistance(contact.s - hole.s), contact.lateral - hole.lateral));
  }
  assert.ok(car.s > before.s + 10, 'the wheels must physically pass through and beyond the crater');
  assert.ok(closestWheel < hole.radius, 'the physical wheel path must actually cross the crater');
  assert.equal(car.damage, before.damage); assert.equal(car.engine.wear, before.wear);
  assert.deepEqual(car.wheels, before.wheels); assert.equal(car.potholeHits, before.hits); assert.equal(car.hazardRolls, before.rolls);
});

test('Truck accelerating above 15 mph during the same wheel contact loses protection without repeated rolls', () => {
  const sim = isolated('truck'), car = sim.player;
  setHole(sim, { speed: TRUCK_SAFE_SPEED - 0.02, radius: 0.7 });
  sim.hitPotholes(car);
  assert.equal(car.potholeHits, 0);
  assert.equal(car.hazardRolls, 0);
  for (let tick = 0; tick < 20 && car.potholeHits === 0; tick += 1) sim.update(step, { throttle: 1 });
  assert.ok(car.potholeHits > 0 && car.damage > 0, 'crossing the speed threshold while physically overlapping must remove immunity');
  const rolls = car.hazardRolls;
  for (let call = 0; call < 30; call += 1) sim.hitPotholes(car);
  assert.equal(car.hazardRolls, rolls, 'one damaging contact still cannot reroll every frame');
});

test('Truck low-speed pothole protection does not prevent real vehicle collisions or grass engine wear', () => {
  const sim = isolated('truck'), car = sim.player;
  const wreck = sim.cars.find(other => other !== car);
  Object.assign(wreck, { s: 20, lateral: 0 }); sim.updateWorld(wreck);
  Object.assign(car, { s: 12, lateral: 0, speed: 6, lateralVelocity: 0 });
  advance(sim, 1.5, { throttle: 0.2 });
  assert.ok(car.damage > 0, 'a sub-15 mph collision remains harmful');
  const heatSim = isolated('truck'), heatCar = heatSim.player;
  Object.assign(heatCar, { s: heatSim.track.length / 2 - 100, lateral: -heatSim.track.width / 2 - 5, speed: 4 });
  advance(heatSim, 12, { throttle: 1 });
  assert.ok(heatCar.engine.heat > 0 && heatCar.engine.grassDrivingSeconds > 0, 'grass exposure must remain active');
});

for (const oversized of [false, true]) test(`Truck AI brakes below the protection threshold for ${oversized ? 'an oversized radius-retention regression' : 'unavoidable natural-size potholes'} and accelerates after clearing`, () => {
  const sim = isolated('truck'), car = sim.player;
  Object.assign(car, { s: 15, lateral: 0, speed: 24, targetLateral: 0, aiTimer: 0 });
  // Natural-size two-meter craters form a road-spanning row. No paved wheel
  // path can clear it; this avoids assumptions about unrealistic giant holes.
  const holes = oversized
    ? [{ id: 'oversized-radius-regression', s: 100, lateral: 0, radius: sim.track.width * 0.6, severity: 0.08, ...sampleTrack(sim.track, 100, 0) }]
    : [-12, -8, -4, 0, 4, 8, 12].map((lateral, index) => ({ id: `unavoidable-${index}`, s: 100, lateral, radius: 2, severity: 0.08, ...sampleTrack(sim.track, 100, lateral) }));
  sim.potholes = holes; sim.potholeBuckets = new Map([[2, holes]]);
  let braked = false, touched = false, maximumContactSpeed = 0;
  for (let frame = 0; frame < 30 / step && car.s < 250; frame += 1) {
    const input = sim.aiControl(car, step); braked ||= input.brake > 0.1;
    sim.update(step, input);
    for (const wheel of car.wheels) {
      const point = sim.wheelContactPosition(car, wheel);
      if (holes.some(hole => Math.hypot(sim.relativeDistance(point.s - hole.s), point.lateral - hole.lateral) < hole.radius + 0.18)) {
        touched = true; maximumContactSpeed = Math.max(maximumContactSpeed, car.speed);
      }
    }
    assert.ok(Math.abs(car.lateral) + car.spec.width / 2 <= sim.track.width / 2);
  }
  assert.ok(braked && touched, 'the driver must actually brake and physically cross the unavoidable hazard');
  assert.ok(maximumContactSpeed < TRUCK_SAFE_SPEED, `actual contact speed ${maximumContactSpeed}m/s must remain below15mph`);
  assert.equal(car.potholeHits, 0); assert.equal(car.damage, 0);
  assert.ok(car.s >= 250 && car.speed > TRUCK_SAFE_SPEED + 5, 'protection must not make the truck crawl forever after the hazard');
});
