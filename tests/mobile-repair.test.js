import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceSimulation } from '../src/simulation.js';

const step = 1 / 120;
const advance = (sim, seconds, input = {}) => { for (let tick = 0; tick < Math.ceil(seconds / step); tick += 1) sim.update(step, input); };
function fixture({ role = 'suv', difficulty = 0, damage = 0.25 } = {}) {
  const sim = new RaceSimulation({ trackId: 'daytona', playerClass: 'civilian', streetClassId: role, difficulty, seed: 31, laps: 3 });
  advance(sim, 3.02);
  sim.potholes = []; sim.potholeBuckets.clear();
  sim.cars.filter(car => !car.isPlayer).forEach((car, index) => {
    Object.assign(car, { s: sim.track.length * 0.7 + index * 12, lateral: 0, speed: 0 });
    sim.wreckCar(car, 'Controlled roadside-service isolation');
  });
  const car = sim.player;
  Object.assign(car, { s: sim.track.length / 2, lateral: -sim.track.width / 2 - 6, speed: 0, lateralVelocity: 0, headingOffset: 0, damage });
  car.engine.wear = 0.2;
  Object.assign(car.wheels[0], { tire: 'blown', pressure: 0, leakRate: 0, bend: 0.1, suspensionDamage: 0.2 });
  Object.assign(car.wheels[1], { tire: 'punctured', pressure: 0.8, leakRate: 0.01 });
  sim.updateHandling(car); sim.updateWorld(car);
  return sim;
}
function pitPosition(sim) {
  const car = sim.player, bay = sim.getPitBay(car);
  Object.assign(car, { s: bay.s - 1.2, lateral: bay.lateral + 0.5, speed: 0, lateralVelocity: 0, headingOffset: 0.05 });
  sim.updateWorld(car); sim.updatePitInfo(car);
}
function offRoadPosition(sim) {
  Object.assign(sim.player, { s: sim.track.length / 2, lateral: -sim.track.width / 2 - 6, speed: 0, lateralVelocity: 0, headingOffset: 0 });
  sim.updateWorld(sim.player); sim.updatePitInfo(sim.player);
}
function freshTires(car) {
  assert.ok(car.wheels.every(wheel => wheel.tire === 'intact' && wheel.pressure === 1 && wheel.leakRate === 0));
}
function restoreLiveOther(sim, position) {
  const other = sim.cars.find(car => car !== sim.player);
  Object.assign(other, { ...position, speed: 0, lateralVelocity: 0, headingOffset: 0, damage: 0, wrecked: false, wreckTime: null, wreckReason: '', status: 'racing', contactCooldown: 100 });
  sim.updateHandling(other); sim.updateWorld(other);
  const ai = sim.aiControl.bind(sim);
  sim.aiControl = (car, dt) => car === other ? { throttle: 0, brake: 1, steer: 0 } : ai(car, dt);
  return other;
}

test('only a stopped repairable SUV with a clear off-line work area can deploy without wasting invalid attempts', () => {
  for (const role of ['sports', 'sedan', 'truck']) {
    const sim = fixture({ role });
    assert.equal(sim.requestMobileRepair(), false);
    assert.equal(sim.player.mobileRepair.supported, false);
  }
  for (const invalid of ['road', 'pit-through', 'speed', 'lateral-speed', 'paused', 'wreck', 'crew-blocked']) {
    const sim = fixture(), car = sim.player;
    if (invalid === 'road') car.lateral = 0;
    if (invalid === 'pit-through') Object.assign(car, { s: 0, lateral: sim.pit.throughLateral });
    if (invalid === 'speed') car.speed = 0.2;
    if (invalid === 'lateral-speed') car.lateralVelocity = 0.2;
    if (invalid === 'paused') sim.togglePause();
    if (invalid === 'wreck') sim.wreckCar(car, 'Controlled terminal condition');
    if (invalid === 'crew-blocked') restoreLiveOther(sim, { s: car.s, lateral: car.lateral + 2.5 });
    assert.equal(sim.requestMobileRepair(), false, invalid);
    assert.equal(car.mobileRepair.charges, 1, `${invalid}: invalid deployment must not consume charge`);
    assert.equal(car.mobileRepair.attempts, 0);
  }
});

