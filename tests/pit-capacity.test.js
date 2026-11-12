import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RaceSimulation, sampleTrack } from '../src/simulation.js';

const STEP = 1 / 60;
// Saved failures predate the expanded straight. Recover their original local
// geometry before translating the whole fixture relative to the new pit ends.
const historicalLapLength = 0.533 * 1609.344;
const historicalLocalDistance = distance => ((distance + historicalLapLength / 2) % historicalLapLength + historicalLapLength) % historicalLapLength - historicalLapLength / 2;
function ready(options = {}) {
  const sim = new RaceSimulation({ seed: 19, difficulty: 0, laps: 3, trackId: 'bristol', ...options });
  for (let i = 0; i < 190; i += 1) sim.update(STEP);
  return sim;
}

for (const trackId of ['daytona', 'talladega', 'bristol']) {
  test(`${trackId}: twenty assigned pit bays have physical clearance and reject another driver's bay`, () => {
    const sim = ready({ trackId });
    assert.equal(sim.pit.bays.length, 20);
    assert.equal(new Set(sim.pit.bays.map(bay => bay.id)).size, 20);
    assert.equal(new Set(sim.pit.bays.map(bay => bay.carId)).size, 20);
    assert.ok(sim.pit.entryS >= -sim.track.straightLength / 2 + 3, 'entry and a whole car must remain clear of the turn');
    assert.ok(sim.pit.exitS <= sim.track.straightLength / 2 - 3, 'exit and a whole car must remain clear of the turn');
    const maximumCarDiagonal = Math.max(...sim.cars.map(car => Math.hypot(car.spec.length, car.spec.width)));
    for (const [index, car] of sim.cars.entries()) {
      const bay = sim.getPitBay(car);
      assert.equal(bay.id, car.assignedBayId);
      assert.equal(bay.carId, car.id);
      assert.ok(bay.s - bay.length / 2 > sim.pit.entryS);
      assert.ok(bay.s + bay.length / 2 < sim.pit.exitS);
      for (const endS of [bay.s - bay.length / 2, bay.s, bay.s + bay.length / 2]) {
        assert.ok(Math.abs(endS) < sim.track.straightLength / 2, 'the full stall must fit on the home straight');
        assert.equal(sampleTrack(sim.track, endS, bay.lateral).curvature, 0);
      }
      assert.ok(Math.abs(bay.lateral - sim.pit.throughLateral) > (bay.width + sim.pit.throughWidth) / 2, 'service bays must leave a separate clear through lane');
      const point = sampleTrack(sim.track, bay.s, bay.lateral);
      for (const other of sim.pit.bays.slice(index + 1)) {
        const adjacent = sampleTrack(sim.track, other.s, other.lateral);
        assert.ok(Math.hypot(point.x - adjacent.x, point.z - adjacent.z) > maximumCarDiagonal, 'curved-track bay spacing must accommodate actual cars');
      }
      const wrong = sim.pit.bays[(index + 1) % sim.pit.bays.length];
      Object.assign(car, { s: wrong.s, lateral: wrong.lateral, speed: 0, lateralVelocity: 0, headingOffset: 0, damage: 0.4 });
      sim.updateWorld(car);
      sim.updatePitInfo(car);
      assert.equal(car.pitInBay, false);
      assert.equal(sim.requestPitService(car), false);
      Object.assign(car, { s: bay.s, lateral: bay.lateral });
      assert.equal(sim.requestPitService(car), true);
      assert.equal(car.pitState, 'servicing');
    }
  });

  test(`${trackId}: a practical off-center or slightly angled stop receives service, while unsafe poses do not`, () => {
    for (const playerClass of ['stock', 'civilian']) {
      for (const pose of [{ longitudinal: 2, lateral: 0 }, { longitudinal: 0, lateral: 1 }, { longitudinal: 1.8, lateral: 0.8, heading: 0.12, speed: 0.3 }]) {
        const sim = ready({ trackId, playerClass });
        const car = sim.player, bay = sim.getPitBay(car);
        for (const other of sim.cars.filter(other => other !== car)) { other.s = sim.track.length / 2; sim.wreckCar(other, 'Controlled service isolation'); }
        Object.assign(car, { s: bay.s + pose.longitudinal, lateral: bay.lateral + pose.lateral, speed: pose.speed || 0, lateralVelocity: 0, headingOffset: pose.heading || 0, damage: 0.4 });
        sim.updateWorld(car); sim.updatePitInfo(car);
        assert.equal(car.pitInBay, true, 'whole vehicle must fit in its own painted bay');
        assert.equal(car.pitCentered, false, 'manual eligibility must not require precision AI centering');
        const position = [car.s, car.lateral, car.headingOffset];
        assert.equal(sim.requestPitService(car), true, `a realistic safe stop must work: ${JSON.stringify(pose)}`);
        assert.ok(Math.hypot(car.s - position[0], car.lateral - position[1]) < 1e-10 && Math.abs(car.headingOffset - position[2]) < 1e-10, 'acceptance must not snap the vehicle');
        for (let frame = 0; frame < 301; frame += 1) sim.update(STEP, { brake: 1 });
        assert.equal(car.pitState, 'complete');
        assert.equal(car.damage, 0, 'normal five-second Easy service must actually finish off-center');
        assert.ok(Math.hypot(car.s - position[0], car.lateral - position[1]) < 1e-10 && Math.abs(car.headingOffset - position[2]) < 1e-10, 'completed service must preserve the physical stop pose, including a slight angle');
      }
      const sim = ready({ trackId, playerClass }), car = sim.player, bay = sim.getPitBay(car);
      const base = { s: bay.s, lateral: bay.lateral, speed: 0, lateralVelocity: 0, headingOffset: 0, damage: 0.4 };
      for (const deviation of [{ headingOffset: 0.4 }, { speed: 2 }, { lateralVelocity: 1 }, { lateral: sim.pit.throughLateral }, { lateral: 0 }, { s: bay.s + bay.length / 2 - 0.2 }]) {
        Object.assign(car, base, deviation); sim.updateWorld(car); sim.updatePitInfo(car);
        assert.equal(sim.requestPitService(car), false, `unsafe pose must be rejected: ${JSON.stringify(deviation)}`);
      }
      Object.assign(car, base); sim.wreckCar(car, 'Controlled terminal condition');
      assert.equal(sim.requestPitService(car), false, 'a wreck cannot be revived by practical parking tolerance');
    }
  });
}

