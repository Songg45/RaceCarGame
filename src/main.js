import './styles.css';
import { RaceSimulation, sampleTrack, ENGINE_LIMITS } from './simulation.js';
import { TRACKS, STREET_CLASSES, STOCK_CAR, getStreetClass, TRUCK_SAFE_SPEED } from './catalog.js';
import { RaceRenderer } from './renderer.js';
import { WatchSeries } from './watch-series.js';

const $ = (selector) => document.querySelector(selector);
const mph = (speed = 0) => Math.round(speed * 2.236936);
const time = (seconds) => seconds == null || !Number.isFinite(seconds) ? '—' : `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
const safe = (text) => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const difficultyName = (value) => value === 0 ? 'Easy' : value < 40 ? 'Moderate' : value < 80 ? 'Hard' : 'Extreme';
let config = { trackId: TRACKS[0].id, playerClass: 'stock', streetClassId: 'sedan', laps: 3, difficulty: 0 };
let sim, view, inMenu = true, boardClass = 'stock', resultsShown = false, spectating = false, lastUI = 0, lastEvent = '', eventTimeout;
let watch = null, lastWatchReport = null, watchPhase = '', pausedForVisibility = false;
let wakeFrame = () => {}, suspendFrames = () => {}, graphicsPausedRace = false;
const keys = new Set(), touch = { throttle: 0, brake: 0, steer: 0, service: false };
const streetPresentation = {
  sedan: { speed: 3, protection: 2, perk: 'Balanced handling · Strong brakes', outline: 'M8 31L23 26L33 15H62L76 28L91 32V43H8Z', cabin: 'M31 26L38 19H60L69 26Z', help: 'A balanced everyday car with dependable steering and braking.' },
  sports: { speed: 4, protection: 1, perk: 'Maximum pace · Most vulnerable', outline: 'M6 34L29 28L43 20H63L78 30L93 34V43H6Z', cabin: 'M38 28L47 23H61L69 28Z', help: 'The fastest Street role, including sports and muscle cars. Potholes punish it hardest.' },
  suv: { speed: 2, protection: 3, perk: 'Roadside crew · 15-second repair', outline: 'M8 25L20 11H68L81 27L91 30V43H8Z', cabin: 'M21 24L27 15H65L73 24Z', help: 'Stop clear of traffic for a 15-second roadside repair. Pit stops recharge it; contact during repair causes severe damage and loses the crew for the race.' },
  truck: { speed: 1, protection: 4, perk: 'Pothole immunity below 15 MPH', outline: 'M8 18H37L48 29H92V43H8Z', cabin: 'M15 22H34L40 29H15Z', help: 'The slowest, toughest Street role. Potholes cause no new damage or slowdown below 15 MPH; collisions and engine wear still matter.' },
};
const rating = value => Array.from({ length: 4 }, (_, index) => `<i class="${index < value ? 'filled' : ''}"></i>`).join('');
const streetCards = ['sedan', 'sports', 'suv', 'truck'].map(id => {
  const role = STREET_CLASSES.find(item => item.id === id), display = streetPresentation[id];
  return `<button class="street-card ${id === config.streetClassId ? 'selected' : ''}" data-street-role="${id}" aria-pressed="${id === config.streetClassId}" aria-label="${safe(role.name)}. Speed ${display.speed} of 4. Pothole protection ${display.protection} of 4. ${safe(display.perk)}"><div class="street-card-heading"><strong>${safe(role.name)}</strong><svg viewBox="0 0 100 54" class="role-silhouette" aria-hidden="true" focusable="false"><path d="${display.outline}" fill="currentColor"/><path d="${display.cabin}" fill="#152a35"/><circle cx="25" cy="42" r="8" fill="#12212b"/><circle cx="76" cy="42" r="8" fill="#12212b"/><circle cx="25" cy="42" r="4" fill="#aebebc"/><circle cx="76" cy="42" r="4" fill="#aebebc"/></svg></div><div class="role-rating"><span>SPEED</span><b aria-hidden="true">${rating(display.speed)}</b></div><div class="role-rating"><span>PROTECTION</span><b aria-hidden="true">${rating(display.protection)}</b></div><small>${display.perk}</small></button>`;
}).join('');

$('#app').innerHTML = `
  <div id="world"></div>
  <div class="vignette"></div>
  <header class="brand"><div class="brand-icon" aria-hidden="true"><i></i><i></i><i></i></div><div>SPLIT<span>/</span>GRID<small>STOCK vs STREET</small></div></header>
  <div class="top-status"><span class="live-dot"></span><span id="top-track">${safe(TRACKS[0].name)}</span><span class="status-divider"></span><span>20 DRIVERS · ONE TRACK</span></div>
  <section id="setup" class="setup-panel" aria-label="Race setup">
    <div class="eyebrow"><span class="small-line"></span> THE MIXED-CLASS CHALLENGE</div>
    <h1>Two races.<br>One <em>racing line.</em></h1>
    <p class="intro">Ten stock cars. Ten everyday drivers. Share the asphalt, trade paint, and race your own class.</p>
    <div class="field-label"><span>01</span> CHOOSE YOUR SIDE</div>
    <div class="class-selector" role="group" aria-label="Vehicle class">
      <button class="class-choice selected" data-class="stock" aria-pressed="true"><span class="car-icon stock-icon">▰</span><strong>Stock car</strong><small>POWER. PRECISION.</small><span class="choice-dot"></span></button>
      <button class="class-choice" data-class="civilian" aria-pressed="false"><span class="car-icon road-icon">▰</span><strong>Street car</strong><small>EVERYDAY. ALL OUT.</small><span class="choice-dot"></span></button>
    </div>
    <div id="street-choices" class="street-choices hidden"><div class="street-choice-label">FOUR ROLES · ONE STREET RACE</div><div id="street-cards" class="street-cards" role="group" aria-label="Choose your Street role">${streetCards}</div><p id="street-role-help" class="street-role-help"></p></div>
    <div class="vehicle-row"><div><span class="vehicle-label">YOUR MACHINE</span><strong id="vehicle-name">V8 Stock Car · #88</strong></div><div class="vehicle-speed"><strong id="vehicle-speed">200</strong><small>TOP MPH*</small></div></div>
    <div class="field-label"><span>02</span> SET YOUR RACE</div>
    <div class="setup-grid"><label class="select-field">CIRCUIT<select id="track">${TRACKS.map(t => `<option value="${safe(t.id)}">${safe(t.name)}</option>`).join('')}</select></label><label class="lap-field">LAPS<input id="laps" type="number" min="3" max="200" step="1" value="3" inputmode="numeric"></label></div>
    <div class="track-info"><span id="track-details"></span><button id="full-distance" class="text-button">Full race ↗</button></div>
    <div class="difficulty-top"><label for="difficulty">TRACK DIFFICULTY</label><strong id="difficulty-name">Easy</strong></div>
    <input id="difficulty" class="difficulty-slider" type="range" min="0" max="100" step="1" value="0" aria-label="Track difficulty">
    <div class="range-labels"><span>EASY</span><span>EXTREME</span></div>
    <p id="difficulty-help" class="difficulty-help">Every completed pit stop replaces all four tires. Other repair quality follows difficulty.</p>
    <button id="start" class="primary-button">TAKE THE GRID <span>↗</span></button>
    <button id="watch-series" class="secondary-button watch-launch">WATCH 3-RACE SERIES <span>▶</span></button>
    <p class="watch-launch-note">Autopilot · Easy 10 laps → Medium 15 → Extreme 20</p>
    <div class="setup-foot"><span><i class="yellow-dot"></i> 10 STOCK + 10 STREET</span><span>ASSISTED OVAL DRIVING</span></div>
  </section>
  <aside id="scene-label" class="scene-label"><span class="eyebrow">YOUR NEXT CHALLENGE</span><strong id="scene-track"></strong><span id="scene-subtitle"></span><div><b class="stock-dot"></b> STOCK CLASS <b class="street-dot"></b> STREET CLASS</div></aside>
  <main id="race-ui" class="hidden" aria-label="Race dashboard">
    <div class="race-top"><div class="race-lap"><span>LAP</span><strong id="lap-value">1<span>/ 3</span></strong></div><div class="race-position"><span>CLASS POSITION</span><strong id="position-value">1 <span>/ 10</span></strong></div><div class="race-timing"><span>RACE TIME</span><strong id="race-time">0:00.00</strong></div><div class="race-actions"><button id="camera" title="Change camera (C)" aria-label="Change camera">CAM <small>C</small></button><button id="pause" title="Pause (P or Escape)">PAUSE <small>P</small></button><button id="sound" aria-pressed="false" title="Toggle engine sound">SOUND OFF</button><button id="fullscreen" aria-label="Toggle fullscreen" title="Fullscreen">⛶</button></div></div>
    <aside class="leaderboard"><div class="board-heading"><strong>LIVE TIMING</strong><span id="board-count">10 DRIVERS</span></div><div class="board-tabs" role="group" aria-label="Standings class"><button data-board="stock" class="active">STOCK</button><button data-board="civilian">STREET</button><button data-board="all">OVERALL</button></div><div id="standings"></div><div class="board-footer"><span class="yellow-dot"></span> YOUR CAR <span class="board-note">RACE YOUR CLASS</span></div></aside>
    <div id="race-message" role="status" class="race-message hidden"></div>
    <div id="countdown" class="countdown hidden" aria-live="polite"><small>GET READY</small><strong>3</strong></div>
    <section class="telemetry"><div class="speed-row"><strong id="speed">0</strong><div><span>MPH</span><b id="gear">N</b></div><div class="throttle-meter"><i id="throttle-fill"></i></div></div><div class="speed-rule"></div><div class="condition-row"><span>CAR CONDITION</span><strong id="condition">100%</strong></div><div class="condition-meter"><i id="condition-fill"></i></div><div class="telemetry-meta"><span id="class-label">STOCK CLASS</span><span id="draft-label">CLEAN AIR</span></div><div class="pit-instruction" id="pit-status">PIT LANE · INSIDE THE HOME STRAIGHT</div><button id="service" class="service-button">PRESS E · PIT SERVICE</button></section>
    <aside class="map-panel"><div class="map-heading"><span>TRACK MAP</span><span id="camera-label">CHASE CAM</span></div><canvas id="minimap" width="280" height="160" aria-label="Track map, cars and pit lane"></canvas><div class="map-legend"><span><b class="stock-dot"></b> STOCK</span><span><b class="street-dot"></b> STREET</span><span><b class="you-dot"></b> YOU</span></div></aside>
    <div class="controls-bar"><span><kbd>W</kbd><kbd>↑</kbd> THROTTLE</span><span><kbd>S</kbd><kbd>↓</kbd> BRAKE</span><span><kbd>A</kbd><kbd>D</kbd> STEER</span><span><kbd>E</kbd> PIT SERVICE</span><button id="recover">RECOVER <kbd>R</kbd></button><span class="assist-note">STEERING ASSIST ON</span></div>
    <div class="touch-controls"><div class="touch-steering"><button data-touch="left" aria-label="Steer left">◀</button><button data-touch="right" aria-label="Steer right">▶</button></div><div class="touch-pedals"><button data-touch="brake" aria-label="Brake">BRAKE</button><button data-touch="throttle" aria-label="Accelerate">GAS</button></div></div>
    <aside id="watch-banner" class="watch-banner hidden"><div class="eyebrow"><span class="live-dot"></span> LIVE AUTOPILOT · NORMAL SPEED</div><strong id="watch-run"></strong><p id="watch-progress"></p><small id="watch-focus"></small></aside>
    <div id="watch-controls" class="watch-controls hidden"><span id="watch-sequence">EASY 10 → MEDIUM 15 → EXTREME 20</span><button id="watch-export">EXPORT RESULTS</button><button id="watch-stop">STOP SERIES</button><button id="watch-garage">GARAGE</button></div>
  </main>
  <div id="pause-overlay" class="modal-backdrop hidden"><section class="modal pause-modal" aria-labelledby="pause-title"><div class="eyebrow">TAKE A BREATHER</div><h2 id="pause-title">Race paused.</h2><p>The whole field is paused. Your racing line will be right here.</p><button id="resume" class="primary-button">BACK TO RACING <span>↗</span></button><button id="restart" class="secondary-button">RESTART RACE</button><button id="garage" class="text-button">Return to garage</button></section></div>
  <div id="results-overlay" class="modal-backdrop hidden"><section class="modal results-modal" aria-labelledby="results-title"><div class="eyebrow" id="results-eyebrow">CHECKERED FLAG</div><h2 id="results-title">Race complete.</h2><p id="results-subtitle"></p><div id="result-stats" class="result-stats"></div><div class="result-table-heading"><span>YOUR CLASS</span><span>RACE TIME</span></div><div id="result-standings"></div><p id="results-note" class="result-note"></p><div class="results-buttons"><button id="race-again" class="primary-button">RACE AGAIN <span>↗</span></button><button id="spectate" class="secondary-button">WATCH THE RACE</button><button id="results-garage" class="text-button">Return to garage</button></div></section></div>
  <div id="load-error" class="modal-backdrop hidden"><section class="modal"><h2>Unable to start 3D view</h2><p id="load-error-detail"></p></section></div>
  <div id="graphics-overlay" class="modal-backdrop graphics-overlay hidden"><section class="modal"><div class="eyebrow">GRAPHICS RECOVERY</div><h2>Graphics paused.</h2><p id="graphics-status">The browser lost its graphics context. Your race is paused and its state is kept in this tab. Waiting for graphics to recover…</p><button id="graphics-resume" class="primary-button" disabled>WAITING FOR GRAPHICS</button></section></div>
  <div id="series-overlay" class="modal-backdrop hidden"><section class="modal series-modal" aria-labelledby="series-title"><div class="eyebrow">AUTONOMOUS RACE SERIES</div><h2 id="series-title"></h2><p id="series-subtitle"></p><div id="series-results"></div><p id="series-next-label"></p><button id="series-next" class="primary-button">NEXT RACE <span>↗</span></button><button id="series-hold" class="secondary-button">PAUSE BETWEEN RACES</button><button id="series-export" class="secondary-button">DOWNLOAD RESULTS JSON</button><button id="series-garage" class="text-button">Return to garage</button></section></div>
