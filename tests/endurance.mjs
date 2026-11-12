import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { RaceSimulation } from '../src/simulation.js';

const STEP = 1 / 60;
const SEED = 20261112;
const scenarios = [
  { name: 'Easy', slug: 'easy-10', difficulty: 0, laps: 10 },
  { name: 'Medium', slug: 'medium-15', difficulty: 50, laps: 15 },
  { name: 'Extreme', slug: 'extreme-20', difficulty: 100, laps: 20 },
];
const selectedScenario = process.argv.find(argument => argument.startsWith('--scenario='))?.slice('--scenario='.length);
assert.ok(!selectedScenario || scenarios.some(scenario => scenario.slug === selectedScenario), 'Choose --scenario=easy-10, medium-15, or extreme-20.');
// Preserve the actually watched baseline. New component/pit physics writes a
// separate revision; callers may choose another new directory explicitly.
const requestedOutput = process.argv.find(argument => argument.startsWith('--output='))?.slice('--output='.length);
const outputDir = requestedOutput ? pathToFileURL(`${resolve(requestedOutput)}/`) : new URL('../artifacts/guaranteed-pit-tires/endurance/', import.meta.url);
const preservedBaseline = fileURLToPath(new URL('../artifacts/endurance/', import.meta.url)).toLowerCase().replace(/[\\/]$/, '');
assert.notEqual(fileURLToPath(outputDir).toLowerCase().replace(/[\\/]$/, ''), preservedBaseline, 'The actually watched baseline directory is preserved; choose a new output directory.');
const previousWheelRevision = fileURLToPath(new URL('../artifacts/wheel-damage/endurance/', import.meta.url)).toLowerCase().replace(/[\\/]$/, '');
assert.notEqual(fileURLToPath(outputDir).toLowerCase().replace(/[\\/]$/, ''), previousWheelRevision, 'The accepted wheel revision is historical; choose a new output directory.');
const previousStraightRevision = fileURLToPath(new URL('../artifacts/straight-pits/endurance/', import.meta.url)).toLowerCase().replace(/[\\/]$/, '');
assert.notEqual(fileURLToPath(outputDir).toLowerCase().replace(/[\\/]$/, ''), previousStraightRevision, 'The accepted straight-pit revision is historical; choose a new output directory.');
const previousAvoidanceRevision = fileURLToPath(new URL('../artifacts/manual-pits-avoidance/endurance/', import.meta.url)).toLowerCase().replace(/[\\/]$/, '');
assert.notEqual(fileURLToPath(outputDir).toLowerCase().replace(/[\\/]$/, ''), previousAvoidanceRevision, 'The accepted avoidance revision is historical; choose a new output directory.');
await mkdir(outputDir, { recursive: true });
const sourceHash = createHash('sha256').update(await readFile(new URL('../src/simulation.js', import.meta.url))).digest('hex');
const catalogHash = createHash('sha256').update(await readFile(new URL('../src/catalog.js', import.meta.url))).digest('hex');
const results = [];
const rounded = value => Number.isFinite(value) ? Number(value.toFixed(4)) : value;
const snapshot = (sim, car) => ({
  elapsed: rounded(sim.elapsed), s: rounded(car.s), lateral: rounded(car.lateral), speed: rounded(car.speed),
  damage: rounded(car.damage), completedLaps: car.completedLaps, finished: car.finished, wrecked: car.wrecked,
  potholeHits: car.potholeHits, pitState: car.pitState, inPit: car.inPit, pitTarget: car.pitTarget,
  pitRoute: car.pitRoute, assignedBay: car.assignedBayId, pitMergeCommitted: car.pitMergeCommitted,
  engine: car.engine ? { ...car.engine } : null,
});

