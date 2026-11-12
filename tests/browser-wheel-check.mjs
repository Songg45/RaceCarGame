import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const baseURL = process.env.RACE_URL || 'http://127.0.0.1:4173/';
const directory = new URL('../artifacts/wheel-damage/', import.meta.url);
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const browserDeadline = setTimeout(() => browser.close(), 60000);
browserDeadline.unref();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const shot = name => page.screenshot({ path: fileURLToPath(new URL(name, directory)), fullPage: true });
const simState = () => page.evaluate(() => {
  const { simulation: sim, renderer } = window.__SPLIT_GRID__;
  return { state: sim.state, elapsed: sim.elapsed, wheels: sim.player.wheels, handling: sim.player.handling, damage: sim.player.damage, speed: sim.player.speed, pitState: sim.player.pitState, assignedBay: sim.getPitBay(sim.player), bayCount: sim.pit.bays.length, renderedBays: renderer.bayVisuals.size, carCount: sim.cars.length };
});
const start = async () => {
  await page.locator('#start').click();
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.state === 'racing');
};
const componentScenario = () => page.evaluate(() => {
  const { simulation: sim, renderer } = window.__SPLIT_GRID__;
  Object.assign(sim.player, { s: 25, lateral: 0, speed: 12, lateralVelocity: 0, damage: 0.55 });
  Object.assign(sim.player.wheels.find(wheel => wheel.id === 'FL'), { tire: 'punctured', pressure: 0.85, leakRate: 0.02 });
  Object.assign(sim.player.wheels.find(wheel => wheel.id === 'FR'), { tire: 'blown', pressure: 0, leakRate: 0 });
  Object.assign(sim.player.wheels.find(wheel => wheel.id === 'RL'), { bend: 0.8 });
  Object.assign(sim.player.wheels.find(wheel => wheel.id === 'RR'), { suspensionDamage: 0.95, suspensionStatus: 'broken' });
  sim.updateHandling(sim.player); sim.updateWorld(sim.player);
  renderer.mode = 'chase'; renderer.cameraReady = false;
});

