import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const baseURL = process.env.RACE_URL || 'http://127.0.0.1:4174/';
const directory = new URL('../artifacts/street-classes/', import.meta.url);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const deadline = setTimeout(() => browser.close(), 90000); deadline.unref();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
const errors = [], checks = [];
let manifest;
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const shot = name => page.screenshot({ path: fileURLToPath(new URL(name, directory)), fullPage: true });
const observe = () => page.evaluate(() => {
  const { simulation: sim, renderer: view } = window.__SPLIT_GRID__, car = sim.player;
  const mesh = view.carMeshes.get(car.id), crew = mesh.userData.roadside;
  return { elapsed: sim.elapsed, state: sim.state, role: car.streetClassId, speed: car.speed,
    damage: car.damage, engine: { ...car.engine }, position: [car.s, car.lateral, car.headingOffset],
    wheels: car.wheels.map(wheel => ({ ...wheel })), mobile: { ...car.mobileRepair }, pitState: car.pitState, pitVisits: car.pitVisits,
    crew: crew ? { visible: crew.visible, elapsed: crew.userData.elapsed, area: crew.userData.area,
      position: crew.position.toArray(), rotation: crew.rotation.y, borderScale: crew.userData.border.scale.toArray(),
      mechanics: crew.userData.mechanics.map(mechanic => ({ position: mechanic.position.toArray(), arms: mechanic.userData.arms.map(arm => arm.rotation.x) })),
      hood: mesh.userData.hood.rotation.x } : null,
    worldPosition: [car.x, car.y + .03, car.z], heading: car.heading, draws: view.renderer.info.render.frame };
});
const layout = () => page.evaluate(() => {
  const rect = selector => { const box = document.querySelector(selector).getBoundingClientRect(); return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height }; };
  return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
    telemetry: rect('.telemetry'), ability: rect('#roadside-panel'), button: rect('#roadside'), touch: rect('.touch-controls'),
    charge: document.querySelector('#roadside-charge').textContent, warning: document.querySelector('#roadside-warning').textContent };
});
const offRoadFixture = async (first = false) => page.evaluate(first => {
  const { simulation: sim, renderer: view } = window.__SPLIT_GRID__, car = sim.player;
  if (first) {
    sim.potholes = []; sim.potholeBuckets.clear();
    sim.cars.filter(other => other !== car).forEach((other, index) => {
      Object.assign(other, { s: sim.track.length * .7 + index * 12, lateral: 0, speed: 0 });
      sim.wreckCar(other, 'Controlled roadside-browser isolation'); sim.updateWorld(other);
    });
  }
  Object.assign(car, { s: sim.track.length / 2, lateral: -sim.track.width / 2 - 6, speed: 0, lateralVelocity: 0, headingOffset: 0, damage: .24 });
  car.engine.wear = .12;
  Object.assign(car.wheels[0], { tire: first ? 'blown' : 'punctured', pressure: first ? 0 : .6, leakRate: first ? 0 : .01, bend: .1, suspensionDamage: .2 });
  sim.updateHandling(car); sim.updateWorld(car); sim.updatePitInfo(car); sim.updateMobileRepairInfo(car);
  view.mode = 'chase'; view.cameraReady = false; view.needsRender = true;
  return { s: car.s, lateral: car.lateral, role: car.streetClassId, available: car.mobileRepair.available, charges: car.mobileRepair.charges };
}, first);
const moveToPitFixture = () => page.evaluate(() => {
  const sim = window.__SPLIT_GRID__.simulation, car = sim.player, bay = sim.getPitBay(car);
  Object.assign(car, { s: bay.s - 1.2, lateral: bay.lateral + .5, speed: 0, lateralVelocity: 0, headingOffset: .05 });
  sim.updateHandling(car); sim.updateWorld(car); sim.updatePitInfo(car); sim.updateMobileRepairInfo(car);
  window.__SPLIT_GRID__.renderer.cameraReady = false; window.__SPLIT_GRID__.renderer.needsRender = true;
  return { bay: bay.number, available: car.pitAvailable, pose: [car.s, car.lateral, car.headingOffset] };
});

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  manifest = await (await page.request.get(`${baseURL}build-info.json`)).json();
  await page.locator('[data-class="civilian"]').click();
  assert.equal(await page.locator('[data-street-role]').count(), 4);
  assert.equal(await page.locator('select#vehicle').count(), 0);
  const selectedRoles = [];
  for (const role of ['sedan', 'sports', 'suv', 'truck']) {
    await page.locator(`[data-street-role="${role}"]`).click();
    selectedRoles.push(await page.evaluate(() => {
      const sim = window.__SPLIT_GRID__.simulation;
      return { selected: sim.player.streetClassId, stock: sim.cars.filter(car => car.classId === 'stock').length, street: sim.cars.filter(car => car.classId === 'civilian').length };
    }));
  }
  assert.deepEqual(selectedRoles.map(value => value.selected), ['sedan', 'sports', 'suv', 'truck']);
  assert.ok(selectedRoles.every(value => value.stock === 10 && value.street === 10));
  await page.locator('[data-street-role="suv"]').click();
  await page.locator('#street-cards').scrollIntoViewIfNeeded();
  await shot('four-street-role-cards-desktop.png');
  checks.push({ check: 'Four actual role cards replace the model dropdown; every grid still has10stock+10Street', selectedRoles });

  await page.locator('[data-street-role="truck"]').click();
  await page.locator('#track').selectOption('bristol');
  await page.locator('#start').click();
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.state === 'racing');
  await page.keyboard.press('p');
  const thresholds = [];
  for (const speedMph of [14.9, 15]) {
    await page.evaluate(speedMph => {
      const sim = window.__SPLIT_GRID__.simulation;
      sim.player.speed = speedMph * .44704; sim.updateHandling(sim.player);
      document.querySelector('#pause-overlay').classList.add('hidden');
    }, speedMph);
    await page.waitForFunction(speedMph => document.querySelector('#truck-protection').classList.contains('active') === (speedMph < 15)
      && document.querySelector('#truck-protection-detail').textContent.includes(`${speedMph.toFixed(1)} MPH`), speedMph);
    thresholds.push(await page.evaluate(() => ({ actualSpeed: window.__SPLIT_GRID__.simulation.player.speed,
      protected: window.__SPLIT_GRID__.simulation.player.potholeProtected, text: document.querySelector('#truck-protection').textContent })));
    await shot(speedMph < 15 ? 'truck-below15-protected.png' : 'truck-at15-unprotected.png');
  }
  assert.equal(thresholds[0].protected, true); assert.equal(thresholds[1].protected, false);
  assert.match(thresholds[0].text, /14\.9 MPH/); assert.match(thresholds[1].text, /15\.0 MPH/);
  checks.push({ check: 'Truck HUD uses actual below15mph protection, not rounded speedometer logic', thresholds,
    boundary: 'Two declared speed fixtures while the simulation is paused prevent coasting across the threshold. Pause overlay hidden only for the screenshots.' });

  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.locator('[data-class="civilian"]').click(); await page.locator('[data-street-role="suv"]').click();
  await page.locator('#track').selectOption('bristol');
  await page.locator('#difficulty').focus(); await page.keyboard.press('Home');
  await page.locator('#start').click(); await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.state === 'racing');
  const initial = await offRoadFixture(true); assert.equal(initial.available, true);
  await page.waitForFunction(() => !document.querySelector('#roadside').disabled);
  await page.keyboard.press('m'); await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.mobileRepair.state === 'active');
  const started = await observe();
  await page.waitForTimeout(750); const animated1 = await observe();
  await page.waitForTimeout(300); const animated2 = await observe();
  assert.equal(animated2.crew.visible, true); assert.equal(animated2.crew.mechanics.length, 2);
  assert.deepEqual(animated2.crew.position, animated2.worldPosition);
  assert.equal(animated2.crew.borderScale[0], animated2.mobile.area.width); assert.equal(animated2.crew.borderScale[2], animated2.mobile.area.length);
  assert.equal(animated2.crew.rotation, animated2.heading + animated2.mobile.area.headingOffset);
  assert.ok(animated2.crew.hood < -.2);
  assert.notDeepEqual(animated1.crew.mechanics.map(person => person.arms), animated2.crew.mechanics.map(person => person.arms));
  assert.ok(Math.abs(animated2.crew.elapsed - (animated2.mobile.duration - animated2.mobile.remaining)) < .06);
  await page.keyboard.press('p'); await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.state === 'paused');
  await page.waitForTimeout(100); const paused = await observe();
  await page.waitForTimeout(350); const stillPaused = await observe();
  assert.equal(stillPaused.elapsed, paused.elapsed); assert.equal(stillPaused.mobile.remaining, paused.mobile.remaining); assert.deepEqual(stillPaused.crew, paused.crew);
  await page.locator('#resume').click();
  const hidden = await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'));
    const { simulation: sim, renderer: view } = window.__SPLIT_GRID__;
    return { elapsed: sim.elapsed, remaining: sim.player.mobileRepair.remaining, draws: view.renderer.info.render.frame };
  });
  await page.waitForTimeout(350);
  assert.deepEqual(await page.evaluate(() => ({ elapsed: window.__SPLIT_GRID__.simulation.elapsed, remaining: window.__SPLIT_GRID__.simulation.player.mobileRepair.remaining, draws: window.__SPLIT_GRID__.renderer.renderer.info.render.frame })), hidden);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.locator('#resume').click(); await page.waitForTimeout(150);
  await shot('suv-roadside-active-desktop.png');
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(150);
  const mobileActive = await layout();
  assert.ok(mobileActive.scrollWidth <= mobileActive.width && mobileActive.telemetry.bottom <= mobileActive.touch.top);
  assert.ok(mobileActive.ability.top >= 100 && mobileActive.button.height >= 40);
  await shot('suv-roadside-active-mobile.png');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.mobileRepair.state === 'complete', undefined, { timeout: 19000 });
  await page.waitForFunction(() => document.querySelector('#roadside-charge').textContent.includes('SPENT'));
  const completed = await observe();
  assert.equal(completed.mobile.charges, 0); assert.equal(completed.mobile.completed, 1); assert.equal(completed.mobile.disabled, false);
  assert.equal(completed.damage, 0); assert.equal(completed.engine.wear, 0);
  assert.ok(completed.wheels.every(wheel => wheel.tire === 'intact' && wheel.pressure === 1));
  assert.equal(completed.crew.visible, false); assert.equal(completed.crew.hood, 0);
  assert.deepEqual(completed.position, started.position);
  assert.ok(completed.elapsed - started.elapsed >= 14.8 && completed.elapsed - started.elapsed < 15.5);
  checks.push({ check: 'RealM starts15s service; exactcrew area and two mechanics animate from simulation time; P and controlledvisibility freeze; completion spends charge', initial, started, animated1, animated2, paused, stillPaused, hidden, completed, mobileActive,
    boundary: 'Declared initial repairable SUV on clear backstraight infield and isolated other cars. No subsequent repair or time injection. RealM and ordinary realtime updates perform service. Hidden behavior uses the real visibility handler with a declared document.hidden override, not a native tab-background claim.' });

  const pit1 = await moveToPitFixture(); assert.equal(pit1.available, true);
  await page.waitForFunction(() => !document.querySelector('#service').disabled && !document.querySelector('#service').classList.contains('hidden'));
  await page.keyboard.press('e'); await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.pitState === 'servicing');
  const pitStart = await observe();
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.pitState === 'complete', undefined, { timeout: 7500 });
  await page.waitForFunction(() => document.querySelector('#roadside-charge').textContent.includes('READY'));
  const recharged = await observe(); assert.equal(recharged.mobile.charges, 1); assert.equal(recharged.mobile.disabled, false);
  assert.ok(recharged.elapsed - pitStart.elapsed > 4.8); await shot('suv-pit-restores-roadside-charge.png');
  checks.push({ check: 'Ordinary five-second pit service restores a spent roadside charge', pit1, pitStart, recharged, boundary: 'Declared initial pose in assigned bay. ActualE and full normal service; no charge mutation.' });

  const secondFixture = await offRoadFixture(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => !document.querySelector('#roadside').disabled);
  await page.locator('#roadside').click(); await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.mobileRepair.state === 'active');
  await page.waitForTimeout(450); const beforeContact = await observe();
  const contact = await page.evaluate(() => {
    const sim = window.__SPLIT_GRID__.simulation, car = sim.player, area = car.mobileRepair.area;
    const other = sim.cars.find(driver => driver !== car);
    Object.assign(other, { s: area.s, lateral: area.lateral - (area.width / 2 + other.spec.width / 2 - .15), speed: 0, lateralVelocity: 0,
      headingOffset: 0, damage: 0, wrecked: false, wreckTime: null, wreckReason: '', finished: false, finishTime: null, status: 'racing', contactCooldown: 100 });
    sim.updateHandling(other); sim.updateWorld(other);
    const ai = sim.aiControl.bind(sim); sim.aiControl = (driver, dt) => driver === other ? { throttle: 0, brake: 1, steer: 0 } : ai(driver, dt);
    return { ownerId: car.id, otherId: other.id, area: { ...area }, carOverlap: sim.footprintsOverlap(sim.carFootprint(car), sim.carFootprint(other)), crewOverlap: sim.footprintsOverlap(area, sim.carFootprint(other)) };
  });
  assert.equal(contact.carOverlap, false); assert.equal(contact.crewOverlap, true);
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.mobileRepair.disabled);
  await page.waitForFunction(() => document.querySelector('#roadside-charge').textContent.includes('CREW LOST'));
  const lost = await observe();
  assert.equal(lost.mobile.state, 'cancelled'); assert.equal(lost.mobile.charges, 0); assert.equal(lost.mobile.penaltyApplied, true);
  assert.ok(lost.damage >= beforeContact.damage + .24 && lost.engine.wear >= beforeContact.engine.wear + .19);
  assert.ok(lost.wheels[0].bend >= beforeContact.wheels[0].bend + .34 && lost.wheels[0].suspensionDamage >= beforeContact.wheels[0].suspensionDamage + .34);
  assert.ok(lost.wheels[0].pressure < 1, 'interrupted service cannot grant fresh tires');
  assert.equal(lost.crew.visible, false); assert.equal(lost.crew.hood, 0);
  assert.equal(await page.locator('#roadside').isDisabled(), true);
  const mobileLost = await layout(); assert.ok(mobileLost.telemetry.bottom <= mobileLost.touch.top && mobileLost.scrollWidth <= mobileLost.width);
  await shot('suv-crew-contact-permanently-disabled-mobile.png');
  const pit2 = await moveToPitFixture(); assert.equal(pit2.available, true);
  await page.waitForFunction(() => !document.querySelector('#service').disabled && !document.querySelector('#service').classList.contains('hidden'));
  await page.keyboard.press('e'); await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.pitState === 'servicing');
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.pitState === 'complete', undefined, { timeout: 7500 });
  const disabledAfterPit = await observe();
  assert.equal(disabledAfterPit.damage, 0); assert.equal(disabledAfterPit.engine.wear, 0);
  assert.equal(disabledAfterPit.mobile.disabled, true); assert.equal(disabledAfterPit.mobile.charges, 0); assert.equal(disabledAfterPit.mobile.chargeAvailable, false);
  assert.match(await page.locator('#roadside-charge').textContent(), /CREW LOST/);
  checks.push({ check: 'Mobilebutton works; crew-only contact applies severe penalty/no partial repairs and permanently disables ability even after fullEasy pit repair', secondFixture, beforeContact, contact, lost, mobileLost, pit2, disabledAfterPit,
    boundary: 'Second declared repairable off-road pose; actualbutton starts service. A declared stationary vehicle contact overlaps only the fixed crew rectangle, not the SUV chassis, with normal contact cooldown deliberately high. Ordinary nexttick applies penalty. Final declared bay pose uses actualE and full5s repair; disabled flag never injected.' });
  assert.deepEqual(errors, []);
  await writeFile(new URL('browser-street-classes.json', directory), JSON.stringify({ passed: true, baseURL, sourceSha256: manifest.sourceSha256, buildSha256: manifest.buildSha256, checks, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, checks: checks.length, errors }));
} catch (error) {
  const state = await observe().catch(() => null);
  await shot('street-classes-browser-failure.png').catch(() => {});
  await writeFile(new URL('browser-street-classes.json', directory), JSON.stringify({ passed: false, baseURL, sourceSha256: manifest?.sourceSha256, buildSha256: manifest?.buildSha256, checks, errors, state, failure: error.stack }, null, 2));
  throw error;
} finally { clearTimeout(deadline); await browser.close(); }