for (const scenario of scenarios.filter(item => !selectedScenario || item.slug === selectedScenario)) {
  const wallStart = performance.now();
  const options = { trackId: 'bristol', playerClass: 'stock', vehicleId: 'civic', seed: SEED, laps: scenario.laps, difficulty: scenario.difficulty };
  const sim = new RaceSimulation(options);
  assert.equal(sim.cars.length, 20);
  assert.equal(sim.cars.filter(car => car.classId === 'stock').length, 10);
  assert.equal(sim.cars.filter(car => car.classId === 'civilian').length, 10);
  const metrics = new Map(sim.cars.map(car => [car.id, {
    pitEntries: 0, serviceStarts: 0, serviceOutcomes: [], terminal: null,
    lastPitState: car.pitState, lastInPit: car.inPit, activeService: null,
    progressS: car.s, lastProgressAt: 0, lapEvents: [], previousLaps: 0,
  }]));
  const timeline = [];
  let nextCheckpoint = 60, frames = 0, stopReason = 'all-cars-finished-or-wrecked';
  console.log(`START ${scenario.name}: ${scenario.laps} laps, difficulty ${scenario.difficulty}, seed ${SEED}, ${sim.potholes.length} potholes`);
  while (!sim.raceComplete) {
    // The sole player is driven through the same ordinary control API as the
    // visible watch mode. No positions, damage, laps, clocks, or RNG are set.
    const input = sim.state === 'racing' && !sim.player.finished && !sim.player.wrecked
      ? sim.aiControl(sim.player, STEP) : {};
    sim.update(STEP, input);
    frames += 1;
    for (const car of sim.cars) {
      const metric = metrics.get(car.id);
      for (const field of ['s', 'lateral', 'speed', 'damage']) assert.ok(Number.isFinite(car[field]), `${car.id} non-finite ${field}`);
      if (!metric.lastInPit && car.inPit) metric.pitEntries += 1;
      if (metric.lastPitState !== 'servicing' && car.pitState === 'servicing') {
        metric.serviceStarts += 1;
        metric.activeService = { startedAt: rounded(sim.elapsed), visitsBefore: car.pitVisits, damageAtStart: rounded(car.damage), s: rounded(car.s), lateral: rounded(car.lateral) };
      }
      if (metric.lastPitState === 'servicing' && car.pitState !== 'servicing') {
        metric.serviceOutcomes.push({
          ...metric.activeService, endedAt: rounded(sim.elapsed), damageAtEnd: rounded(car.damage),
          netDamageChangeDuringVisit: rounded(car.damage - (metric.activeService?.damageAtStart ?? car.damage)),
          outcome: car.pitVisits > (metric.activeService?.visitsBefore ?? car.pitVisits) ? 'service-completed' : car.wrecked ? 'destroyed-during-service' : 'service-interrupted',
          message: car.repairMessage, wrecked: car.wrecked,
        });
        metric.activeService = null;
      }
      if (car.completedLaps !== metric.previousLaps) {
        assert.equal(car.completedLaps, metric.previousLaps + 1, `${car.id} skipped a timing line`);
        metric.lapEvents.push({ lap: car.completedLaps, time: rounded(car.lapStartTime ?? sim.elapsed) });
        metric.previousLaps = car.completedLaps;
      }
      if (!metric.terminal && (car.finished || car.wrecked)) {
        metric.terminal = { result: car.finished ? 'FINISHED' : 'DNF', time: rounded(car.finished ? car.finishTime : car.wreckTime), ...snapshot(sim, car) };
        timeline.push({ carId: car.id, classId: car.classId, player: car.isPlayer, ...metric.terminal });
      }
      if (car.s > metric.progressS + 0.5 || car.pitState === 'servicing') {
        metric.progressS = Math.max(metric.progressS, car.s);
        metric.lastProgressAt = sim.elapsed;
      }
      metric.lastPitState = car.pitState;
      metric.lastInPit = car.inPit;
    }
    if (sim.elapsed >= nextCheckpoint) {
      console.log(JSON.stringify({ mode: scenario.name, elapsed: rounded(sim.elapsed), finished: sim.cars.filter(car => car.finished).length, dnf: sim.cars.filter(car => car.wrecked && !car.finished).length, active: sim.cars.filter(car => !car.finished && !car.wrecked).length, leaderLaps: Math.max(...sim.cars.map(car => car.completedLaps)), player: snapshot(sim, sim.player) }));
      nextCheckpoint += 60;
    }
    const stalled = sim.cars.filter(car => !car.finished && !car.wrecked && sim.elapsed - metrics.get(car.id).lastProgressAt > 180);
    if (stalled.length) { stopReason = 'incomplete-stalled-driver-watchdog'; break; }
    if (sim.elapsed > 7200) { stopReason = 'incomplete-two-simulated-hours-watchdog'; break; }
    if (performance.now() - wallStart > 40000) { stopReason = 'incomplete-forty-wall-seconds-watchdog'; break; }
  }
  const overall = sim.getStandings();
  const cars = overall.map((car, index) => {
    const metric = metrics.get(car.id);
    return {
      id: car.id, name: car.name, number: car.number, classId: car.classId, isPlayer: car.isPlayer,
      overallPosition: index + 1, classPosition: sim.getStandings(car.classId).findIndex(item => item.id === car.id) + 1,
      result: car.finished ? 'FINISHED' : car.wrecked ? 'DNF' : 'RUNNING', completedLaps: car.completedLaps,
      finishTime: rounded(car.finishTime), wreckTime: rounded(car.wreckTime), wreckReason: car.wreckReason,
      physicallyWreckedAfterFinish: car.finished && car.wrecked,
      wheelComponents: car.wheels ? car.wheels.map(wheel => ({ ...wheel })) : null,
      engine: car.engine ? { ...car.engine } : null,
      handling: car.handling ? { ...car.handling } : null,
      assignedPitBay: car.assignedBayId ?? null,
      damage: rounded(car.damage), potholeHitsAtTermination: metric.terminal?.potholeHits ?? null,
      potholeHitsAtFieldCompletion: car.potholeHits, pitEntries: metric.pitEntries,
      serviceStarts: metric.serviceStarts, serviceOutcomes: metric.serviceOutcomes,
      lapEvents: metric.lapEvents, terminalSnapshot: metric.terminal, finalSnapshot: snapshot(sim, car),
      secondsSinceLastForwardProgress: rounded(sim.elapsed - metric.lastProgressAt),
    };
  });
  const result = {
    scenario, options, simulationSourceSha256: sourceHash, catalogSourceSha256: catalogHash, trackLengthMeters: sim.track.length, trackMiles: sim.track.miles, fixedStepSeconds: STEP,
    raceComplete: sim.raceComplete, terminationReason: stopReason,
    simulatedRaceSeconds: rounded(sim.elapsed), simulatedCountdownSeconds: 3,
    harnessWallSeconds: rounded((performance.now() - wallStart) / 1000), frames,
    potholes: sim.potholes.length, finished: cars.filter(car => car.result === 'FINISHED').length,
    dnf: cars.filter(car => car.result === 'DNF').length, stillRunning: cars.filter(car => car.result === 'RUNNING').length,
    collisionCount: sim.collisionCount, crossClassCollisions: sim.crossClassCollisions,
    totalPotholeHits: sim.cars.reduce((sum, car) => sum + car.potholeHits, 0),
    pitServiceStarts: cars.reduce((sum, car) => sum + car.serviceStarts, 0),
    completedPitServices: cars.flatMap(car => car.serviceOutcomes).filter(outcome => outcome.outcome === 'service-completed').length,
    destroyedDuringService: cars.flatMap(car => car.serviceOutcomes).filter(outcome => outcome.outcome === 'destroyed-during-service').length,
    player: cars.find(car => car.isPlayer), cars, timeline,
    verificationBoundary: 'Fast headless engine endurance; untouched normal grid; ordinary fixed-step updates with AI controls; no position/lap/damage/time injection. Separate from the normal-speed visible watch series.',
  };
  assert.equal(result.finished + result.dnf + result.stillRunning, 20);
  if (result.raceComplete) {
    assert.equal(result.stillRunning, 0);
    for (const car of cars.filter(item => item.result === 'FINISHED')) assert.equal(car.completedLaps, scenario.laps);
  } else process.exitCode = 1;
  results.push(result);
  await writeFile(new URL(`${scenario.slug}.json`, outputDir), JSON.stringify(result, null, 2));
  console.log(`END ${scenario.name}: ${result.raceComplete ? 'COMPLETE' : 'INCOMPLETE'}, ${result.finished} finished / ${result.dnf} DNF / ${result.stillRunning} running; ${result.simulatedRaceSeconds}s simulated, ${result.harnessWallSeconds}s wall`);
}

