import { RaceSimulation } from './simulation.js';

export const WATCH_PLAN = Object.freeze([
  Object.freeze({ name: 'Easy', difficulty: 0, laps: 10 }),
  Object.freeze({ name: 'Medium', difficulty: 50, laps: 15 }),
  Object.freeze({ name: 'Extreme', difficulty: 100, laps: 20 }),
]);

const STEP = 1 / 60;
const copy = value => JSON.parse(JSON.stringify(value));
const serviceActive = car => car.pitState === 'servicing' || car.mobileRepair?.state === 'active';

/** Runs the same driver inputs and physics as a manual race, in real time. */
export class WatchSeries {
  constructor({ seed = 20261112, intermissionSeconds = 10 } = {}) {
    this.seed = seed;
    this.intermissionSeconds = intermissionSeconds;
    this.startedAt = new Date().toISOString();
    this.index = 0;
    this.phase = 'racing';
    this.paused = false;
    this.accumulator = 0;
    this.nextIn = 0;
    this.results = [];
    this.stallHistory = [];
    this.stall = null;
    this.input = {};
    this.createRace();
  }

  createRace() {
    const run = WATCH_PLAN[this.index];
    this.simulation = new RaceSimulation({ trackId: 'bristol', playerClass: 'stock', vehicleId: 'civic', difficulty: run.difficulty, laps: run.laps, seed: this.seed });
    this.phase = 'racing';
    this.accumulator = 0;
    this.input = {};
    this.raceStartedAt = new Date().toISOString();
    this.resetTrafficGuard();
  }

  update(dt) {
    if (this.paused || this.phase === 'complete' || this.phase === 'stopped' || !Number.isFinite(dt) || dt <= 0) return;
    const elapsed = Math.min(dt, .1);
    if (this.phase === 'intermission') {
      this.nextIn = Math.max(0, this.nextIn - elapsed);
      if (this.nextIn <= 0) this.nextRace();
      return;
    }
    this.accumulator += elapsed;
    const sim = this.simulation;
    while (this.accumulator + 1e-9 >= STEP && !sim.raceComplete) {
      const serviceWasActive = sim.cars.some(car => !car.finished && !car.wrecked && serviceActive(car));
      this.input = sim.state === 'racing' && !sim.player.finished && !sim.player.wrecked ? sim.aiControl(sim.player, STEP) : {};
      sim.update(STEP, this.input);
      this.accumulator -= STEP;
      if (!sim.raceComplete && this.checkTrafficGuard(serviceWasActive)) return;
    }
    if (sim.raceComplete) {
      this.results.push(this.captureResult());
      this.accumulator = 0;
      if (this.index === WATCH_PLAN.length - 1) {
        this.phase = 'complete';
        this.completedAt = new Date().toISOString();
      } else {
        this.phase = 'intermission';
        this.nextIn = this.intermissionSeconds;
      }
    }
  }

  nextRace() {
    if (this.phase !== 'intermission') return false;
    this.index += 1;
    this.createRace();
    return true;
  }

  togglePause() {
    if (this.phase === 'complete' || this.phase === 'stopped' || this.phase === 'stalled') return this.paused;
    this.paused = !this.paused;
    this.simulation.togglePause();
    this.accumulator = 0;
    return this.paused;
  }

  stop() {
    if (this.phase === 'complete' || this.phase === 'stopped') return;
    if (!this.paused) this.simulation.togglePause();
    this.phase = 'stopped';
    this.paused = true;
    this.stoppedAt = new Date().toISOString();
  }

  resetTrafficGuard() {
    this.progressMarkers = new Map(this.simulation.cars.map(car => [car.id, car.s]));
    this.lastProgressAt = this.simulation.elapsed;
    this.noProgressSeconds = 0;
    this.stall = null;
  }

  checkTrafficGuard(serviceWasActive) {
    const sim = this.simulation;
    const active = sim.cars.filter(car => !car.finished && !car.wrecked);
    if (!active.length || sim.state === 'countdown') return false;
    let progressed = false;
    for (const car of active) {
      const previous = this.progressMarkers.get(car.id) ?? car.s;
      if (car.s - previous >= .1 - 1e-9) { this.progressMarkers.set(car.id, car.s); progressed = true; }
    }
    if (progressed || serviceWasActive || active.some(serviceActive)) this.lastProgressAt = sim.elapsed;
    this.noProgressSeconds = sim.elapsed - this.lastProgressAt;
    if (this.noProgressSeconds < 45 - 1e-7) return false;
    this.stall = { run: this.index + 1, detectedAt: new Date().toISOString(), simulatedSeconds: sim.elapsed, noProgressSeconds: this.noProgressSeconds, minimumForwardProgressMeters: .1, unfinishedCars: active.length, retryAt: null, message: 'Traffic stalled: race unfinished and paused for review.' };
    this.stallHistory.push(this.stall);
    this.phase = 'stalled'; this.paused = true; this.accumulator = 0;
    sim.togglePause();
    return true;
  }

