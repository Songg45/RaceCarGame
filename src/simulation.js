import { getTrack, getRoadCar, getStreetClass, ROAD_CARS, STOCK_CAR, STOCK_COLORS, TRUCK_SAFE_SPEED } from './catalog.js';
export { TRUCK_SAFE_SPEED } from './catalog.js';

const STEP = 1 / 120;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const mod = (n, m) => ((n % m) + m) % m;
const smooth = (n) => { const x = clamp(n, 0, 1); return x * x * (3 - 2 * x); };
const WHEEL_LAYOUT = [
  { id: 'FL', label: 'Front left', side: -1, axle: 1 },
  { id: 'FR', label: 'Front right', side: 1, axle: 1 },
  { id: 'RL', label: 'Rear left', side: -1, axle: -1 },
  { id: 'RR', label: 'Rear right', side: 1, axle: -1 },
];

/** Arcade engine-stress tuning, expressed in seconds and normalized condition. */
export const ENGINE_LIMITS = Object.freeze({
  warningHeat: 0.55, wearHeat: 0.65, criticalHeat: 0.85,
  heatingSeconds: 65, maxHeatWearSeconds: 60,
  minimumDrivingSpeed: 0.8, minimumThrottle: 0.15,
  pavedCoolingRate: 0.04, grassIdleCoolingRate: 0.01,
});

export const MOBILE_REPAIR_RULES = Object.freeze({
  duration: 15, stopSpeed: 0.05, lateralStopSpeed: 0.05,
  lengthPadding: 3, widthPadding: 2.6,
  collisionBody: 0.25, collisionBodyDifficulty: 0.10,
  collisionEngine: 0.20, collisionEngineDifficulty: 0.10,
  collisionBend: 0.35, collisionBendDifficulty: 0.20,
  collisionSuspension: 0.35, collisionSuspensionDifficulty: 0.25,
});

export function isPotholeProtected(car, speed = car.speed) {
  return (car.streetClassId || car.spec?.streetClassId) === 'truck' && speed < TRUCK_SAFE_SPEED;
}

/** Tuning probabilities, not real-world failure statistics. One roll per wheel impact. */
export function potholeRisk(hole, speed, wheel = {}, vehicle = {}) {
  if (vehicle.streetClassId === 'truck' && speed < TRUCK_SAFE_SPEED) return { blowoutChance: 0, assemblyChance: 0, suspensionBreakChance: 0, bentWheelChance: 0, punctureChance: 0 };
  const size = clamp((Number(hole.radius) - 0.45) / 1.9, 0, 1.7);
  const velocity = clamp(Math.max(0, speed) / 60, 0, 1.7);
  const severity = 0.65 + clamp(Number(hole.severity) || 0, 0, 0.4) * 4;
  const wear = 1 + clamp(wheel.suspensionDamage || 0, 0, 1) * 0.6 + clamp(wheel.bend || 0, 0, 1) * 0.3;
  const assemblyChance = clamp((0.0004 + 0.012 * size ** 2.3) * velocity ** 1.5 * severity * wear * (wheel.tire === 'blown' ? 2.5 : 1), 0, 0.18);
  const blowoutChance = wheel.tire === 'blown' ? 0 : clamp((0.008 + 0.13 * size ** 1.7) * velocity ** 0.95 * severity * wear * (1 + (1 - (wheel.pressure ?? 1)) * 0.75), 0, 0.34);
  const suspensionBreakChance = clamp((0.001 + 0.025 * size ** 2) * velocity ** 1.5 * severity * wear, 0, 0.14);
  const bentWheelChance = clamp((0.006 + 0.07 * size ** 2) * velocity ** 1.2 * severity * wear, 0, 0.16);
  const punctureChance = wheel.tire !== 'intact' && wheel.tire !== undefined ? 0 : clamp((0.025 + 0.15 * size ** 1.4) * velocity ** 0.7 * severity, 0, 0.18);
  const risks = { blowoutChance, assemblyChance, suspensionBreakChance, bentWheelChance, punctureChance };
  if (!vehicle.streetClassId) return risks; // Stock tuning remains independent.
  const total = Object.values(risks).reduce((sum, chance) => sum + chance, 0);
  // Scale the probability of any failure, preserving the relative failure mix
  // and leaving room for a strict resilience ordering even at saturated wear.
  const adjusted = 1 - (1 - Math.min(total, 0.98)) ** vehicle.potholeFactor;
  return Object.fromEntries(Object.entries(risks).map(([kind, chance]) => [kind, total ? chance / total * adjusted : 0]));
}

/** World-space stadium oval, measured from the middle of the front straight. */
export function sampleTrack(track, s, lateral = 0) {
  const straight = track.straightLength;
  const radius = track.radius;
  const arc = Math.PI * radius;
  const u = mod(s + straight / 2, track.length);
  let x, z, tx, tz, curvature = 0, turnProgress = 0;
  if (u < straight) {
    x = u - straight / 2; z = -radius; tx = 1; tz = 0;
  } else if (u < straight + arc) {
    turnProgress = u - straight;
    const angle = turnProgress / radius - Math.PI / 2;
    x = straight / 2 + radius * Math.cos(angle); z = radius * Math.sin(angle);
    tx = -Math.sin(angle); tz = Math.cos(angle); curvature = 1 / radius;
  } else if (u < 2 * straight + arc) {
    x = straight / 2 - (u - straight - arc); z = radius; tx = -1; tz = 0;
  } else {
    turnProgress = u - 2 * straight - arc;
    const angle = turnProgress / radius + Math.PI / 2;
    x = -straight / 2 + radius * Math.cos(angle); z = radius * Math.sin(angle);
    tx = -Math.sin(angle); tz = Math.cos(angle); curvature = 1 / radius;
  }
  // Reflect the planar stadium into the right-handed, Y-up renderer's world.
  // Forward x up is camera-right (-tz, tx): positive lateral is therefore
  // visibly right/outward, the infield is left, and every bend turns left.
  z = -z;
  tz = -tz;
  const nx = -tz, nz = tx;
  const banking = curvature ? track.banking * smooth(Math.min(turnProgress, arc - turnProgress) / Math.min(90, arc * 0.22)) : 0;
  return {
    x: x + nx * lateral, y: Math.max(0, lateral + track.width / 2) * Math.tan(banking),
    z: z + nz * lateral, tx, tz, nx, nz, heading: Math.atan2(tx, tz), curvature, banking,
  };
}

