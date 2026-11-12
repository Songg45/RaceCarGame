import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceSimulation, sampleTrack } from '../src/simulation.js';

const step = 1 / 60;
const advance = (sim, seconds, input = { brake: 1 }) => {
  for (let frame = 0; frame < Math.ceil(seconds / step); frame += 1) sim.update(step, input);
};
function fixture(playerClass = 'stock', difficulty = 100, seed = 29) {
  const sim = new RaceSimulation({ trackId: 'bristol', playerClass, difficulty, seed, laps: 3 });
  advance(sim, 3.05);
  for (const [index, other] of sim.cars.filter(car => !car.isPlayer).entries()) {
    other.s = sim.track.length / 2 + index * 12;
    sim.wreckCar(other, 'Controlled service isolation');
  }
  sim.potholes = []; sim.potholeBuckets.clear();
  const car = sim.player, bay = sim.getPitBay(car);
  Object.assign(car, { s: bay.s - 1.5, lateral: bay.lateral + 0.6, speed: 0, lateralVelocity: 0, headingOffset: 0.08, damage: 0.35 });
  Object.assign(car.engine, { heat: 0.1, wear: 0.25 });
  car.wheels.forEach(wheel => { wheel.bend = 0.2; wheel.suspensionDamage = 0.3; });
  Object.assign(car.wheels[0], { tire: 'blown', pressure: 0, leakRate: 0 });
  Object.assign(car.wheels[1], { tire: 'punctured', pressure: 0.55, leakRate: 0.02 });
  Object.assign(car.wheels[2], { tire: 'intact', pressure: 0.45, leakRate: 0 });
  Object.assign(car.wheels[3], { tire: 'punctured', pressure: 0.65, leakRate: 0.04 });
  sim.updateHandling(car); sim.updateWorld(car); sim.updatePitInfo(car);
  return sim;
}
function assertFresh(sim) {
  const car = sim.player;
  assert.deepEqual(car.wheels.map(wheel => [wheel.id, wheel.tire, wheel.pressure, wheel.leakRate]), ['FL', 'FR', 'RL', 'RR'].map(id => [id, 'intact', 1, 0]));
  assert.equal(car.handling.blownTires, 0);
  assert.equal(car.handling.puncturedTires, 0);
  assert.equal(car.handling.minPressure, 1);
  const event = sim.events.findLast(event => event.type === 'repair' && event.carId === car.id);
  assert.ok(event, 'completion must produce a repair event');
  assert.deepEqual(event.tiresReplaced, ['FL', 'FR', 'RL', 'RR']);
  assert.match(car.repairMessage, /^All four tires replaced\./);
}

