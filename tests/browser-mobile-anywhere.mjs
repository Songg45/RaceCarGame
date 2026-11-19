import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const baseURL = process.env.RACE_URL || 'http://127.0.0.1:4174/';
const directory = new URL('../artifacts/mobile-repair-anywhere/', import.meta.url);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const deadline = setTimeout(() => browser.close(), 75000); deadline.unref();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
const errors = [], checks = []; let manifest;
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const observe = () => page.evaluate(() => {
  const sim = window.__SPLIT_GRID__.simulation, car = sim.player;
  return { elapsed: sim.elapsed, state: sim.state, inPit: car.inPit, pose: [car.s, car.lateral, car.headingOffset],
    damage: car.damage, engineWear: car.engine.wear, wheels: car.wheels.map(wheel => ({ ...wheel })),
    mobile: { ...car.mobileRepair }, pitState: car.pitState, pitVisits: car.pitVisits };
});
const fresh = state => assert.ok(state.wheels.every(wheel => wheel.tire === 'intact' && wheel.pressure === 1 && wheel.leakRate === 0));
const shot = name => page.screenshot({ path: fileURLToPath(new URL(name, directory)), fullPage: true });
const layout = () => page.evaluate(() => {
  const box = selector => {
    const element = document.querySelector(selector), rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height,
      visible: getComputedStyle(element).display !== 'none' && rect.width > 0 && rect.height > 0, disabled: element.disabled ?? null, text: element.textContent };
  };
  return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth,
    mobile: box('#roadside'), pit: box('#service'), warning: box('#roadside-warning'), pedals: box('.touch-controls') };
});
const checkLayout = state => {
  assert.ok(state.scrollWidth <= state.width);
  for (const key of ['mobile', 'pit', 'warning']) {
    const box = state[key]; assert.equal(box.visible, true, `${key} must remain visible in the pits`);
    assert.ok(box.left >= 0 && box.right <= state.width && box.top >= 0 && box.bottom <= state.height, `${key} must fit the viewport`);
  }
  assert.ok(state.mobile.bottom <= state.pit.top || state.pit.bottom <= state.mobile.top, 'M and E controls must not overlap');
  if (state.pedals.visible) assert.ok(Math.max(state.mobile.bottom, state.pit.bottom, state.warning.bottom) < state.pedals.top, 'repair controls and warning must clear mobile pedals');
  assert.match(state.warning.text, /contact/i);
};
try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  manifest = await (await page.request.get(`${baseURL}build-info.json`)).json();
  await page.locator('[data-class="civilian"]').click(); await page.locator('[data-street-role="suv"]').click();
  await page.locator('#track').selectOption('bristol'); await page.locator('#difficulty').fill('0'); await page.locator('#start').click();
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.state === 'racing');
  const initial = await page.evaluate(() => {
    const { simulation: sim, renderer: view } = window.__SPLIT_GRID__, car = sim.player;
    sim.potholes = []; sim.potholeBuckets.clear();
    sim.cars.filter(other => other !== car).forEach((other, index) => { other.s = sim.track.length * .7 + index * 12; sim.wreckCar(other, 'Controlled manual-mobile UI isolation'); });
    Object.assign(car, { s: sim.track.length / 2, lateral: 0, speed: 0, lateralVelocity: 0, headingOffset: 0, damage: .24 });
    car.engine.wear = .12; Object.assign(car.wheels[0], { tire: 'blown', pressure: 0, bend: .1, suspensionDamage: .2 });
    sim.updateHandling(car); sim.updateWorld(car); sim.updatePitInfo(car); sim.updateMobileRepairInfo(car);
    view.cameraReady = false; view.needsRender = true;
    return { available: car.mobileRepair.available, racingLane: car.lateral === 0, safeForAI: sim.mobileRepairAreaClear(car) };
  });
  assert.equal(initial.available, true); assert.equal(initial.racingLane, true); assert.equal(initial.safeForAI, false);
  await page.waitForFunction(() => !document.querySelector('#roadside').disabled);
  await page.keyboard.press('m');
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.mobileRepair.state === 'active');
  await page.waitForTimeout(350);
  const roadStarted = await observe(); assert.equal(roadStarted.mobile.charges, 0); assert.equal(roadStarted.damage, .24);
  await shot('road-mobile-service-desktop.png');
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.mobileRepair.completed === 1, null, { timeout: 19000 });
  const roadCompleted = await observe(); fresh(roadCompleted); assert.equal(roadCompleted.damage, 0); assert.equal(roadCompleted.mobile.disabled, false);
  assert.deepEqual(roadCompleted.pose, roadStarted.pose);
  checks.push({ check: 'Real M starts and completes normal fifteen-second mobile repair while stopped on the racing lane', initial, roadStarted, roadCompleted });

  await page.evaluate(() => {
    const { simulation: sim, renderer: view } = window.__SPLIT_GRID__, car = sim.player, bay = sim.getPitBay(car);
    Object.assign(car, { s: bay.s, lateral: bay.lateral, speed: 0, lateralVelocity: 0, headingOffset: 0 });
    sim.updateWorld(car); sim.updatePitInfo(car); sim.updateMobileRepairInfo(car); view.cameraReady = false; view.needsRender = true;
  });
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.pitAvailable);
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.pitState === 'servicing');
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.mobileRepair.charges === 1, null, { timeout: 8000 });
  const recharged = await observe(); assert.equal(recharged.pitVisits, 1);
  checks.push({ check: 'Actual E and normal completed five-second pit service recharge the spent charge', recharged });

  await page.evaluate(() => {
    const { simulation: sim, renderer: view } = window.__SPLIT_GRID__, car = sim.player;
    Object.assign(car, { s: 0, lateral: sim.pit.throughLateral, speed: 0, lateralVelocity: 0, headingOffset: 0, damage: .2 });
    car.engine.wear = .1; Object.assign(car.wheels[0], { tire: 'blown', pressure: 0 });
    sim.updateHandling(car); sim.updateWorld(car); sim.updatePitInfo(car); sim.updateMobileRepairInfo(car); view.cameraReady = false; view.needsRender = true;
  });
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.inPit && !document.querySelector('#roadside').disabled);
  const desktop = await layout(); checkLayout(desktop); await shot('pit-mobile-button-desktop.png');
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(200);
  const mobile = await layout(); checkLayout(mobile); assert.equal(mobile.mobile.disabled, false); await shot('pit-mobile-button-mobile.png');
  await page.locator('#roadside').click();
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.mobileRepair.state === 'active');
  const pitStarted = await observe(); assert.equal(pitStarted.inPit, true); assert.equal(pitStarted.damage, .2);
  await shot('pit-mobile-service-mobile.png');
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.mobileRepair.completed === 2, null, { timeout: 19000 });
  const pitCompleted = await observe(); fresh(pitCompleted); assert.equal(pitCompleted.damage, 0); assert.equal(pitCompleted.mobile.disabled, false);
  assert.equal(pitCompleted.pitVisits, 1, 'mobile work in the through lane is not another pit-service visit');
  assert.deepEqual(pitCompleted.pose, pitStarted.pose);
  checks.push({ check: 'Visible reachable mobile button works in the pit through lane; M/E controls and warning fit desktop and mobile', desktop, mobile, pitStarted, pitCompleted });
  assert.deepEqual(errors, []);
  await writeFile(new URL('browser-mobile-anywhere.json', directory), JSON.stringify({ passed: true, baseURL, sourceSha256: manifest.sourceSha256, buildSha256: manifest.buildSha256, checks, errors,
    boundary: 'Declared initial positions/damage and isolated traffic; real keyboard M/E and mobile button with normal15s/5s service, no elapsed-time or charge injection. This is UI acceptance, not a naturally driven pit approach.' }, null, 2));
  console.log(JSON.stringify({ passed: true, checks: checks.length, errors }));
} catch (error) {
  await shot('browser-failure.png').catch(() => {});
  await writeFile(new URL('browser-mobile-anywhere.json', directory), JSON.stringify({ passed: false, checks, errors, failure: String(error.stack || error), sourceSha256: manifest?.sourceSha256, buildSha256: manifest?.buildSha256 }, null, 2));
  throw error;
} finally { clearTimeout(deadline); await browser.close(); }
