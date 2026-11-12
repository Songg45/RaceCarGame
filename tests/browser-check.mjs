import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseURL = process.env.RACE_URL || 'http://127.0.0.1:5173';
const artifactDir = new URL('../artifacts/', import.meta.url);
await mkdir(artifactDir, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
const checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const state = () => page.evaluate(() => {
  const { simulation: sim, renderer } = window.__SPLIT_GRID__;
  return {
    state: sim.state, count: sim.cars.length, stock: sim.cars.filter(car => car.classId === 'stock').length,
    civilian: sim.cars.filter(car => car.classId === 'civilian').length, meshes: renderer.carMeshes.size,
    difficulty: sim.difficultyLevel, potholes: sim.potholes.length, elapsed: sim.elapsed,
    gpuMemory: { ...renderer.renderer.info.memory },
    player: { classId: sim.player.classId, modelId: sim.player.modelId, s: sim.player.s, lateral: sim.player.lateral, speed: sim.player.speed, damage: sim.player.damage, wrecked: sim.player.wrecked, pitState: sim.player.pitState },
  };
});
const screenshot = async name => page.screenshot({ path: new URL(name, artifactDir).pathname.replace(/^\/(?=[A-Za-z]:)/, ''), fullPage: true });
const ready = () => page.waitForFunction(() => Boolean(window.__SPLIT_GRID__), { timeout: 20000 });
const racing = () => page.waitForFunction(() => window.__SPLIT_GRID__.simulation.state === 'racing', { timeout: 20000 });
const screenLateral = () => page.evaluate(() => {
  const { simulation: sim, renderer } = window.__SPLIT_GRID__;
  const center = { ...sim.player, lateral: 0 };
  sim.updateWorld(center);
  const carPixel = renderer.lookAt.clone().set(sim.player.x, sim.player.y, sim.player.z).project(renderer.camera);
  const centerPixel = renderer.lookAt.clone().set(center.x, center.y, center.z).project(renderer.camera);
  return carPixel.x - centerPixel.x;
});
const checkField = async label => {
  const value = await state();
  assert.equal(value.count, 20); assert.equal(value.stock, 10); assert.equal(value.civilian, 10); assert.equal(value.meshes, 20);
  checks.push({ check: label, state: value });
};

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await ready();
  await screenshot('desktop-setup.png');
  for (const [track, cap] of [['daytona', '200'], ['talladega', '188'], ['bristol', '500']]) {
    await page.locator('#track').selectOption(track);
    assert.equal(await page.locator('#laps').getAttribute('max'), cap);
    await page.locator('#full-distance').click();
    assert.equal(await page.locator('#laps').inputValue(), cap);
  }
  await page.locator('#track').selectOption('daytona');
  await page.locator('#laps').fill('3');
  await page.locator('#laps').press('Tab');
  const easyHoles = (await state()).potholes;
  await page.locator('#difficulty').focus();
  await page.keyboard.press('End');
  await page.keyboard.press('Tab');
  assert.equal((await state()).difficulty, 100);
  assert.ok((await state()).potholes > easyHoles * 5);
  await screenshot('desktop-extreme-potholes.png');
  checks.push({ check: 'UI track lap caps and Easy–Extreme slider', easyHoles, extremeHoles: (await state()).potholes });
  await page.locator('#start').click(); await racing();
  await page.evaluate(() => {
    const { simulation: sim, renderer } = window.__SPLIT_GRID__;
    const hole = [...sim.potholes].sort((a, b) => a.s - b.s).find(item => item.s > 120);
    Object.assign(sim.player, { s: hole.s - 25, lateral: hole.lateral, speed: 0, lateralVelocity: 0 });
    sim.updateWorld(sim.player); renderer.cameraReady = false;
  });
  await page.waitForTimeout(350);
  await screenshot('desktop-potholes-chase.png');
  checks.push({ check: 'Controlled visual scenario: chase camera25m before real Extreme pothole for visibility review' });
  await page.keyboard.press('p'); await page.locator('#garage').click();
  await page.locator('#difficulty').focus(); await page.keyboard.press('Home'); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Tab');
  assert.equal((await state()).difficulty, 1);
  assert.equal(await page.locator('#difficulty-name').textContent(), 'Moderate');
  assert.doesNotMatch(await page.locator('#difficulty-help').textContent(), /perfect/i);
  await page.locator('#difficulty').focus(); await page.keyboard.press('End');
  for (let index = 0; index < 5; index += 1) await page.keyboard.press('PageDown');
  await page.keyboard.press('Tab');
  assert.equal((await state()).difficulty, 50);
  assert.equal(await page.locator('#difficulty-name').textContent(), 'Hard');
  checks.push({ check: 'Intermediate slider labels agree with engine values:1Moderate,50Hard' });
  await page.locator('#difficulty').focus(); await page.keyboard.press('Home'); await page.keyboard.press('Tab');
  await page.locator('#start').click();
  await racing();
  await checkField('Stock player: simultaneous10stock+10street rendered');
  const before = await state();
  await page.keyboard.down('w'); await page.waitForTimeout(3500); await page.keyboard.up('w');
  const after = await state();
  assert.ok(after.player.speed > 5 && after.player.s > before.player.s + 10);
  await screenshot('desktop-chase-race.png');
  const screenBeforeLeft = await screenLateral();
  await page.keyboard.down('a'); await page.waitForTimeout(500); await page.keyboard.up('a');
  assert.ok((await state()).player.lateral < after.player.lateral);
  const screenAfterLeft = await screenLateral();
  assert.ok(screenAfterLeft < screenBeforeLeft, 'A must move screen-left relative to track center');
  await page.keyboard.down('d'); await page.waitForTimeout(750); await page.keyboard.up('d');
  const screenAfterRight = await screenLateral();
  assert.ok(screenAfterRight > screenAfterLeft, 'D must move screen-right relative to track center');
  await page.keyboard.press('c');
  assert.equal(await page.evaluate(() => window.__SPLIT_GRID__.renderer.mode), 'hood');
  await page.keyboard.press('c');
  await screenshot('desktop-stock-race.png');
  await page.keyboard.press('p');
  assert.equal((await state()).state, 'paused');
  const paused = await state(); await page.waitForTimeout(400);
  assert.equal((await state()).elapsed, paused.elapsed);
  await page.locator('#resume').click();
  // Explicit synthetic focus-loss event verifies safety handler; this does not
  // claim that OS tab/background lifecycle itself was exercised.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  assert.equal((await state()).state, 'paused');
  checks.push({ check: 'Real keyboard throttle/screen-leftA/screen-rightD/camera/pause; synthetic blur safety handler', before, after, projectedLateral: { screenBeforeLeft, screenAfterLeft, screenAfterRight } });
  await page.locator('#garage').click();
  await page.locator('[data-class="civilian"]').click();
  await page.locator('#vehicle').selectOption('camry');
  await page.locator('#track').selectOption('bristol');
  await page.locator('#start').click(); await racing();
  await checkField('Civilian player: simultaneous10stock+10street rendered');
  assert.equal((await state()).player.modelId, 'camry');
  await page.keyboard.down('w'); await page.waitForTimeout(3000); await page.keyboard.up('w');
  assert.ok((await state()).player.speed > 4);
  await screenshot('desktop-street-race.png');
  // Deliberate scenario injection: engine tests separately prove natural pit
  // entry. This browser scenario checks keyboard service and displayed result.
  await page.evaluate(() => {
    const sim = window.__SPLIT_GRID__.simulation;
    Object.assign(sim.player, { s: 0, lateral: sim.pit.lateral, speed: 0, lateralVelocity: 0, damage: 0.6 });
    sim.updateWorld(sim.player);
  });
  await page.keyboard.down('e');
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.pitState === 'servicing', { timeout: 5000 });
  await screenshot('desktop-pit-service.png');
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.pitState === 'complete', { timeout: 25000 });
  await page.keyboard.up('e');
  assert.equal((await state()).player.damage, 0);
  checks.push({ check: 'Injected pit position, real keyboardE service for full duration, Easy damage0', state: await state() });
  // Deliberately accelerate to a final-line scenario to verify result rendering;
  // full race-distance verification lives in the independent engine suite.
  await page.evaluate(() => {
    const sim = window.__SPLIT_GRID__.simulation;
    Object.assign(sim.player, { s: sim.laps * sim.track.length - 0.02, lateral: 0, speed: 10, completedLaps: sim.laps - 1, crossedStart: true });
    sim.updateWorld(sim.player);
  });
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.finished);
  await page.locator('#results-overlay:not(.hidden)').waitFor();
  assert.doesNotMatch(await page.locator('#result-stats').textContent(), /DNF/);
  await page.evaluate(() => { window.__SPLIT_GRID__.simulation.player.damage = 1; });
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.wrecked);
  assert.doesNotMatch(await page.locator('#results-title').textContent(), /ends here/i);
  assert.doesNotMatch(await page.locator('#result-stats').textContent(), /DNF/);
  await screenshot('desktop-finish-result.png');
  checks.push({ check: 'Injected final-line scenario: finish results preserve classification despite later physicalwreck' });
  await page.locator('#race-again').click(); await racing();
  await page.evaluate(() => { window.__SPLIT_GRID__.simulation.player.damage = 1; });
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.wrecked);
  await page.locator('#results-overlay:not(.hidden)').waitFor();
  await screenshot('desktop-permanent-wreck.png');
  assert.match(await page.locator('#results-title').textContent(), /ends here/i);
  assert.equal(await page.locator('#recover').isDisabled(), true);
  const wreck = await state();
  await page.locator('#spectate').click(); await page.waitForTimeout(1000);
  assert.equal((await state()).player.s, wreck.player.s);
  assert.equal((await state()).player.lateral, wreck.player.lateral);
  assert.equal(await page.evaluate(() => {
    const { simulation: sim, renderer } = window.__SPLIT_GRID__;
    return Boolean(renderer.spectatorCar && renderer.spectatorCar.id !== sim.player.id && !renderer.spectatorCar.wrecked);
  }), true, 'spectator camera should follow a surviving driver');
  await page.keyboard.press('p'); await page.locator('#restart').click();
  assert.equal((await state()).player.wrecked, false);
  assert.equal((await state()).player.damage, 0);
  checks.push({ check: 'Injected terminal damage: DNF, stationary persistent wreck, spectate, explicitrestart clears', wreck });
  await page.keyboard.press('p'); await page.locator('#garage').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await screenshot('mobile-setup.png');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('#start').click(); await racing();
  await page.locator('[data-touch="throttle"]').waitFor({ state: 'visible' });
  const gas = await page.locator('[data-touch="throttle"]').boundingBox();
  await page.mouse.move(gas.x + gas.width / 2, gas.y + gas.height / 2);
  await page.mouse.down(); await page.waitForTimeout(1500); await page.mouse.up();
  assert.ok((await state()).player.speed > 1);
  await screenshot('mobile-race.png');
  checks.push({ check: '390px mobile viewport: no horizontal overflow; real pointer gas control accelerates', state: await state() });
  const textureCounts = [(await state()).gpuMemory.textures];
  for (let restart = 0; restart < 3; restart += 1) {
    await page.keyboard.press('p'); await page.locator('#restart').click();
    await page.waitForTimeout(100);
    textureCounts.push((await state()).gpuMemory.textures);
  }
  assert.equal(new Set(textureCounts).size, 1, 'GPU texture count should stay stable across same-track restarts');
  checks.push({ check: 'Same-track GPUtexturecount remainsstable across3explicitrestarts', textureCounts });
  assert.deepEqual(errors, []);
  await writeFile(new URL('browser-verification.json', artifactDir), JSON.stringify({ baseURL, checks, errors, verificationBoundary: 'Short real-input browser drives; pit and DNF deliberately injected; complete3lap runs separately exercised in pureengine tests.' }, null, 2));
  console.log(JSON.stringify({ passed: true, checks: checks.length, errors, artifacts: artifactDir.pathname }, null, 2));
} catch (error) {
  await screenshot('browser-failure.png').catch(() => {});
  await writeFile(new URL('browser-verification.json', artifactDir), JSON.stringify({ baseURL, checks, errors, failure: error.stack }, null, 2));
  throw error;
} finally {
  await browser.close();
}
