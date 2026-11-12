import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RaceSimulation } from '../src/simulation.js';

const STEP = 1 / 60;
const saved = JSON.parse(readFileSync(new URL('../artifacts/straight-pits/endurance/medium-incomplete-wall-bound.json', import.meta.url), 'utf8'));
const damagedDrivers = saved.cars.filter(car => car.result === 'RUNNING');

function recoveryFixture(measured) {
  const sim = new RaceSimulation({ trackId: 'bristol', playerClass: measured.classId, vehicleId: 'civic', difficulty: 0, laps: 20, seed: 20261112 });
  for (let frame = 0; frame < 190; frame += 1) sim.update(STEP);
  sim.potholes = []; sim.potholeBuckets.clear();
  const driver = sim.cars.find(car => car.id === measured.id);
  sim.player = driver;
  sim.cars.forEach((car, index) => {
    car.isPlayer = car === driver;
    if (car !== driver) {
      car.s = sim.track.length * 0.55 + index * 7; car.lateral = 5;
      sim.wreckCar(car, 'Controlled unrelated traffic isolation');
    }
  });
  Object.assign(driver, { s: sim.pit.entryS - 80, lateral: -sim.track.width / 2 - 10, speed: 1.5, lateralVelocity: 0, headingOffset: 0, damage: measured.damage });
  driver.wheels = measured.wheelComponents.map(wheel => ({ ...wheel }));
  sim.updateHandling(driver); sim.updateWorld(driver);
  return sim;
}

for (const measured of damagedDrivers) {
  test(`${measured.id}: real full countersteering can recover its recorded severe damage from the grass`, () => {
    const sim = recoveryFixture(measured), car = sim.player;
    const initial = car.lateral, originalComponents = JSON.stringify(car.wheels);
    let reachedPavement = false;
    for (let frame = 0; frame < 60 * 60; frame += 1) {
      const before = [car.s, car.lateral];
      sim.update(STEP, { throttle: 1, steer: 1 });
      assert.ok(Math.abs(car.s - before[0]) < 3 && Math.abs(car.lateral - before[1]) < 3, 'recovery must be continuous');
      if (car.lateral >= -sim.track.width / 2 + 0.75) { reachedPavement = true; break; }
    }
    assert.ok(reachedPavement, `full countersteer needs real authority against damage pull: ${JSON.stringify({ initial, lateral: car.lateral, speed: car.speed, handling: car.handling })}`);
    assert.equal(car.wrecked, false);
    assert.equal(car.pitVisits, 0);
    assert.equal(JSON.stringify(car.wheels), originalComponents, 'countersteering must not secretly repair components');
  });

  test(`${measured.id}: AI physically returns with the recorded damage, centers in its own bay and receives repair`, () => {
    const sim = recoveryFixture(measured), car = sim.player;
    let serviceStarted = false, restored = false;
    for (let frame = 0; frame < 60 * 240; frame += 1) {
      const before = [car.s, car.lateral];
      sim.update(STEP, sim.aiControl(car, STEP));
      assert.ok(Math.abs(car.s - before[0]) < 3 && Math.abs(car.lateral - before[1]) < 3, 'AI recovery must physically drive');
      if (car.pitState === 'servicing') {
        serviceStarted = true;
        assert.equal(car.pitCentered && car.pitInBay, true);
      }
      if (serviceStarted && car.pitState === 'complete') {
        restored = car.damage === 0 && car.wheels.every(wheel => wheel.tire === 'intact' && wheel.pressure === 1 && wheel.bend === 0 && wheel.suspensionDamage === 0);
        break;
      }
    }
    assert.ok(serviceStarted && restored, `damaged car must reach actual service without being teleported or retired: ${JSON.stringify({ serviceStarted, restored, s: car.s, lateral: car.lateral, speed: car.speed, route: car.pitRoute, damage: car.damage })}`);
    assert.equal(car.wrecked, false);
  });
}
