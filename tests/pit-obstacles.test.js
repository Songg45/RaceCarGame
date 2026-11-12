import test from 'node:test';
import assert from 'node:assert/strict';
import { RaceSimulation } from '../src/simulation.js';

const STEP = 1 / 60;
function obstructedExit(trackId, liveObstacle = false, entrance = false) {
  const sim = new RaceSimulation({ trackId, playerClass: 'stock', laps: 20, difficulty: 0, seed: 31 });
  for (let frame = 0; frame < 190; frame += 1) sim.update(STEP);
  sim.potholes = []; sim.potholeBuckets.clear();
  const drivers = ['stock-1', 'civilian-1', 'stock-2', 'civilian-2'].map(id => sim.cars.find(car => car.id === id));
  const obstacleCars = liveObstacle ? [sim.player] : ['stock-9', 'civilian-9'].map(id => sim.cars.find(car => car.id === id));
  const obstacleS = entrance ? sim.pit.entryS - 20 : sim.pit.exitS - 75;
  const travelLane = entrance ? -sim.track.width / 2 + 2.5 : sim.pit.throughLateral;
  sim.cars.forEach((car, index) => {
    car.speed = 0; car.lateralVelocity = 0; car.headingOffset = 0;
    if (drivers.includes(car)) {
      const place = drivers.indexOf(car);
      Object.assign(car, { s: obstacleS - 12 - place * 14, lateral: travelLane, damage: 0.2, pitTarget: true, pitExiting: !entrance, pitRoute: entrance ? 'approach' : 'through-exit', pitState: entrance ? 'none' : 'complete', pitVisitLocked: !entrance });
    } else if (obstacleCars.includes(car)) {
      const place = obstacleCars.indexOf(car);
      Object.assign(car, { s: obstacleS + place * 8, lateral: travelLane + (liveObstacle ? 0 : place ? 0.9 : -0.9), damage: liveObstacle ? 0.75 : 1 });
      if (liveObstacle) Object.assign(car.wheels[0], { tire: 'blown', pressure: 0 });
      else sim.wreckCar(car, 'Controlled permanent pit-exit obstruction');
    } else {
      car.s = sim.track.length * 0.5 + index * 8; car.lateral = 5;
      sim.wreckCar(car, 'Controlled unrelated traffic isolation');
    }
    sim.updateHandling(car); sim.updateWorld(car);
  });
  const original = obstacleCars.map(car => [car.s, car.lateral, car.x, car.z]);
  const exited = new Set();
  // A damaged human driver may hold the brake in the through lane. It remains
  // a live car, not an invented DNF. AI must choose the open pavement beside it.
  for (let frame = 0; frame < 60 * 90; frame += 1) {
    const previous = drivers.map(car => [car.s, car.lateral]);
    sim.update(STEP, { brake: 1 });
    drivers.forEach((car, index) => {
      assert.ok(Math.abs(car.s - previous[index][0]) < 6 && Math.abs(car.lateral - previous[index][1]) < 6, 'bypass must use continuous movement');
      assert.equal(car.wrecked, false, `${car.id} may not be forced out of the race to resolve traffic`);
      if (entrance ? car.s > obstacleS + 55 : !car.inPit && !car.pitTarget && car.s > sim.pit.exitS + 25) exited.add(car.id);
    });
    if (exited.size === drivers.length) break;
  }
  if (liveObstacle) {
    assert.equal(sim.player.wrecked, false, 'a waiting driver must stay live');
    assert.ok(Math.hypot(sim.player.s - original[0][0], sim.player.lateral - original[0][1]) < 0.3, 'passing traffic must not ram the waiting driver out of its way');
  } else assert.deepEqual(obstacleCars.map(car => [car.s, car.lateral, car.x, car.z]), original, 'permanent wrecks must retain their exact positions');
  assert.equal(exited.size, drivers.length, `open pavement must allow traffic to leave: ${JSON.stringify(drivers.filter(car => !exited.has(car.id)).map(car => ({ id: car.id, s: car.s, lateral: car.lateral, speed: car.speed, route: car.pitRoute })))}`);
}

for (const trackId of ['daytona', 'talladega', 'bristol']) {
  test(`${trackId}: exit traffic physically bypasses multiple permanent wrecks using clear pavement`, () => obstructedExit(trackId));
}
test('Bristol: exit traffic passes a damaged stationary live car without treating it as a wreck', () => obstructedExit('bristol', true));
test('Bristol: pit-bound traffic passes multiple wrecks before the entrance on the racing surface', () => obstructedExit('bristol', false, true));

test('a stationary wreck67m behind a centered service bay does not reserve the merge lane forever', () => {
  const sim = new RaceSimulation({ trackId: 'daytona', difficulty: 0, seed: 31, laps: 20 });
  for (let frame = 0; frame < 190; frame += 1) sim.update(STEP);
  sim.potholes = []; sim.potholeBuckets.clear();
  const car = sim.player, bay = sim.getPitBay(car), obstacle = sim.cars.find(item => item.id === 'stock-9');
  Object.assign(car, { s: bay.s, lateral: bay.lateral, speed: 0, lateralVelocity: 0, headingOffset: 0, pitState: 'complete', pitTarget: true, pitExiting: true, pitRoute: 'exit-stall', pitVisitLocked: true });
  sim.cars.filter(item => item !== car).forEach((other, index) => {
    other.s = other === obstacle ? car.s - 67 : sim.track.length * 0.5 + index * 8;
    other.lateral = other === obstacle ? sim.pit.throughLateral : 5;
    sim.wreckCar(other, 'Controlled stationary merge fixture'); sim.updateWorld(other);
  });
  const original = [obstacle.s, obstacle.lateral];
  for (let frame = 0; frame < 60 * 90; frame += 1) {
    sim.update(STEP, sim.aiControl(car, STEP));
    if (!car.inPit && !car.pitTarget && car.s > sim.pit.exitS + 20) break;
  }
  assert.deepEqual([obstacle.s, obstacle.lateral], original);
  assert.equal(car.wrecked, false);
  assert.ok(!car.inPit && !car.pitTarget && car.s > sim.pit.exitS + 20, 'a distant stationary object behind the stall must not cause an endless merge wait');
});