`;

$('.condition-row > span').textContent = 'BODY CONDITION';
$('.condition-meter').insertAdjacentHTML('afterend', `<section id="wheel-condition" class="wheel-condition" aria-label="Wheel and suspension condition"><div id="wheel-grid" class="wheel-grid"></div><div id="wheel-warning" class="wheel-warning"></div><details class="handling-details"><summary id="handling-summary">HANDLING</summary><div id="handling-detail"></div></details></section>`);
$('#wheel-condition').insertAdjacentHTML('beforebegin', `<section id="engine-condition" class="engine-condition" aria-label="Engine heat and condition"><div class="engine-heading"><span>ENGINE HEAT</span><strong id="engine-heat">0%</strong><small id="engine-health">CONDITION 100%</small></div><div class="engine-meter"><i id="engine-heat-fill"></i></div><small id="engine-warning" class="hidden"></small></section>`);
$('.telemetry-meta').insertAdjacentHTML('afterend', `<section id="truck-protection" class="truck-protection hidden" aria-label="Truck pothole protection"><strong id="truck-protection-state"></strong><span id="truck-protection-detail"></span></section><section id="roadside-panel" class="roadside-panel hidden" aria-label="Roadside repair"><div class="roadside-heading"><span>ROADSIDE CREW</span><strong id="roadside-charge"></strong></div><div id="roadside-progress" class="roadside-progress hidden"><i></i></div><p id="roadside-status"></p><button id="roadside" class="roadside-button" type="button">CALL CREW <kbd>M</kbd></button><small id="roadside-warning">Contact during repair causes severe damage.</small></section>`);
$('.controls-bar .assist-note').insertAdjacentHTML('beforebegin', `<span id="roadside-key-hint" class="hidden"><kbd>M</kbd> ROADSIDE CREW</span>`);
$('#series-next').insertAdjacentHTML('beforebegin', `<button id="series-retry" class="primary-button hidden">RETRY FROM SAME POSITIONS <span>↗</span></button><button id="series-restart" class="secondary-button hidden">RESTART ENTIRE SERIES</button>`);

function currentTrack() { return TRACKS.find(t => t.id === config.trackId) || TRACKS[0]; }
function buildSimulation() {
  return new RaceSimulation({ ...config, difficulty: config.difficulty, seed: (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0 });
}
function selectedCar() { return config.playerClass === 'stock' ? STOCK_CAR : getStreetClass(config.streetClassId); }
function setupChanged(rebuild = true) {
  const track = currentTrack(), car = selectedCar();
  config.laps = Math.max(3, Math.min(track.standardLaps, Math.round(Number($('#laps').value) || 3)));
  $('#laps').value = config.laps; $('#laps').max = track.standardLaps;
  $('#street-choices').classList.toggle('hidden', config.playerClass !== 'civilian');
  document.body.classList.toggle('street-selection', config.playerClass === 'civilian');
  document.querySelectorAll('[data-street-role]').forEach(button => { const selected = button.dataset.streetRole === config.streetClassId; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); });
  $('#street-role-help').textContent = streetPresentation[config.streetClassId].help;
  $('#vehicle-speed').textContent = mph(car.maxSpeed);
  $('#vehicle-name').textContent = config.playerClass === 'stock' ? `${STOCK_CAR.name || 'V8 Stock Car'} · #88` : car.name;
  $('#track-details').textContent = `${(track.length / 1609.344).toFixed(track.expanded || track.length < 1500 ? 3 : 2)} MI · 3–${track.standardLaps} LAPS${track.expanded ? ' · EXPANDED LAYOUT' : ''}`;
  $('#scene-track').textContent = track.name; $('#scene-subtitle').textContent = track.subtitle || 'A full-throttle oval challenge'; $('#top-track').textContent = `${track.name}${track.expanded ? ' · Expanded layout' : ''}`;
  $('#difficulty-name').textContent = difficultyName(config.difficulty);
  $('#difficulty').style.setProperty('--fill', `${config.difficulty}%`);
  const potholeHelp = config.difficulty === 0 ? 'Sparse potholes.' : config.difficulty < 40 ? 'More potholes.' : config.difficulty < 80 ? 'Heavy potholes.' : 'Pothole-riddled track.';
  const repairHelp = config.difficulty === 0 ? 'All other damage is fully repaired.' : config.difficulty < 40 ? 'Other repairs are partial.' : config.difficulty < 80 ? 'Other repairs are unreliable.' : 'Other repairs can worsen damage.';
  $('#difficulty-help').textContent = `${potholeHelp} Every completed pit stop replaces all four tires. ${repairHelp} Wrecks stay on track.`;
  if (rebuild && view) { sim = buildSimulation(); view.setRace(sim); wakeFrame(); }
}

