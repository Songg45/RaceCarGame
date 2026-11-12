import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RaceSimulation, sampleTrack } from '../src/simulation.js';

const baseline = process.argv.includes('--baseline');
const STEP = 1 / 60;
const requestedOutput = process.argv.find(argument => argument.startsWith('--output='))?.slice('--output='.length);
const output = requestedOutput ? pathToFileURL(`${resolve(requestedOutput)}/`) : new URL('../artifacts/straight-pits/', import.meta.url);
await mkdir(output, { recursive: true });
const sourceSha256 = createHash('sha256').update(await readFile(new URL('../src/catalog.js', import.meta.url))).update(await readFile(new URL('../src/simulation.js', import.meta.url))).digest('hex');
const results = [];
const started = performance.now();
const angleDifference = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

for (const trackId of ['daytona', 'talladega', 'bristol']) {
  const sim = new RaceSimulation({ trackId, playerClass: 'stock', laps: 20, difficulty: 0, seed: 19 });
  for (let frame = 0; frame < 190; frame += 1) sim.update(STEP);
  sim.potholes = []; sim.potholeBuckets.clear();
  sim.cars.forEach((car, index) => {
    Object.assign(car, { s: sim.pit.entryS - 110 - Math.floor(index / 2) * 13, lateral: index % 2 ? 3.2 : -3.2, speed: 16, damage: 0.55, lateralVelocity: 0 });
    // Every class includes ordinary body-damaged cars and repairable component
    // failures. The baseline records the old undamaged-wheel approach exactly.
    if (!baseline && Math.floor(index / 2) % 2) {
      Object.assign(car.wheels[0], { tire: 'blown', pressure: 0 });
      Object.assign(car.wheels[2], { bend: 0.25, suspensionDamage: 0.3 });
    }
    sim.updateHandling(car); sim.updateWorld(car);
  });
  const records = new Map(sim.cars.map(car => [car.id, { id: car.id, classId: car.classId, bay: car.pitBayNumber, componentDamage: car.wheels.some(wheel => wheel.tire !== 'intact'), started: false, completed: false, exited: false, maximumServiceError: { longitudinal: 0, lateral: 0, headingDegrees: 0 }, footprintContained: true, servicePositionShift: null }]));
  const pose = car => {
    const bay = sim.getPitBay(car), point = sampleTrack(sim.track, bay.s, bay.lateral);
    const heading = angleDifference(car.heading + car.headingOffset - point.heading);
    const longitudinal = Math.abs(sim.relativeDistance(car.s) - bay.s), lateral = Math.abs(car.lateral - bay.lateral);
    const halfLength = Math.abs(Math.cos(heading)) * car.spec.length / 2 + Math.abs(Math.sin(heading)) * car.spec.width / 2;
    const halfWidth = Math.abs(Math.sin(heading)) * car.spec.length / 2 + Math.abs(Math.cos(heading)) * car.spec.width / 2;
    return { longitudinal, lateral, headingDegrees: Math.abs(heading) * 180 / Math.PI, footprintContained: longitudinal + halfLength <= bay.length / 2 && lateral + halfWidth <= bay.width / 2 };
  };
  const request = sim.requestPitService.bind(sim);
  sim.requestPitService = (car = sim.player) => {
    const before = { s: car.s, lateral: car.lateral, headingOffset: car.headingOffset };
    const accepted = request(car);
    if (accepted) {
      const record = records.get(car.id);
      record.started = true; record.startAt = sim.elapsed; record.startPose = pose(car);
      record.servicePositionShift = Math.hypot(car.s - before.s, car.lateral - before.lateral);
      record.serviceHeadingShift = Math.abs(car.headingOffset - before.headingOffset);
    }
    return accepted;
  };
  for (let frame = 0; frame < 60 * 420; frame += 1) {
    sim.update(STEP, sim.aiControl(sim.player, STEP));
    for (const car of sim.cars) {
      const record = records.get(car.id);
      if (car.pitState === 'servicing') {
        const current = pose(car);
        for (const field of ['longitudinal', 'lateral', 'headingDegrees']) record.maximumServiceError[field] = Math.max(record.maximumServiceError[field], current[field]);
        record.footprintContained &&= current.footprintContained;
      }
      if (record.started && car.pitState === 'complete') record.completed = true;
      if (record.completed && !car.inPit && !car.pitTarget) record.exited = true;
    }
    if ([...records.values()].every(record => record.exited)) break;
    if (performance.now() - started > 35000) throw new Error('Bounded parking verification exceeded 35 wall seconds');
  }
  const geometry = {
    trackId, length: sim.track.length, straightLength: sim.track.straightLength,
    entryS: sim.pit.entryS, exitS: sim.pit.exitS,
    straightBayCount: sim.pit.bays.filter(bay => Math.abs(bay.s) + bay.length / 2 <= sim.track.straightLength / 2).length,
    allPitPavingStraight: sim.pit.entryS >= -sim.track.straightLength / 2 && sim.pit.exitS <= sim.track.straightLength / 2,
    serviceTolerance: sim.pit.serviceTolerance, parkingTolerance: sim.pit.parkingTolerance ?? sim.pit.serviceTolerance,
  };
  const result = { geometry, elapsed: sim.elapsed, cars: [...records.values()], remaining: sim.cars.filter(car => !records.get(car.id).exited).map(car => ({ id: car.id, s: car.s, lateral: car.lateral, speed: car.speed, route: car.pitRoute, wrecked: car.wrecked, wreckReason: car.wreckReason, damage: car.damage, engine: car.engine ? { ...car.engine } : null })) };
  results.push(result);
  console.log(JSON.stringify({ trackId, ...geometry, services: result.cars.filter(car => car.started).length, exited: result.cars.filter(car => car.exited).length, maxima: Object.fromEntries(['longitudinal', 'lateral', 'headingDegrees'].map(field => [field, Math.max(...result.cars.map(car => car.maximumServiceError[field]))])), remaining: result.remaining }));
}
const report = { baseline, sourceSha256, wallSeconds: (performance.now() - started) / 1000, boundary: 'Controlled two-wide positions before the pit entrance and repairable initial damage; all later approach/parking/service/exit uses normal AI and physics. No bay-center position or heading injection. Service wrapper records positions without changing them.', results };
await writeFile(new URL(baseline ? 'parking-before-fix.json' : 'parking-verification.json', output), JSON.stringify(report, null, 2));
if (!baseline) for (const result of results) {
  assert.equal(result.geometry.straightBayCount, 20);
  assert.equal(result.geometry.allPitPavingStraight, true);
  assert.deepEqual(result.remaining, []);
  for (const car of result.cars) {
    assert.equal(car.started && car.completed && car.exited, true, `${car.id} complete physical visit`);
    assert.equal(car.footprintContained, true, `${car.id} chassis contained in stall`);
    assert.equal(car.servicePositionShift, 0, `${car.id} no service position snap`);
    assert.equal(car.serviceHeadingShift, 0, `${car.id} no service heading snap`);
    const tolerance = result.geometry.parkingTolerance;
    assert.ok(car.maximumServiceError.longitudinal <= tolerance.longitudinal + 1e-8 && car.maximumServiceError.lateral <= tolerance.lateral + 1e-8 && car.maximumServiceError.headingDegrees <= tolerance.heading * 180 / Math.PI + 1e-8, `${car.id} must be parked centrally and aligned: ${JSON.stringify(car.maximumServiceError)}`);
  }
}
