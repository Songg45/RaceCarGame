import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const output = new URL('../artifacts/driving-rubberband/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const deadline = setTimeout(() => browser.close(), 75000); deadline.unref();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
const errors = [], runs = [];
const phase = process.env.CONTINUITY_PHASE || 'baseline';
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.addInitScript(() => {
  const original = window.requestAnimationFrame;
  window.requestAnimationFrame = callback => original.call(window, timestamp => {
    window.__qaFrameTime = timestamp;
    callback(timestamp);
  });
});
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.floor(values.length * p))] ?? 0;
try {
  for (const scenario of [{ name: 'clear-straight', difficulty: 0, clear: true }, { name: 'normal-grid-easy', difficulty: 0 }, { name: 'normal-grid-extreme', difficulty: 100 }].filter(item => phase === 'baseline' || item.name !== 'normal-grid-easy')) {
    await page.goto(process.env.RACE_URL || 'http://127.0.0.1:4173/');
    await page.waitForFunction(() => Boolean(window.__SPLIT_GRID__));
    await page.locator('#track').selectOption('daytona');
    await page.locator('#difficulty').fill(String(scenario.difficulty));
    await page.locator('#start').click();
    await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.state === 'racing');
    await page.evaluate(scenario => {
      const { simulation: sim, renderer: view } = window.__SPLIT_GRID__;
      if (scenario.clear) {
        sim.potholes = []; sim.potholeBuckets.clear();
        sim.cars.filter(car => !car.isPlayer).forEach((car, index) => {
          car.s = sim.track.length * .65 + index * 12;
          sim.wreckCar(car, 'Controlled clear-road continuity isolation');
        });
        Object.assign(sim.player, { s: -sim.track.straightLength / 2 + 60, lateral: 0, speed: 0, lateralVelocity: 0, headingOffset: 0 });
        sim.updateWorld(sim.player); view.cameraReady = false;
      }
      const trace = window.__continuityTrace = { frames: [], corrections: [], updates: [], started: performance.now() };
      const originalUpdate = sim.update.bind(sim), originalCollision = sim.resolveCollisions.bind(sim), originalRender = view.render.bind(view);
      view.__qaOriginalRender = originalRender;
      sim.update = (dt, input) => {
        const before = performance.now(), elapsed = sim.elapsed;
        originalUpdate(dt, input);
        trace.updates.push({ dt, elapsed: sim.elapsed, simulatedDelta: sim.elapsed - elapsed, cpuMs: performance.now() - before });
      };
      sim.resolveCollisions = () => {
        const before = sim.cars.map(car => [car.s, car.lateral]);
        originalCollision();
        sim.cars.forEach((car, i) => {
          const ds = car.s - before[i][0], dl = car.lateral - before[i][1];
          if (Math.abs(ds) > .001 || Math.abs(dl) > .001) trace.corrections.push({ elapsed: sim.elapsed, id: car.id, player: car.isPlayer, ds, dl, speed: car.speed });
        });
      };
      view.render = (...args) => {
        const before = performance.now(); originalRender(...args); const renderCpuMs = performance.now() - before;
        const car = sim.player, mesh = view.carMeshes.get(car.id), projected = mesh.position.clone().project(view.camera);
        const relative = mesh.position.clone().sub(view.camera.position);
        trace.frames.push({ now: window.__qaFrameTime, dt: args[1], elapsed: sim.elapsed, accumulator: sim.accumulator,
          s: car.s, lateral: car.lateral, speed: car.speed, world: [car.x, car.y, car.z], mesh: mesh.position.toArray(),
          camera: view.camera.position.toArray(), lookAt: view.lookAt.toArray(), projected: [projected.x, projected.y],
          cameraForwardDistance: relative.x * Math.sin(car.heading) + relative.z * Math.cos(car.heading),
          collisions: sim.collisionCount, potholeHits: car.potholeHits, wrecked: car.wrecked, renderCpuMs,
          field: sim.cars.map(other => [other.id, other.s, other.lateral, other.speed]) });
      };
    }, scenario);
    await page.keyboard.down('w');
    await page.waitForTimeout(12000);
    await page.keyboard.up('w');
    await page.keyboard.press('p');
    const trace = await page.evaluate(() => window.__continuityTrace);
    const frames = trace.frames.filter(frame => frame.elapsed > trace.frames[0].elapsed + 2);
    const deltas = frames.slice(1).map((frame, index) => ({ ds: frame.s - frames[index].s, screenY: (frame.projected[1] - frames[index].projected[1]) * 384,
      cameraDistance: frame.cameraForwardDistance - frames[index].cameraForwardDistance, rawMs: frame.now - frames[index].now, simulatedDelta: frame.elapsed - frames[index].elapsed }));
    const summary = { ...scenario, frames: frames.length, firstElapsed: frames[0]?.elapsed, lastElapsed: frames.at(-1)?.elapsed,
      minForwardStep: Math.min(...deltas.map(item => item.ds)), backwardFrames: deltas.filter(item => item.ds < -.001).length,
      largestScreenVerticalStepPixels: Math.max(...deltas.map(item => Math.abs(item.screenY))),
      cameraDistanceStepRange: [Math.min(...deltas.map(item => item.cameraDistance)), Math.max(...deltas.map(item => item.cameraDistance))],
      rawFrameMsP50: percentile(deltas.map(item => item.rawMs), .5), rawFrameMsP95: percentile(deltas.map(item => item.rawMs), .95),
      updateCpuMsP95: percentile(trace.updates.map(item => item.cpuMs), .95), renderSubmissionCpuMsP95: percentile(frames.map(item => item.renderCpuMs), .95),
      playerCollisionCorrections: trace.corrections.filter(item => item.player), final: frames.at(-1),
      boundary: scenario.clear ? 'Declared clear-road starting pose and removed hazards/isolated opponents, then actual held W with normal timing. No subsequent state injection.' : 'Unmodified grid and hazards, actual held W with normal timing.' };
    runs.push(summary);
    await writeFile(new URL(`${phase === 'baseline' ? '' : `${phase}-`}${scenario.name}-trace.json`, output), JSON.stringify(trace));
    await page.screenshot({ path: fileURLToPath(new URL(`${phase === 'baseline' ? '' : `${phase}-`}${scenario.name}.png`, output)) });
    console.log(JSON.stringify({ name: summary.name, frames: summary.frames, backwardFrames: summary.backwardFrames, minForwardStep: summary.minForwardStep, screenStep: summary.largestScreenVerticalStepPixels, updateP95: summary.updateCpuMsP95 }));
  }
  let cameraChecks = null;
  if (phase !== 'baseline') {
    const recorded = JSON.parse(await readFile(new URL('clear-straight-replay-fixture.json', output), 'utf8'));
    cameraChecks = await page.evaluate(recorded => {
      const { simulation: original, renderer: view } = window.__SPLIT_GRID__;
      view.render = view.__qaOriginalRender;
      original.state = 'paused';
      const sim = original.restart(), car = sim.player;
      sim.state = 'paused'; view.setRace(sim); view.mode = 'chase'; view.cameraReady = false;
      const point = () => {
        const mesh = view.carMeshes.get(car.id), screen = mesh.position.clone().project(view.camera);
        return { s: car.s, world: [car.x, car.y, car.z], mesh: mesh.position.toArray(), camera: view.camera.position.toArray(),
          look: view.lookAt.toArray(), screen: [screen.x, screen.y], gap: (car.x - view.camera.position.x) * Math.sin(car.heading) + (car.z - view.camera.position.z) * Math.cos(car.heading) };
      };
      const pose = (s, lateral = 0) => { Object.assign(car, { s, lateral, speed: 30, lateralVelocity: 0, headingOffset: 0 }); sim.updateWorld(car); };
      const replay = [];
      for (const frame of recorded.frames) {
        Object.assign(car, { s: frame.s, lateral: frame.lateral, speed: frame.speed }); sim.elapsed = frame.elapsed; sim.updateWorld(car);
        view.render(sim, frame.dt, false, false);
        replay.push({ elapsed: frame.elapsed, ...point() });
      }
      const modes = [];
      for (const mode of ['chase', 'hood', 'overhead', 'pit']) {
        pose(-100); view.mode = mode; view.cameraReady = false; view.render(sim, 1 / 60, false, false); const before = point();
        pose(-95); view.render(sim, 1 / 60, false, false); const moved = point();
        view.render(sim, 1 / 60, false, false); const paused = point();
        modes.push({ mode, before, moved, paused });
      }
      view.mode = 'chase'; view.cameraReady = false;
      const turns = [];
      for (let offset = -10; offset <= 30; offset += .5) {
        pose(sim.track.straightLength / 2 + offset); view.render(sim, 1 / 60, false, false); turns.push(point());
      }
      // A real recovery call changes lateral pose only; camera must travel with it.
      pose(0, -sim.track.width / 2 - 10); sim.state = 'racing'; view.cameraReady = false; view.render(sim, 1 / 60, false, false);
      const recoveryBefore = point(), recovered = sim.recoverPlayer(); view.render(sim, 1 / 60, false, false); const recoveryAfter = point();
      // Ordinary collision processing remains visible: no visual interpolation may
      // conceal its corrected position. Other fixture cars stay far from this pair.
      sim.cars.filter(other => other !== car).forEach((other, index) => { other.s = sim.track.length * .65 + index * 12; sim.wreckCar(other, 'Camera collision isolation'); });
      const other = sim.cars.find(driver => driver !== car);
      pose(0); Object.assign(other, { s: 3, lateral: 0, speed: 0, wrecked: false, damage: 0, status: 'racing', contactCooldown: 0 });
      car.contactCooldown = 0; sim.updateWorld(other);
      view.cameraReady = false; view.render(sim, 1 / 60, false, false); const collisionBefore = point();
      sim.update(1 / 120, { throttle: 1 }); view.render(sim, 1 / 120, false, false); const collisionAfter = point();
      // A changed spectator focus and a fresh race must reset away from the old rig.
      sim.wreckCar(car, 'Controlled focus transition'); view.render(sim, 1 / 60, false, true);
      const focus = { expected: other.id, actual: view.focusCarId, camera: view.camera.position.toArray() };
      const fresh = sim.restart(); view.setRace(fresh); const resetBefore = view.cameraReady; view.render(fresh, 1 / 60, false, false);
      const reset = { before: resetBefore, after: view.cameraReady, focus: view.focusCarId, expected: fresh.player.id, camera: view.camera.position.toArray() };
      return { replay, modes, turns, recovery: { recovered, before: recoveryBefore, after: recoveryAfter }, collision: { before: collisionBefore, after: collisionAfter, contacts: sim.collisionCount }, focus, reset };
    }, recorded);
    const steady = cameraChecks.replay.filter(frame => frame.elapsed > 8);
    const gaps = steady.map(frame => frame.gap), screenSteps = steady.slice(1).map((frame, i) => Math.abs(frame.screen[1] - steady[i].screen[1]) * 384);
    cameraChecks.replaySummary = { samples: steady.length, gapRangeMeters: Math.max(...gaps) - Math.min(...gaps), largestScreenStepPixels: Math.max(...screenSteps), boundary: 'Exact recorded baseline world poses and frame dt replayed through candidate renderer; this fixture does not advance game physics.' };
    assert.ok(cameraChecks.replaySummary.gapRangeMeters < 1e-6);
    assert.ok(cameraChecks.replaySummary.largestScreenStepPixels < 1e-6);
    for (const test of cameraChecks.modes) {
      const delta = test.moved.camera.map((value, axis) => value - test.before.camera[axis]);
      const expected = test.mode === 'pit' ? [0, 0, 0] : [5, 0, 0];
      expected.forEach((value, axis) => assert.ok(Math.abs(delta[axis] - value) < 1e-8, `${test.mode} anchored translation`));
      test.paused.camera.forEach((value, axis) => assert.ok(Math.abs(value - test.moved.camera[axis]) < 1e-8, `${test.mode} pause`));
    }
    for (const frame of [...cameraChecks.replay, ...cameraChecks.turns]) {
      assert.ok([...frame.camera, ...frame.screen, ...frame.mesh].every(Number.isFinite));
      assert.ok(Math.abs(frame.mesh[0] - frame.world[0]) < 1e-9 && Math.abs(frame.mesh[2] - frame.world[2]) < 1e-9, 'rendered position must retain the exact physical pose');
    }
    assert.equal(cameraChecks.recovery.recovered, true);
    assert.equal(cameraChecks.recovery.before.s, cameraChecks.recovery.after.s);
    assert.ok(cameraChecks.collision.contacts > 0);
    assert.ok(cameraChecks.collision.after.s < cameraChecks.collision.before.s, 'ordinary collision correction must still occur');
    assert.equal(cameraChecks.focus.actual, cameraChecks.focus.expected);
    assert.equal(cameraChecks.reset.before, false); assert.equal(cameraChecks.reset.after, true); assert.equal(cameraChecks.reset.focus, cameraChecks.reset.expected);
    assert.ok(runs.find(run => run.clear).largestScreenVerticalStepPixels < .01, 'actual clear-road held-W drive should retain a stable projected car');
  }
  await writeFile(new URL(`${phase}-browser.json`, output), JSON.stringify({ errors, runs, cameraChecks }, null, 2));
  assert.equal(errors.length, 0);
} catch (error) {
  await writeFile(new URL(`${phase}-browser-failure.json`, output), JSON.stringify({ error: String(error.stack || error), errors, runs }, null, 2));
  throw error;
} finally { clearTimeout(deadline); await browser.close(); }