  retryStalledRace() {
    if (this.phase !== 'stalled') return false;
    this.stall.retryAt = new Date().toISOString();
    this.phase = 'racing'; this.paused = false;
    if (this.simulation.state === 'paused') this.simulation.togglePause();
    this.accumulator = 0; this.input = {}; this.resetTrafficGuard();
    return true;
  }

  captureResult() {
    const sim = this.simulation;
    const standings = sim.getStandings().map((car, index) => ({
      overallPosition: index + 1,
      classPosition: sim.getStandings(car.classId).findIndex(other => other.id === car.id) + 1,
      id: car.id, number: car.number, name: car.name, classId: car.classId, isPlayer: car.isPlayer,
      streetClassId: car.streetClassId || null,
      status: car.finished ? 'finished' : car.wrecked ? 'DNF' : 'racing',
      completedLaps: car.completedLaps, finishTime: car.finishTime, bestLap: car.bestLap,
      damage: car.damage, wrecked: car.wrecked, wreckTime: car.wreckTime, wreckReason: car.wreckReason, potholeHits: car.potholeHits,
      assignedBayId: car.assignedBayId, pitBayNumber: car.pitBayNumber,
      wheels: (car.wheels || []).map(wheel => ({ ...wheel })), handling: { ...car.handling },
      engine: car.engine ? { ...car.engine } : null,
      mobileRepair: car.mobileRepair?.supported ? { state: car.mobileRepair.state, charges: car.mobileRepair.charges ?? 0,
        disabled: Boolean(car.mobileRepair.disabled), disabledReason: car.mobileRepair.disabledReason || '',
        attempts: car.mobileRepair.attempts ?? 0, completed: car.mobileRepair.completed ?? 0,
        penaltyApplied: Boolean(car.mobileRepair.penaltyApplied) } : null,
    }));
    const finishers = standings.filter(car => car.status === 'finished').length;
    return {
      ...WATCH_PLAN[this.index], trackId: sim.track.id, trackName: sim.track.name, seed: this.seed,
      raceStartedAt: this.raceStartedAt, endedAt: new Date().toISOString(), simulatedSeconds: sim.elapsed,
      raceComplete: sim.raceComplete, finishers, dnfs: standings.filter(car => car.status === 'DNF').length,
      targetDistanceReached: finishers > 0,
      outcome: !sim.raceComplete ? this.phase === 'stalled' ? 'Traffic stalled; race unfinished and paused for review' : 'Stopped before every car finished or retired' : finishers > 0 ? 'Classified after every car finished or retired' : 'All cars retired before the target distance',
      potholes: sim.potholes.length, collisions: sim.collisionCount, crossClassCollisions: sim.crossClassCollisions,
      standings,
    };
  }

  get snapshot() {
    const sim = this.simulation;
    return {
      phase: this.phase, paused: this.paused, run: this.index + 1, totalRuns: WATCH_PLAN.length,
      ...WATCH_PLAN[this.index], seed: this.seed, nextIn: this.nextIn,
      simulatedSeconds: sim.elapsed,
      finishers: sim.cars.filter(car => car.finished).length,
      dnfs: sim.cars.filter(car => car.wrecked && !car.finished).length,
      racing: sim.cars.filter(car => !car.finished && !car.wrecked).length,
      completedRuns: this.results.length, raceComplete: sim.raceComplete,
      noProgressSeconds: this.noProgressSeconds, stall: this.stall ? { ...this.stall } : null,
    };
  }

  get report() {
    return copy({
      title: 'Split Grid — real-time autonomous race series', startedAt: this.startedAt,
      completedAt: this.completedAt || null, stoppedAt: this.stoppedAt || null,
      mode: 'normal-speed fixed-step autopilot using unmodified race physics', trackId: 'bristol', playerClass: 'stock',
      seed: this.seed, plan: WATCH_PLAN, current: this.snapshot, results: this.results,
      stallHistory: this.stallHistory,
      unfinishedRace: ['stopped', 'stalled'].includes(this.phase) ? this.captureResult() : null,
    });
  }
}
