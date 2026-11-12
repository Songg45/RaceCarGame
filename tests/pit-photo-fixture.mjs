import { mkdir, writeFile } from 'node:fs/promises';
import { RaceSimulation } from '../src/simulation.js';

const STEP = 1 / 60;
const sim = new RaceSimulation({ trackId: 'bristol', playerClass: 'stock', vehicleId: 'civic', difficulty: 0, laps: 10, seed: 20261112 });
sim.potholes = []; sim.potholeBuckets.clear(); sim.pit.serviceSeconds = 600;
sim.cars.forEach((car, index) => {
  Object.assign(car, { s: sim.pit.entryS - 110 - Math.floor(index / 2) * 13, lateral: index % 2 ? 3.2 : -3.2, speed: 16, damage: 0.55, lateralVelocity: 0, headingOffset: 0 });
  sim.updateHandling(car); sim.updateWorld(car);
});
const snapshot = () => sim.cars.map(car => ({ id: car.id, bay: car.pitBayNumber, s: car.s, lateral: car.lateral, speed: car.speed, route: car.pitRoute, pitState: car.pitState, centered: car.pitCentered, error: car.pitCenterError, wrecked: car.wrecked, reason: car.wreckReason, damage: car.damage, engine: { ...car.engine } }));
const starts = new Map(), atNinety = [];
for (let frame = 0; frame < 60 * 300; frame += 1) {
  sim.update(STEP, sim.state === 'racing' ? sim.aiControl(sim.player, STEP) : {});
  for (const car of sim.cars) if (car.pitState === 'servicing' && !starts.has(car.id)) starts.set(car.id, sim.elapsed);
  if (sim.elapsed >= 90 && !atNinety.length) atNinety.push(...snapshot());
  if (sim.cars.every(car => car.pitState === 'servicing')) break;
}
const result = { seed: 20261112, initialBoundary: 'Same two-wide road setup before entry, allbodydamage.55. Initialize during countdown before any AI consumes RNG;600s service holds earlier natural arrivals. Normalfixed-step AI physics only afterward.', elapsed: sim.elapsed, allServicing: sim.cars.every(car => car.pitState === 'servicing'), starts: [...starts].map(([id, seconds]) => ({ id, seconds })), atNinety, final: snapshot() };
await mkdir(new URL('../artifacts/straight-pits/', import.meta.url), { recursive: true });
await writeFile(new URL('../artifacts/straight-pits/photo-fixture-probe.json', import.meta.url), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ allServicing: result.allServicing, elapsed: result.elapsed, starts: result.starts, remaining: result.final.filter(car => car.pitState !== 'servicing'), at90Remaining: atNinety.filter(car => car.pitState !== 'servicing') }));
if (!result.allServicing) process.exitCode = 1;