test('normal roadside repair takes fifteen seconds, gives no early repairs, freezes while paused, and consumes one charge', () => {
  const sim = fixture(), car = sim.player;
  const position = [car.s, car.lateral, car.headingOffset], damage = car.damage, wear = car.engine.wear;
  assert.equal(sim.requestMobileRepair(), true);
  assert.equal(car.mobileRepair.charges, 0); assert.equal(car.mobileRepair.used, true);
  assert.equal(car.mobileRepair.attempts, 1); assert.equal(sim.requestMobileRepair(), false);
  advance(sim, 5);
  const frozen = { remaining: car.mobileRepair.remaining, elapsed: sim.elapsed, damage: car.damage };
  sim.togglePause(); advance(sim, 20); assert.equal(sim.elapsed, frozen.elapsed); assert.equal(car.mobileRepair.remaining, frozen.remaining); assert.equal(car.damage, frozen.damage); sim.togglePause();
  advance(sim, 9.9);
  assert.ok(car.mobileRepair.remaining > 0);
  assert.equal(car.damage, damage); assert.equal(car.engine.wear, wear);
  assert.equal(car.wheels[0].tire, 'blown'); assert.equal(car.mobileRepair.completed, 0);
  advance(sim, 0.12);
  assert.equal(car.mobileRepair.completed, 1); assert.equal(car.mobileRepair.remaining, 0);
  assert.equal(car.damage, 0); assert.equal(car.engine.wear, 0); freshTires(car);
  assert.equal(car.pitVisits, 0); assert.equal(car.mobileRepair.charges, 0); assert.equal(car.mobileRepair.disabled, false);
  assert.deepEqual([car.s, car.lateral, car.headingOffset], position);
  assert.equal(sim.requestMobileRepair(), false);
});

test('normal mobile repair can recharge at a completed pit stop and repeat within the same race', () => {
  const sim = fixture(), car = sim.player;
  assert.equal(sim.requestMobileRepair(), true); advance(sim, 15.02); freshTires(car);
  assert.equal(car.damage, 0); assert.equal(car.engine.wear, 0);
  pitPosition(sim);
  assert.equal(sim.requestPitService(), true, 'a healthy spent SUV must be eligible solely to recharge');
  advance(sim, 4.9); assert.equal(car.mobileRepair.charges, 0, 'entry and partial service cannot recharge');
  advance(sim, 0.12); assert.equal(car.mobileRepair.charges, 1); assert.equal(car.mobileRepair.used, false);
  offRoadPosition(sim); car.damage = 0.2;
  assert.equal(sim.requestMobileRepair(), true); advance(sim, 15.02);
  assert.equal(car.mobileRepair.attempts, 2); assert.equal(car.mobileRepair.completed, 2); assert.equal(car.damage, 0);
});

test('driving aborts without partial repairs; interrupted pit service cannot recharge, but a nonfatal bad completed stop can', () => {
  const sim = fixture({ difficulty: 100 }), car = sim.player;
  const before = car.damage;
  assert.equal(sim.requestMobileRepair(), true); advance(sim, 2); sim.update(step, { throttle: 1 });
  assert.equal(car.mobileRepair.charges, 0); assert.equal(car.mobileRepair.disabled, false); assert.equal(car.mobileRepair.completed, 0);
  assert.equal(car.damage, before); assert.equal(car.wheels[0].tire, 'blown');
  pitPosition(sim); assert.equal(sim.requestPitService(), true); advance(sim, 2);
  car.lateral = sim.pit.throughLateral; advance(sim, step); assert.equal(car.mobileRepair.charges, 0);
  offRoadPosition(sim); pitPosition(sim);
  sim.random = () => 0;
  assert.equal(sim.requestPitService(), true); advance(sim, 5.02);
  assert.ok(car.damage > before, 'other Extreme repairs can still go wrong');
  assert.equal(car.wrecked, false); freshTires(car); assert.equal(car.mobileRepair.charges, 1);
});