document.querySelectorAll('[data-class]').forEach(button => button.addEventListener('click', () => {
  config.playerClass = button.dataset.class;
  document.querySelectorAll('[data-class]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-pressed', String(b === button)); }); setupChanged();
}));
document.querySelectorAll('[data-street-role]').forEach(button => button.addEventListener('click', () => { config.streetClassId = button.dataset.streetRole; setupChanged(); }));
$('#track').addEventListener('change', e => { config.trackId = e.target.value; setupChanged(); });
$('#laps').addEventListener('change', () => setupChanged(false));
$('#difficulty').addEventListener('input', e => { config.difficulty = Number(e.target.value); setupChanged(false); });
$('#difficulty').addEventListener('change', () => setupChanged());
$('#full-distance').addEventListener('click', () => { $('#laps').value = currentTrack().standardLaps; setupChanged(false); });

function setBoard(value) { boardClass = value; document.querySelectorAll('[data-board]').forEach(b => b.classList.toggle('active', b.dataset.board === value)); lastUI = 0; }
document.querySelectorAll('[data-board]').forEach(b => b.addEventListener('click', () => setBoard(b.dataset.board)));
function clearInput() { keys.clear(); Object.assign(touch, { throttle: 0, brake: 0, steer: 0, service: false }); document.querySelectorAll('[data-touch]').forEach(b => b.classList.remove('pressed')); }
function startRace() {
  watch = null; document.body.classList.remove('watching'); $('#watch-banner').classList.add('hidden'); $('#watch-controls').classList.add('hidden'); $('#series-overlay').classList.add('hidden'); $('#restart').textContent = 'RESTART RACE';
  $('#pause').innerHTML = 'PAUSE <small>P</small>';
  setupChanged(false); clearInput(); sim = buildSimulation(); view.setRace(sim); inMenu = false; spectating = false; resultsShown = false;
  $('#setup').classList.add('hidden'); $('#scene-label').classList.add('hidden'); $('#race-ui').classList.remove('hidden');
  $('#pause-overlay').classList.add('hidden'); $('#results-overlay').classList.add('hidden'); document.body.classList.add('racing');
  setBoard(config.playerClass); $('#class-label').textContent = config.playerClass === 'stock' ? 'STOCK CLASS' : 'STREET CLASS';
  showMessage('Both classes are live. Race clean, watch for potholes.', 4500);
  wakeFrame();
}
function returnToGarage() {
  if (watch) { watch.stop(); lastWatchReport = watch.report; watch = null; }
  document.body.classList.remove('watching'); $('#watch-banner').classList.add('hidden'); $('#watch-controls').classList.add('hidden'); $('#series-overlay').classList.add('hidden');
  clearInput(); inMenu = true; spectating = false; resultsShown = false; $('#setup').classList.remove('hidden'); $('#scene-label').classList.remove('hidden');
  $('#race-ui').classList.add('hidden'); $('#pause-overlay').classList.add('hidden'); $('#results-overlay').classList.add('hidden'); document.body.classList.remove('racing');
  sim = buildSimulation(); view.setRace(sim);
  setupChanged(false); $('#pause').innerHTML = 'PAUSE <small>P</small>'; $('#restart').textContent = 'RESTART RACE';
  wakeFrame();
}
function pauseRace() {
  if (watch) {
    watch.togglePause(); clearInput(); pausedForVisibility = false;
    if (watch.phase === 'racing') $('#pause-overlay').classList.toggle('hidden', !watch.paused);
    updateWatchUI(); wakeFrame(); return;
  }
  if (inMenu || (resultsShown && !spectating)) return;
  clearInput(); sim.togglePause(); $('#pause-overlay').classList.toggle('hidden', sim.state !== 'paused');
  wakeFrame();
}
function recover() {
  if (watch) return;
  if (inMenu || sim.state === 'paused') return;
  if (sim.player.wrecked) { showMessage('This car is wrecked. It remains on track until the next race.'); return; }
  sim.recoverPlayer(); showMessage('Car recovered. Damage stays with you — use the pit lane for repairs.');
}
function requestService() {
  if (watch || inMenu || sim.state !== 'racing' || sim.player.wrecked) return;
  if (sim.requestPitService()) { lastUI = 0; wakeFrame(); }
}
function requestRoadsideRepair() {
  if (watch || inMenu || sim.state !== 'racing' || sim.player.wrecked || sim.player.mobileRepair?.state === 'active') return;
  if (!sim.requestMobileRepair()) showMessage(sim.player.mobileRepair?.reason || 'Stop fully clear of the racing surface and pit traffic.');
  lastUI = 0; wakeFrame();
}
function changeCamera() { const mode = view.cycleCamera(); $('#camera-label').textContent = mode === 'pit' ? 'PIT OVERVIEW' : `${mode.toUpperCase()} CAM`; wakeFrame(); }
$('#start').addEventListener('click', startRace); $('#pause').addEventListener('click', pauseRace); $('#resume').addEventListener('click', pauseRace);
$('#restart').addEventListener('click', () => watch ? startWatchSeries() : startRace()); $('#race-again').addEventListener('click', startRace);
$('#garage').addEventListener('click', returnToGarage); $('#results-garage').addEventListener('click', returnToGarage);
$('#recover').addEventListener('click', recover); $('#camera').addEventListener('click', changeCamera);
$('#spectate').addEventListener('click', () => { spectating = true; view.cameraReady = false; $('#results-overlay').classList.add('hidden'); showMessage('Following a surviving racer. C changes camera; P opens race options.'); });
$('#fullscreen').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => showMessage('Fullscreen is unavailable in this browser view.')); });

