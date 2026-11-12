import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { RaceSimulation } from '../src/simulation.js';

const revision = process.argv.includes('--baseline') ? 'baseline' : 'after';
const output = new URL('../artifacts/manual-pits-avoidance/', import.meta.url);
await mkdir(output, { recursive: true });
const step = 1 / 60, seeds = [20261112, 1, 7, 19, 42];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceSha256 = hash(await readFile(new URL('../src/simulation.js', import.meta.url)));
const catalogSha256 = hash(await readFile(new URL('../src/catalog.js', import.meta.url)));
const round = value => Number(value.toFixed(5));
const results = [], start = performance.now();

for (const seed of seeds) {
  const sim = new RaceSimulation({ trackId: 'bristol', playerClass: 'stock', laps: 20, difficulty: 100, seed });
  const holes = sim.potholes.map(({ id, s, lateral, radius, severity }) => ({ id, s, lateral, radius, severity }));
  const metrics = new Map(sim.cars.map(car => [car.id, { startS: car.s, furthestS: car.s, grassSeconds: 0, contactEpisodes: 0, wallEpisodes: 0, maximumAbsLateral: Math.abs(car.lateral), progressSnapshots: {} }]));
  const perCar = car => {
    const metric = metrics.get(car.id);
    return {
      id: car.id, classId: car.classId, damage: round(car.damage), wrecked: car.wrecked, wreckReason: car.wreckReason,
      potholeHits: car.potholeHits, progress: round(metric.furthestS - metric.startS), completedLaps: car.completedLaps,
      s: round(car.s), lateral: round(car.lateral), speed: round(car.speed), grassSeconds: round(metric.grassSeconds),
      contactEpisodes: metric.contactEpisodes, wallEpisodes: metric.wallEpisodes, maximumAbsLateral: round(metric.maximumAbsLateral),
      wheels: car.wheels.map(wheel => ({ ...wheel })), engine: { ...car.engine },
    };
  };
  const snapshot = () => {
    const cars = sim.cars.map(perCar);
    const classes = Object.fromEntries(['stock', 'civilian'].map(classId => {
      const group = cars.filter(car => car.classId === classId);
      const sum = field => round(group.reduce((total, car) => total + car[field], 0));
      return [classId, { potholeHits: sum('potholeHits'), totalBodyDamage: sum('damage'), retired: group.filter(car => car.wrecked).length, completedLaps: sum('completedLaps'), progress: sum('progress'), contactEpisodes: sum('contactEpisodes'), wallEpisodes: sum('wallEpisodes'), grassSeconds: sum('grassSeconds') }];
    }));
    return { elapsed: round(sim.elapsed), collisionCount: sim.collisionCount, crossClassCollisions: sim.crossClassCollisions, classes, cars };
  };
  const timeSnapshots = {}, progressSnapshots = {};
  while (sim.elapsed < 60 - 1e-6 && !sim.raceComplete) {
    const previous = new Map(sim.cars.map(car => [car.id, { contact: car.contactCooldown, wall: car.wallCooldown }]));
    sim.update(step, sim.state === 'racing' && !sim.player.wrecked ? sim.aiControl(sim.player, step) : {});
    for (const car of sim.cars) {
      const metric = metrics.get(car.id), before = previous.get(car.id);
      metric.furthestS = Math.max(metric.furthestS, car.s);
      metric.maximumAbsLateral = Math.max(metric.maximumAbsLateral, Math.abs(car.lateral));
      if (sim.state !== 'countdown' && car.offTrack && !car.wrecked && car.speed > 0.8) metric.grassSeconds += step;
      if (car.contactCooldown > before.contact + 0.1) metric.contactEpisodes += 1;
      if (car.wallCooldown > before.wall + 0.1) metric.wallEpisodes += 1;
      for (const distance of [250, 500]) if (!metric.progressSnapshots[distance] && metric.furthestS - metric.startS >= distance) metric.progressSnapshots[distance] = { elapsed: round(sim.elapsed), ...perCar(car) };
    }
    for (const seconds of [30, 60]) if (!timeSnapshots[seconds] && sim.elapsed >= seconds - 1e-6) timeSnapshots[seconds] = snapshot();
    const fieldProgress = [...metrics.values()].reduce((sum, metric) => sum + metric.furthestS - metric.startS, 0);
    for (const distance of [1000, 5000, 10000]) if (!progressSnapshots[distance] && fieldProgress >= distance) progressSnapshots[distance] = snapshot();
    assert.ok(performance.now() - start < 35000, 'Opening recorder exceeded its 35-second wall bound');
  }
  const result = { seed, holes, holesSha256: hash(JSON.stringify(holes)), terminalBefore60: sim.raceComplete, final: snapshot(), timeSnapshots, progressSnapshots, individualProgressSnapshots: Object.fromEntries([...metrics].map(([id, metric]) => [id, metric.progressSnapshots])) };
  results.push(result);
  console.log(JSON.stringify({ seed, holes: holes.length, elapsed: result.final.elapsed, time30: timeSnapshots[30]?.classes, time60: timeSnapshots[60]?.classes, collisions60: result.final.collisionCount, progressCheckpoints: Object.keys(progressSnapshots) }));
}
const report = { revision, sourceSha256, catalogSha256, seeds, wallSeconds: (performance.now() - start) / 1000, boundary: 'Unchanged 20-car normal grid and seeded pothole layout. Ordinary 1/60-second updates and AI controls for all cars. No position, damage, clock, lap or RNG mutation. Class contactEpisodes count observed contact cooldown resets; collisionCount is the engine event counter. Equal-progress checkpoints use sum of each car furthest forward displacement from its initial grid position, so stopping cannot falsely improve equal-distance exposure.', results };
await writeFile(new URL(`extreme-opening-${revision}.json`, output), JSON.stringify(report, null, 2), { flag: revision === 'baseline' ? 'wx' : 'w' });
console.log(JSON.stringify({ revision, wallSeconds: round(report.wallSeconds), output: new URL(`extreme-opening-${revision}.json`, output).pathname }));