function crowdedApproach(trackId, withWreck = false) {
  const sim = ready({ trackId });
  // This controlled fixture isolates pit traffic from random road hazards.
  // Starting positions are two-wide, before the entry; all subsequent motion
  // uses normal AI controls, collisions and fixed-step physics.
  sim.potholes = [];
  sim.potholeBuckets.clear();
  sim.cars.forEach((car, index) => {
    Object.assign(car, { s: sim.pit.entryS - 110 - Math.floor(index / 2) * 13, lateral: index % 2 ? 3.2 : -3.2, speed: 16, damage: 0.55, lateralVelocity: 0 });
    sim.updateHandling(car);
  });
  const wreck = withWreck ? sim.cars.find(car => car.id === 'civilian-5') : null;
  if (wreck) {
    const bay = sim.getPitBay(wreck);
    Object.assign(wreck, { s: bay.s, lateral: bay.lateral });
    sim.wreckCar(wreck, 'Controlled stationary pit-bay obstacle');
    sim.updateWorld(wreck);
  }
  const wreckPosition = wreck ? [wreck.s, wreck.lateral, wreck.x, wreck.z] : null;
  const active = sim.cars.filter(car => car !== wreck);
  const observed = new Map(active.map(car => [car.id, { started: false, completed: false, exited: false, serviceBay: null, lastPitState: car.pitState }]));
  let largestSChange = 0, largestLateralChange = 0;
  for (let frame = 0; frame < 60 * 360; frame += 1) {
    const before = new Map(sim.cars.map(car => [car.id, [car.s, car.lateral]]));
    const input = sim.state === 'racing' && !sim.player.finished && !sim.player.wrecked ? sim.aiControl(sim.player, STEP) : {};
    sim.update(STEP, input);
    for (const car of active) {
      const record = observed.get(car.id);
      const [s, lateral] = before.get(car.id);
      largestSChange = Math.max(largestSChange, Math.abs(car.s - s));
      largestLateralChange = Math.max(largestLateralChange, Math.abs(car.lateral - lateral));
      if (car.pitState === 'servicing') {
        record.started = true;
        record.serviceBay = sim.getPitBay(car).id;
        assert.equal(car.pitInBay, true, `${car.id} must physically occupy its own bay during service`);
      }
      if (record.lastPitState === 'servicing' && car.pitState === 'complete' && !car.wrecked) record.completed = true;
      if (record.completed && !car.inPit && !car.pitTarget) record.exited = true;
      record.lastPitState = car.pitState;
    }
    if ([...observed.values()].every(record => record.exited)) break;
  }
  if (wreck) assert.deepEqual([wreck.s, wreck.lateral, wreck.x, wreck.z], wreckPosition, 'the obstacle must remain in its actual bay');
  const unresolved = active.filter(car => !observed.get(car.id).exited).map(car => ({ id: car.id, ...observed.get(car.id), s: car.s, lateral: car.lateral, speed: car.speed, wrecked: car.wrecked, damage: car.damage, pitRoute: car.pitRoute, pitTarget: car.pitTarget, bay: sim.getPitBay(car).s }));
  assert.deepEqual(unresolved, [], `all assigned drivers must service and physically exit: ${JSON.stringify(unresolved)}`);
  assert.equal(new Set([...observed.values()].map(record => record.serviceBay)).size, active.length);
  assert.ok(largestSChange < 6, `unexpected longitudinal teleport: ${largestSChange}m per frame`);
  assert.ok(largestLateralChange < 6, `unexpected lateral teleport: ${largestLateralChange}m per frame`);
  assert.ok(active.every(car => !car.wrecked), 'ordinary pit traffic should complete without destroying drivers');
  return { sim, observed, largestSChange, largestLateralChange };
}