window.addEventListener('keydown', e => {
  if (!$('#graphics-overlay').classList.contains('hidden')) return;
  if (inMenu || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  const key = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd', 'e', 'm'].includes(key)) e.preventDefault();
  if (!e.repeat) {
    if (key === 'p' || key === 'escape') pauseRace();
    if (key === 'c') changeCamera();
    if (key === 'r') recover();
    if (key === 'e') requestService();
    if (key === 'm') requestRoadsideRepair();
  }
  keys.add(key);
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => { clearInput(); if (!watch && !inMenu && sim.state !== 'paused' && !resultsShown) pauseRace(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInput();
    if (engineGain && audioCtx) engineGain.gain.setValueAtTime(0, audioCtx.currentTime);
    if (watch && !watch.paused && watch.phase !== 'complete' && watch.phase !== 'stopped') { watch.togglePause(); pausedForVisibility = true; }
    else if (!watch && !inMenu && sim.state !== 'paused' && !resultsShown) pauseRace();
    suspendFrames();
  } else {
    if (watch && pausedForVisibility) { watch.togglePause(); pausedForVisibility = false; }
    if (view) view.needsRender = true;
    wakeFrame(true);
  }
});
document.querySelectorAll('[data-touch]').forEach(button => {
  const apply = (pressed) => {
    const type = button.dataset.touch; button.classList.toggle('pressed', pressed);
    if (type === 'left') touch.steer = pressed ? -1 : 0;
    else if (type === 'right') touch.steer = pressed ? 1 : 0;
    else touch[type] = pressed ? 1 : 0;
  };
  button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); apply(true); });
  button.addEventListener('pointerup', () => apply(false)); button.addEventListener('pointercancel', () => apply(false));
});
$('#service').addEventListener('click', requestService);
$('#roadside').addEventListener('click', requestRoadsideRepair);

function showMessage(message, duration = 3200) {
  $('#race-message').textContent = message; $('#race-message').classList.remove('hidden'); clearTimeout(eventTimeout);
  eventTimeout = setTimeout(() => $('#race-message').classList.add('hidden'), duration);
}

let audioCtx, oscillator, engineGain, soundEnabled = false;
window.addEventListener('race-graphics-lost', () => {
  clearInput(); suspendFrames();
  const wasRunning = Boolean(sim && !inMenu && (watch ? !watch.paused && !['complete', 'stopped'].includes(watch.phase) : sim.state !== 'paused'));
  graphicsPausedRace = wasRunning || Boolean(watch && pausedForVisibility);
  pausedForVisibility = false;
  if (wasRunning) { if (watch) watch.togglePause(); else sim.togglePause(); }
  if (engineGain && audioCtx) engineGain.gain.setValueAtTime(0, audioCtx.currentTime);
  $('#graphics-status').textContent = 'The browser lost its graphics context. Your race is paused and its state is kept in this tab. Waiting for graphics to recover…';
  $('#graphics-resume').disabled = true; $('#graphics-resume').textContent = 'WAITING FOR GRAPHICS'; $('#graphics-overlay').classList.remove('hidden');
});
window.addEventListener('race-graphics-restored', () => {
  $('#graphics-status').textContent = 'Graphics have recovered. Continue when you are ready; the race will resume from its saved position without catching up skipped time.';
  $('#graphics-resume').disabled = false; $('#graphics-resume').textContent = 'CONTINUE';
  wakeFrame(true);
});
$('#graphics-resume').addEventListener('click', () => {
  if (view.contextLost) return;
  if (graphicsPausedRace) { if (watch) watch.togglePause(); else sim.togglePause(); }
  graphicsPausedRace = false; $('#graphics-overlay').classList.add('hidden'); wakeFrame(true);
});
$('#sound').addEventListener('click', () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)(); oscillator = audioCtx.createOscillator(); oscillator.type = 'sawtooth';
    const filter = audioCtx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 260;
    engineGain = audioCtx.createGain(); engineGain.gain.value = 0; oscillator.connect(filter); filter.connect(engineGain); engineGain.connect(audioCtx.destination); oscillator.start();
  }
  audioCtx.resume(); soundEnabled = !soundEnabled; $('#sound').textContent = soundEnabled ? 'SOUND ON' : 'SOUND OFF'; $('#sound').setAttribute('aria-pressed', String(soundEnabled));
});

