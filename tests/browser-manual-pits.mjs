import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const baseURL = process.env.RACE_URL || 'http://127.0.0.1:4174/';
const directory = new URL('../artifacts/manual-pits-avoidance/', import.meta.url);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const deadline = setTimeout(() => browser.close(), 65000); deadline.unref();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const shot = name => page.screenshot({ path: fileURLToPath(new URL(name, directory)), fullPage: true });
const observe = () => page.evaluate(() => {
  const sim = window.__SPLIT_GRID__.simulation, car = sim.player, bay = sim.getPitBay(car);
  return { s: car.s, lateral: car.lateral, speed: car.speed, damage: car.damage, headingOffset: car.headingOffset, centered: car.pitCentered, inBay: car.pitInBay, available: car.pitAvailable, state: car.pitState, elapsed: sim.elapsed, bayS: bay.s, bayLateral: bay.lateral, braking: car.spec.braking * car.handling.brakingFactor };
});
try {
  for (const playerClass of ['stock', 'civilian']) {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.locator('#track').selectOption('bristol');
    await page.locator(`[data-class="${playerClass}"]`).click();
    await page.locator('#difficulty').focus();
    await page.keyboard.press('Home');
    await page.locator('#start').click();
    await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.state === 'racing');
    const initial = await page.evaluate(() => {
      const { simulation: sim, renderer: view } = window.__SPLIT_GRID__, car = sim.player, bay = sim.getPitBay(car);
      sim.potholes = []; sim.potholeBuckets.clear();
      sim.cars.filter(other => other !== car).forEach((other, index) => {
        Object.assign(other, { s: sim.track.length / 2 + index * 12, lateral: 0 }); sim.wreckCar(other, 'Controlled unrelated traffic isolation'); sim.updateWorld(other);
      });
      Object.assign(car, { s: bay.s - 18, lateral: bay.lateral + 0.8, speed: 0, lateralVelocity: 0, headingOffset: 0, damage: 0.4 });
      sim.updateHandling(car); sim.updateWorld(car); sim.updatePitInfo(car);
      const request = sim.requestPitService.bind(sim);
      window.__qaServiceAcceptance = null;
      sim.requestPitService = (driver = sim.player) => {
        const before = [driver.s, driver.lateral, driver.headingOffset];
        const accepted = request(driver);
        if (accepted && driver === car) window.__qaServiceAcceptance = { before, after: [driver.s, driver.lateral, driver.headingOffset], elapsed: sim.elapsed };
        return accepted;
      };
      view.mode = 'chase'; view.cameraReady = false; view.needsRender = true;
      window.__qaManualPose = [car.s, car.lateral];
      return { s: car.s, lateral: car.lateral, bayS: bay.s, bayLateral: bay.lateral, inBay: car.pitInBay, available: car.pitAvailable };
    });
    assert.equal(initial.inBay, false); assert.equal(initial.available, false);
    // From this boundary onward, the car moves only through real keyboard
    // throttle/brake input and the running browser's ordinary update loop.
    const samples = [], driveStarted = Date.now();
    let gas = false;
    while (Date.now() - driveStarted < 14000) {
      const state = await observe(); samples.push(state);
      const remaining = state.bayS - 1.8 - state.s;
      if (remaining <= state.speed ** 2 / Math.max(1, 2 * state.braking) + 0.35) break;
      const wantGas = state.speed < 3.5;
      if (wantGas !== gas) { await page.keyboard[wantGas ? 'down' : 'up']('w'); gas = wantGas; }
      await page.waitForTimeout(80);
    }
    await page.keyboard.up('w');
    await page.keyboard.down('s');
    await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.speed === 0, undefined, { timeout: 2500 });
    await page.keyboard.up('s');
    await page.waitForTimeout(200);
    const stopped = await observe();
    assert.ok(stopped.s - initial.s > 10, 'the player must physically drive into the bay');
    assert.equal(stopped.inBay, true); assert.equal(stopped.available, true);
    assert.equal(stopped.centered, false, 'this must demonstrate a practical off-center stop');
    assert.ok(Math.abs(stopped.lateral - stopped.bayLateral) > 0.5);
    assert.equal(await page.locator('#service').isEnabled(), true);
    assert.match(await page.locator('#pit-status').textContent(), /READY FOR SERVICE/i);
    await shot(`${playerClass}-manual-off-center-ready.png`);
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.pitState === 'servicing');
    await page.waitForTimeout(200);
    const servicing = await observe();
    const acceptance = await page.evaluate(() => window.__qaServiceAcceptance);
    assert.deepEqual(acceptance.after, acceptance.before, 'actual acceptance must not reposition or rotate the car');
    assert.equal(servicing.centered, false);
    assert.equal(servicing.s, acceptance.after[0]); assert.equal(servicing.lateral, acceptance.after[1]);
    await shot(`${playerClass}-manual-off-center-servicing.png`);
    await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.pitState === 'complete', undefined, { timeout: 6500 });
    const repaired = await observe();
    assert.equal(repaired.damage, 0); assert.equal(repaired.s, acceptance.after[0]); assert.equal(repaired.lateral, acceptance.after[1]);
    checks.push({ playerClass, initial, stopped, acceptance, servicing, repaired, samples, boundary: 'One controlled initial position 18 m before own bay, with 0.8 m lateral offset and body damage 0.4. All later movement is real W/S keyboard input and ordinary real-time browser physics. One short E tap starts normal five-second service; no post-setup pose mutation or direct repair calls. A read-only wrapper records the pose at actual service acceptance.' });
  }
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.locator('#difficulty').focus(); await page.keyboard.press('Home');
  await page.locator('#start').click();
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.state === 'racing');
  await page.evaluate(() => {
    const sim = window.__SPLIT_GRID__.simulation, car = sim.player, bay = sim.getPitBay(car);
    sim.cars.filter(other => other !== car).forEach((other, index) => { other.s = sim.track.length / 2 + index * 12; sim.wreckCar(other, 'Controlled button-check isolation'); sim.updateWorld(other); });
    Object.assign(car, { s: bay.s - 1.5, lateral: bay.lateral + 0.8, speed: 0, lateralVelocity: 0, headingOffset: 0.1, damage: 0.4 });
    sim.updateWorld(car); sim.updatePitInfo(car);
  });
  await page.waitForFunction(() => !document.querySelector('#service').disabled);
  const clickStart = await observe();
  await page.locator('#service').click();
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.pitState === 'servicing');
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.pitState === 'complete', undefined, { timeout: 6500 });
  const clickEnd = await observe();
  assert.equal(clickEnd.damage, 0); assert.equal(clickEnd.s, clickStart.s); assert.equal(clickEnd.lateral, clickStart.lateral);
  checks.push({ check: 'One actual service-button click starts and completes service', clickStart, clickEnd, boundary: 'Separate controlled initial off-center/angled position for button wiring only; physical keyboard arrival is independently verified above.' });
  assert.deepEqual(errors, []);
  await writeFile(new URL('browser-manual-pits.json', directory), JSON.stringify({ passed: true, baseURL, checks, errors }, null, 2));
  console.log(JSON.stringify({ passed: true, checks: checks.length, errors }));
} catch (error) {
  const state = await observe().catch(() => null);
  await shot('manual-pits-failure.png').catch(() => {});
  await writeFile(new URL('browser-manual-pits.json', directory), JSON.stringify({ passed: false, baseURL, checks, errors, state, failure: error.stack }, null, 2));
  throw error;
} finally { clearTimeout(deadline); await browser.close(); }