test('a completed Extreme roadside repair gives four fresh tires but keeps the shared bad-crew non-tire outcome', () => {
  const sim = fixture({ difficulty: 100 }), car = sim.player;
  const before = { body: car.damage, wear: car.engine.wear, bend: car.wheels[0].bend, suspension: car.wheels[0].suspensionDamage };
  sim.random = () => 0;
  assert.equal(sim.requestMobileRepair(), true); advance(sim, 15.02);
  assert.equal(car.mobileRepair.completed, 1); freshTires(car);
  assert.ok(car.damage > before.body && car.engine.wear > before.wear);
  assert.ok(car.wheels[0].bend > before.bend && car.wheels[0].suspensionDamage > before.suspension);
  assert.equal(car.pitVisits, 0); assert.equal(car.mobileRepair.charges, 0);
});

for (const contact of ['body', 'crew-area', 'last-tick']) test(`${contact}: contact cancels before repair, applies one major penalty, and permanently disables the ability`, () => {
  const sim = fixture({ difficulty: 100, damage: 0.1 }), car = sim.player;
  assert.equal(sim.requestMobileRepair(), true);
  if (contact === 'last-tick') for (let tick = 0; tick < 1799; tick += 1) sim.update(step);
  else advance(sim, 1);
  const area = { ...car.mobileRepair.area };
  const other = restoreLiveOther(sim, { s: area.s, lateral: contact === 'body' ? car.lateral + 0.05 : area.lateral + (area.width + 2) / 2 - 0.1 });
  if (contact !== 'body') other.lateral = area.lateral + (area.width + other.spec.width) / 2 - 0.05;
  car.contactCooldown = 100;
  const before = { body: car.damage, wear: car.engine.wear, bend: car.wheels[0].bend, suspension: car.wheels[0].suspensionDamage };
  sim.update(step);
  assert.equal(car.mobileRepair.disabled, true); assert.equal(car.mobileRepair.charges, 0);
  assert.equal(car.mobileRepair.completed, 0); assert.equal(car.wheels[0].tire, 'blown', 'interruption must not deliver new tires');
  assert.ok(car.damage - before.body >= 0.34 && car.engine.wear - before.wear >= 0.29, 'severe crew damage must bypass normal contact cooldown');
  assert.ok(car.wheels[0].bend - before.bend >= 0.54 && car.wheels[0].suspensionDamage - before.suspension >= 0.59);
  assert.equal(sim.events.filter(event => event.kind === 'mobile-crew-collision' && event.carId === car.id).length, 1);
  const penaltyBody = car.damage;
  advance(sim, 0.05);
  assert.equal(car.damage, penaltyBody, 'the same active overlap must not repeatedly apply the crew penalty');
  assert.equal(sim.events.filter(event => event.kind === 'mobile-crew-collision' && event.carId === car.id).length, 1);
  other.s = sim.track.length * 0.7; sim.wreckCar(other, 'End collision fixture');
  sim.difficultyLevel = 0; pitPosition(sim);
  assert.equal(sim.requestPitService(), true); advance(sim, 5.02);
  assert.equal(car.damage, 0); assert.equal(car.engine.wear, 0); freshTires(car);
  assert.equal(car.mobileRepair.disabled, true); assert.equal(car.mobileRepair.charges, 0);
  offRoadPosition(sim); car.damage = 0.2; assert.equal(sim.requestMobileRepair(), false, 'even perfect pit repair cannot restore collision-disabled ability');
  const fresh = sim.restart(); assert.equal(fresh.player.mobileRepair.disabled, false); assert.equal(fresh.player.mobileRepair.charges, 1);
});

test('fatal ordinary contact during mobile service still disables it and applies its one-time penalty without revival', () => {
  const sim = fixture({ damage: 0.95 }), car = sim.player;
  assert.equal(sim.requestMobileRepair(), true);
  const other = restoreLiveOther(sim, { s: car.s - 3, lateral: car.lateral });
  other.speed = 70; other.contactCooldown = 0; car.contactCooldown = 0;
  sim.update(step);
  assert.equal(car.wrecked, true); assert.equal(car.mobileRepair.disabled, true);
  assert.ok(car.engine.wear >= 0.4 - 1e-10 && car.wheels[0].bend >= 0.45 - 1e-10, 'the crew penalty must still apply when ordinary collision damage is fatal');
  assert.equal(car.mobileRepair.completed, 0);
  assert.equal(sim.events.filter(event => event.kind === 'mobile-crew-collision' && event.carId === car.id).length, 1);
  assert.equal(sim.requestMobileRepair(), false); assert.equal(sim.requestPitService(), false); assert.equal(sim.recoverPlayer(), false);
});