function randomGenerator(seed) {
  let state = (Number(seed) || 1) >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RaceSimulation {
  constructor(options = {}) {
    this.options = { ...options };
    this.track = getTrack(options.trackId);
    const requestedLaps = Number(options.laps ?? 3);
    this.laps = clamp(Number.isFinite(requestedLaps) ? Math.round(requestedLaps) : 3, 3, this.track.standardLaps);
    this.playerClass = options.playerClass === 'civilian' ? 'civilian' : 'stock';
    this.state = 'countdown';
    this.countdown = 3;
    this.elapsed = 0;
    this.raceComplete = false;
    this.events = [];
    this.collisionCount = 0;
    this.crossClassCollisions = 0;
    this.accumulator = 0;
    this.random = randomGenerator(options.seed ?? Math.floor(Math.random() * 0xFFFFFFFF));
    const difficultyNames = { easy: 0, normal: 35, hard: 70, extreme: 100 };
    const requestedDifficulty = typeof options.difficulty === 'string' ? (difficultyNames[options.difficulty] ?? Number(options.difficulty)) : Number(options.difficulty ?? 35);
    this.difficultyLevel = clamp(Number.isFinite(requestedDifficulty) ? requestedDifficulty : 35, 0, 100);
    this.difficulty = 0.85 + this.difficultyLevel * 0.0015;
    const pitLength = Math.min(Math.max(this.track.straightLength * 0.90, 480), this.track.straightLength - 100);
    this.pit = {
      entryS: -pitLength / 2, exitS: pitLength / 2,
      throughLateral: -this.track.width / 2 - 9, throughWidth: 7,
      innerLateral: -this.track.width / 2 - 23.5, outerLateral: -this.track.width / 2,
      width: 7, bayLength: 14, serviceSeconds: 5, speedLimit: 16, bays: [],
      parkingTolerance: { longitudinal: 0.25, lateral: 0.15, heading: 0.04, speed: 0.15, lateralSpeed: 0.10 },
      serviceTolerance: { heading: 0.18, speed: 0.5, lateralSpeed: 0.2 },
      straightMargin: (this.track.straightLength - pitLength) / 2,
    };
    this.potholes = this.createPotholes();
    this.hazardCount = this.potholes.length;
    this.potholeBuckets = new Map();
    for (const hole of this.potholes) {
      const bucket = Math.floor(hole.s / 40);
      if (!this.potholeBuckets.has(bucket)) this.potholeBuckets.set(bucket, []);
      this.potholeBuckets.get(bucket).push(hole);
    }
    this.cars = [];
    const selected = getRoadCar(options.streetClassId ? getStreetClass(options.streetClassId).representativeId : options.vehicleId);
    this.streetClassId = selected.streetClassId;
    // The player's chosen road model takes the fifth grid slot; all ten models
    // remain represented exactly once, and the player is one of the twenty cars.
    const roads = [...ROAD_CARS];
    const selectedIndex = roads.findIndex((car) => car.id === selected.id);
    [roads[4], roads[selectedIndex]] = [roads[selectedIndex], roads[4]];
    for (let row = 0; row < 10; row += 1) {
      this.cars.push(this.makeCar('stock', STOCK_CAR, row, -3.2, STOCK_COLORS[row]));
      this.cars.push(this.makeCar('civilian', roads[row], row, 3.2, roads[row].color));
    }
    this.player = this.cars.find((car) => car.isPlayer);
    this.pit.bays = this.cars.map((car, index) => {
      const bay = { id: `bay-${String(index + 1).padStart(2, '0')}`, carId: car.id, number: index + 1, s: (index - 9.5) * 16, lateral: -this.track.width / 2 - 19, length: 14, width: 7 };
      car.assignedBayId = bay.id; car.pitBayNumber = bay.number;
      return bay;
    });
    const playerBay = this.getPitBay(this.player);
    // Legacy single-player aliases; service validation always uses the car's
    // assigned bay, while rendering uses the full bays array and through lane.
    this.pit.bayS = playerBay.s; this.pit.lateral = playerBay.lateral;
    for (const car of this.cars) { this.updateHandling(car); this.updateWorld(car); this.updatePitInfo(car); this.updateMobileRepairInfo(car); }
  }

  makeCar(classId, spec, row, lateral, color) {
    return {
      id: `${classId}-${row + 1}`, classId, modelId: spec.id, name: spec.name,
      streetClassId: classId === 'civilian' ? spec.streetClassId : null,
      streetClassName: classId === 'civilian' ? spec.streetClassName : null,
      body: spec.body, color, number: classId === 'stock' ? [7, 12, 24, 48, 88, 3, 19, 22, 43, 9][row] : row + 101,
      isPlayer: classId === this.playerClass && row === 4,
      spec, s: -12 - row * 13, lateral, speed: 0, lateralVelocity: 0,
      targetLateral: lateral, headingOffset: 0, damage: 0, draft: 0,
      completedLaps: 0, lap: 1, finished: false, finishTime: null,
      lastLap: null, bestLap: null, lapStartTime: null, crossedStart: false,
      contactCooldown: 0, wallCooldown: 0, aiTimer: this.random() * 0.4,
      skill: this.difficulty * (0.96 + this.random() * 0.04),
      offTrack: false, collisionFlash: 0, x: 0, y: 0, z: 0, heading: 0,
      status: 'racing', wrecked: false, wreckTime: null, wreckReason: '',
      inPit: false, pitAvailable: false, pitState: 'none', pitRemaining: 0,
      pitVisitLocked: false, repairMessage: '', pitTarget: false, pitExiting: false, potholeHits: 0,
      pitRoute: 'none', pitMergeCommitted: false, pitVisits: 0,
      pitBypassLateral: null, pitBypassUntilS: null,
      stationaryTime: 0,
      engine: { heat: 0, wear: 0, status: 'normal', grassDrivingSeconds: 0, cooling: false, heatRate: 0 },
      wheels: WHEEL_LAYOUT.map((wheel) => ({ ...wheel, suspensionDamage: 0, suspensionStatus: 'healthy', tire: 'intact', pressure: 1, leakRate: 0, bend: 0, assembly: 'intact', lastImpactTime: null })),
      handling: null, vibration: 0, hazardRolls: 0, tireBlowouts: 0, wheelAssemblyFailures: 0,
      aiStuckTime: 0, aiEscapeTime: 0, aiEscapeLane: lateral,
      aiHazardPlan: null,
      potholeProtected: false,
      mobileRepair: { supported: classId === 'civilian' && spec.streetClassId === 'suv', charges: classId === 'civilian' && spec.streetClassId === 'suv' ? 1 : 0, disabled: false, disabledReason: '', used: false, state: classId === 'civilian' && spec.streetClassId === 'suv' ? 'ready' : 'unavailable', available: false, remaining: 0, duration: MOBILE_REPAIR_RULES.duration, area: null, reason: '', attempts: 0, completed: 0, penaltyApplied: false, aiTarget: null },
      holeContacts: new Map(),
    };
  }

  getPitBay(car) { return this.pit.bays.find((bay) => bay.carId === car.id); }

  isPotholeProtected(car, speed = car.speed) { return isPotholeProtected(car, speed); }

  wheelContactPosition(car, wheel) {
    const angle = -car.headingOffset;
    const forward = wheel.axle * car.spec.length * 0.31;
    const side = wheel.side * car.spec.width * 0.48;
    return { s: car.s + forward * Math.cos(angle) - side * Math.sin(angle), lateral: car.lateral + side * Math.cos(angle) + forward * Math.sin(angle) };
  }

  updateHandling(car) {
    car.potholeProtected = isPotholeProtected(car);
    const wheels = car.wheels;
    for (const wheel of wheels) {
      wheel.suspensionStatus = wheel.suspensionDamage >= 0.85 ? 'broken' : wheel.suspensionDamage > 0.01 ? 'worn' : 'healthy';
      if (wheel.tire === 'blown') { wheel.pressure = 0; wheel.leakRate = 0; }
    }
    const average = wheels.reduce((sum, wheel) => sum + wheel.suspensionDamage, 0) / 4;
    const averageBend = wheels.reduce((sum, wheel) => sum + wheel.bend, 0) / 4;
    const averagePressure = wheels.reduce((sum, wheel) => sum + wheel.pressure, 0) / 4;
    const broken = wheels.filter((wheel) => wheel.suspensionStatus === 'broken').length;
    const blown = wheels.filter((wheel) => wheel.tire === 'blown').length;
    const frontBlown = wheels.filter((wheel) => wheel.axle === 1 && wheel.tire === 'blown').length;
    const pull = wheels.reduce((sum, wheel) => sum + wheel.side * (wheel.suspensionDamage * (wheel.axle === 1 ? 0.65 : 0.25) + wheel.bend * 0.45 + (1 - wheel.pressure) * 0.5 + (wheel.tire === 'blown' ? wheel.axle === 1 ? 1.2 : 0.65 : 0)), 0);
    const tireLimp = blown ? [0, 24, 18, 12, 8][blown] : Infinity;
    const suspensionLimp = broken ? Math.max(10, 22 - broken * 4) : Infinity;
    car.handling = {
      gripFactor: clamp((1 - car.damage * 0.20) * (1 - average * 0.52) * (1 - blown * 0.18) * (0.5 + averagePressure * 0.5) * (1 - broken * 0.15), 0.13, 1),
      steeringFactor: clamp(1 - car.damage * 0.15 - average * 0.40 - averageBend * 0.25 - frontBlown * 0.12 - (blown - frontBlown) * 0.04 - broken * 0.08, 0.22, 1),
      brakingFactor: clamp(1 - car.damage * 0.20 - average * 0.30 - blown * 0.12 - (1 - averagePressure) * 0.20 - broken * 0.06, 0.22, 1),
      accelerationFactor: clamp(1 - car.damage * 0.15 - average * 0.20 - blown * 0.10 - averageBend * 0.15, 0.28, 1) * (1 - car.engine.wear * 0.55),
      topSpeedFactor: (1 - car.damage * 0.27) * (1 - average * 0.20) * (1 - averageBend * 0.30) * (0.55 + averagePressure * 0.45) * (1 - car.engine.wear * 0.35),
      limpSpeed: Math.min(tireLimp, suspensionLimp) === Infinity ? null : Math.min(tireLimp, suspensionLimp),
      pull, blownTires: blown, maxSuspensionDamage: Math.max(...wheels.map((wheel) => wheel.suspensionDamage)),
      averageSuspensionDamage: average, minPressure: Math.min(...wheels.map((wheel) => wheel.pressure)),
      averageBend, vibrationFactor: averageBend * 0.7 + Math.max(...wheels.map((wheel) => wheel.bend)) * 0.3,
      brokenSuspensions: broken, puncturedTires: wheels.filter((wheel) => wheel.tire === 'punctured').length,
    };
    return car.handling;
  }

  updateComponents(car, dt) {
    for (const wheel of car.wheels) {
      if (wheel.tire !== 'punctured') continue;
      wheel.pressure = Math.max(0, wheel.pressure - wheel.leakRate * dt);
      if (wheel.pressure <= 0.18) {
        wheel.tire = 'blown'; wheel.pressure = 0; wheel.leakRate = 0; car.tireBlowouts += 1;
        this.addEvent('blowout', `${wheel.label} tire collapsed after pressure fell below 18%.`, { carId: car.id, wheelId: wheel.id, kind: 'tire-blown' });
      }
    }
    this.updateHandling(car);
  }

  updateEngine(car, control, dt) {
    if (this.state === 'paused' || this.state === 'countdown' || car.wrecked) return;
    const engine = car.engine;
    const previousHeat = engine.heat, previousStatus = engine.status;
    this.updatePitInfo(car);
    const onGrass = car.lateral < -this.track.width / 2 + 0.5 && !car.inPit;
    const throttle = clamp(Number(control.throttle) || 0, 0, 1);
    const drivingGrass = onGrass && car.speed > ENGINE_LIMITS.minimumDrivingSpeed && throttle > ENGINE_LIMITS.minimumThrottle;
    if (dt > 0) {
      if (drivingGrass) {
        engine.grassDrivingSeconds += dt;
        engine.heat = clamp(engine.heat + dt * (0.55 + throttle * 0.45) / ENGINE_LIMITS.heatingSeconds, 0, 1);
        if (engine.heat > ENGINE_LIMITS.wearHeat) {
          engine.wear = clamp(engine.wear + dt * (engine.heat - ENGINE_LIMITS.wearHeat) / (1 - ENGINE_LIMITS.wearHeat) / ENGINE_LIMITS.maxHeatWearSeconds, 0, 1);
        }
      } else {
        engine.heat = Math.max(0, engine.heat - dt * (onGrass ? ENGINE_LIMITS.grassIdleCoolingRate : ENGINE_LIMITS.pavedCoolingRate));
      }
    }
    engine.heatRate = dt > 0 ? (engine.heat - previousHeat) / dt : 0;
    engine.cooling = engine.heatRate < 0;
    engine.status = engine.wear >= 1 ? 'burnt' : engine.heat >= ENGINE_LIMITS.criticalHeat || engine.wear >= 0.75 ? 'critical' : engine.heat >= ENGINE_LIMITS.warningHeat || engine.wear >= 0.4 ? 'hot' : 'normal';
    if (drivingGrass && engine.heatRate > 0 && previousHeat < ENGINE_LIMITS.warningHeat && engine.heat >= ENGINE_LIMITS.warningHeat) {
      this.addEvent('engine', 'Engine overheating on grass. Return to pavement to cool it.', { carId: car.id, kind: 'engine-hot' });
    } else if (drivingGrass && engine.heatRate > 0 && previousHeat < ENGINE_LIMITS.criticalHeat && engine.heat >= ENGINE_LIMITS.criticalHeat) {
      this.addEvent('engine', 'Critical engine heat. Leave the grass before the engine burns out.', { carId: car.id, kind: 'engine-critical' });
    } else if (engine.status !== previousStatus && engine.heat < ENGINE_LIMITS.warningHeat && engine.wear >= 0.4 && previousStatus !== 'critical') {
      this.addEvent('engine', 'Lasting engine wear is reducing power. Reach your assigned pit bay for repair.', { carId: car.id, kind: 'engine-worn' });
    }
    if (engine.status === 'burnt') this.wreckCar(car, 'Engine burned out after prolonged grass driving', { preserveBody: true });
  }

  createPotholes() {
    const difficulty = this.difficultyLevel / 100;
    const density = 2 + 68 * difficulty ** 1.2;
    const expectedCount = Math.max(5, this.track.length / 1000 * density);
    const count = Math.max(3, Math.round(expectedCount * (0.72 + this.random() * 0.56)));
    return Array.from({ length: count }, (_, index) => {
      const s = 105 + this.random() * (this.track.length - 260);
      const lateral = (this.random() - 0.5) * (this.track.width - 5);
      const radius = 0.65 + this.random() * 0.95 + difficulty * 0.4;
      const severity = 0.016 + difficulty * 0.045 + this.random() * (0.020 + difficulty * 0.05);
      const world = sampleTrack(this.track, s, lateral);
      return { id: `pothole-${index + 1}`, s, lateral, radius, severity, x: world.x, y: world.y, z: world.z };
    }).sort((a, b) => a.s - b.s);
  }

  hitPotholes(car) {
    if (car.wrecked || car.inPit) return;
    const position = mod(car.s, this.track.length);
    const buckets = [Math.floor(mod(position - 8, this.track.length) / 40), Math.floor(position / 40), Math.floor(mod(position + 8, this.track.length) / 40)];
    for (const bucket of new Set(buckets)) for (const hole of this.potholeBuckets.get(bucket) || []) {
      for (const wheel of car.wheels) {
        const contact = this.wheelContactPosition(car, wheel);
        const longitudinal = this.relativeDistance(hole.s - contact.s);
        const lateral = hole.lateral - contact.lateral;
        const touches = longitudinal * longitudinal + lateral * lateral < (hole.radius + 0.18) ** 2;
        const contactId = `${hole.id}:${wheel.id}`;
        if (!touches) { car.holeContacts.delete(contactId); continue; }
        if (car.holeContacts.has(contactId) && car.holeContacts.get(contactId)?.protected !== true) continue;
        if (isPotholeProtected(car)) {
          // Protected overlap is not a consumed damaging hit. If the driver
          // accelerates above the limit while still in this crater, one normal
          // impact occurs, then the usual no-reroll bookkeeping takes over.
          car.holeContacts.set(contactId, { protected: true });
          continue;
        }
        // A stationary wheel does not keep trying the same hazard roll. The
        // contact is released only after this wheel physically exits the hole.
        car.holeContacts.set(contactId, this.elapsed);
        if (car.speed < 0.5) continue;
        const impactSpeed = car.speed;
        const risk = potholeRisk(hole, impactSpeed, wheel, car.spec);
        const roll = this.random();
        car.hazardRolls += 1;
        car.potholeHits += 1;
        wheel.lastImpactTime = this.elapsed;
        const impact = (hole.severity * (0.35 + impactSpeed / 70) + 0.012 * (impactSpeed / 60) ** 2) * (car.spec.potholeFactor ?? 1);
        // Separate wheel impacts share the body load, but wear the wheel that
        // actually crossed the crater. A broad hole can strike both axles.
        car.damage = clamp(car.damage + impact * 0.32, 0, 1);
        wheel.suspensionDamage = clamp(wheel.suspensionDamage + impact * 1.8, 0, 1);
        car.speed *= 1 - Math.min(0.08, impact * 0.28);
        car.lateralVelocity += wheel.side * impact * 3;
        car.collisionFlash = 0.30;
        const details = { carId: car.id, wheelId: wheel.id, holeId: hole.id, impactSpeed };
        if (roll < risk.assemblyChance) {
          wheel.assembly = 'destroyed'; wheel.tire = 'blown'; wheel.pressure = 0; wheel.leakRate = 0; wheel.suspensionDamage = 1;
          car.wheelAssemblyFailures += 1;
          this.updateHandling(car);
          this.addEvent('assembly', `${wheel.label} wheel assembly destroyed. Permanent retirement.`, { ...details, kind: 'assembly-destroyed' });
          this.wreckCar(car, `${wheel.label} wheel assembly destroyed`);
          return;
        }
        if (roll < risk.assemblyChance + risk.blowoutChance && wheel.tire !== 'blown') {
          wheel.tire = 'blown'; wheel.pressure = 0; wheel.leakRate = 0; car.tireBlowouts += 1;
          this.addEvent('blowout', `${wheel.label} tire blown — limp to your assigned pit bay.`, { ...details, kind: 'tire-blown' });
        } else if (roll < risk.assemblyChance + risk.blowoutChance + risk.suspensionBreakChance) {
          wheel.suspensionDamage = Math.max(0.90, wheel.suspensionDamage);
          this.addEvent('suspension', `${wheel.label} suspension broken — severe cornering loss. Pit urgently.`, { ...details, kind: 'suspension-broken' });
        } else if (roll < risk.assemblyChance + risk.blowoutChance + risk.suspensionBreakChance + risk.bentWheelChance) {
          wheel.bend = clamp(wheel.bend + 0.35 + hole.radius * 0.12, 0, 1);
          this.addEvent('bent-wheel', `${wheel.label} wheel bent — vibration and steering pull.`, { ...details, kind: 'wheel-bent' });
        } else if (roll < risk.assemblyChance + risk.blowoutChance + risk.suspensionBreakChance + risk.bentWheelChance + risk.punctureChance && wheel.tire === 'intact') {
          wheel.tire = 'punctured'; wheel.leakRate = 0.003 + hole.severity * 0.018 + hole.radius * 0.0015;
          this.addEvent('puncture', `${wheel.label} tire punctured — pressure is falling.`, { ...details, kind: 'tire-punctured' });
        } else {
          this.addEvent('pothole', `${wheel.label} suspension damaged — grip and steering reduced.`, { ...details, kind: 'suspension-wear' });
        }
        this.updateHandling(car);
        if (car.damage >= 1) { this.wreckCar(car, 'Pothole damage'); return; }
      }
    }
  }

  needsRepair(car) {
    return car.damage > 0 || car.engine.wear > 0 || car.engine.heat > 0 || car.wheels.some((wheel) => wheel.suspensionDamage > 0 || wheel.tire !== 'intact' || wheel.pressure < 1 || wheel.bend > 0);
  }

  carFootprint(car) {
    return { s: car.s, lateral: car.lateral, headingOffset: car.headingOffset, length: car.spec.length, width: car.spec.width };
  }

  footprintsOverlap(first, second, margin = 0) {
    const a = -(first.headingOffset || 0), b = -(second.headingOffset || 0);
    const forwardA = [Math.cos(a), Math.sin(a)], sideA = [-Math.sin(a), Math.cos(a)];
    const forwardB = [Math.cos(b), Math.sin(b)], sideB = [-Math.sin(b), Math.cos(b)];
    const delta = [this.relativeDistance(second.s - first.s), second.lateral - first.lateral];
    const dot = (u, v) => u[0] * v[0] + u[1] * v[1];
    for (const axis of [forwardA, sideA, forwardB, sideB]) {
      const radiusA = Math.abs(dot(axis, forwardA)) * first.length / 2 + Math.abs(dot(axis, sideA)) * first.width / 2;
      const radiusB = Math.abs(dot(axis, forwardB)) * second.length / 2 + Math.abs(dot(axis, sideB)) * second.width / 2;
      if (Math.abs(dot(delta, axis)) > radiusA + radiusB + margin) return false;
    }
    return true;
  }

  getMobileRepairArea(car) {
    return { ...this.carFootprint(car), carId: car.id, length: car.spec.length + MOBILE_REPAIR_RULES.lengthPadding, width: car.spec.width + MOBILE_REPAIR_RULES.widthPadding };
  }

  mobileRepairAreaClear(car, area = this.getMobileRepairArea(car)) {
    const angle = area.headingOffset || 0;
    const halfWidth = Math.abs(Math.cos(angle)) * area.width / 2 + Math.abs(Math.sin(angle)) * area.length / 2;
    if (area.lateral + halfWidth > -this.track.width / 2 - 0.5) return false;
    const throughLane = { s: (this.pit.entryS + this.pit.exitS) / 2, lateral: this.pit.throughLateral, length: this.pit.exitS - this.pit.entryS, width: this.pit.throughWidth, headingOffset: 0 };
    if (this.footprintsOverlap(area, throughLane, 0.25)) return false;
    if (this.pit.bays.some((bay) => this.footprintsOverlap(area, { ...bay, headingOffset: 0 }, 0.25))) return false;
    return this.cars.every((other) => other === car || !this.footprintsOverlap(area, other.mobileRepair?.state === 'active' ? other.mobileRepair.area : this.carFootprint(other), 0.25));
  }

  updateMobileRepairInfo(car) {
    const mobile = car.mobileRepair;
    mobile.used = mobile.charges === 0;
    mobile.chargeAvailable = mobile.charges > 0 && !mobile.disabled;
    mobile.available = false;
    if (!mobile.supported || mobile.state === 'active') return;
    if (mobile.disabled) { mobile.reason = mobile.disabledReason; return; }
    if (car.wrecked || car.finished) { mobile.reason = 'A terminal or finished car cannot receive mobile repair.'; return; }
    if (!mobile.charges) { mobile.reason = 'Charge spent. Complete a pit stop to recharge.'; return; }
    if (car.pitState === 'servicing') { mobile.reason = 'Finish the current pit service first.'; return; }
    if (!this.needsRepair(car)) { mobile.reason = 'No repairs needed.'; return; }
    if (car.speed > MOBILE_REPAIR_RULES.stopSpeed || Math.abs(car.lateralVelocity) > MOBILE_REPAIR_RULES.lateralStopSpeed) { mobile.reason = 'Stop completely before deploying the repair area.'; return; }
    mobile.reason = 'Ready. Deploy for 15 seconds; contact causes severe damage and disables the ability.';
    mobile.available = true;
  }

  requestMobileRepair(car = this.player) {
    if (this.state === 'paused' || this.state === 'countdown' || this.raceComplete) return false;
    this.updateMobileRepairInfo(car);
    const mobile = car.mobileRepair;
    if (!mobile.available || mobile.state === 'active' || car.wheels.some((wheel) => wheel.assembly === 'destroyed') || car.engine.wear >= 1) return false;
    mobile.charges = 0; mobile.used = true; mobile.chargeAvailable = false;
    mobile.state = 'active'; mobile.available = false; mobile.remaining = MOBILE_REPAIR_RULES.duration;
    mobile.area = this.getMobileRepairArea(car); mobile.attempts += 1; mobile.penaltyApplied = false;
    mobile.aiTarget = null; mobile.reason = ''; mobile.message = 'Mobile repair active. Remain stopped and protect the crew area.';
    car.speed = 0; car.lateralVelocity = 0;
    car.pitTarget = false; car.pitExiting = false; car.pitRoute = 'none';
    this.addEvent('mobile', mobile.message, { carId: car.id, kind: 'mobile-repair-started' });
    return true;
  }

  cancelMobileRepair(car, reason = 'Movement interrupted the repair.', collision = false, contactCarId = null) {
    const mobile = car.mobileRepair;
    if (mobile.state !== 'active') return false;
    mobile.state = 'cancelled'; mobile.area = null; mobile.remaining = 0; mobile.available = false;
    mobile.aiTarget = null; mobile.charges = 0; mobile.used = true; mobile.chargeAvailable = false;
    mobile.reason = reason;
    if (collision) {
      mobile.disabled = true; mobile.disabledReason = 'Contact interrupted mobile repair. Ability disabled for this race.';
      if (!mobile.penaltyApplied) {
        mobile.penaltyApplied = true;
        const difficulty = this.difficultyLevel / 100, rules = MOBILE_REPAIR_RULES;
        const penalty = { body: rules.collisionBody + rules.collisionBodyDifficulty * difficulty, engine: rules.collisionEngine + rules.collisionEngineDifficulty * difficulty, bend: rules.collisionBend + rules.collisionBendDifficulty * difficulty, suspension: rules.collisionSuspension + rules.collisionSuspensionDifficulty * difficulty };
        car.damage = clamp(car.damage + penalty.body, 0, 1);
        car.engine.wear = clamp(car.engine.wear + penalty.engine, 0, 1);
        const corner = car.wheels.find((wheel) => wheel.id === 'FL');
        corner.bend = clamp(corner.bend + penalty.bend, 0, 1);
        corner.suspensionDamage = clamp(corner.suspensionDamage + penalty.suspension, 0, 1);
        mobile.message = `Crew-interruption penalty: body +${Math.round(penalty.body * 100)}%, engine wear +${Math.round(penalty.engine * 100)}%, front-left rim and suspension damaged. Mobile repair disabled for this race.`;
        car.repairMessage = mobile.message;
        this.updateHandling(car);
        if (car.engine.wear < 1) this.updateEngine(car, { throttle: 0 }, 0);
        this.addEvent('mobile', mobile.message, { carId: car.id, kind: 'mobile-crew-collision', contactCarId, penalty });
        if (car.engine.wear >= 1) { car.engine.status = 'burnt'; this.wreckCar(car, 'Mobile crew collision destroyed the engine', { preserveBody: true }); }
        else if (car.damage >= 1) this.wreckCar(car, 'Mobile crew collision damage');
      }
    } else {
      mobile.message = `${reason} No repair granted. Complete a pit stop to recharge.`;
      this.addEvent('mobile', mobile.message, { carId: car.id, kind: 'mobile-repair-cancelled' });
    }
    return true;
  }

  resolveMobileRepairContacts() {
    for (const owner of this.cars) {
      if (owner.mobileRepair.state !== 'active') continue;
      const other = this.cars.find((car) => car !== owner && this.footprintsOverlap(owner.mobileRepair.area, this.carFootprint(car)));
      if (other) this.cancelMobileRepair(owner, 'Vehicle contact with the deployed repair area.', true, other.id);
    }
  }

  completeMobileRepair(car) {
    const mobile = car.mobileRepair;
    if (this.state === 'paused' || this.state === 'countdown' || mobile.state !== 'active' || mobile.remaining > 0.00001 || car.wrecked || mobile.disabled) return false;
    mobile.state = 'complete'; mobile.area = null; mobile.remaining = 0; mobile.completed += 1;
    this.applyRepairOutcome(car, 'mobile');
    mobile.message = car.repairMessage;
    car.targetLateral = -this.track.width / 2 + 3;
    car.aiTimer = 0;
    this.updateMobileRepairInfo(car);
    return true;
  }

  trafficObjects(car) {
    return this.cars.filter((other) => other !== car).map((other) => {
      const area = other.mobileRepair.state === 'active' ? other.mobileRepair.area : null;
      return area ? { ...other, s: area.s, lateral: area.lateral, headingOffset: area.headingOffset, speed: 0, lateralVelocity: 0, spec: { ...other.spec, length: area.length, width: area.width } } : other;
    });
  }

  mobileRepairControl(car) {
    const mobile = car.mobileRepair;
    if (!mobile.supported || !mobile.charges || mobile.disabled || car.finished || car.wrecked || car.pitState === 'servicing') { mobile.aiTarget = null; return null; }
    const localS = this.relativeDistance(car.s), area = this.getMobileRepairArea(car);
    const firstBay = this.pit.bays[0].s - this.pit.bayLength / 2;
    const lastBay = this.pit.bays[this.pit.bays.length - 1].s + this.pit.bayLength / 2;
    const onClearApron = localS > this.pit.entryS + area.length / 2 + 6 && localS < firstBay - area.length / 2 - 15 || localS > lastBay + area.length / 2 + 15 && localS < this.pit.exitS - area.length / 2 - 15;
    const outsidePit = localS < this.pit.entryS - 30 || localS > this.pit.exitS + 30;
    if (!mobile.aiTarget) {
      if (onClearApron) mobile.aiTarget = { kind: 'apron', lateral: this.pit.innerLateral + area.width / 2 + 0.5 };
      else if (outsidePit) mobile.aiTarget = { kind: 'infield', lateral: -this.track.width / 2 - 6.5 };
      else return null;
    }
    if (mobile.aiTarget.kind === 'apron' && !onClearApron || mobile.aiTarget.kind === 'infield' && !outsidePit) {
      mobile.aiTarget = null;
      return null;
    }
    const goal = mobile.aiTarget.lateral;
    // Brake on the road first. Pulling a damaged car into the grass at racing
    // speed spends its entire braking distance off-road before it can stop.
    let targetSpeed = car.speed > 12 ? 10 : 6;
    car.targetLateral = car.speed > 12 ? car.lateral : goal;
    const crossing = this.trafficObjects(car).find((other) => {
      const gap = this.relativeDistance(other.s - car.s);
      const left = Math.min(car.lateral, car.targetLateral) - (car.spec.width + other.spec.width) / 2 - 0.4;
      const right = Math.max(car.lateral, car.targetLateral) + (car.spec.width + other.spec.width) / 2 + 0.4;
      return gap > -8 && gap < 22 && other.lateral > left && other.lateral < right;
    });
    if (crossing) {
      car.targetLateral = car.lateral;
      targetSpeed = Math.min(targetSpeed, Math.max(0, crossing.speed - 2));
      // A permanent obstruction should not make the mobile approach a second
      // stopped obstacle; let the ordinary path planner pass it before retrying.
      if (crossing.wrecked || crossing.mobileRepair.state === 'active' || crossing.stationaryTime > 2.5) {
        mobile.aiTarget = null; mobile.aiRetryAt = this.elapsed + 4;
        return null;
      }
    }
    this.updateMobileRepairInfo(car);
    // Location is an AI stopping policy, not a restriction on player requests.
    const areaClear = this.mobileRepairAreaClear(car);
    if (areaClear) targetSpeed = 0;
    const steering = this.steeringDynamics(car);
    const correction = steering.disturbance / Math.max(0.05, steering.authority);
    return {
      throttle: clamp((targetSpeed - car.speed) * 0.7, 0, 1),
      brake: clamp((car.speed - targetSpeed) * 0.7, 0, 1),
      steer: clamp((car.targetLateral - car.lateral) * 0.7 - car.lateralVelocity * 0.25 - correction, -1, 1),
      mobileRepair: mobile.available && areaClear,
    };
  }

  updatePitInfo(car) {
    const localS = this.relativeDistance(car.s);
    const bay = this.getPitBay(car);
    const wasInPit = car.inPit;
    car.inPit = localS >= this.pit.entryS && localS <= this.pit.exitS && car.lateral < this.pit.outerLateral + 0.8 && car.lateral >= this.pit.innerLateral - 0.5;
    if (wasInPit && !car.inPit && car.pitState !== 'servicing') {
      car.pitVisitLocked = false;
      if (car.pitState === 'complete') car.pitState = 'none';
    }
    const angle = car.headingOffset || 0;
    const projectedHalfLength = Math.abs(Math.cos(angle)) * car.spec.length / 2 + Math.abs(Math.sin(angle)) * car.spec.width / 2;
    const projectedHalfWidth = Math.abs(Math.cos(angle)) * car.spec.width / 2 + Math.abs(Math.sin(angle)) * car.spec.length / 2;
    car.pitCenterError = { longitudinal: bay.s - localS, lateral: bay.lateral - car.lateral, heading: -angle };
    car.pitInBay = car.inPit && Math.abs(car.pitCenterError.longitudinal) + projectedHalfLength <= bay.length / 2 - 0.15 && Math.abs(car.pitCenterError.lateral) + projectedHalfWidth <= bay.width / 2 - 0.15;
    const parking = this.pit.parkingTolerance, tolerance = this.pit.serviceTolerance;
    car.pitCentered = car.pitInBay && Math.abs(car.pitCenterError.longitudinal) <= parking.longitudinal && Math.abs(car.pitCenterError.lateral) <= parking.lateral && Math.abs(angle) <= parking.heading;
    car.pitServicePoseValid = car.pitInBay && Math.abs(angle) <= tolerance.heading;
    const needsRepair = this.needsRepair(car) || car.mobileRepair.supported && !car.mobileRepair.disabled && car.mobileRepair.charges === 0;
    car.pitAvailable = !car.wrecked && !car.finished && car.mobileRepair.state !== 'active' && needsRepair && car.pitServicePoseValid && car.speed <= tolerance.speed && Math.abs(car.lateralVelocity) <= tolerance.lateralSpeed && !car.pitVisitLocked && car.pitState !== 'servicing' && !car.wheels.some((wheel) => wheel.assembly === 'destroyed');
  }

  requestPitService(car = this.player) {
    if (this.state === 'paused' || this.state === 'countdown' || car.wrecked || car.finished) return false;
    this.updatePitInfo(car);
    if (!car.pitAvailable) return false;
    car.pitState = 'servicing';
    car.pitExiting = false;
    car.pitRoute = 'service';
    car.pitRemaining = this.pit.serviceSeconds;
    car.pitVisitLocked = true;
    car.pitAvailable = false;
    car.speed = 0;
    car.lateralVelocity = 0;
    car.repairMessage = 'Pit crew servicing your car…';
    this.addEvent('pit', `Bay ${car.pitBayNumber}: service started. Hold position for five seconds.`, { carId: car.id });
    return true;
  }

  completePitService(car) {
    if (car.wrecked || car.pitState !== 'servicing' || !car.pitServicePoseValid || car.wheels.some((wheel) => wheel.assembly === 'destroyed')) return;
    car.pitState = 'complete';
    car.pitExiting = car.pitTarget;
    car.pitRoute = car.pitTarget ? 'exit-stall' : 'none';
    car.pitMergeCommitted = false;
    car.pitVisits += 1;
    car.pitRemaining = 0;
    car.pitAvailable = false;
    this.applyRepairOutcome(car, 'pit');
    if (!car.wrecked && car.mobileRepair.supported && !car.mobileRepair.disabled) {
      Object.assign(car.mobileRepair, { charges: 1, used: false, chargeAvailable: true, state: 'ready', reason: '', area: null, aiTarget: null, message: 'Mobile repair charge restored by completed pit service.' });
    }
    this.updateMobileRepairInfo(car);
  }

  applyRepairOutcome(car, source = 'pit') {
    const before = car.damage;
    const engineWearBefore = car.engine.wear;
    const difficulty = this.difficultyLevel / 100;
    const qualityRoll = this.random();
    let change, fraction = 0, worsened = false;
    const replaced = [];
    if (difficulty === 0) { change = -before; fraction = 1; }
    else if (difficulty >= 0.80 && qualityRoll < (difficulty - 0.65) * 1.3) {
      // At Extreme, roughly 45% of service visits can cause further damage.
      change = 0.08 + this.random() * 0.28;
      worsened = true;
    } else {
      fraction = clamp(1 - difficulty * 0.70 - this.random() * difficulty * 0.24, 0.06, 1);
      change = -before * fraction;
    }
    car.damage = clamp(before + change, 0, 1);
    if (worsened) {
      car.engine.wear = clamp(car.engine.wear + change * 0.6, 0, 1);
      car.engine.heat = clamp(car.engine.heat + change * 0.35, 0, 1);
      const wheel = car.wheels[Math.floor(this.random() * car.wheels.length)];
      wheel.suspensionDamage = clamp(wheel.suspensionDamage + change, 0, 1);
      wheel.bend = clamp(wheel.bend + change * 0.6, 0, 1);
      // Keep the former tire-mistake draw in the sequence, but tire replacement
      // is now guaranteed independently of the other repair quality outcomes.
      this.random();
      car.repairMessage = `All four tires replaced. Crew mistake: body damage +${Math.round(change * 100)}%; ${wheel.label.toLowerCase()} wheel rim and suspension damaged; engine condition lost ${Math.round((car.engine.wear - engineWearBefore) * 100)} points (${Math.round((1 - car.engine.wear) * 100)}% remains).`;
    } else {
      car.engine.wear *= 1 - fraction;
      car.engine.heat *= 1 - fraction;
      for (const wheel of car.wheels) {
        wheel.suspensionDamage *= 1 - fraction;
        wheel.bend *= 1 - fraction;
        // Preserve the prior conditional draw count without making new tires
        // conditional on it. Bent rims and suspension still follow difficulty.
        if (fraction !== 1 && wheel.tire !== 'intact') this.random();
      }
      car.repairMessage = fraction === 1 ? 'All four tires replaced. Perfect repair: body, engine, wheels and suspension fully restored.' : `All four tires replaced. Other repairs partial; engine condition ${Math.round((1 - car.engine.wear) * 100)}%.`;
    }
    // This runs after every repair-quality branch, including crew mistakes.
    // It changes tires only; a damaged wheel rim or suspension stays damaged.
    for (const wheel of car.wheels) {
      wheel.tire = 'intact'; wheel.pressure = 1; wheel.leakRate = 0;
      replaced.push(wheel.id);
    }
    this.updateHandling(car);
    if (source === 'mobile') car.repairMessage = `Mobile repair completed. ${car.repairMessage}`;
    this.addEvent('repair', car.repairMessage, { carId: car.id, source, kind: source === 'mobile' ? 'mobile-repair-completed' : 'pit-repair-completed', tiresReplaced: replaced });
    if (car.engine.wear >= 1) {
      car.engine.status = 'burnt';
      this.wreckCar(car, `${source === 'mobile' ? 'Mobile' : 'Pit'} crew failure destroyed the engine`, { preserveBody: true });
    } else {
      this.updateEngine(car, { throttle: 0 }, 0);
      if (car.damage >= 1) this.wreckCar(car, `${source === 'mobile' ? 'Mobile' : 'Pit'} crew repair failure`);
    }
  }

  wreckCar(car, reason = 'Crash damage', options = {}) {
    if (car.wrecked) return;
    if (car.mobileRepair.state === 'active') this.cancelMobileRepair(car, 'The car became a terminal wreck.');
    if (!options.preserveBody) car.damage = 1;
    car.wrecked = true;
    car.status = car.finished ? 'finished' : 'wrecked';
    car.wreckTime = this.elapsed;
    car.wreckReason = reason;
    car.speed = 0;
    car.lateralVelocity = 0;
    car.pitState = 'none';
    car.pitRemaining = 0;
    car.pitAvailable = false;
    car.pitTarget = false;
    if (car.isPlayer) this.state = 'finished';
    this.updateHandling(car);
    this.addEvent('wreck', car.finished ? `${reason}. Completed result stands; wreck remains on track.` : `${reason}. DNF — wreck remains on track.`, { carId: car.id });
  }

  /** At most 0.1 seconds enter the accumulator: hidden tabs cannot catch up. */
  update(dt, input = {}) {
    if (this.state === 'paused' || !Number.isFinite(dt) || dt <= 0 || this.raceComplete) return;
    this.accumulator += Math.min(dt, 0.1);
    const controls = {
      throttle: clamp(Number(input.throttle) || 0, 0, 1),
      brake: clamp(Number(input.brake) || 0, 0, 1),
      steer: clamp(Number(input.steer) || 0, -1, 1),
      service: Boolean(input.service),
      mobileRepair: Boolean(input.mobileRepair),
    };
    while (this.accumulator >= STEP) {
      this.tick(STEP, controls);
      this.accumulator -= STEP;
    }
  }

  tick(dt, input) {
    if (this.state === 'countdown') {
      this.countdown = Math.max(0, this.countdown - dt);
      if (this.countdown < 0.00001) { this.countdown = 0; this.state = 'racing'; this.addEvent('green', 'Green flag. Both races are live.'); }
      return;
    }
    this.elapsed += dt;
    this.resolveMobileRepairContacts();
    for (const car of this.cars) {
      car.previousS = car.s;
      if (car.wrecked) { car.speed = 0; car.lateralVelocity = 0; continue; }
      const brokenAssembly = car.wheels.find((wheel) => wheel.assembly === 'destroyed');
      if (brokenAssembly) { this.wreckCar(car, `${brokenAssembly.label} wheel assembly destroyed`); continue; }
      if (car.damage >= 1) { this.wreckCar(car, 'Crash damage'); continue; }
      if (car.engine.wear >= 1) { this.updateEngine(car, { throttle: 0 }, 0); continue; }
      car.stationaryTime = car.speed < 0.35 && Math.abs(car.lateralVelocity) < 0.2 && car.pitState !== 'servicing' ? car.stationaryTime + dt : 0;
      this.updateComponents(car, dt);
      car.contactCooldown = Math.max(0, car.contactCooldown - dt);
      car.wallCooldown = Math.max(0, car.wallCooldown - dt);
      car.collisionFlash = Math.max(0, car.collisionFlash - dt);
      this.updatePitInfo(car);
      this.updateMobileRepairInfo(car);
      if (car.mobileRepair.state === 'active') {
        const area = car.mobileRepair.area;
        const moved = car.speed > MOBILE_REPAIR_RULES.stopSpeed || Math.abs(car.lateralVelocity) > MOBILE_REPAIR_RULES.lateralStopSpeed || Math.abs(this.relativeDistance(car.s - area.s)) > 0.01 || Math.abs(car.lateral - area.lateral) > 0.01;
        const drivingInput = car.isPlayer && !car.finished && input.throttle > 0.05 && input.brake < 0.8;
        if (moved || drivingInput) this.cancelMobileRepair(car, 'Movement interrupted mobile repair.');
        else {
          car.speed = 0; car.lateralVelocity = 0;
          this.updateEngine(car, { throttle: 0 }, dt);
          car.mobileRepair.remaining = Math.max(0, car.mobileRepair.remaining - dt);
          continue;
        }
      }
      if (car.pitState === 'servicing') {
        this.updateEngine(car, { throttle: 0 }, dt);
        if (!car.pitServicePoseValid) {
          car.pitState = 'complete'; car.pitRemaining = 0;
          car.repairMessage = 'Service interrupted. Leave and re-enter the pit lane to try again.';
          continue;
        }
        car.speed = 0; car.lateralVelocity = 0;
        car.pitRemaining = Math.max(0, car.pitRemaining - dt);
        if (car.pitRemaining <= 0.00001) this.completePitService(car);
        continue;
      }
      const control = car.isPlayer && !car.finished ? input : this.aiControl(car, dt);
      if (control.service && this.requestPitService(car)) continue;
      if (control.mobileRepair && this.requestMobileRepair(car)) continue;
      this.moveCar(car, control, dt);
      this.hitPotholes(car);
    }
    // Both checks precede completion: a contact on the last service tick must
    // cancel and penalize the attempt, never grant a repair first.
    this.resolveMobileRepairContacts();
    this.resolveCollisions();
    this.resolveMobileRepairContacts();
    for (const car of this.cars) {
      if (car.mobileRepair.state === 'active' && car.mobileRepair.remaining <= 0.00001) this.completeMobileRepair(car);
      this.countLaps(car, dt);
      this.updateHandling(car);
      this.updateWorld(car);
      this.updateMobileRepairInfo(car);
    }
    this.raceComplete = this.cars.every((car) => car.finished || car.wrecked);
  }

  aiControl(car, dt) {
    const handling = this.updateHandling(car);
    if (car.mobileRepair.state === 'active') return { throttle: 0, brake: 1, steer: 0 };
    car.aiStuckTime = car.speed < 0.5 && !car.pitTarget ? car.aiStuckTime + dt : 0;
    car.aiEscapeTime = Math.max(0, car.aiEscapeTime - dt);
    const pitS = this.relativeDistance(car.s);
    const needsMechanicalRepair = car.damage > 0.42 || car.engine.wear > 0.2 || car.engine.heat > 0.7 || handling.blownTires || handling.brokenSuspensions || handling.maxSuspensionDamage > 0.6 || handling.averageBend > 0.22 || handling.minPressure < 0.78;
    const needsRecharge = car.mobileRepair.supported && !car.mobileRepair.disabled && !car.mobileRepair.charges;
    const needsPit = needsMechanicalRepair || needsRecharge;
    const nearPitEntrance = pitS > this.pit.entryS - Math.max(260, car.speed * 10) && pitS < this.pit.entryS + 20;
    if (!car.pitTarget && !nearPitEntrance && needsMechanicalRepair && this.elapsed >= (car.mobileRepair.aiRetryAt || 0)) {
      const mobileInput = this.mobileRepairControl(car);
      if (mobileInput) return mobileInput;
    }
    if (!car.finished && needsPit && !car.pitVisitLocked && pitS > this.pit.entryS - 140 && pitS < this.pit.entryS + 20 && !car.pitTarget) {
      car.pitTarget = true; car.pitRoute = 'approach'; car.pitMergeCommitted = false;
    }
    if (car.pitTarget) {
      const pitInput = this.pitControl(car);
      if (pitInput) return pitInput;
    }
    car.aiTimer -= dt;
    if (car.aiTimer <= 0) {
      car.aiTimer = 0.28 + this.random() * 0.18;
      car.aiHazardPlan = this.planRoadPath(car);
      car.targetLateral = car.aiHazardPlan.lateral;
    }
    let targetSpeed = Math.min(car.spec.maxSpeed * car.skill * handling.topSpeedFactor, handling.limpSpeed ?? Infinity);
    const lookahead = Math.max(25, car.speed * 1.5);
    const here = sampleTrack(this.track, car.s, car.lateral);
    const ahead = sampleTrack(this.track, car.s + lookahead, car.lateral);
    const curve = Math.max(here.curvature, ahead.curvature);
    if (curve) targetSpeed = Math.min(targetSpeed, this.cornerSpeed(car, curve) * 0.97);
    if (car.aiHazardPlan?.unsafe) targetSpeed = Math.min(targetSpeed, 6);
    if (car.aiHazardPlan?.impactS !== null && car.aiHazardPlan?.impactS !== undefined) {
      const gap = car.aiHazardPlan.impactS - car.s - car.spec.length / 2 - car.speed * 0.4;
      const safeBraking = car.spec.braking * handling.brakingFactor * 0.55;
      targetSpeed = Math.min(targetSpeed, Math.sqrt(car.aiHazardPlan.impactSpeed ** 2 + 2 * safeBraking * Math.max(0, gap)));
    }
    const safeBraking = car.spec.braking * handling.brakingFactor * 0.5;
    const traffic = this.nearestAhead(car, Math.max(45, car.speed ** 2 / (2 * safeBraking) + 12), (car.spec.width + 2.04) / 2 + 0.2);
    if (traffic) targetSpeed = Math.min(targetSpeed, Math.sqrt(traffic.car.speed ** 2 + 2 * safeBraking * Math.max(0, traffic.gap - 10)));
    if (traffic && traffic.gap < Math.max(10, car.speed * 0.55)) {
      targetSpeed = Math.min(targetSpeed, Math.max(0, traffic.car.speed + (traffic.gap - 9) * 0.4));
      if (traffic.car.wrecked && Math.abs(car.targetLateral - car.lateral) > 1) targetSpeed = Math.max(2, targetSpeed);
    }
    if (car.finished) targetSpeed *= 0.90;
    if (car.inPit) targetSpeed = Math.min(targetSpeed, this.pit.speedLimit);
    if (car.aiStuckTime > 3 && traffic?.car.wrecked && !car.pitTarget && car.aiEscapeTime <= 0) {
      const direction = car.lateral < traffic.car.lateral ? -1 : 1;
      const laneLimit = this.track.width / 2 - 2;
      car.aiEscapeLane = clamp(traffic.car.lateral + direction * 4, -laneLimit, laneLimit);
      if (Math.abs(car.aiEscapeLane - car.lateral) < 1) car.aiEscapeLane = clamp(traffic.car.lateral - direction * 4, -laneLimit, laneLimit);
      car.aiEscapeTime = 6;
      car.aiStuckTime = 0;
    }
    if (car.aiEscapeTime > 0 && !car.pitTarget) {
      car.targetLateral = car.aiHazardPlan && !car.aiHazardPlan.unsafe ? car.aiHazardPlan.lateral : car.aiEscapeLane;
      targetSpeed = Math.max(targetSpeed, 2.5);
    }
    const steering = this.steeringDynamics(car);
    const correction = steering.disturbance / Math.max(0.05, steering.authority);
    return {
      throttle: clamp((targetSpeed - car.speed) * 0.8, 0, 1),
      brake: clamp((car.speed - targetSpeed) * 0.26, 0, 0.85),
      steer: clamp((car.targetLateral - car.lateral) * 0.35 - car.lateralVelocity * 0.18 - correction, -1, 1),
    };
  }

  planRoadPath(car) {
    const planningSpeed = Math.max(8, car.speed);
    const braking = car.spec.braking * car.handling.brakingFactor;
    const horizon = clamp(planningSpeed * 2.6 + planningSpeed ** 2 / (2 * braking) * 0.35, 65, 190);
    const laneLimit = this.track.width / 2 - car.spec.width / 2 - 0.8;
    const buckets = new Set();
    const maximumRadius = this.potholes.reduce((largest, hole) => Math.max(largest, hole.radius), 0);
    const rearScan = Math.max(8, car.spec.length / 2 + maximumRadius + 0.5);
    let bucketPosition = mod(car.s - rearScan, this.track.length), remaining = rearScan + horizon + maximumRadius + 0.5;
    while (remaining >= 0) {
      const bucket = Math.floor(bucketPosition / 40);
      buckets.add(bucket);
      // The last bucket may be shorter than 40m. Walk actual boundaries so a
      // scan crossing the start line includes both partial/end and first bins.
      const step = Math.min((bucket + 1) * 40, this.track.length) - bucketPosition + 0.00001;
      bucketPosition = mod(bucketPosition + step, this.track.length);
      remaining -= step;
    }
    const hazards = [];
    for (const bucket of buckets) for (const hole of this.potholeBuckets.get(bucket) || []) {
      const gap = this.relativeDistance(hole.s - car.s);
      if (gap > -car.spec.length / 2 - hole.radius - 0.35 && gap < horizon + hole.radius) hazards.push({ hole, gap });
    }
    hazards.sort((a, b) => a.gap - b.gap);
    const traffic = this.trafficObjects(car).filter((other) => this.relativeDistance(other.s - car.s) > -35 && this.relativeDistance(other.s - car.s) < horizon + 40);
    const laneCandidates = [clamp(car.targetLateral, -laneLimit, laneLimit), clamp(car.lateral, -laneLimit, laneLimit)];
    for (let index = 0; index <= 10; index += 1) laneCandidates.push(-laneLimit + index * laneLimit / 5);
    for (const { hole } of hazards.slice(0, 3)) {
      const clearance = hole.radius + car.spec.width / 2 + 0.65;
      laneCandidates.push(clamp(hole.lateral - clearance, -laneLimit, laneLimit), clamp(hole.lateral + clearance, -laneLimit, laneLimit));
    }
    const lanes = laneCandidates.filter((lane, index) => laneCandidates.findIndex((other) => Math.abs(other - lane) < 0.25) === index);
    const dynamics = this.steeringDynamics({ ...car, speed: planningSpeed });
    const correction = dynamics.disturbance / Math.max(0.05, dynamics.authority);
    const sampleSeconds = 0.2, sampleDistance = planningSpeed * sampleSeconds;
    const count = Math.ceil(horizon / sampleDistance) + 2;
    // Longitudinal traffic prediction is shared by every candidate. Most
    // samples have no car alongside, so avoid a candidate×sample×field scan.
    const trafficSamples = Array.from({ length: Math.min(count, 16) + 1 }, () => []);
    for (const other of traffic) {
      const initialGap = this.relativeDistance(other.s - car.s);
      for (let index = 1; index < trafficSamples.length; index += 1) {
        const time = index * sampleSeconds;
        if (Math.abs(initialGap + (other.speed - planningSpeed) * time) < (car.spec.length + other.spec.length) / 2 + 1) {
          trafficSamples[index].push({ lateral: other.lateral + other.lateralVelocity * Math.min(time, 0.8), halfWidth: other.spec.width / 2 });
        }
      }
    }
    const plans = lanes.map((lane) => {
      const samples = [{ lateral: car.lateral, velocity: car.lateralVelocity }];
      let lateral = car.lateral, velocity = car.lateralVelocity, unsafe = false;
      for (let index = 1; index <= count; index += 1) {
        const steer = clamp((lane - lateral) * 0.35 - velocity * 0.18 - correction, -1, 1);
        const desired = steer * dynamics.authority + dynamics.disturbance;
        velocity += (desired - velocity) * Math.min(1, sampleSeconds * 5.5 * car.handling.steeringFactor);
        lateral += velocity * sampleSeconds;
        samples.push({ lateral, velocity });
        if (Math.abs(lateral) > laneLimit + 0.15) unsafe = true;
        if (index >= trafficSamples.length) continue;
        const yaw = Math.atan2(velocity, planningSpeed);
        const halfWidth = car.spec.width / 2 * Math.cos(yaw) + car.spec.length / 2 * Math.abs(Math.sin(yaw));
        for (const other of trafficSamples[index]) if (Math.abs(lateral - other.lateral) < halfWidth + other.halfWidth + 0.35) unsafe = true;
      }
      const sample = (distance) => {
        const position = clamp(distance / sampleDistance, 0, samples.length - 1);
        const index = Math.floor(position), next = samples[Math.min(index + 1, samples.length - 1)], fraction = position - index;
        return { lateral: samples[index].lateral + (next.lateral - samples[index].lateral) * fraction, velocity: samples[index].velocity + (next.velocity - samples[index].velocity) * fraction };
      };
      let risk = 0, impactS = null, impactSpeed = null;
      for (const { hole, gap } of hazards) {
        let overlap = 0;
        // Both axles and their swept body envelope must clear the crater, not
        // just the car's centerline or a single arbitrary visible pothole.
        for (const axle of [-1, 1]) {
          const point = sample(gap - axle * car.spec.length * 0.31);
          const yaw = Math.atan2(point.velocity, planningSpeed);
          const clearance = hole.radius + 0.3 + car.spec.width / 2 * Math.cos(yaw) + car.spec.length * 0.31 * Math.abs(Math.sin(yaw));
          overlap = Math.max(overlap, 1 - Math.abs(hole.lateral - point.lateral) / clearance);
        }
        if (overlap <= 0) continue;
        risk += overlap * (20 + 120 * (1 - clamp(gap / horizon, 0, 1)) ** 2) * (1 + hole.severity * 3);
        if (impactS === null) {
          impactS = car.s + Math.max(0, gap - hole.radius);
          impactSpeed = car.streetClassId === 'truck' ? TRUCK_SAFE_SPEED - 0.7 : clamp(20 - hole.radius * 3.2, 8, 18);
        }
      }
      const leader = traffic.reduce((nearest, other) => {
        const gap = this.relativeDistance(other.s - car.s);
        return gap > 0 && Math.abs(other.lateral - lane) < (other.spec.width + car.spec.width) / 2 + 0.4 && (!nearest || gap < nearest.gap) ? { car: other, gap } : nearest;
      }, null);
      const trafficCost = leader && leader.car.speed < car.speed + 3 ? Math.max(0, 65 - leader.gap) * 0.18 : 0;
      const score = risk + trafficCost + Math.abs(lane - car.lateral) * 0.7 + Math.abs(lane - car.targetLateral) * 1.2 + (unsafe ? 10000 : 0);
      return { lateral: lane, risk, unsafe, score, impactS, impactSpeed };
    });
    plans.sort((a, b) => a.score - b.score);
    const best = plans[0];
    const held = plans.find((plan) => Math.abs(plan.lateral - car.targetLateral) < 0.25);
    let selected = held && !held.unsafe && held.score <= best.score + 3 ? held : best;
    if (best.unsafe && Math.abs(car.lateral) <= laneLimit) selected = plans.reduce((nearest, plan) => Math.abs(plan.lateral - car.lateral) < Math.abs(nearest.lateral - car.lateral) ? plan : nearest, plans[0]);
    return { ...selected, scanDistance: horizon, plannedAt: this.elapsed, hazardsScanned: hazards.length };
  }

  pitControl(car) {
    const localS = this.relativeDistance(car.s);
    const bay = this.getPitBay(car);
    const toBay = bay.s - localS;
    const travelLane = this.pitTravelLane(car);
    let targetSpeed = this.pit.speedLimit;
    if (car.pitState === 'complete' && !car.pitExiting) {
      car.pitExiting = true; car.pitRoute = 'exit-stall'; car.pitMergeCommitted = false;
    }
    if (!car.pitExiting && toBay < -this.pit.parkingTolerance.longitudinal) {
      // Overshooting a bay is a missed visit, never a teleport or an infinite
      // standstill at the wrong longitudinal position.
      car.pitExiting = true; car.pitRoute = 'through-exit';
    }
    if (car.pitRoute === 'approach') {
      // Queue on the paved inner racing lane until the actual pit entrance.
      // Turning into the grass before the entrance strands low-power cars.
      car.targetLateral = travelLane;
      // Plan the slowdown using the car's damaged brakes. Waiting until the
      // stall turn to brake makes a limping car slide past its center even
      // when there is enough steering lock for a correctly paced approach.
      const approachBraking = car.spec.braking * car.handling.brakingFactor * 0.45;
      targetSpeed = Math.min(targetSpeed, Math.sqrt(4.5 ** 2 + 2 * approachBraking * Math.max(0, toBay - 32)));
      if (car.targetLateral < car.lateral - 0.2) {
        const innerNeighbor = this.cars.find((other) => {
          const gap = this.relativeDistance(other.s - car.s);
          const sharedHalfWidth = (other.spec.width + car.spec.width) / 2;
          const sharedHalfLength = (other.spec.length + car.spec.length) / 2;
          return other !== car && !other.wrecked && other.pitTarget && other.lateral < car.lateral - 0.4 && other.lateral >= car.targetLateral - sharedHalfWidth - 0.3 && gap > -sharedHalfLength - 1 && gap < 12;
        });
        if (innerNeighbor) {
          targetSpeed = Math.min(targetSpeed, Math.max(0, innerNeighbor.speed - 3));
          // Yield in the current outer lane rather than steering through the
          // inner driver's body while braking. Resume the merge after its
          // complete footprint has moved ahead.
          car.targetLateral = Math.max(car.lateral, innerNeighbor.lateral + (innerNeighbor.spec.width + car.spec.width) / 2 + 0.35);
        }
      }
      if (toBay < 32) { car.pitRoute = 'enter-stall'; }
    }
    if (car.pitRoute === 'enter-stall' || car.pitRoute === 'service') {
      // Approach on the outside of the preceding occupied stall, then finish
      // the lateral alignment over the final seven metres. A straight-line
      // aim at this bay from 32m away cuts through the previous driver's box.
      car.targetLateral = bay.lateral + clamp((toBay - 7) * 0.28, 0, this.pit.throughLateral - bay.lateral);
      // Reach the actual center, rather than stopping at the first point where
      // the body fits inside the painted rectangle. Slow continuously on the
      // final approach; service never snaps position or yaw to the target.
      const aligned = Math.abs(car.pitCenterError.lateral) <= this.pit.parkingTolerance.lateral && Math.abs(car.pitCenterError.heading) <= this.pit.parkingTolerance.heading;
      targetSpeed = toBay <= this.pit.parkingTolerance.longitudinal && aligned ? 0 : clamp(toBay * 0.4, 0.18, 4.5);
    } else if (car.pitRoute === 'exit-stall') {
      if (!car.pitMergeCommitted) {
        const occupied = this.cars.some((other) => {
          if (other === car) return false;
          const gap = this.relativeDistance(other.s - car.s);
          const stationary = other.wrecked || other.stationaryTime > 2.5 && other.pitState !== 'servicing';
          const behindClearance = stationary ? -(other.spec.length + car.spec.length) / 2 - 1 : -75;
          return gap > behindClearance && gap < 15 && Math.abs(other.lateral - travelLane) < (other.spec.width + car.spec.width) / 2 + 0.4;
        });
        if (!occupied) car.pitMergeCommitted = true;
      }
      car.targetLateral = car.pitMergeCommitted ? travelLane : bay.lateral;
      targetSpeed = car.pitMergeCommitted ? 4.5 : 0;
      if (car.pitMergeCommitted && Math.abs(car.lateral - travelLane) < 1) car.pitRoute = 'through-exit';
    } else if (car.pitRoute === 'through-exit') {
      car.targetLateral = localS > this.pit.exitS - 65 ? -this.track.width / 2 + 3 : travelLane;
      if (!car.inPit && localS > this.pit.exitS - 45) {
        car.pitTarget = false; car.pitExiting = false; car.pitRoute = 'none'; car.pitState = 'none';
        car.pitBypassLateral = null; car.pitBypassUntilS = null;
        return null;
      }
    }
    targetSpeed = Math.min(targetSpeed, car.handling.limpSpeed ?? Infinity);
    let traffic = null;
    const safeBraking = car.spec.braking * car.handling.brakingFactor * 0.5;
    const trafficLookahead = Math.max(45, car.speed ** 2 / (2 * safeBraking) + 12);
    for (const other of this.cars) {
      if (other === car || Math.abs(other.lateral - car.lateral) >= (other.spec.width + car.spec.width) / 2) continue;
      const gap = mod(other.s - car.s, this.track.length);
      if (gap > 0 && gap < trafficLookahead && (!traffic || gap < traffic.gap)) traffic = { car: other, gap };
    }
    if (traffic) targetSpeed = Math.min(targetSpeed, Math.sqrt(traffic.car.speed ** 2 + 2 * safeBraking * Math.max(0, traffic.gap - 11)));
    if (traffic && traffic.gap < Math.max(12, car.speed * 0.9)) {
      targetSpeed = Math.min(targetSpeed, Math.max(0, traffic.car.speed + (traffic.gap - 11) * 0.5));
      if ((traffic.car.wrecked || traffic.car.stationaryTime > 2.5 && traffic.car.pitState !== 'servicing') && Math.abs(car.targetLateral - car.lateral) > 0.25) targetSpeed = Math.max(targetSpeed, 2);
    }
    // The deterministic pull compensation is a driver input, not cancelled
    // physics: a human must supply the same opposite steering correction.
    const steering = this.steeringDynamics(car);
    const correction = steering.disturbance / Math.max(0.05, steering.authority);
    return {
      throttle: clamp((targetSpeed - car.speed) * 0.7, 0, 1),
      brake: clamp((car.speed - targetSpeed) * 0.6, 0, 1),
      steer: clamp((car.targetLateral - car.lateral) * (car.pitRoute === 'enter-stall' ? 1.1 : 0.65) - car.lateralVelocity * 0.18 - correction, -1, 1),
      service: car.pitAvailable && car.pitCentered && car.speed <= this.pit.parkingTolerance.speed && Math.abs(car.lateralVelocity) <= this.pit.parkingTolerance.lateralSpeed && !car.pitExiting,
    };
  }

  pitTravelLane(car) {
    const localS = this.relativeDistance(car.s);
    const onPitPaving = localS >= this.pit.entryS && localS <= this.pit.exitS;
    const nominal = localS < this.pit.entryS + 3 || localS > this.pit.exitS ? -this.track.width / 2 + 2.5 : this.pit.throughLateral;
    // Before the entry only the racing surface is paved. Along the pit route,
    // its apron adjoins that same road, so both remain physically available.
    const inside = onPitPaving ? this.pit.innerLateral : -this.track.width / 2 + 0.5;
    const outside = this.track.width / 2 - 0.5;
    const obstacles = this.trafficObjects(car).filter((other) => {
      const gap = this.relativeDistance(other.s - car.s);
      const stationaryObstacle = other.mobileRepair.state === 'active' || other.wrecked || other.stationaryTime > 2.5 && other.pitState !== 'servicing';
      return other !== car && stationaryObstacle && gap > -8 && gap < 70 && other.lateral > inside && other.lateral < outside;
    });
    if (car.pitBypassLateral !== null && car.s < car.pitBypassUntilS && car.pitBypassLateral - car.spec.width / 2 >= inside && car.pitBypassLateral + car.spec.width / 2 <= outside && !obstacles.some((other) => Math.abs(other.lateral - car.pitBypassLateral) < (other.spec.width + car.spec.width) / 2 + 0.45)) return car.pitBypassLateral;
    car.pitBypassLateral = null; car.pitBypassUntilS = null;
    const blockers = obstacles.filter((other) => Math.abs(other.lateral - nominal) < (other.spec.width + car.spec.width) / 2 + 0.5);
    if (!blockers.length) return nominal;
    // The apron is paved and wider than the marked through lane. Choose a
    // persistent, footprint-clear side of a stationary obstruction instead of
    // waiting forever on the nominal centerline. Wrecks keep their exact pose.
    const candidates = [nominal + 2.8, nominal - 2.8, nominal + 5.5, nominal - 5.5, onPitPaving ? this.pit.outerLateral - 2 : 0, inside + 2, outside - 2];
    // Include every genuinely open lateral interval, not just a fixed list of
    // lane centers. A narrow but car-wide gap must not be mistaken for a wall.
    let free = [[inside + car.spec.width / 2, outside - car.spec.width / 2]];
    for (const other of obstacles) {
      const clearance = (other.spec.width + car.spec.width) / 2 + 0.46;
      const low = other.lateral - clearance, high = other.lateral + clearance;
      free = free.flatMap(([left, right]) => {
        if (high <= left || low >= right) return [[left, right]];
        const remaining = [];
        if (low > left) remaining.push([left, low]);
        if (high < right) remaining.push([high, right]);
        return remaining;
      });
    }
    for (const [left, right] of free) if (right - left > 0.1) candidates.push((left + right) / 2, left + 0.05, right - 0.05);
    const clear = candidates.filter((lane) => {
      if (lane - car.spec.width / 2 < inside || lane + car.spec.width / 2 > outside) return false;
      if (obstacles.some((other) => Math.abs(other.lateral - lane) < (other.spec.width + car.spec.width) / 2 + 0.45)) return false;
      // A car leaving a nearby inner stall must not cut across the wreck to
      // reach the far side. It can pass on the near side before merging out.
      if (car.lateral < nominal - 5 && obstacles.some((other) => {
        const gap = this.relativeDistance(other.s - car.s);
        return gap > -3 && gap < 18 && other.lateral > Math.min(car.lateral, lane) && other.lateral < Math.max(car.lateral, lane);
      })) return false;
      return true;
    }).sort((a, b) => (Math.abs(a - car.lateral) + Math.abs(a - nominal) * 0.2) - (Math.abs(b - car.lateral) + Math.abs(b - nominal) * 0.2));
    if (!clear.length) return nominal; // A genuinely blocked corridor stays blocked.
    car.pitBypassLateral = clear[0];
    car.pitBypassUntilS = car.s + Math.max(...blockers.map((other) => this.relativeDistance(other.s - car.s))) + 20;
    return car.pitBypassLateral;
  }

  cornerSpeed(car, curvature) {
    const handling = this.updateHandling(car);
    return Math.sqrt((car.spec.grip * handling.gripFactor + this.track.banking * 2.5) * 9.81 / Math.max(curvature, 0.00001));
  }

  steeringDynamics(car) {
    const handling = car.handling;
    // At a walking pace the driver can use a larger steering angle than at
    // racing speed. Damage still reduces that authority and its response rate.
    const roadRatio = 0.75 - 0.43 * clamp((car.speed - 8) / 17, 0, 1);
    // Broken suspension slows the response, but a repairable steering system
    // can still reach useful lock while creeping into a bay. Fade that parking
    // lock out by 20m/s; response lag below remains fully damage dependent.
    const lockFactor = Math.max(handling.steeringFactor, 0.7 * (1 - clamp((car.speed - 5) / 15, 0, 1)));
    const authority = Math.min(car.inPit ? 6 : 8, car.speed * (car.inPit ? 0.65 : roadRatio)) * lockFactor;
    const vibration = handling.vibrationFactor * Math.sin(car.s * 0.8 + this.elapsed * 18);
    const rawDisturbance = (handling.pull + vibration * 0.65) * clamp(car.speed / 30, 0, 1.5);
    // A repairable wheel may pull hard, but cannot defeat full opposite lock
    // at crawl speed. Keep 40% of the already degraded steering available up
    // to 18m/s; the protection fades at speed, where a blowout can lose control.
    const disturbanceLimit = authority * (0.6 + 1.4 * clamp((car.speed - 18) / 22, 0, 1));
    return { authority, vibration, disturbance: clamp(rawDisturbance, -disturbanceLimit, disturbanceLimit) };
  }

  moveCar(car, control, dt) {
    const surface = sampleTrack(this.track, car.s, car.lateral);
    const halfWidth = this.track.width / 2;
    this.updatePitInfo(car);
    car.offTrack = car.lateral < -halfWidth + 0.5 && !car.inPit;
    this.updateEngine(car, control, dt);
    if (car.wrecked) return;
    const draftTarget = this.nearestAhead(car, 42, 2.2);
    car.draft = draftTarget && draftTarget.gap > 5 && car.speed > 20 ? clamp((42 - draftTarget.gap) / 28, 0, 1) : 0;
    const handling = this.updateHandling(car);
    const maxSpeed = Math.min(car.spec.maxSpeed * handling.topSpeedFactor * (1 + car.draft * 0.055), handling.limpSpeed ?? Infinity);
    const drag = 0.18 + 0.00010 * car.speed * car.speed;
    const powerFade = clamp((maxSpeed - car.speed) / (maxSpeed * 0.18), 0, 1);
    let acceleration = control.throttle * car.spec.acceleration * handling.accelerationFactor * powerFade - control.brake * car.spec.braking * handling.brakingFactor - drag - car.speed * handling.averageBend * 0.025;
    if (car.offTrack) acceleration -= Math.min(4, car.speed * 0.8) + car.speed * 0.11;
    if (car.inPit && car.speed > this.pit.speedLimit) acceleration -= (car.speed - this.pit.speedLimit) * 1.2;
    // A new blowout decelerates physically toward the limp limit; it does not
    // teleport the car's momentum down to the new limit in one simulation tick.
    if (car.speed > maxSpeed) acceleration -= Math.min(12, (car.speed - maxSpeed) * 1.5);
    car.speed = clamp(car.speed + acceleration * dt, 0, car.spec.maxSpeed * 1.08);
    const steering = this.steeringDynamics(car);
    car.vibration = steering.vibration;
    const desiredLateralVelocity = control.steer * steering.authority + steering.disturbance;
    car.lateralVelocity += (desiredLateralVelocity - car.lateralVelocity) * Math.min(1, dt * (car.offTrack ? 2 : 5.5) * handling.steeringFactor);
    if (surface.curvature && car.speed > this.cornerSpeed(car, surface.curvature)) {
      const excess = car.speed - this.cornerSpeed(car, surface.curvature);
      car.lateralVelocity += excess * 0.35 * dt;
      car.speed = Math.max(0, car.speed - excess * 0.16 * dt);
    }
    car.lateral += car.lateralVelocity * dt;
    const wall = halfWidth - car.spec.width / 2;
    if (car.lateral > wall) {
      const impact = Math.max(0, car.lateralVelocity);
      car.lateral = wall;
      car.lateralVelocity = -impact * 0.2;
      car.speed *= Math.max(0.992, 1 - impact * 0.004);
      if (car.wallCooldown <= 0 && (impact > 0.4 || car.speed > 10)) {
        car.damage = clamp(car.damage + 0.004 + impact * 0.004, 0, 1);
        car.wallCooldown = 0.6;
        car.collisionFlash = 0.25;
        if (car.isPlayer) this.addEvent('wall', 'Wall contact — ease off and steer left.');
      }
    }
    // The infield is recoverable grass, bounded well before the opposite road.
    const pitS = this.relativeDistance(car.s);
    const insideLimit = pitS >= this.pit.entryS && pitS <= this.pit.exitS ? this.pit.innerLateral + car.spec.width / 2 : -halfWidth - 10;
    if (car.lateral < insideLimit) { car.lateral = insideLimit; car.lateralVelocity = Math.max(0, car.lateralVelocity); }
    const radiusFactor = Math.max(0.65, 1 + surface.curvature * car.lateral);
    car.s += car.speed / radiusFactor * dt;
    if (car.speed > 0.05 || Math.abs(car.lateralVelocity) > 0.05) car.headingOffset = -Math.atan2(car.lateralVelocity, Math.max(5, car.speed));
    this.updatePitInfo(car);
    if (car.damage >= 1) this.wreckCar(car, 'Wall impact');
  }

  relativeDistance(delta) { return mod(delta + this.track.length / 2, this.track.length) - this.track.length / 2; }

  nearestAhead(car, range, width) {
    let result = null;
    for (const other of this.cars) {
      if (other === car || Math.abs(other.lateral - car.lateral) > width) continue;
      const gap = mod(other.s - car.s, this.track.length);
      if (gap > 0 && gap < range && (!result || gap < result.gap)) result = { car: other, gap };
    }
    return result;
  }

  resolveCollisions() {
    for (let i = 0; i < this.cars.length; i += 1) for (let j = i + 1; j < this.cars.length; j += 1) {
      const a = this.cars[i], b = this.cars[j];
      if (a.wrecked && b.wrecked) continue;
      const ds = this.relativeDistance(b.s - a.s);
      const dl = b.lateral - a.lateral;
      const halfLength = (a.spec.length + b.spec.length) / 2;
      const halfWidth = (a.spec.width + b.spec.width) / 2;
      if (Math.abs(ds) >= halfLength || Math.abs(dl) >= halfWidth) continue;
      const relativeSpeed = Math.abs(a.speed - b.speed);
      const lateralImpact = Math.abs(a.lateralVelocity - b.lateralVelocity);
      const lateralPenetration = halfWidth - Math.abs(dl);
      const longitudinalPenetration = halfLength - Math.abs(ds);
      if (a.wrecked || b.wrecked) {
        const wreck = a.wrecked ? a : b;
        const moving = a.wrecked ? b : a;
        const impactSpeed = moving.speed;
        if (lateralPenetration < longitudinalPenetration * 0.65) {
          const direction = moving.lateral >= wreck.lateral ? 1 : -1;
          moving.lateral += direction * (lateralPenetration + 0.01);
          moving.lateralVelocity = direction * Math.min(5, 1 + impactSpeed * 0.06);
          moving.speed *= 0.70;
        } else {
          const delta = this.relativeDistance(moving.s - wreck.s);
          moving.s += (delta >= 0 ? 1 : -1) * (longitudinalPenetration + 0.01);
          moving.speed *= 0.15;
          moving.lateralVelocity += moving.lateral >= wreck.lateral ? 1 : -1;
        }
        if (moving.contactCooldown <= 0) {
          moving.damage = clamp(moving.damage + 0.025 + impactSpeed * 0.009, 0, 1);
          moving.contactCooldown = 0.5;
          moving.collisionFlash = 0.4;
          this.collisionCount += 1;
          if (a.classId !== b.classId) this.crossClassCollisions += 1;
          if (moving.isPlayer) this.addEvent('contact', 'Wreck impact — watch for stationary cars.');
        }
        if (moving.damage >= 1) this.wreckCar(moving, 'Collision with a wreck');
        continue;
      }
      if (lateralPenetration < longitudinalPenetration * 0.65) {
        const direction = dl >= 0 ? 1 : -1;
        a.lateral -= direction * (lateralPenetration / 2 + 0.005);
        b.lateral += direction * (lateralPenetration / 2 + 0.005);
        a.lateralVelocity -= direction * (0.6 + lateralImpact * 0.2);
        b.lateralVelocity += direction * (0.6 + lateralImpact * 0.2);
        a.speed *= 0.997; b.speed *= 0.997;
      } else {
        const direction = ds >= 0 ? 1 : -1;
        a.s -= direction * (longitudinalPenetration / 2 + 0.005);
        b.s += direction * (longitudinalPenetration / 2 + 0.005);
        const momentum = (a.speed * a.spec.mass + b.speed * b.spec.mass) / (a.spec.mass + b.spec.mass);
        a.speed = Math.max(0, momentum - direction * relativeSpeed * 0.05);
        b.speed = Math.max(0, momentum + direction * relativeSpeed * 0.05);
        a.lateralVelocity -= (dl >= 0 ? 1 : -1) * 0.4;
        b.lateralVelocity += (dl >= 0 ? 1 : -1) * 0.4;
      }
      if (a.contactCooldown <= 0 && b.contactCooldown <= 0) {
        const damage = 0.004 + relativeSpeed * 0.0016 + lateralImpact * 0.002;
        a.damage = clamp(a.damage + damage * b.spec.mass / a.spec.mass, 0, 1);
        b.damage = clamp(b.damage + damage * a.spec.mass / b.spec.mass, 0, 1);
        a.contactCooldown = b.contactCooldown = 0.4;
        a.collisionFlash = b.collisionFlash = 0.3;
        this.collisionCount += 1;
        if (a.classId !== b.classId) this.crossClassCollisions += 1;
        if (a.isPlayer || b.isPlayer) this.addEvent('contact', a.classId !== b.classId ? 'Cross-class contact — both cars take the hit.' : 'Contact — keep it clean.');
      }
      if (a.damage >= 1) this.wreckCar(a, 'Collision damage');
      if (b.damage >= 1) this.wreckCar(b, 'Collision damage');
    }
  }

  countLaps(car, dt) {
    if (car.finished || car.wrecked) return;
    const previous = car.previousS;
    if (!car.crossedStart && car.s >= 0 && previous < 0) {
      car.crossedStart = true;
      car.lapStartTime = this.elapsed - dt + dt * clamp((0 - previous) / Math.max(0.0001, car.s - previous), 0, 1);
    }
    // A forward crossing of each next full circuit is required. Sideways
    // recovery never changes s, so it cannot skip a timing gate or award a lap.
    const nextLine = (car.completedLaps + 1) * this.track.length;
    if (car.crossedStart && previous < nextLine && car.s >= nextLine) {
      const crossingTime = this.elapsed - dt + dt * clamp((nextLine - previous) / Math.max(0.0001, car.s - previous), 0, 1);
      const lapTime = crossingTime - (car.lapStartTime ?? 0);
      car.lastLap = lapTime;
      car.bestLap = car.bestLap === null ? lapTime : Math.min(car.bestLap, lapTime);
      car.lapStartTime = crossingTime;
      car.completedLaps += 1;
      car.lap = Math.min(this.laps, car.completedLaps + 1);
      if (car.isPlayer && car.completedLaps < this.laps) this.addEvent('lap', `Lap ${car.lap} of ${this.laps}${car.lap === this.laps ? ' — final lap!' : ''}`);
      if (car.completedLaps >= this.laps) {
        car.finished = true;
        car.status = 'finished';
        car.finishTime = crossingTime;
        if (car.isPlayer) {
          this.state = 'finished';
          this.addEvent('finish', 'Checkered flag. Your race is complete.');
        }
      }
    }
  }

  updateWorld(car) {
    const position = sampleTrack(this.track, car.s, car.lateral);
    car.x = position.x; car.y = position.y; car.z = position.z;
    car.heading = position.heading;
    car.banking = position.banking;
  }

  getStandings(classId) {
    return this.cars.filter((car) => !classId || car.classId === classId).sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.wrecked !== b.wrecked) return a.wrecked ? 1 : -1;
      return b.s - a.s;
    });
  }

  togglePause() {
    if (this.state === 'paused') { this.state = this.beforePause; }
    else { this.beforePause = this.state; this.state = 'paused'; }
    this.accumulator = 0;
    return this.state;
  }

  recoverPlayer() {
    if (this.state !== 'racing' || this.player.finished || this.player.wrecked || this.player.pitState === 'servicing') return false;
    const car = this.player;
    if (car.mobileRepair.state === 'active') this.cancelMobileRepair(car, 'Recovery interrupted mobile repair.');
    const candidates = [-0.28, 0.28, -0.65, 0.65, 0].map((ratio) => ratio * this.track.width / 2);
    const safe = candidates.find((lane) => this.cars.every((other) => other === car || Math.abs(this.relativeDistance(other.s - car.s)) > 9 || Math.abs(other.lateral - lane) > 2.5));
    if (safe === undefined) return false;
    car.lateral = safe;
    car.targetLateral = safe;
    car.lateralVelocity = 0;
    car.headingOffset = 0;
    car.speed = Math.min(car.speed, 12);
    this.updateWorld(car);
    this.addEvent('recover', 'Recovered to a clear lane. Track position preserved.');
    return true;
  }

  addEvent(type, text, details = {}) {
    const previous = this.events[this.events.length - 1];
    if (previous?.type === type && previous.carId === details.carId && previous.wheelId === details.wheelId && this.elapsed - previous.time < 2) return;
    this.events.push({ type, text, time: this.elapsed, id: `${type}-${details.carId || 'race'}-${details.wheelId || ''}-${this.elapsed.toFixed(3)}`, ...details });
    if (this.events.length > 120) this.events.shift();
  }

  restart() { return new RaceSimulation(this.options); }
}

export const SIMULATION_STEP = STEP;