for (const trackId of ['daytona', 'talladega', 'bristol']) {
  test(`${trackId}: a crowded ten-stock/ten-civilian approach services all twenty assigned bays and exits`, () => {
    crowdedApproach(trackId);
  });
}

test('Bristol: a wreck in one service bay stays permanent while the other nineteen drivers pass, service and exit', () => {
  crowdedApproach('bristol', true);
});

test('Bristol: the observed exit queue physically bypasses two permanent through-lane wrecks', () => {
  const saved = JSON.parse(readFileSync(new URL('../artifacts/wheel-damage/endurance/medium-incomplete-before-exit-fix.json', import.meta.url), 'utf8'));
  const sim = ready({ laps: 20 });
  sim.potholes = []; sim.potholeBuckets.clear();
  const queuedIds = ['stock-3', 'civilian-6', 'stock-4', 'stock-6', 'civilian-8', 'stock-5'];
  const obstacleIds = ['stock-9', 'civilian-3'];
  // Reconstruct the measured queue geometry and component condition once.
  // Unrelated traffic is isolated away from the exit. No positions or damage
  // are changed after this setup; the active cars must drive around the wrecks.
  sim.cars.forEach((car, index) => {
    const measured = saved.cars.find(item => item.id === car.id);
    if (queuedIds.includes(car.id) || obstacleIds.includes(car.id)) {
      Object.assign(car, { s: historicalLocalDistance(measured.finalSnapshot.s) + sim.pit.exitS - 240, lateral: measured.finalSnapshot.lateral, speed: 0, lateralVelocity: 0, damage: measured.damage });
      car.wheels = measured.wheelComponents.map(wheel => ({ ...wheel }));
      sim.updateHandling(car);
      if (obstacleIds.includes(car.id)) sim.wreckCar(car, measured.wreckReason);
      else Object.assign(car, { pitTarget: true, pitExiting: true, pitRoute: 'through-exit', pitState: 'complete', pitVisitLocked: true });
    } else {
      car.s = sim.track.length * 0.55 + index * 7; car.lateral = 5;
      sim.wreckCar(car, 'Controlled unrelated traffic isolation');
    }
    sim.updateWorld(car);
  });
  const queued = sim.cars.filter(car => queuedIds.includes(car.id));
  const obstacles = sim.cars.filter(car => obstacleIds.includes(car.id));
  const originalWrecks = obstacles.map(car => [car.id, car.s, car.lateral, car.x, car.z]);
  const exited = new Set();
  for (let frame = 0; frame < 60 * 90; frame += 1) {
    const previous = queued.map(car => [car.s, car.lateral]);
    sim.update(STEP, sim.aiControl(sim.player, STEP));
    queued.forEach((car, index) => {
      assert.ok(Math.abs(car.s - previous[index][0]) < 6 && Math.abs(car.lateral - previous[index][1]) < 6, `${car.id} must move continuously`);
      assert.equal(car.wrecked, false, `${car.id} must bypass rather than be forcibly retired`);
      if (car.s > sim.pit.exitS + 25 && !car.inPit && !car.pitTarget) exited.add(car.id);
    });
    if (exited.size === queued.length) break;
  }
  assert.deepEqual(obstacles.map(car => [car.id, car.s, car.lateral, car.x, car.z]), originalWrecks, 'the actual obstacles must remain in place');
  assert.equal(exited.size, queued.length, `all measured queued cars must leave: ${JSON.stringify(queued.filter(car => !exited.has(car.id)).map(car => ({ id: car.id, s: car.s, lateral: car.lateral, speed: car.speed, route: car.pitRoute })))}`);
});

