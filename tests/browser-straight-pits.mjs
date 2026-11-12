import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const baseURL = process.env.RACE_URL || 'http://127.0.0.1:4174/';
const directory = new URL('../artifacts/straight-pits/', import.meta.url);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const deadline = setTimeout(() => browser.close(), 60000); deadline.unref();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const shot = name => page.screenshot({ path: fileURLToPath(new URL(name, directory)), fullPage: true });

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__SPLIT_GRID__));
  await page.locator('#track').selectOption('bristol');
  await page.waitForTimeout(350);
  const trackInfo = await page.evaluate(() => {
    const sim = window.__SPLIT_GRID__.simulation;
    return { length: sim.track.length, miles: sim.track.miles, referenceMiles: sim.track.referenceMiles, straight: sim.track.straightLength, entry: sim.pit.entryS, exit: sim.pit.exitS };
  });
  assert.ok(trackInfo.straight >= 600 && trackInfo.miles > 1);
  await shot('expanded-straight-garage.png');
  checks.push({ check: 'Expanded game distance and complete pit row fit a straight home stretch', trackInfo });
  await page.locator('#watch-series').click();
  await page.keyboard.press('p');
  await page.waitForFunction(() => window.__SPLIT_GRID__.watch.paused);
  const setup = await page.evaluate(() => {
    const { simulation: sim } = window.__SPLIT_GRID__;
    sim.potholes = []; sim.potholeBuckets.clear();
    sim.pit.serviceSeconds = 600;
    sim.cars.forEach((car, index) => {
      Object.assign(car, { s: sim.pit.entryS - 110 - Math.floor(index / 2) * 13, lateral: index % 2 ? 3.2 : -3.2, speed: 16, damage: 0.55, lateralVelocity: 0, headingOffset: 0 });
      sim.updateHandling(car); sim.updateWorld(car);
    });
    window.__qaPitArrivals = [];
    const request = sim.requestPitService.bind(sim);
    sim.requestPitService = (car = sim.player) => {
      const before = [car.s, car.lateral, car.headingOffset];
      const accepted = request(car);
      if (accepted) window.__qaPitArrivals.push({ id: car.id, classId: car.classId, bay: car.pitBayNumber, time: sim.elapsed, error: { ...car.pitCenterError }, centered: car.pitCentered, wholeChassisInside: car.pitInBay, speed: car.speed, positionShift: Math.hypot(car.s - before[0], car.lateral - before[1]), headingShift: car.headingOffset - before[2] });
      return accepted;
    };
    return { serviceSeconds: sim.pit.serviceSeconds, initial: sim.cars.map(car => ({ id: car.id, s: car.s, lateral: car.lateral })), boundary: 'All cars begin on the racing surface before the entrance during countdown. Only initial poses/body damage and an extended600-second service fixture are set. The live watch controller stays paused while ordinary1/60 engine ticks and AI controls are accelerated for the photo. No later positions/headings are injected; this is not a real-time watch.' };
  });
  checks.push({ check: 'Declared photo fixture initialized before driving', setup });
  const physicalRun = await page.evaluate(() => {
    const sim = window.__SPLIT_GRID__.simulation;
    sim.togglePause();
    for (let frame = 0; frame < 60 * 300; frame += 1) {
      sim.update(1 / 60, sim.state === 'racing' ? sim.aiControl(sim.player, 1 / 60) : {});
      if (sim.cars.every(car => car.pitState === 'servicing')) break;
    }
    const allServicing = sim.cars.every(car => car.pitState === 'servicing');
    const result = { allServicing, elapsed: sim.elapsed, cars: sim.cars.map(car => ({ id: car.id, s: car.s, lateral: car.lateral, speed: car.speed, route: car.pitRoute, pitState: car.pitState, error: car.pitCenterError, wrecked: car.wrecked, reason: car.wreckReason })) };
    sim.togglePause();
    return result;
  });
  assert.equal(physicalRun.allServicing, true, JSON.stringify(physicalRun));
  // Let the normal paused UI cycle consume the accelerated simulation state
  // before photographing it; otherwise the original countdown HUD is stale.
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#countdown').isVisible(), false);
  const arrivals = await page.evaluate(() => window.__qaPitArrivals);
  assert.equal(new Set(arrivals.map(car => car.id)).size, 20);
  assert.equal(new Set(arrivals.map(car => car.bay)).size, 20);
  assert.equal(new Set(arrivals.filter(car => car.classId === 'stock').map(car => car.id)).size, 10);
  for (const car of arrivals) {
    assert.equal(car.centered && car.wholeChassisInside, true);
    assert.ok(Math.abs(car.error.longitudinal) <= 0.25 && Math.abs(car.error.lateral) <= 0.15 && Math.abs(car.error.heading) <= 0.04);
    assert.equal(car.positionShift, 0); assert.equal(car.headingShift, 0);
  }
  const parked = await page.evaluate(() => window.__SPLIT_GRID__.simulation.cars.map(car => [car.id, car.s, car.lateral, car.headingOffset]));
  await page.evaluate(() => {
    const { simulation: sim, renderer: view } = window.__SPLIT_GRID__;
    document.querySelector('#pause-overlay').classList.add('hidden');
    document.querySelector('#watch-banner').style.visibility = 'hidden';
    view.mode = 'overhead'; view.cameraReady = false; view.render(sim, 0, false, false);
    view.camera.position.set(sim.player.x, 26, sim.player.z + 18);
    view.camera.lookAt(sim.player.x, 0, sim.player.z);
    view.renderer.render(view.scene, view.camera); view.needsRender = false;
  });
  await shot('physically-centered-own-bay.png');
  await page.evaluate(() => {
    const { simulation: sim, renderer: view } = window.__SPLIT_GRID__;
    document.querySelector('#race-ui').style.visibility = 'hidden';
    view.mode = 'pit'; view.cameraReady = false; view.render(sim, 0, false, false); view.needsRender = false;
  });
  await shot('twenty-physically-parked-straight-bays.png');
  const visuals = await page.evaluate(() => {
    const { simulation: sim, renderer: view } = window.__SPLIT_GRID__;
    return sim.cars.map(car => {
      const visual = view.bayVisuals.get(car.id), mesh = view.carMeshes.get(car.id);
      return { id: car.id, center: visual.center, outlineLength: visual.outlineLength, outlineWidth: visual.outlineWidth, bodyLength: car.spec.length, bodyWidth: car.spec.width, meshPosition: { x: mesh.position.x, z: mesh.position.z }, carPosition: { x: car.x, z: car.z } };
    });
  });
  assert.deepEqual(await page.evaluate(() => window.__SPLIT_GRID__.simulation.cars.map(car => [car.id, car.s, car.lateral, car.headingOffset])), parked, 'camera-only screenshots cannot alter any car pose');
  for (const visual of visuals) {
    assert.ok(visual.outlineLength > visual.bodyLength && visual.outlineWidth > visual.bodyWidth);
    assert.deepEqual(visual.meshPosition, visual.carPosition);
  }
  checks.push({ check: 'All20 physically arrive centered/aligned in their own straight bays without service snapping; graphics match actual poses', setup, physicalRun, arrivals, visuals, screenshotBoundary: 'Accelerated ordinary physics, not real-time watch. Closeup changes the camera only and hides the normal-speed banner. Full-row photo hides HUD only. Cars are paused after actual AI driving;600-second service holds earlier arrivals for the picture. Normal five-second service/exit is verified separately by the60-car engine run.' });

  // Separate targeted UI fixture. The full45-second guard is exercised with
  // ordinary engine ticks in unit tests; here a declared clock advance exposes
  // its modal/export/retry actions without another minute of browser workload.
  await page.evaluate(() => { document.querySelector('#race-ui').style.visibility = ''; document.querySelector('#watch-banner').style.visibility = ''; });
  await page.locator('#watch-garage').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-class="civilian"]').click();
  await page.locator('#start').click();
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.state === 'racing');
  await page.evaluate(() => {
    const { simulation: sim, renderer: view } = window.__SPLIT_GRID__;
    view.mode = 'chase'; view.cameraReady = false; view.needsRender = true;
    sim.player.damage = 0.35;
    Object.assign(sim.player.engine, { heat: 0.88, wear: 0.3, status: 'critical', cooling: true });
  });
  await page.waitForTimeout(350);
  assert.equal(await page.locator('#engine-condition').isVisible(), true);
  assert.match(await page.locator('#engine-heat').textContent(), /%/);
  assert.match(await page.locator('#engine-health').textContent(), /70/);
  const mobileLayout = await page.evaluate(() => {
    const telemetry = document.querySelector('.telemetry').getBoundingClientRect(), touch = document.querySelector('.touch-controls').getBoundingClientRect();
    return { bottom: telemetry.bottom, pedalsTop: touch.top, overflow: document.documentElement.scrollWidth > innerWidth };
  });
  assert.equal(mobileLayout.overflow, false); assert.ok(mobileLayout.bottom <= mobileLayout.pedalsTop);
  await shot('mobile-controlled-engine-heat.png');
  await page.evaluate(() => { Object.assign(window.__SPLIT_GRID__.simulation.player.engine, { heat: 0, wear: 0.8, cooling: false, heatRate: 0 }); });
  await page.waitForTimeout(250);
  const coldWearWarning = await page.locator('#engine-warning').textContent();
  assert.match(coldWearWarning, /ENGINE WEAR|NEEDS PIT REPAIR/i);
  assert.doesNotMatch(coldWearWarning, /CRITICAL HEAT|LEAVE GRASS/i);
  assert.match(await page.locator('#engine-heat').textContent(), /0%/);
  assert.match(await page.locator('#engine-health').textContent(), /20/);
  await shot('mobile-controlled-cold-engine-wear.png');
  const bodyBeforeBurn = await page.evaluate(() => {
    const sim = window.__SPLIT_GRID__.simulation;
    const body = sim.player.damage;
    sim.player.engine.wear = 1;
    sim.updateEngine(sim.player, { throttle: 0 }, 1 / 60);
    return body;
  });
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.wrecked);
  await page.waitForTimeout(150);
  const burnState = await page.evaluate(() => {
    const { simulation: sim, renderer: view } = window.__SPLIT_GRID__;
    return { damage: sim.player.damage, engine: { ...sim.player.engine }, wrecked: sim.player.wrecked, bodyScale: view.carMeshes.get(sim.player.id).scale.y, repair: sim.requestPitService(), recover: sim.recoverPlayer() };
  });
  assert.equal(burnState.damage, bodyBeforeBurn); assert.equal(burnState.engine.status, 'burnt');
  assert.equal(burnState.bodyScale, 1); assert.equal(burnState.repair, false); assert.equal(burnState.recover, false);
  await shot('controlled-engine-burn-retirement.png');
  checks.push({ check: 'Controlled engine heat/wear HUD fits mobile; cold wear is distinguished from heat; engine-only retirement preserves structural body condition and shape', mobileLayout, coldWearWarning, burnState, boundary: 'Explicit heat/wear fixtures exercise UI only. Natural grass-driving warning/wear/burn timing and permanent failure are separately verified by ordinary engine-drive tests.' });
  await page.locator('#results-garage').click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('#watch-series').click();
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.state === 'racing');
  await page.evaluate(() => {
    const sim = window.__SPLIT_GRID__.simulation;
    window.__qaStallSimulation = sim; window.__qaStallOriginalAI = sim.aiControl.bind(sim);
    sim.aiControl = () => ({ throttle: 0, brake: 1, steer: 0 });
    for (const car of sim.cars) { car.speed = 0; car.lateralVelocity = 0; }
    sim.elapsed += 46;
  });
  await page.waitForFunction(() => window.__SPLIT_GRID__.watch.phase === 'stalled');
  await page.waitForFunction(() => document.querySelector('#series-title').textContent === 'Traffic stalled.');
  assert.equal(await page.locator('#series-title').textContent(), 'Traffic stalled.');
  assert.equal(await page.locator('#series-next').isVisible(), false);
  assert.equal(await page.locator('#series-retry').isVisible(), true);
  await shot('stalled-traffic-review.png');
  const downloadReady = page.waitForEvent('download');
  await page.locator('#series-export').click();
  const download = await downloadReady;
  const exportPath = fileURLToPath(new URL('controlled-stall-export.json', directory));
  await download.saveAs(exportPath);
  const exported = JSON.parse(await readFile(exportPath, 'utf8'));
  assert.equal(exported.results.length, 0);
  assert.equal(exported.unfinishedRace.raceComplete, false);
  assert.equal(exported.unfinishedRace.standings.filter(car => car.status === 'racing').length, 20);
  assert.ok(exported.unfinishedRace.standings.every(car => car.engine && Number.isFinite(car.engine.heat) && Number.isFinite(car.engine.wear)));
  await page.evaluate(() => { window.__SPLIT_GRID__.simulation.aiControl = window.__qaStallOriginalAI; });
  await page.locator('#series-retry').click();
  assert.equal(await page.evaluate(() => window.__SPLIT_GRID__.simulation === window.__qaStallSimulation), true);
  await page.waitForFunction(() => window.__SPLIT_GRID__.watch.phase === 'racing' && !window.__SPLIT_GRID__.watch.paused);
  checks.push({ check: 'Controlled no-progress UI fixture offers honest unfinished export and retries the same race; noNext or forcedDNF', boundary: 'Separate fresh race with brake-only AI and an explicit46-second clock advance. Full guard timing is verified independently by normal fixed-step controller tests.' });
  assert.deepEqual(errors, []);
  await writeFile(new URL('browser-straight-pits.json', directory), JSON.stringify({ passed: true, baseURL, checks, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, checks: checks.length, physicalArrivals: arrivals.length, errors }));
} catch (error) {
  const failureState = await page.evaluate(() => {
    const app = window.__SPLIT_GRID__; if (!app?.simulation) return null;
    return { watch: app.watch, elapsed: app.simulation.elapsed, cars: app.simulation.cars.map(car => ({ id: car.id, s: car.s, lateral: car.lateral, speed: car.speed, route: car.pitRoute, pitState: car.pitState, error: car.pitCenterError, wrecked: car.wrecked, reason: car.wreckReason })) };
  }).catch(() => null);
  await shot('straight-pit-browser-failure.png').catch(() => {});
  await writeFile(new URL('browser-straight-pits.json', directory), JSON.stringify({ passed: false, baseURL, checks, errors, failure: error.stack, failureState }, null, 2));
  throw error;
} finally { clearTimeout(deadline); await browser.close(); }