// Independent serial runs can accumulate one revision's report without rerunning
// earlier races or importing outcomes from the preserved pre-upgrade baseline.
if (selectedScenario) {
  for (const scenario of scenarios.filter(item => item.slug !== selectedScenario)) {
    try {
      const previous = JSON.parse(await readFile(new URL(`${scenario.slug}.json`, outputDir), 'utf8'));
      if (previous.simulationSourceSha256 === sourceHash && previous.catalogSourceSha256 === catalogHash) results.push(previous);
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  results.sort((a, b) => scenarios.findIndex(item => item.slug === a.scenario.slug) - scenarios.findIndex(item => item.slug === b.scenario.slug));
}

await writeFile(new URL('summary.json', outputDir), JSON.stringify({ seed: SEED, simulationSourceSha256: sourceHash, catalogSourceSha256: catalogHash, results: results.map(({ cars, timeline, player, ...result }) => ({ ...result, player: { result: player.result, completedLaps: player.completedLaps, classPosition: player.classPosition, overallPosition: player.overallPosition, finishTime: player.finishTime, wreckTime: player.wreckTime, wreckReason: player.wreckReason } })) }, null, 2));
const elapsedLabel = seconds => `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
const report = [
  '# Autonomous race endurance report — guaranteed four-tire service', '',
  'Run each scenario serially: `node tests/endurance.mjs --scenario=easy-10`, then `--scenario=medium-15`, then `--scenario=extreme-20`.', '',
  '**This report covers fast, independent engine runs. The normal-speed visible browser watch series is a separate run and must be observed separately.**', '',
  `All scenarios used the unmodified 20-car starting grid, Thunder Bowl (Bristol inspired), stock player #88, seed **${SEED}**, and fixed 1/60-second updates. Medium means slider **50**, the midpoint. All movement, damage, laps, pit visits, and retirement events came from ordinary engine updates and AI controls; no positions, laps, damage, clocks, or random state were injected.`, '',
  '| Scenario | Scheduled laps | Potholes | Finished | DNF | Still racing | Field terminal time | Player outcome |',
  '| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |',
  ...results.map(result => `| ${result.scenario.name} (${result.scenario.difficulty}) | ${result.scenario.laps} | ${result.potholes} | ${result.finished} | ${result.dnf} | ${result.stillRunning} | ${elapsedLabel(result.simulatedRaceSeconds)} | ${result.player.result === 'FINISHED' ? `P${result.player.classPosition} stock / P${result.player.overallPosition} overall at ${elapsedLabel(result.player.finishTime)}` : `DNF after ${result.player.completedLaps} completed laps at ${elapsedLabel(result.player.wreckTime)}`} |`), '',
  'Finished drivers reached the scheduled distance. DNF drivers retired before completing it. Complete field attrition is a terminal race simulation, not a completed scheduled distance. A watchdog result is explicitly incomplete; no running driver is silently removed.', '',
  '| Scenario | Contacts | Cross-class contacts | Pothole impacts | Service starts | Completed services | Destroyed during service |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...results.map(result => `| ${result.scenario.name} | ${result.collisionCount} | ${result.crossClassCollisions} | ${result.totalPotholeHits} | ${result.pitServiceStarts} | ${result.completedPitServices} | ${result.destroyedDuringService} |`), '',
  'Contact and pothole totals run until the whole field terminates, including coasting after an individual finish. The JSON separates each car\'s terminal snapshot from its final field-completion snapshot. Pit damage deltas are net changes between service start and end: another car may collide with a car during service. The recorded repair message reports the crew outcome. A wreck during unfinished service is not counted as a completed repair.', '',
  '## Full classifications', '',
  ...results.flatMap(result => [
    `### ${result.scenario.name} — ${result.scenario.laps} scheduled laps`, '',
    `[Detailed per-car data and event timeline](${result.scenario.slug}.json). Maximum completed laps: **${Math.max(...result.cars.map(car => car.completedLaps))}**. Termination: \`${result.terminationReason}\`.`, '',
    '| Overall | Class rank | Car | Result | Laps | Finish / wreck time | Wreck cause | Pothole hits at termination | Completed pit services |',
    '| ---: | --- | --- | --- | ---: | --- | --- | ---: | ---: |',
    ...result.cars.map(car => `| ${car.overallPosition} | ${car.classId} ${car.classPosition} | #${car.number} ${car.name}${car.isPlayer ? ' (player)' : ''} | ${car.result} | ${car.completedLaps} | ${elapsedLabel(car.finishTime ?? car.wreckTime ?? result.simulatedRaceSeconds)} | ${car.wreckReason || '—'} | ${car.potholeHitsAtTermination ?? car.potholeHitsAtFieldCompletion} | ${car.serviceOutcomes.filter(outcome => outcome.outcome === 'service-completed').length} |`), '',
  ]),
  '## Reproducibility and limits', '',
  `Simulation source SHA-256: \`${sourceHash}\`. The harness checks finite state, sequential timing-line crossings, exactly 10+10 cars, all finishers reaching their scheduled lap count, and all 20 cars being terminal before declaring completion. Stalled drivers or a two-hour simulation watchdog produce an explicitly incomplete result.`, '',
  `Track catalog SHA-256: \`${catalogHash}\`. The expanded game circuit has an actual lap distance of ${results[0]?.trackLengthMeters.toFixed(3)} meters (${results[0]?.trackMiles.toFixed(3)} miles); its historical venue inspiration is not a claim that the expanded game track retains the real venue's dimensions.`, '',
  'A single deterministic seed demonstrates these exact races, not general difficulty balance or every possible random layout. The wheel and pit revision has separate results from the earlier actually watched baseline. Pothole hits now count individual wheel contacts, so their totals are not directly comparable with the earlier car-level counter. The three-second countdown is excluded from reported race times. Fast engine wall time does not demonstrate the user-visible normal-speed watch elapsed time.', '',
  '[Machine-readable summary](summary.json).', '',
].join('\n');
await writeFile(new URL('ENDURANCE-REPORT.md', outputDir), report);
console.log(JSON.stringify({ allComplete: results.every(result => result.raceComplete), artifacts: outputDir.pathname }));
