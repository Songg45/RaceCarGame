# Split Grid acceptance report

Verified November 12, 2026, in `C:\Github\RaceCarGame`.

**Result:** 33 engine tests passed, production build passed, and 11 browser acceptance scenarios passed with zero JavaScript/console errors. The local preview is `http://127.0.0.1:5173/`.

## Commands and outcomes

| Command | Result |
| --- | --- |
| `npm test` | 33 passed; 0 failed, skipped, or cancelled. |
| `npm run build` | Vite production build succeeded. |
| `node tests/browser-check.mjs` | 11 scenarios passed in isolated headless Microsoft Edge; error list empty. |

The browser launch required normal host execution because the Windows sandbox closed Edge's process/pipe at startup. No browser security settings were changed. The first app check found a missing favicon; that was fixed and the final run has no resource or console errors.

Vite emits a non-blocking bundle-size warning: the Three.js application bundle is approximately 549.5 kB minified, 147.4 kB gzip. No production deployment was performed.

## Engine evidence

- Both player classes have exactly 20 unique cars: 10 stock and 10 civilian, including one player. The road roster has ten distinct everyday models.
- All three track limits accept whole-number laps from 3 through the scheduled event limit: Daytona 200, Talladega 188, Bristol 500. Invalid values are bounded safely.
- Track geometry closes continuously, turns left, and maps positive lateral steering to the driver's right. Vehicle heading agrees with its velocity.
- The initial start-line crossing counts zero completed laps. Reverse and repeated crossings do not award duplicate laps.
- Stock and civilian cars exchange momentum and both take damage on contact. Stock acceleration is higher than a common road car's. Braking slows the car; pause freezes the field and race clock.
- Both classes completed three-lap Bristol races through ordinary per-frame driving updates, with completed laps observed in sequence 1, 2, 3. The test driver used the simulation's AI control function; no distance or lap values were injected into these full-race tests.
- Easy has sparse potholes; Extreme is substantially denser. Seeds reproduce layouts, different seeds vary them, and a pothole hit damages either class.
- Terminal wrecks remain stationary and collidable, stay in the 20-car field, and cannot recover or receive service. Explicitly starting a new race clears them. AI attempts a physical pass around a blocked wreck. Race completion includes finished and wrecked cars.
- A classified finisher retains its result even if its car later becomes physically wrecked.
- Pit service requires the actual bay, speed below 2 m/s, and five simulated seconds. Easy returns damage to zero. Across 24 seeds per level, average repair quality decreased at levels 35, 70, and 100. Extreme sometimes increased damage and could permanently wreck a nearly destroyed car. Repeated requests cannot reroll a single visit.
- Both vehicle classes physically entered, stopped in, serviced at, and exited the pit lane on all three tracks. Those six tests set up a damaged car on the road 100 m before the entry and parked other traffic away; all subsequent motion used ordinary driving updates without teleporting.

## Browser evidence

The final run used a 1440 × 1000 desktop viewport and a 390 × 844 mobile viewport.

- Track selectors update the lap cap and full-distance control correctly. Easy/Extreme and intermediate labels agree with the simulation's difficulty values.
- Both stock and civilian races simultaneously expose 10 stock cars, 10 civilian cars, and 20 rendered car meshes.
- Real keyboard input accelerates and steers the car. Projection through the active camera confirms **A moves screen-left and D moves screen-right**. Camera switching and pause/resume work.
- A synthetic window-blur event exercises the focus-loss safety handler. This is not an OS-level background-tab lifecycle test.
- Real keyboard E starts pit service and completes the full duration, restoring Easy damage to zero. This UI scenario deliberately places a damaged car in the pit first; natural entry is covered by the separate engine approaches.
- A deliberately injected final-line scenario renders a finish result that survives subsequent physical wreck damage. A separate injected terminal-damage scenario renders DNF, preserves a stationary obstacle, allows following a surviving racer with the spectator camera, and clears the wreck on explicit restart.
- The mobile viewport has no horizontal overflow, and a real pointer press on the gas button accelerates the car. This is viewport/pointer emulation, not a physical-phone hardware test.
- GPU texture count stayed at **14, 14, 14, 14** across the initial mobile race and three explicit same-track restarts.

The complete browser record is [browser-verification.json](browser-verification.json). The browser drives were short functional checks, not a full manually driven race. The simulated three-lap races, targeted injected UI scenarios, and physical pit-approach scenarios are distinct evidence.

## Visual evidence

- [Desktop setup](desktop-setup.png)
- [Chase-camera mixed field](desktop-chase-race.png)
- [Visible Extreme potholes from chase camera](desktop-potholes-chase.png) — controlled starting position 25 m before an actual generated hole.
- [Overhead stock race](desktop-stock-race.png)
- [Street race](desktop-street-race.png)
- [Pit service view](desktop-pit-service.png)
- [Finish classification](desktop-finish-result.png)
- [Permanent wreck / DNF](desktop-permanent-wreck.png)
- [Mobile setup](mobile-setup.png)
- [Mobile race and controls](mobile-race.png)

Reviewed screenshots show readable controls, both vehicle types, visible road hazards, a marked pit lane inside the left-turn oval, and grounded scenery. The supervisor reviewed and approved the final chase and pothole visuals.

## Scope of the result

This is an assisted, simulation-inspired arcade racer with simplified tracks and vehicle physics. It is not a full tire/suspension or professional NASCAR dynamics model. Full scheduled-distance endurance runs (188–500 laps), physical phone devices, online multiplayer, and deployed hosting were not tested or claimed.

## Autonomous-series extension

The later watch-series addition passed three additional controller tests, bringing `npm test` to **36/36**. The controller's complete Easy 10 / Medium 15 / Extreme 20 series matches the separate untouched-grid endurance harness for per-car classifications, laps, elapsed times, potholes, and collisions. It continues after the player's finish until the full field terminates, supports pause, and preserves unfinished results on stop.

[The endurance report](endurance/ENDURANCE-REPORT.md) records the full three engine runs. All 20 cars finished Easy; Medium and Extreme ended with all 20 cars wrecked before the scheduled distance. These fast engine/controller checks are separate from the user's normal-speed visible browser watch. The supervisor owns and observes that visible browser run.