test('Bristol: pit-bound traffic physically passes the observed wreck before the paved entrance', () => {
  const saved = JSON.parse(readFileSync(new URL('../artifacts/wheel-damage/endurance/medium-incomplete-before-entry-fix.json', import.meta.url), 'utf8'));
  const sim = ready({ laps: 20 });
  sim.potholes = []; sim.potholeBuckets.clear();
  const queuedIds = ['civilian-10', 'stock-7', 'stock-5', 'stock-10', 'stock-1', 'stock-3'];
  const obstacle = sim.cars.find(car => car.id === 'civilian-9');
  sim.cars.forEach((car, index) => {
    const measured = saved.cars.find(item => item.id === car.id);
    if (queuedIds.includes(car.id) || car === obstacle) {
      Object.assign(car, { s: historicalLocalDistance(measured.finalSnapshot.s) + sim.pit.entryS + 240, lateral: measured.finalSnapshot.lateral, speed: 0, lateralVelocity: 0, damage: measured.damage });
      car.wheels = measured.wheelComponents.map(wheel => ({ ...wheel }));
      sim.updateHandling(car);
      if (car === obstacle) sim.wreckCar(car, measured.wreckReason);
      else Object.assign(car, { pitTarget: true, pitExiting: false, pitRoute: 'approach', pitState: 'none' });
    } else {
      car.s = sim.track.length * 0.55 + index * 7; car.lateral = 5;
      sim.wreckCar(car, 'Controlled unrelated traffic isolation');
    }
    sim.updateWorld(car);
  });
  const originalWreck = [obstacle.s, obstacle.lateral, obstacle.x, obstacle.z];
  const queued = sim.cars.filter(car => queuedIds.includes(car.id));
  const passed = new Set();
  for (let frame = 0; frame < 60 * 90; frame += 1) {
    const previous = queued.map(car => [car.s, car.lateral]);
    sim.update(STEP, sim.aiControl(sim.player, STEP));
    queued.forEach((car, index) => {
      assert.ok(Math.abs(car.s - previous[index][0]) < 6 && Math.abs(car.lateral - previous[index][1]) < 6, `${car.id} must physically move`);
      assert.equal(car.wrecked, false, `${car.id} must bypass the wreck without forced retirement`);
      if (car.s > obstacle.s + 40) passed.add(car.id);
    });
    if (passed.size === queued.length) break;
  }
  assert.deepEqual([obstacle.s, obstacle.lateral, obstacle.x, obstacle.z], originalWreck);
  assert.equal(passed.size, queued.length, `all queued drivers must pass the entry obstacle: ${JSON.stringify(queued.filter(car => !passed.has(car.id)).map(car => ({ id: car.id, s: car.s, lateral: car.lateral, speed: car.speed, route: car.pitRoute })))}`);
});