try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__SPLIT_GRID__));
  assert.equal(await page.locator('script[src*="@vite/client"]').count(), 0, 'stable play must not contain the development HMR client');
  const idleBefore = await page.evaluate(() => window.__SPLIT_GRID__.renderer.renderer.info.render.frame);
  await page.waitForTimeout(600);
  const idleAfter = await page.evaluate(() => window.__SPLIT_GRID__.renderer.renderer.info.render.frame);
  assert.equal(idleAfter, idleBefore, 'the idle garage must not redraw continuously');
  assert.equal(await page.evaluate(() => window.__SPLIT_GRID__.renderer.renderer.getPixelRatio()), 1);
  await shot('stable-play-garage.png');
  checks.push({ check: 'Stable production snapshot at DPR1; idle garage does not redraw continuously', idleBefore, idleAfter });
  await page.locator('#track').selectOption('bristol');
  await page.locator('#difficulty').focus(); await page.keyboard.press('Home');
  await start();
  const healthy = await simState();
  assert.equal(healthy.bayCount, 20); assert.equal(healthy.renderedBays, 20); assert.equal(healthy.carCount, 20);
  assert.equal(await page.locator('#wheel-grid [data-wheel]').count(), 4);
  assert.match(await page.locator('#pit-status').textContent(), new RegExp(`BAY ${String(healthy.assignedBay.number).padStart(2, '0')}`));
  await page.keyboard.press('c'); await page.keyboard.press('c');
  await page.waitForTimeout(150); await shot('twenty-bay-pit-overview.png');
  checks.push({ check: '20 distinct engine bays and rendered bay groups; four corner HUD; own bay identity', assignedBay: healthy.assignedBay });

  const activeDrawStart = await page.evaluate(() => window.__SPLIT_GRID__.renderer.renderer.info.render.frame);
  await page.waitForTimeout(1000);
  const activeDrawEnd = await page.evaluate(() => window.__SPLIT_GRID__.renderer.renderer.info.render.frame);
  assert.ok(activeDrawEnd - activeDrawStart <= 66, 'active drawing should stay within the 60fps cap plus timing tolerance');
  // Headless tabs do not consistently expose native background visibility.
  // Exercise the real visibility handler with an explicitly controlled DOM
  // visibility event and distinguish this from a manual foreground-tab test.
  const hiddenState = await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    return { elapsed: window.__SPLIT_GRID__.simulation.elapsed, draws: window.__SPLIT_GRID__.renderer.renderer.info.render.frame };
  });
  await page.waitForTimeout(350);
  assert.deepEqual(await page.evaluate(() => ({ elapsed: window.__SPLIT_GRID__.simulation.elapsed, draws: window.__SPLIT_GRID__.renderer.renderer.info.render.frame })), hiddenState);
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.locator('#resume').click();
  checks.push({ check: 'Active drawing is capped; controlled visibility event suspends physics and drawing', activeDrawsInOneSecond: activeDrawEnd - activeDrawStart, hiddenState });

  const lostContext = await page.evaluate(() => {
    const app = window.__SPLIT_GRID__;
    window.__qaOriginalSimulation = app.simulation;
    window.__qaLoseContext = app.renderer.renderer.getContext().getExtension('WEBGL_lose_context');
    if (!window.__qaLoseContext) return false;
    window.__qaLoseContext.loseContext();
    return true;
  });
  assert.equal(lostContext, true, 'test browser must support controlled context-loss exercise');
  await page.waitForFunction(() => window.__SPLIT_GRID__.renderer.contextLost);
  assert.equal(await page.locator('#graphics-overlay').isVisible(), true);
  const recoveryState = await page.evaluate(() => ({ elapsed: window.__SPLIT_GRID__.simulation.elapsed, s: window.__SPLIT_GRID__.simulation.player.s }));
  await page.waitForTimeout(400);
  assert.deepEqual(await page.evaluate(() => ({ elapsed: window.__SPLIT_GRID__.simulation.elapsed, s: window.__SPLIT_GRID__.simulation.player.s })), recoveryState);
  await page.evaluate(() => window.__qaLoseContext.restoreContext());
  await page.waitForFunction(() => !document.querySelector('#graphics-resume').disabled);
  await page.locator('#graphics-resume').click();
  assert.equal(await page.evaluate(() => window.__SPLIT_GRID__.simulation === window.__qaOriginalSimulation), true);
  await page.waitForTimeout(150);
  assert.ok((await simState()).elapsed > recoveryState.elapsed);
  checks.push({ check: 'Controlled WebGL context loss pauses the field; explicit recovery retains the same race and resumes without reset', recoveryState });

  await page.evaluate(() => {
    const sim = window.__SPLIT_GRID__.simulation;
    Object.assign(sim.player.wheels.find(wheel => wheel.id === 'FL'), { tire: 'punctured', pressure: 0.95, leakRate: 0.04 });
    sim.updateHandling(sim.player);
  });
  const initialPressure = (await simState()).wheels.find(wheel => wheel.id === 'FL').pressure;
  await page.waitForTimeout(2200);
  assert.ok((await simState()).wheels.find(wheel => wheel.id === 'FL').pressure < initialPressure - 0.04);
  assert.match(await page.locator('[data-wheel="FL"]').getAttribute('aria-label'), /puncture/);
  await page.keyboard.press('p');
  await page.waitForTimeout(100);
  const pausedPressure = (await simState()).wheels.find(wheel => wheel.id === 'FL').pressure;
  const pausedDraws = await page.evaluate(() => window.__SPLIT_GRID__.renderer.renderer.info.render.frame);
  await page.waitForTimeout(300);
  assert.equal((await simState()).wheels.find(wheel => wheel.id === 'FL').pressure, pausedPressure);
  assert.equal(await page.evaluate(() => window.__SPLIT_GRID__.renderer.renderer.info.render.frame), pausedDraws);
  await page.locator('#resume').click();
  checks.push({ check: 'Controlled FL puncture pressure drops during real-time play and freezes on pause', initialPressure, pausedPressure });

  await componentScenario();
  await page.waitForFunction(() => document.querySelector('[data-wheel="RR"]').textContent.includes('BROKEN'));
  assert.match(await page.locator('[data-wheel="FL"]').getAttribute('aria-label'), /puncture/);
  assert.match(await page.locator('[data-wheel="FR"]').getAttribute('aria-label'), /blowout/);
  assert.match(await page.locator('[data-wheel="RL"]').getAttribute('aria-label'), /bent/);
  assert.match(await page.locator('[data-wheel="RR"]').getAttribute('aria-label'), /broken/);
  await page.keyboard.down('w'); await page.waitForTimeout(500); await page.keyboard.up('w');
  const damaged = await simState();
  assert.ok(damaged.handling.gripFactor < 1 && damaged.handling.steeringFactor < 1 && damaged.handling.brakingFactor < 1);
  const cornerMeshes = await page.evaluate(() => {
    const { simulation: sim, renderer } = window.__SPLIT_GRID__;
    return renderer.carMeshes.get(sim.player.id).userData.wheels.map(wheel => ({ id: wheel.userData.id, side: wheel.userData.side, axle: wheel.userData.axle, tireScale: wheel.userData.tire.scale.x, y: wheel.position.y }));
  });
  assert.deepEqual(cornerMeshes.map(wheel => wheel.id).sort(), ['FL', 'FR', 'RL', 'RR']);
  assert.ok(cornerMeshes.find(wheel => wheel.id === 'FR').tireScale < cornerMeshes.find(wheel => wheel.id === 'RL').tireScale);
  await shot('desktop-four-corner-damage.png');
  checks.push({ check: 'Controlled four distinct failures: correct per-corner labels, flat-tire visual, reduced handling, real throttle input', damaged, cornerMeshes });

  await page.evaluate(() => {
    const { simulation: sim, renderer } = window.__SPLIT_GRID__;
    const bay = sim.getPitBay(sim.player);
    Object.assign(sim.player, { s: bay.s, lateral: bay.lateral, speed: 0, lateralVelocity: 0 });
    sim.updateWorld(sim.player); renderer.mode = 'overhead'; renderer.cameraReady = false;
  });
  await page.keyboard.down('e');
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.pitState === 'servicing');
  await page.waitForFunction(() => document.querySelector('#pit-status').textContent.includes('SERVICE'));
  await shot('assigned-bay-service.png');
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.pitState === 'complete', null, { timeout: 20000 });
  await page.keyboard.up('e'); await page.waitForTimeout(150);
  const repaired = await simState();
  assert.equal(repaired.damage, 0);
  assert.ok(repaired.wheels.every(wheel => wheel.tire === 'intact' && wheel.pressure === 1 && wheel.bend === 0 && wheel.suspensionDamage === 0));
  assert.equal(repaired.handling.gripFactor, 1);
  assert.equal(repaired.handling.steeringFactor, 1);
  assert.equal(repaired.handling.brakingFactor, 1);
  assert.match(await page.locator('#handling-summary').textContent(), /Grip 100%.*Steer 100%.*Brake 100%/);
  await shot('easy-components-restored.png');
  checks.push({ check: 'Injected own-bay position, real E input and full service duration restore all Easy components and HUD', repaired });

  await page.keyboard.press('p'); await page.locator('#garage').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-class="civilian"]').click(); await start();
  await componentScenario(); await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const layout = await page.evaluate(() => {
    const telemetry = document.querySelector('.telemetry').getBoundingClientRect();
    const touch = document.querySelector('.touch-controls').getBoundingClientRect();
    const wheelGrid = document.querySelector('#wheel-grid').getBoundingClientRect();
    return { telemetryBottom: telemetry.bottom, touchTop: touch.top, wheelTop: wheelGrid.top, wheelBottom: wheelGrid.bottom, viewportHeight: innerHeight };
  });
  assert.ok(layout.telemetryBottom <= layout.touchTop, 'damage HUD must leave touch pedals accessible');
  assert.ok(layout.wheelTop >= 0 && layout.wheelBottom <= layout.viewportHeight);
  assert.equal(await page.locator('[data-touch="throttle"]').isVisible(), true);
  await shot('mobile-four-corner-damage.png');
  checks.push({ check: '390px mobile component HUD stays on-screen and does not overlap pedals', layout });

  await page.evaluate(() => {
    const sim = window.__SPLIT_GRID__.simulation;
    const wheel = sim.player.wheels.find(item => item.id === 'FL');
    wheel.assembly = 'destroyed'; sim.player.damage = 1;
  });
  await page.waitForFunction(() => window.__SPLIT_GRID__.simulation.player.wrecked);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => {
    const { simulation: sim, renderer } = window.__SPLIT_GRID__;
    return renderer.carMeshes.get(sim.player.id).userData.wheels.find(wheel => wheel.userData.id === 'FL').visible;
  }), false);
  assert.equal(await page.locator('#service').isDisabled(), true);
  assert.equal(await page.locator('#recover').isDisabled(), true);
  await shot('assembly-failure-retirement.png');
  checks.push({ check: 'Controlled assembly-loss scenario hides the correct wheel and retires the car permanently' });

  assert.deepEqual(errors, []);
  await writeFile(new URL('browser-wheel-verification.json', directory), JSON.stringify({ passed: true, baseURL, checks, errors, boundary: 'Independent headless browser. Component/bay scenarios use explicitly injected starting states; real time, key input, rendering, HUD, pause, service, and mobile layout are then exercised. Normal physical approach, contact randomness, and full races are covered separately by engine tests.' }, null, 2));
  console.log(JSON.stringify({ passed: true, checks: checks.length, errors }));
} catch (error) {
  await shot('browser-wheel-failure.png').catch(() => {});
  await writeFile(new URL('browser-wheel-verification.json', directory), JSON.stringify({ passed: false, checks, errors, failure: error.stack }, null, 2));
  throw error;
} finally { clearTimeout(browserDeadline); await browser.close(); }