const map = $('#minimap'), ctx = map.getContext('2d');
function drawMap() {
  const track = sim.track, points = [];
  for (let i = 0; i <= 100; i++) points.push(sampleTrack(track, i / 100 * track.length));
  const maxX = Math.max(...points.map(p => Math.abs(p.x))), maxZ = Math.max(...points.map(p => Math.abs(p.z)));
  const scale = Math.min((map.width - 36) / (maxX * 2), (map.height - 30) / (maxZ * 2));
  const pos = p => [map.width / 2 + p.x * scale, map.height / 2 + p.z * scale];
  ctx.clearRect(0, 0, map.width, map.height); ctx.lineWidth = 10; ctx.strokeStyle = '#394651'; ctx.lineJoin = 'round'; ctx.beginPath();
  points.forEach((p, i) => { const [x, y] = pos(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.stroke();
  const start = pos(sampleTrack(track, 0)); ctx.fillStyle = '#e9eedf'; ctx.fillRect(start[0] - 1, start[1] - 7, 2, 14);
  const pitSpec = sim.pit || sim.track.pit;
  const focused = spectating && view.spectatorCar ? view.spectatorCar : sim.player;
  const assignedBay = sim.getPitBay?.(focused) || pitSpec.bays?.find(bay => bay.carId === focused.id);
  if (pitSpec) {
    ctx.strokeStyle = '#68b5aa'; ctx.lineWidth = 2.5; ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const point = pos(sampleTrack(track, pitSpec.entryS + (pitSpec.exitS - pitSpec.entryS) * i / 60, pitSpec.throughLateral ?? pitSpec.lateral));
      i ? ctx.lineTo(...point) : ctx.moveTo(...point);
    }
    ctx.stroke();
    for (const bay of pitSpec.bays || []) {
      const point = pos(sampleTrack(track, bay.s, bay.lateral)); ctx.fillStyle = bay.carId === focused.id ? '#e8f95a' : '#71a69a';
      ctx.fillRect(point[0] - 1.5, point[1] - 1.5, 3, 3);
    }
    if (assignedBay) {
      const point = pos(sampleTrack(track, assignedBay.s, assignedBay.lateral));
      ctx.fillStyle = '#e8f95a'; ctx.font = 'bold 9px sans-serif'; ctx.fillText(`B${assignedBay.number}`, point[0] - 7, point[1] - 8);
    }
  }
  for (const car of [...sim.cars.filter(c => !c.isPlayer), sim.player]) {
    const [x, y] = pos(sampleTrack(track, car.s, car.lateral)); ctx.fillStyle = car.wrecked ? '#ed6355' : car.isPlayer ? '#e8f95a' : car.classId === 'stock' ? '#f2c46a' : '#6cc9e9';
    ctx.beginPath(); ctx.arc(x, y, car.isPlayer ? 4.5 : 2.8, 0, Math.PI * 2); ctx.fill();
    if (car.isPlayer) { ctx.strokeStyle = '#101922'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
}

function renderStandings() {
  const standings = sim.getStandings(boardClass === 'all' ? undefined : boardClass);
  $('#board-count').textContent = `${standings.length} DRIVERS`;
  let visible = standings.slice(0, 7);
  const playerIndex = standings.findIndex(c => c.isPlayer);
  if (playerIndex > 6) visible = [...standings.slice(0, 5), standings[playerIndex - 1], standings[playerIndex]];
  $('#standings').innerHTML = visible.map(car => `<div class="timing-row ${car.isPlayer ? 'you' : ''} ${car.wrecked && !car.finished ? 'dnf' : ''}"><span class="timing-pos">${standings.indexOf(car) + 1}</span><i style="background:${safe(car.color)}"></i><span class="timing-name">${car.isPlayer ? `YOU · #${car.number}` : `#${car.number} ${safe(car.name)}`}<small>${car.isPlayer ? safe(car.name) : car.classId === 'stock' ? 'STOCK' : 'STREET'} · BAY ${car.pitBayNumber || '—'}</small></span><span class="timing-gap">${car.finished ? 'FIN' : car.wrecked ? 'DNF' : `L${car.lap || Math.min(config.laps, car.completedLaps + 1)}`}</span></div>`).join('');
}

function renderResults() {
  const p = sim.player, standings = sim.getStandings(p.classId), rank = standings.findIndex(c => c.id === p.id) + 1;
  const wrecked = Boolean(p.wrecked && !p.finished);
  $('#results-eyebrow').textContent = wrecked ? 'OUT OF THE RACE' : 'CHECKERED FLAG';
  $('#results-title').textContent = wrecked ? 'Your race ends here.' : rank === 1 ? 'Class victory.' : 'Across the line.';
  $('#results-subtitle').textContent = wrecked ? 'Your wreck remains on the track. The rest of the field races on.' : `${p.classId === 'stock' ? 'Stock' : 'Street'} class · ${sim.track.name} · ${sim.laps} laps`;
  $('#result-stats').innerHTML = `<div><span>CLASS RESULT</span><strong>${wrecked ? 'DNF' : `P${rank}`}</strong></div><div><span>YOUR TIME</span><strong>${time(p.finishTime)}</strong></div><div><span>BEST LAP</span><strong>${time(p.bestLap)}</strong></div>`;
  $('#result-standings').innerHTML = standings.map((car, i) => `<div class="result-row ${car.isPlayer ? 'you' : ''}"><b>${i + 1}</b><span>${car.isPlayer ? 'YOU · ' : ''}#${car.number} ${safe(car.name)}</span><strong>${car.finished ? time(car.finishTime) : car.wrecked ? 'DNF' : `LAP ${car.lap || car.completedLaps + 1}`}</strong></div>`).join('');
  $('#results-note').textContent = sim.raceComplete ? 'All drivers have finished or retired.' : 'Live classification: drivers still on track continue their own race.';
}

function updateUI(input) {
  const p = spectating && view.spectatorCar ? view.spectatorCar : sim.player;
  const rank = sim.getStandings(p.classId).findIndex(c => c.id === p.id) + 1;
  $('#lap-value').innerHTML = `${p.lap || Math.min(sim.laps, p.completedLaps + 1)}<span>/ ${sim.laps}</span>`;
  $('#position-value').innerHTML = `${p.wrecked && !p.finished ? 'DNF' : rank}<span>/ 10</span>`;
  $('#race-time').textContent = time(sim.elapsed); $('#speed').textContent = mph(p.speed); $('#gear').textContent = p.wrecked ? '×' : p.speed < 1 ? 'N' : Math.min(6, Math.max(1, Math.ceil(p.speed / 16)));
  $('#camera-label').textContent = view.mode === 'pit' ? 'ALL 20 BAYS · PIT OVERVIEW' : spectating && view.spectatorCar ? `WATCHING #${view.spectatorCar.number} · ${view.mode.toUpperCase()}` : `${view.mode.toUpperCase()} CAM`;
  $('#throttle-fill').style.height = `${input.throttle * 100}%`;
  const condition = Math.max(0, Math.round((1 - p.damage) * 100));
  $('#condition').textContent = `${condition}%`; $('#condition-fill').style.width = `${condition}%`;
  $('#condition-fill').style.background = condition < 30 ? '#ee705d' : condition < 60 ? '#f4bb57' : '#e8f95a';
  updateWheelUI(p);
  updateEngineUI(p);
  updateRoleUI(p);
  $('#draft-label').textContent = p.wrecked ? 'PERMANENT WRECK' : p.draft > .05 ? 'IN THE DRAFT' : 'CLEAN AIR';
  $('#recover').disabled = Boolean(watch || p.wrecked); $('#service').disabled = Boolean(watch || p.wrecked || !p.pitAvailable);
  $('#service').classList.toggle('hidden', Boolean(p.mobileRepair?.supported && !p.inPit));
  const pitState = p.pitState || p.serviceState;
  const progress = p.serviceProgress ?? p.pitProgress ?? (pitState === 'servicing' ? 1 - p.pitRemaining / (sim.pit?.serviceSeconds || 5) : 0);
  const bay = sim.getPitBay?.(p) || sim.pit.bays?.find(item => item.carId === p.id);
  const bayName = `BAY ${String(bay?.number || p.pitBayNumber || 1).padStart(2, '0')} · #${p.number}`;
  const bayAhead = bay ? (bay.s - p.s + sim.track.length * 1000) % sim.track.length : 0;
  const entryAhead = (sim.pit.entryS - p.s + sim.track.length * 1000) % sim.track.length;
  const parking = pitParkingGuidance(p, bay);
  $('#pit-status').textContent = p.wrecked ? `${bayName} · WRECKS CANNOT BE REPAIRED` : pitState === 'servicing' || progress > 0 ? `${bayName} · SERVICE ${Math.round((progress || 0) * 100)}%` : pitState === 'complete' && p.repairMessage ? `${bayName} · ${p.repairMessage}` : parking ? `${bayName} · ${parking}` : p.inPit ? bayAhead < sim.track.length / 2 ? `${bayName} · ${Math.round(bayAhead)} m AHEAD · KEEP THROUGH LANE CLEAR` : `${bayName} PASSED · EXIT AND CIRCLE BACK` : `PIT ENTRY ${Math.round(entryAhead)} m · ${bayName} · ENTER LEFT`;
  $('#service').textContent = pitState === 'servicing' || progress > 0 ? 'SERVICING · REPAIRS IN PROGRESS' : p.pitAvailable ? 'READY · PRESS E TO REPAIR' : p.inPit ? 'STOP INSIDE YOUR ASSIGNED BAY' : 'PIT SERVICE · YOUR ASSIGNED BAY';
  const countdown = sim.state === 'countdown'; $('#countdown').classList.toggle('hidden', !countdown);
  if (countdown) $('#countdown strong').textContent = Math.max(1, Math.ceil(sim.countdown));
  const event = sim.events?.findLast(item => !item.carId || item.carId === p.id);
  const eventKey = event ? `${event.id ?? ''}:${event.carId ?? ''}:${event.time ?? event.at ?? ''}:${event.type ?? ''}:${event.text ?? event.message ?? ''}` : '';
  if (event && eventKey !== lastEvent) {
    lastEvent = eventKey;
    if ((event.text || event.message) && (!event.carId || event.carId === p.id) && sim.elapsed - (event.time ?? sim.elapsed) < 5) showMessage(event.text || event.message);
  }
  if (!watch && (p.finished || p.wrecked || sim.state === 'wrecked') && !resultsShown) { resultsShown = true; clearInput(); renderResults(); $('#results-overlay').classList.remove('hidden'); }
  if (resultsShown) renderResults(); renderStandings(); drawMap();
  if (watch) updateWatchUI();
}

function pitParkingGuidance(car, bay) {
  if (!car.inPit || !bay || !car.pitCenterError || Math.abs(car.pitCenterError.longitudinal) > bay.length + 5) return '';
  if (car.pitAvailable) return 'READY FOR SERVICE · PRESS E';
  if (car.pitVisitLocked) return 'SERVICE COMPLETE · LEAVE PIT';
  if (!car.pitInBay) return car.pitCenterError.longitudinal < -bay.length / 2 ? 'BAY PASSED · EXIT AND CIRCLE BACK' : 'DRIVE FULLY INSIDE YOUR ASSIGNED BAY';
  if (!car.pitServicePoseValid) return 'STRAIGHTEN THE CAR WITHIN YOUR BAY';
  const tolerance = sim.pit.serviceTolerance;
  if (car.speed > tolerance.speed || Math.abs(car.lateralVelocity) > tolerance.lateralSpeed) return 'STOP IN YOUR BAY FOR SERVICE';
  return car.finished ? 'RACE FINISHED' : 'NO REPAIR NEEDED';
}

function updateRoleUI(car) {
  const truck = car.streetClassId === 'truck', mobile = car.mobileRepair;
  const supported = Boolean(mobile?.supported), active = mobile?.state === 'active';
  document.body.classList.toggle('has-mobile-repair', supported);
  document.body.classList.toggle('has-truck-protection', truck);
  $('#truck-protection').classList.toggle('hidden', !truck);
  if (truck) {
    const protectedNow = Boolean(car.potholeProtected && !car.wrecked);
    $('#truck-protection').classList.toggle('active', protectedNow);
    $('#truck-protection-state').textContent = car.wrecked ? 'TRUCK WRECKED' : protectedNow ? 'POTHOLE PROTECTION ACTIVE' : 'POTHOLE PROTECTION OFF';
    const actualMph = Math.floor(car.speed / .44704 * 10) / 10;
    $('#truck-protection-detail').textContent = `${actualMph.toFixed(1)} MPH · ACTIVE BELOW ${(TRUCK_SAFE_SPEED / .44704).toFixed(0)} MPH`;
  }
  $('#roadside-panel').classList.toggle('hidden', !supported);
  $('#roadside-key-hint').classList.toggle('hidden', !supported);
  if (!watch) $('#class-label').textContent = car.classId === 'stock' ? 'STOCK CLASS' : car.streetClassName || 'STREET CLASS';
  if (!supported) return;
  const disabled = Boolean(mobile.disabled), spent = mobile.charges <= 0;
  const compact = car.inPit && !active;
  $('#roadside-panel').classList.toggle('active', active);
  $('#roadside-panel').classList.toggle('disabled', disabled);
  $('#roadside-panel').classList.toggle('compact', compact);
  $('#roadside-charge').textContent = disabled ? 'CREW LOST' : active ? `${Math.max(0, mobile.remaining).toFixed(1)}s` : spent ? 'CHARGE SPENT' : 'CHARGE READY';
  $('#roadside-progress').classList.toggle('hidden', !active);
  $('#roadside-progress i').style.width = `${active ? Math.max(0, Math.min(100, (1 - mobile.remaining / mobile.duration) * 100)) : 0}%`;
  $('#roadside').disabled = Boolean(watch || car.wrecked || sim.state !== 'racing' || !mobile.available || active || disabled);
  $('#roadside').classList.toggle('hidden', compact || Boolean(watch));
  $('#roadside').innerHTML = disabled ? 'UNAVAILABLE THIS RACE' : active ? 'CREW AT WORK' : spent ? 'RECHARGE AT PIT' : 'CALL ROADSIDE CREW <kbd>M</kbd>';
  if (disabled) {
    $('#roadside-status').textContent = mobile.disabledReason || mobile.reason || 'Contact during repair lost your crew for this race.';
    $('#roadside-warning').textContent = 'Pit service still works; the roadside crew will not return this race.';
  } else if (active) {
    $('#roadside-status').textContent = 'Stay stopped. Driving aborts this repair and spends the charge.';
    $('#roadside-warning').textContent = 'CONTACT CAUSES SEVERE DAMAGE + CREW LOSS';
  } else if (spent) {
    $('#roadside-status').textContent = mobile.state === 'complete' ? mobile.message || car.repairMessage || 'Roadside repair complete.' : mobile.message || mobile.reason || 'Roadside charge spent.';
    $('#roadside-warning').textContent = 'Complete a pit stop to restore one charge.';
  } else {
    $('#roadside-status').textContent = mobile.available ? '15-second repair. Four fresh tires on completion.' : mobile.reason || 'Stop fully clear of the track and pit traffic.';
    $('#roadside-warning').textContent = 'Contact during repair causes severe damage and loses the crew.';
  }
}

function updateWheelUI(car) {
  const wheels = car.wheels || [];
  $('#wheel-condition').classList.toggle('hidden', wheels.length === 0);
  if (!wheels.length) return;
  const labels = { FL: 'Front left', FR: 'Front right', RL: 'Rear left', RR: 'Rear right' };
  const descriptions = [];
  $('#wheel-grid').innerHTML = wheels.map(wheel => {
    const pressure = Math.round((wheel.pressure ?? (wheel.tire === 'blown' ? 0 : 1)) * 100);
    const issues = [];
    if (wheel.assembly === 'destroyed') issues.push('ASSEMBLY LOST');
    if (wheel.tire === 'blown') issues.push('BLOWOUT');
    else if (wheel.tire === 'punctured') issues.push('PUNCTURE');
    if (wheel.suspensionStatus === 'broken') issues.push('SUSP. BROKEN');
    else if (wheel.suspensionDamage > .01) issues.push(`SUSP ${Math.round(wheel.suspensionDamage * 100)}%`);
    if (wheel.bend > .01) issues.push(`BENT ${Math.round(wheel.bend * 100)}%`);
    const description = `${labels[wheel.id] || wheel.label}: pressure ${pressure}%, ${issues.length ? issues.join(', ').toLowerCase() : 'healthy'}`;
    descriptions.push(description);
    const severe = wheel.assembly === 'destroyed' || wheel.tire === 'blown' || wheel.suspensionStatus === 'broken';
    return `<div class="wheel-cell ${severe ? 'critical' : issues.length ? 'worn' : 'healthy'}" data-wheel="${safe(wheel.id)}" title="${safe(description)}" aria-label="${safe(description)}"><div><b>${safe(wheel.id)}</b><span>${pressure}%</span></div><small>${safe(issues[0] || 'OK')}</small></div>`;
  }).join('');
  const handling = car.handling || {};
  const factors = [['Grip', handling.gripFactor], ['Steer', handling.steeringFactor], ['Brake', handling.brakingFactor]].map(([label, value]) => `${label} ${Math.round((value ?? 1) * 100)}%`);
  $('#handling-summary').textContent = factors.join(' · ');
  $('#handling-detail').textContent = `${descriptions.join('. ')}. Acceleration ${Math.round((handling.accelerationFactor ?? 1) * 100)}%, top-speed factor ${Math.round((handling.topSpeedFactor ?? 1) * 100)}%.`;
  const pull = Math.abs(handling.pull || 0) > .001 ? `PULLS ${handling.pull < 0 ? 'LEFT' : 'RIGHT'}` : '';
  $('#wheel-warning').textContent = wheels.some(wheel => wheel.assembly === 'destroyed') ? 'WHEEL ASSEMBLY LOST · IMMOBILIZED' : handling.limpSpeed != null ? `${mph(handling.limpSpeed)} MPH LIMP LIMIT${pull ? ` · ${pull}` : ''}` : handling.vibrationFactor > .01 ? `WHEEL VIBRATION${pull ? ` · ${pull}` : ''}` : wheels.some(wheel => wheel.tire === 'punctured') ? `TIRE PRESSURE FALLING${pull ? ` · ${pull}` : ''}` : pull;
  $('#wheel-warning').classList.toggle('hidden', !$('#wheel-warning').textContent);
}

function updateEngineUI(car) {
  const engine = car.engine;
  $('#engine-condition').classList.toggle('hidden', !engine);
  if (!engine) return;
  const heat = Math.max(0, Math.min(100, Math.round(engine.heat * 100)));
  const health = Math.max(0, Math.min(100, Math.round((1 - engine.wear) * 100)));
  const burnt = engine.status === 'burnt';
  const criticalHeat = engine.heat >= ENGINE_LIMITS.criticalHeat, hot = engine.heat >= ENGINE_LIMITS.warningHeat;
  const cooling = engine.heatRate < 0, heating = engine.heatRate > 0;
  const color = burnt || criticalHeat ? '#f27d60' : hot ? '#f4c06b' : '#8dcab6';
  $('#engine-heat').textContent = burnt ? 'BURNT' : `${heat}%`;
  $('#engine-heat').style.color = color;
  $('#engine-health').textContent = `CONDITION ${health}%`;
  $('#engine-health').style.color = health < 35 ? '#f27d60' : health < 70 ? '#f4c06b' : '#a8bcb2';
  $('#engine-heat-fill').style.width = `${heat}%`; $('#engine-heat-fill').style.background = color;
  let warning = '';
  if (burnt) warning = 'ENGINE BURNT OUT · PERMANENT FAILURE';
  else if (criticalHeat) warning = cooling ? 'CRITICAL HEAT · COOLING' : heating ? 'CRITICAL HEAT · RETURN TO PAVEMENT' : 'CRITICAL ENGINE HEAT';
  else if (hot) warning = cooling ? 'HOT ENGINE · COOLING' : heating ? 'HOT ENGINE · LEAVE THE GRASS' : 'HOT ENGINE';
  else if (cooling && engine.heat > 0) warning = engine.wear > .01 ? 'COOLING · ENGINE WEAR NEEDS PIT REPAIR' : 'ENGINE COOLING';
  else if (engine.wear > .01) warning = 'ENGINE WEAR · NEEDS PIT REPAIR';
  else if (heating) warning = 'HEATING · RETURN TO PAVEMENT';
  else if (heat > 0) warning = 'ENGINE WARM';
  $('#engine-warning').textContent = warning;
  $('#engine-warning').style.color = engine.status === 'critical' || burnt ? '#f27d60' : engine.status === 'hot' ? '#f4c06b' : color;
  $('#engine-warning').classList.toggle('hidden', !warning);
}

function syncWatchedRace() {
  sim = watch.simulation;
  config = { ...config, trackId: 'bristol', playerClass: 'stock', laps: sim.laps, difficulty: sim.difficultyLevel };
  $('#track').value = config.trackId; $('#laps').value = config.laps; $('#difficulty').value = config.difficulty;
  document.querySelectorAll('[data-class]').forEach(button => { const selected = button.dataset.class === 'stock'; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); });
  view.setRace(sim); spectating = false; resultsShown = false; lastEvent = ''; lastUI = 0; watchPhase = '';
  $('#class-label').textContent = 'AUTOPILOT · STOCK #88'; $('#series-overlay').classList.add('hidden'); $('#pause-overlay').classList.add('hidden');
  showMessage(`Run ${watch.index + 1}/3: ${watch.snapshot.name}, ${sim.laps} laps. All 20 cars run to a finish or DNF.`, 5500);
  wakeFrame();
}

function startWatchSeries() {
  clearInput(); watch = new WatchSeries(); lastWatchReport = null; inMenu = false; pausedForVisibility = false;
  $('#setup').classList.add('hidden'); $('#scene-label').classList.add('hidden'); $('#race-ui').classList.remove('hidden');
  $('#results-overlay').classList.add('hidden'); $('#watch-banner').classList.remove('hidden'); $('#watch-controls').classList.remove('hidden');
  document.body.classList.add('racing', 'watching'); $('#restart').textContent = 'RESTART SERIES';
  view.mode = 'chase'; setBoard('all'); syncWatchedRace(); updateWatchUI();
}

function updateWatchUI() {
  if (!watch) return;
  const state = watch.snapshot;
  $('#watch-run').textContent = `${state.run} / 3 · ${state.name} · ${state.laps} laps`;
  $('#watch-progress').textContent = `${state.finishers} finished · ${state.dnfs} DNF · ${state.racing} racing`;
  const focused = view.spectatorCar || sim.player;
  $('#class-label').textContent = `WATCHING ${focused.classId === 'stock' ? 'STOCK' : 'STREET'} #${focused.number}`;
  $('#watch-focus').textContent = `${watch.paused ? 'PAUSED · ' : ''}Following #${focused.number} · ${focused.name} · Difficulty ${state.difficulty}/100`;
  $('#pause').innerHTML = `${watch.paused ? 'RESUME' : 'PAUSE'} <small>P</small>`;
  if (state.phase !== watchPhase) {
    watchPhase = state.phase;
    if (['intermission', 'complete', 'stopped', 'stalled'].includes(state.phase)) {
      lastWatchReport = watch.report; $('#series-overlay').classList.remove('hidden'); $('#pause-overlay').classList.add('hidden'); renderSeriesResults();
    } else $('#series-overlay').classList.add('hidden');
  }
  if (state.phase === 'intermission') {
    $('#series-next-label').textContent = watch.paused ? 'Intermission paused. Resume when you are ready.' : `Next race starts in ${Math.ceil(state.nextIn)} seconds.`;
    $('#series-hold').textContent = watch.paused ? 'RESUME COUNTDOWN' : 'PAUSE BETWEEN RACES';
  }
}

function renderSeriesResults() {
  const report = watch.report, done = watch.phase === 'complete', stopped = watch.phase === 'stopped', stalled = watch.phase === 'stalled';
  $('#series-title').textContent = stalled ? 'Traffic stalled.' : done ? 'Series concluded.' : stopped ? 'Series stopped.' : `${watch.snapshot.name} classified.`;
  $('#series-subtitle').textContent = stalled ? 'No active car made meaningful forward progress for 45 race seconds, and no pit or roadside service was active. The unfinished race is paused for traffic review. A passable route may still exist.' : done ? 'All three races reached a terminal classification. Finishers and DNFs below reflect what actually happened.' : stopped ? 'The current race was stopped by the viewer. Unfinished cars have not been marked as finishers or DNFs.' : 'Every car in this race has finished or retired. Wrecks remain in place until the next grid.';
  $('#series-results').innerHTML = report.results.map(result => {
    const stockWinner = result.standings.find(car => car.classId === 'stock' && car.status === 'finished');
    const streetWinner = result.standings.find(car => car.classId === 'civilian' && car.status === 'finished');
    const maxLaps = Math.max(...result.standings.map(car => car.completedLaps));
    return `<article class="series-result"><div><strong>${safe(result.name)} <span>· ${result.laps} lap target</span></strong><b>${result.finishers} FIN / ${result.dnfs} DNF</b></div><p>${result.targetDistanceReached ? `Target reached · field classified at ${time(result.simulatedSeconds)}` : `All retired before the target · longest run ${maxLaps}/${result.laps} laps`}</p><small>Stock: ${stockWinner ? `#${stockWinner.number} · ${time(stockWinner.finishTime)}` : 'No finisher'} &nbsp; Street: ${streetWinner ? safe(streetWinner.name) + ' · ' + time(streetWinner.finishTime) : 'No finisher'}</small></article>`;
  }).join('') || '<p>No complete race classification was recorded.</p>';
  if (stopped) $('#series-results').insertAdjacentHTML('beforeend', `<p class="stopped-race">Stopped ${safe(watch.snapshot.name)}: ${watch.snapshot.finishers} finished, ${watch.snapshot.dnfs} DNF, ${watch.snapshot.racing} still racing.</p>`);
  if (stalled) $('#series-results').insertAdjacentHTML('beforeend', `<p class="stopped-race">${safe(watch.snapshot.name)} remains unfinished: ${watch.snapshot.finishers} finished, ${watch.snapshot.dnfs} DNF, ${watch.snapshot.racing} drivers still classified as racing.</p>`);
  $('#series-next').classList.toggle('hidden', done || stopped || stalled); $('#series-hold').classList.toggle('hidden', done || stopped || stalled);
  $('#series-retry').classList.toggle('hidden', !stalled); $('#series-restart').classList.toggle('hidden', !stalled);
  $('#series-next-label').textContent = stalled ? 'Retry preserves every car’s position and classification. Export includes the unfinished race and the traffic warning.' : done ? 'Download the complete results, including every car, lap count, damage and finish status.' : stopped ? 'The export includes the unfinished race separately from completed results.' : '';
}

function exportWatchResults() {
  const report = watch?.report || lastWatchReport; if (!report) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'split-grid-watch-results.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#watch-series').addEventListener('click', startWatchSeries);
$('#watch-stop').addEventListener('click', () => { watch.stop(); updateWatchUI(); });
$('#watch-garage').addEventListener('click', returnToGarage); $('#series-garage').addEventListener('click', returnToGarage);
$('#watch-export').addEventListener('click', exportWatchResults); $('#series-export').addEventListener('click', exportWatchResults);
$('#series-next').addEventListener('click', () => { if (watch.paused) watch.togglePause(); if (watch.nextRace()) syncWatchedRace(); });
$('#series-hold').addEventListener('click', pauseRace);
$('#series-retry').addEventListener('click', () => {
  if (!watch?.retryStalledRace()) return;
  clearInput(); updateWatchUI(); showMessage('Traffic retry: same race, same positions. Watching for forward progress.'); wakeFrame(true);
});
$('#series-restart').addEventListener('click', startWatchSeries);

try {
  view = new RaceRenderer($('#world')); setupChanged(false); sim = buildSimulation(); view.setRace(sim);
  Object.defineProperty(window, '__SPLIT_GRID__', { value: Object.freeze({ get simulation() { return sim; }, get renderer() { return view; }, get config() { return { ...config }; }, get watch() { return watch?.snapshot || null; }, get watchReport() { return watch?.report || lastWatchReport; } }) });
  let previous = performance.now(), lastDraw = 0, frameRequest = 0, idleTimer = 0;
  const queueFrame = (idle = false) => {
    if (frameRequest || idleTimer || document.hidden || view.contextLost) return;
    if (idle) idleTimer = setTimeout(() => { idleTimer = 0; if (!document.hidden && !view.contextLost) frameRequest = requestAnimationFrame(frame); }, 250);
    else frameRequest = requestAnimationFrame(frame);
  };
  suspendFrames = () => {
    if (frameRequest) cancelAnimationFrame(frameRequest);
    clearTimeout(idleTimer); frameRequest = 0; idleTimer = 0;
  };
  wakeFrame = (resetClock = false) => {
    clearTimeout(idleTimer); idleTimer = 0;
    if (resetClock) { previous = performance.now(); lastDraw = 0; }
    queueFrame();
  };
  function frame(now) {
    frameRequest = 0;
    if (document.hidden || view.contextLost) { previous = now; return; }
    const runningWorld = !inMenu && sim.state !== 'paused' && !sim.raceComplete;
    const runningClock = watch ? !watch.paused && ['racing', 'intermission'].includes(watch.phase) : runningWorld;
    if (runningClock && now - previous < 1000 / 60 - .4) { queueFrame(); return; }
    const dt = Math.min((now - previous) / 1000, .05); previous = now;
    let input = {
      throttle: keys.has('w') || keys.has('arrowup') ? 1 : touch.throttle,
      brake: keys.has('s') || keys.has('arrowdown') || keys.has(' ') ? 1 : touch.brake,
      steer: (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) || touch.steer,
      service: keys.has('e') || touch.service,
    };
    if (watch) {
      watch.update(dt);
      if (sim !== watch.simulation) syncWatchedRace();
      input = { throttle: 0, brake: 0, steer: 0, service: false, ...watch.input };
      spectating = Boolean(sim.player.finished || sim.player.wrecked);
    } else if (!inMenu) sim.update(dt, input);
    const renderInterval = resultsShown && !spectating ? 1000 / 15 : 1000 / 60;
    if (view.needsRender || (runningWorld && now - lastDraw >= renderInterval - .4)) {
      view.render(sim, dt, inMenu, spectating); lastDraw = now;
    }
    if (!inMenu && now - lastUI > 90) { lastUI = now; updateUI(input); }
    if (audioCtx && engineGain) {
      const active = soundEnabled && runningWorld && !sim.player.wrecked;
      engineGain.gain.setTargetAtTime(active ? .025 + input.throttle * .025 : 0, audioCtx.currentTime, .1);
      oscillator.frequency.setTargetAtTime(42 + sim.player.speed * 1.9 + input.throttle * 18, audioCtx.currentTime, .12);
    }
    queueFrame(!runningClock);
  }
  queueFrame();
  if (new URLSearchParams(window.location.search).get('watch') === 'series') startWatchSeries();
} catch (error) {
  console.error(error); $('#load-error-detail').textContent = `${error.message}. Try a browser with WebGL enabled.`; $('#load-error').classList.remove('hidden');
}