test('SUV AI physically pulls clear, stops, completes roadside service, and resumes racing without a pit visit', () => {
  const sim = fixture({ damage: 0.5 }), car = sim.player;
  Object.assign(car, { s: sim.track.length / 2 - 100, lateral: 0, speed: 18, lateralVelocity: 0, headingOffset: 0, targetLateral: 0 });
  const start = car.s;
  let accepted = null, maximumStep = 0;
  const request = sim.requestMobileRepair.bind(sim);
  sim.requestMobileRepair = (driver = car) => {
    const before = [driver.s, driver.lateral, driver.headingOffset];
    const result = request(driver);
    if (result && driver === car) accepted = { before, after: [driver.s, driver.lateral, driver.headingOffset], speed: driver.speed, lateralVelocity: driver.lateralVelocity, area: { ...driver.mobileRepair.area } };
    return result;
  };
  for (let frame = 0; frame < 120 / step && !car.wrecked; frame += 1) {
    const previous = [car.s, car.lateral];
    sim.update(step, sim.aiControl(car, step));
    maximumStep = Math.max(maximumStep, Math.hypot(car.s - previous[0], car.lateral - previous[1]));
    if (car.mobileRepair.completed > 0 && car.lateral > -sim.track.width / 2 + car.spec.width / 2 && car.speed > 5) break;
  }
  assert.ok(accepted, 'the AI must reach an actual legal roadside deployment');
  assert.deepEqual(accepted.after, accepted.before, 'deploying the crew must not teleport the car');
  assert.ok(accepted.speed <= 0.05 && Math.abs(accepted.lateralVelocity) <= 0.05);
  const halfWidth = Math.abs(Math.sin(accepted.area.headingOffset)) * accepted.area.length / 2 + Math.abs(Math.cos(accepted.area.headingOffset)) * accepted.area.width / 2;
  assert.ok(accepted.area.lateral + halfWidth < -sim.track.width / 2, 'the entire deployed work area must clear the racing line');
  assert.equal(car.mobileRepair.completed, 1); assert.equal(car.mobileRepair.disabled, false);
  assert.equal(car.pitVisits, 0); assert.equal(car.damage, 0); freshTires(car);
  assert.ok(car.s > start + 50 && car.speed > 5 && car.lateral > -sim.track.width / 2 + car.spec.width / 2, 'the repaired AI must return to actual racing progress');
  assert.ok(maximumStep < 2, 'all approach and return movement must remain continuous');
});

test('moving stock and street traffic routes past an active crew footprint without cancelling the repair', () => {
  const sim = fixture(), owner = sim.player;
  assert.equal(sim.requestMobileRepair(), true);
  const area = { ...owner.mobileRepair.area };
  const traffic = sim.cars.filter(car => car !== owner).slice(0, 4);
  traffic.forEach((car, index) => {
    Object.assign(car, { s: owner.s - 45 - index * 20, lateral: index % 2 ? -sim.track.width / 2 + 1.8 : -sim.track.width / 2 - 3, speed: 12, lateralVelocity: 0, headingOffset: 0, targetLateral: -3, damage: 0, wrecked: false, wreckTime: null, wreckReason: '', status: 'racing' });
    sim.updateHandling(car); sim.updateWorld(car);
  });
  const stationary = [owner.s, owner.lateral];
  for (let frame = 0; frame < 30 / step; frame += 1) {
    sim.update(step, { brake: 1 });
    assert.equal(owner.mobileRepair.disabled, false, 'passing AI must avoid the active crew work area');
    if (owner.mobileRepair.completed === 1 && traffic.every(car => car.s > area.s + area.length + 15)) break;
  }
  assert.equal(owner.mobileRepair.completed, 1); assert.deepEqual([owner.s, owner.lateral], stationary);
  assert.ok(traffic.every(car => !car.wrecked && car.s > area.s + area.length + 15), 'all mixed-class traffic must make physical forward progress past the service');
  assert.equal(sim.events.some(event => event.kind === 'mobile-crew-collision'), false);
});