for (const playerClass of ['stock', 'civilian']) {
  for (const difficulty of [0, 50, 75, 100]) test(`${playerClass} difficulty${difficulty}: normal completed service always replaces all four mixed-condition tires`, () => {
    const sim = fixture(playerClass, difficulty), car = sim.player;
    assert.equal(sim.pit.serviceSeconds, 5);
    assert.equal(sim.requestPitService(), true);
    advance(sim, 4.9);
    assert.equal(car.pitState, 'servicing');
    assert.equal(car.pitVisits, 0);
    assert.ok(car.wheels.some(wheel => wheel.tire === 'blown'), 'replacement must wait until service completes');
    advance(sim, 0.12);
    assert.equal(car.pitState, 'complete'); assert.equal(car.pitVisits, 1);
    assertFresh(sim);
    if (difficulty === 0) assert.equal(car.damage, 0);
    else {
      assert.ok(car.damage > 0 && car.engine.wear > 0, 'non-tire repairs retain difficulty');
      assert.ok(car.wheels.some(wheel => wheel.bend > 0 && wheel.suspensionDamage > 0));
    }
    advance(sim, 1);
    assertFresh(sim);
    assert.equal(sim.requestPitService(), false, 'new tires do not unlock a second repair roll during the same visit');
  });

  test(`${playerClass}: a forced Extreme crew mistake still replaces every tire while worsening other damage`, () => {
    const sim = fixture(playerClass), car = sim.player;
    const before = { damage: car.damage, wear: car.engine.wear, bend: car.wheels[0].bend, suspension: car.wheels[0].suspensionDamage, blowouts: car.tireBlowouts };
    sim.random = () => 0; // Declared deterministic crew-quality fixture.
    assert.equal(sim.requestPitService(), true); advance(sim, 5.02);
    assertFresh(sim);
    assert.match(car.repairMessage, /Crew mistake/);
    assert.ok(car.damage > before.damage && car.engine.wear > before.wear);
    assert.ok(car.wheels[0].bend > before.bend && car.wheels[0].suspensionDamage > before.suspension);
    assert.equal(car.tireBlowouts, before.blowouts, 'crew mistakes must not manufacture a tire failure before replacing it');
    assert.ok(car.handling.gripFactor < 1, 'fresh tires must not conceal damaged rims or suspension');
    assert.equal(car.wrecked, false);
  });

  test(`${playerClass}: fresh pit tires remain vulnerable to a later real wheel/pothole impact`, () => {
    const sim = fixture(playerClass, 0), car = sim.player;
    assert.equal(sim.requestPitService(), true); advance(sim, 5.02); assertFresh(sim);
    // A second declared initial condition isolates a subsequent road impact.
    // From here ordinary updates move the repaired vehicle through the crater.
    Object.assign(car, { s: 300, lateral: 0, speed: 35, lateralVelocity: 0, headingOffset: 0 });
    const contact = sim.wheelContactPosition(car, car.wheels[0]);
    const hole = { id: 'post-service-road-impact', s: contact.s + 8, lateral: contact.lateral, radius: 2, severity: 0.08 };
    Object.assign(hole, sampleTrack(sim.track, hole.s, hole.lateral));
    sim.potholes = [hole]; sim.potholeBuckets = new Map([[Math.floor(hole.s / 40), [hole]]]);
    sim.random = () => 0.03;
    const hits = car.potholeHits;
    advance(sim, 0.8, { throttle: 1 });
    assert.ok(car.potholeHits > hits && car.damage > 0);
    assert.ok(car.wheels.some(wheel => wheel.tire !== 'intact' || wheel.pressure < 1), 'replacement grants no tire immunity');
  });
}

test('preexisting wrecks and destroyed wheel assemblies cannot use guaranteed tires to revive', () => {
  for (const playerClass of ['stock', 'civilian']) for (const failure of ['body', 'assembly', 'engine']) {
    const sim = fixture(playerClass), car = sim.player;
    if (failure === 'body') car.damage = 1;
    if (failure === 'assembly') car.wheels[0].assembly = 'destroyed';
    if (failure === 'engine') car.engine.wear = 1;
    advance(sim, step);
    const wheels = structuredClone(car.wheels), position = [car.s, car.lateral];
    assert.equal(car.wrecked, true);
    assert.equal(sim.requestPitService(), false); assert.equal(sim.recoverPlayer(), false);
    advance(sim, 6, { throttle: 1, service: true });
    assert.deepEqual(car.wheels, wheels); assert.deepEqual([car.s, car.lateral], position);
  }
});

test('completed catastrophic non-tire repairs deliver fresh tires but remain permanent retirements', () => {
  for (const failure of ['body', 'engine']) {
    const sim = fixture(), car = sim.player;
    if (failure === 'body') car.damage = 0.97;
    else car.engine.wear = 0.98;
    sim.random = () => 0;
    assert.equal(sim.requestPitService(), true); advance(sim, 5.02);
    assertFresh(sim); assert.equal(car.pitVisits, 1);
    assert.equal(car.wrecked, true); assert.equal(car.speed, 0);
    if (failure === 'engine') { assert.equal(car.engine.status, 'burnt'); assert.ok(car.damage < 1); }
    assert.equal(sim.requestPitService(), false); assert.equal(sim.recoverPlayer(), false);
    const pose = [car.s, car.lateral]; advance(sim, 6, { throttle: 1, service: true });
    assert.deepEqual([car.s, car.lateral], pose); assertFresh(sim);
  }
});

test('interrupted service does not grant a completed tire replacement', () => {
  const sim = fixture(), car = sim.player;
  assert.equal(sim.requestPitService(), true); advance(sim, 1);
  car.lateral = sim.pit.throughLateral; // Controlled displacement outside the service box.
  advance(sim, 6);
  assert.equal(car.pitVisits, 0);
  assert.ok(car.wheels.some(wheel => wheel.tire === 'blown'));
  assert.equal(sim.events.some(event => event.type === 'repair' && event.carId === car.id), false);
});
