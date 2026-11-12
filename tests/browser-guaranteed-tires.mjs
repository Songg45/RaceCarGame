import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const baseURL = process.env.RACE_URL || 'http://127.0.0.1:4174/';
const directory = new URL('../artifacts/guaranteed-pit-tires/', import.meta.url);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const deadline = setTimeout(() => browser.close(), 30000); deadline.unref();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const shot = name => page.screenshot({ path: fileURLToPath(new URL(name, directory)), fullPage: true });
const observe = () => page.evaluate(() => {
  const sim = window.__SPLIT_GRID__.simulation, car = sim.player;
  return { elapsed: sim.elapsed, state: car.pitState, remaining: car.pitRemaining, visits: car.pitVisits,
    position: [car.s, car.lateral, car.headingOffset], damage: car.damage, engine: { ...car.engine },
    wheels: car.wheels.map(wheel => ({ ...wheel })), handling: { ...car.handling },
    message: car.repairMessage, repairEvent: sim.events.findLast(event => event.type === 'repair' && event.carId === car.id) };
});

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.locator('#track').selectOption('bristol');
  await page.locator('#difficulty').focus(); await page.keyboard.press('End');
  assert.equal(await page.locator('#difficulty').inputValue(), '100');
  const help = await page.locator('#difficulty-help').textContent();
  assert.match(help, /Every completed pit stop replaces all four tires/);
  assert.match(help, /Other repairs can worsen damage/);
  await page.locator('#start').click();
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.state === 'racing');
  await page.evaluate(() => {
    const { simulation: sim, renderer: view } = window.__SPLIT_GRID__, car = sim.player, bay = sim.getPitBay(car);
    sim.potholes = []; sim.potholeBuckets.clear();
    sim.cars.filter(other => other !== car).forEach((other, index) => {
      Object.assign(other, { s: sim.track.length / 2 + index * 12, lateral: 0 });
      sim.wreckCar(other, 'Controlled tire-service display isolation'); sim.updateWorld(other);
    });
    Object.assign(car, { s: bay.s - 1.5, lateral: bay.lateral + 0.6, speed: 0, lateralVelocity: 0, headingOffset: 0.08, damage: 0.35 });
    Object.assign(car.engine, { heat: 0.1, wear: 0.25 });
    car.wheels.forEach(wheel => { wheel.bend = 0.2; wheel.suspensionDamage = 0.3; });
    Object.assign(car.wheels[0], { tire: 'blown', pressure: 0, leakRate: 0 });
    Object.assign(car.wheels[1], { tire: 'punctured', pressure: 0.55, leakRate: 0.02 });
    Object.assign(car.wheels[2], { tire: 'intact', pressure: 0.45, leakRate: 0 });
    Object.assign(car.wheels[3], { tire: 'punctured', pressure: 0.65, leakRate: 0.04 });
    sim.random = () => 0; // Declared fixture forces the Extreme crew-mistake branch.
    sim.updateHandling(car); sim.updateWorld(car); sim.updatePitInfo(car);
    const request = sim.requestPitService.bind(sim);
    window.__qaTireServiceAcceptance = null;
    sim.requestPitService = (driver = sim.player) => {
      const pose = [driver.s, driver.lateral, driver.headingOffset];
      const accepted = request(driver);
      if (accepted && driver === car) window.__qaTireServiceAcceptance = { elapsed: sim.elapsed, before: pose, after: [driver.s, driver.lateral, driver.headingOffset] };
      return accepted;
    };
    view.mode = 'chase'; view.cameraReady = false; view.needsRender = true;
  });
  await page.waitForFunction(() => !document.querySelector('#service').disabled && document.querySelector('[data-wheel="FL"] span').textContent === '0%');
  const before = await observe();
  await shot('extreme-mixed-tires-before-service.png');
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.pitState === 'servicing');
  const acceptance = await page.evaluate(() => window.__qaTireServiceAcceptance);
  assert.deepEqual(acceptance.before, acceptance.after, 'service must not move the car');
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.pitState === 'complete', undefined, { timeout: 7500 });
  await page.waitForFunction(() => [...document.querySelectorAll('#wheel-grid .wheel-cell span')].every(cell => cell.textContent === '100%') && document.querySelector('#pit-status').textContent.includes('All four tires replaced'));
  const after = await observe();
  assert.ok(after.elapsed - acceptance.elapsed >= 4.99 && after.elapsed - acceptance.elapsed < 5.5, 'ordinary real-time five-second service must complete after the short E press');
  assert.equal(after.visits, 1);
  assert.deepEqual(after.position, acceptance.after);
  assert.deepEqual(after.wheels.map(wheel => [wheel.id, wheel.tire, wheel.pressure, wheel.leakRate]), ['FL', 'FR', 'RL', 'RR'].map(id => [id, 'intact', 1, 0]));
  assert.ok(after.damage > before.damage && after.engine.wear > before.engine.wear);
  assert.ok(after.wheels[0].bend > before.wheels[0].bend && after.wheels[0].suspensionDamage > before.wheels[0].suspensionDamage);
  assert.equal(after.handling.blownTires, 0); assert.equal(after.handling.puncturedTires, 0);
  assert.deepEqual(after.repairEvent.tiresReplaced, ['FL', 'FR', 'RL', 'RR']);
  assert.match(after.message, /^All four tires replaced\. Crew mistake:/);
  assert.match(after.message, /wheel rim and suspension damaged/);
  const layout = async () => page.evaluate(() => {
    const rect = element => { const box = element.getBoundingClientRect(); return { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height }; };
    const message = document.querySelector('#race-message'), pit = document.querySelector('#pit-status');
    return { viewport: { width: innerWidth, height: innerHeight }, message: { text: message.textContent, visible: !message.classList.contains('hidden'), rect: rect(message), clientWidth: message.clientWidth, scrollWidth: message.scrollWidth }, pit: { text: pit.textContent, rect: rect(pit), clientWidth: pit.clientWidth, scrollWidth: pit.scrollWidth, clientHeight: pit.clientHeight, scrollHeight: pit.scrollHeight }, cells: [...document.querySelectorAll('#wheel-grid .wheel-cell')].map(cell => ({ text: cell.textContent, label: cell.getAttribute('aria-label') })), touch: rect(document.querySelector('.touch-controls')), telemetry: rect(document.querySelector('.telemetry')) };
  });
  const desktop = await layout();
  assert.equal(desktop.message.visible, true); assert.match(desktop.message.text, /All four tires replaced/);
  assert.ok(desktop.message.scrollWidth <= desktop.message.clientWidth && desktop.pit.scrollWidth <= desktop.pit.clientWidth, 'completion text must wrap horizontally');
  assert.ok(desktop.cells.every(cell => cell.text.includes('100%') && cell.label.includes('susp')));
  await shot('extreme-four-fresh-tires-other-damage-desktop.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  const mobile = await layout();
  assert.ok(mobile.message.scrollWidth <= mobile.message.clientWidth && mobile.message.rect.right <= mobile.viewport.width);
  assert.ok(mobile.pit.scrollWidth <= mobile.pit.clientWidth && mobile.telemetry.bottom <= mobile.touch.top, 'telemetry must preserve mobile pedals');
  await shot('extreme-four-fresh-tires-other-damage-mobile.png');
  checks.push({ check: 'Completed Extreme crew-mistake service guarantees four new tires while preserving other repair risk and readable HUD', help, before, acceptance, after, desktop, mobile,
    boundary: 'Declared initial in-bay mixed tire/body/rim/suspension/engine damage; other traffic isolated and crew RNG forced to the bad branch. Actual short E keypress starts ordinary real-time five-second service. No direct repair call, simulated-time acceleration, or later component/pose injection.' });
  assert.deepEqual(errors, []);
  await writeFile(new URL('browser-guaranteed-tires.json', directory), JSON.stringify({ passed: true, baseURL, checks, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, checks: checks.length, errors }));
} catch (error) {
  const state = await observe().catch(() => null);
  await shot('guaranteed-tires-failure.png').catch(() => {});
  await writeFile(new URL('browser-guaranteed-tires.json', directory), JSON.stringify({ passed: false, baseURL, checks, errors, state, failure: error.stack }, null, 2));
  throw error;
} finally { clearTimeout(deadline); await browser.close(); }
