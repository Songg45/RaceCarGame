# Split Grid — Stock vs Street

A browser-based mixed-class oval racing game. Ten NASCAR-style stock cars and ten everyday road cars race together on the same track. Choose either class; your car replaces one of that class's ten entries. Both fields share traffic, drafting, and collisions while keeping separate class standings and an overall order.

The Easy–Extreme difficulty slider controls how many randomly positioned potholes appear. Potholes threaten both fields, with street-class protection described below. A fully wrecked car stays where it crashed as a physical obstacle for the remainder of that race. It cannot be repaired, recovered, or respawned. Starting a new race clears the old wrecks and generates a new road surface.

A damaged but still drivable car can enter the physical pit lane, stop in its own assigned bay, and request repairs. There are **20 individual bays**, one per car, beside a separate through lane. Every bay and the complete entry/exit route fit on the home straight. The Bristol-inspired venue now has 600-meter straights and a 500-meter pit lane; its longer actual game lap is shown separately from the real venue inspiration. **Every completed service installs four fresh tires at every difficulty**, with full pressure and no leaks. Easy also provides a full repair of the other damage. Higher difficulty reduces the reliability of body, engine, rim, and suspension repairs; Extreme service can make those conditions worse while still delivering fresh tires. Service is unavailable out on the racing surface, in another driver's bay, or for a terminal wreck.

Each wheel has separate tire pressure, tire condition, wheel bend, suspension condition, and assembly integrity. Larger potholes and faster impacts increase the chance of failure. One continuous wheel/pothole overlap produces one failure roll rather than repeated rolls every frame; the front and rear wheels can strike the same hole separately.

| Failure | Driving consequence |
| --- | --- |
| Puncture | Pressure leaks over simulated time, progressively reducing grip; sufficiently low pressure collapses into a blowout. Pausing also pauses the leak. |
| Blowout | Immediate pressure and grip loss, a steering pull, and a reduced limp speed. |
| Bent wheel | Persistent steering/speed loss and vibration that affects lateral movement. |
| Broken suspension | Severe grip and control loss; a surviving car can limp to the pits. |
| Destroyed wheel assembly | Permanent immobilization for the remainder of the race. |

The four-corner HUD identifies the affected wheel and pressure. Body condition is separate from tire/component condition. Completed pit service always replaces all four tires, including punctured, blown, and underinflated tires. Easy also restores all repairable rim and suspension damage; harder service can leave or worsen those non-tire conditions. A fresh tire can still be damaged by a later road impact. AI cars seek repairs for component failures as well as body damage.

AI drivers look ahead across multiple potholes, account for the paths of all four wheels, and choose a paved route with room for surrounding traffic. If traffic blocks a safe dodge, they slow or yield. Dense layouts can still cause impacts and permanent failures; the hazard layout and damage model are shared by the player and AI.

Driving under power on grass also builds **engine heat**. A brief excursion is survivable, but prolonged exposure causes warnings, persistent engine wear, reduced power, and eventually permanent engine burnout. Returning to pavement or the paved pit lane cools the engine; cooling does not undo existing wear. Idling does not accumulate driving heat, and pause freezes it. Easy service restores a still-repairable engine; harder crews can leave wear or make it worse. A burnt engine cannot be repaired or respawned during that race. Engine condition, body condition, and wheel condition are displayed separately, so a mechanically disabled car can still have an intact body.

## Run locally

Requires Node.js 20.19+ or 22.12+ and a current WebGL-capable browser. Node.js 24 is supported.

```sh
npm install
npm run build:play
npm run play
```

Open `http://127.0.0.1:4173`. This serves an immutable production snapshot loaded into memory when the server starts. Editing source files or building a newer version does not reload or replace a race in progress. To adopt a new version, run `npm run build:play`, deliberately stop/restart `npm run play`, and reload the browser when ready.

For development with hot reload, use `npm run dev` at `http://127.0.0.1:5173`. Source edits can reload that development page, so use the stable play server for uninterrupted races.

```sh
npm test
npm run build
npm run preview
```

`npm test` exercises the simulation without a browser, one test file at a time. `npm run build` creates the production site in `dist/`; `npm run preview` serves that build locally. `npm run build:play` explicitly publishes the stable `dist-play/` snapshot. The game runs in the browser and does not require an account or backend.

Rendering uses device-pixel ratio 1, reduced shadow-map resolution, and a 60-frame-per-second cap. The garage and paused race redraw only when needed; hiding the tab stops frame scheduling and pauses a live race. If the browser loses its graphics context, the game keeps the race state and shows an explicit recovery screen. Continue after graphics recover; skipped wall time is not simulated as a catch-up burst.

## Driving

Choose **Stock car** or **Street car**, select one of the four street roles when driving a street car, then choose a circuit, lap count, and difficulty and select **Take the grid**. Both fields launch together after a three-second countdown. The ten street entrants retain familiar model appearances, but cars within a role share the same performance specification; model appearance is not another performance choice. The Dodge Charger belongs to Sports / Muscle.

| Street role | Tuned maximum speed | Pothole protection | Role advantage |
| --- | --- | --- | --- |
| Sports / Muscle | About 145 mph | Lowest | Fastest street class and strongest acceleration |
| Sedan / Compact | About 123 mph | Second lowest | Predictable handling and strong braking |
| SUV / Van | About 105 mph | Second highest | Stopped mobile repair, recharged by completed pit stops |
| Truck | About 98 mph | Highest | No new pothole damage or impact effects while actually below 15 mph |

These are arcade class values, not real vehicle specifications. Truck protection ends **at 15 mph**, so slow below the threshold before reaching a pothole and remain below it until the rear wheels clear. The HUD shows whether protection is active. This protection does not repair existing damage or prevent collisions, tire leaks already in progress, or engine damage from grass. Stock cars retain their separate racing specification.

| Control | Action |
| --- | --- |
| W / Up arrow | Accelerate |
| S / Down arrow / Space | Brake |
| A / Left arrow, D / Right arrow | Steer across the racing surface |
| C | Cycle chase, hood, overhead, and pit overview cameras |
| P / Escape | Pause or resume the entire field |
| E | Request pit service when stopped in your numbered service bay |
| M | Deploy SUV / Van mobile repair when fully stopped in a clear off-line location |
| R | Recover a still-drivable car to a clear lane; preserves distance and damage |

Touch-sized steering, throttle, and brake buttons are available on small screens. Sound and fullscreen controls are optional. Steering assistance follows the oval's direction while you control speed and lateral position; brake for the tighter Bristol-inspired corners and steer around hazards. The timing panel switches between stock, street, and overall standings.

For repairs, move left toward the inside, enter the marked pit through lane, then pull into your assigned numbered bay shown in the HUD and map. **Stop with the entire car inside your bay and tap E once**, or click the service button when it says **READY**. A reasonable offset or slight angle is accepted; precise centering is unnecessary. The car must fit within the bay with a small clearance, face approximately along it (within about 10°), and be nearly stopped. Service takes five simulated seconds and never snaps the car into place. Holding E is unnecessary. AI drivers still aim for the center of their stalls. Leave the stall and merge back into the through lane before returning to the track. One repair outcome is allowed per pit visit; leave the lane before requesting another. Other cars and permanent wrecks remain physical obstacles, including in the pits. Damage from collisions and potholes can still end the race before you reach the pits. A terminal wreck is permanent for that race; choose **Watch the race**, **Race again**, or return to the garage after retiring.

An **SUV / Van** can also pull into a clear location on the inside of the circuit, fully stop, and tap **M** or the mobile-repair button. The complete marked crew area must be clear of the racing surface, pit through lane, service bays, and other cars. Mobile service takes **15 simulated seconds** and holds the car where it stopped. Completion uses the same difficulty-dependent repair quality as the pits and always installs four fresh tires. Easy repairs all repairable damage; harder crews may leave or worsen body, engine, rim, and suspension damage. No service can revive a terminal wreck.

The SUV starts with **one mobile-repair charge**. Starting a valid attempt spends it; completing any normal five-second pit stop replenishes it, even if the SUV only needs a recharge. Entering the pits or interrupting a pit stop does not recharge it. Moving or using R during mobile service cancels the attempt without granting repairs; the spent charge can still be restored in the pits. Pausing freezes service time.

**Any vehicle contact with the SUV or its deployed crew area during mobile service immediately cancels the repair, adds a severe crew-interruption damage penalty, and permanently disables mobile repair for that race.** This can wreck the SUV. No fresh tires or partial repair are granted on interruption, and later pit service cannot restore a collision-disabled ability. A new race restores it. The HUD distinguishes a ready charge, a spent charge that needs a pit stop, and permanent disablement. AI SUVs use the same physical pull-off, service, contact, and recharge rules.

## Watch the autonomous series

Select **Watch 3-race series** in the garage, or open `http://127.0.0.1:4173/?watch=series`. The browser runs three races at normal speed on Thunder Bowl with all 20 cars:

1. Easy: 10 scheduled laps, difficulty 0.
2. Medium: 15 scheduled laps, difficulty 50 (the slider midpoint).
3. Extreme: 20 scheduled laps, difficulty 100.

The selected stock car uses the same AI driving controls as the other cars. The camera follows another surviving driver after the selected car finishes or wrecks. Each race continues until every car has either finished or wrecked, then a ten-second intermission precedes the next race. You can pause the race or intermission, stop the series, return to the garage, or export its actual results as JSON. Stopping early preserves unfinished drivers as running; it does not manufacture finish or DNF results.

If no active driver makes meaningful forward progress for 45 simulated seconds and no pit or mobile service is active, the watch series pauses with **Traffic stalled**. It reports the race as unfinished and preserves every driver's actual status. Retry continues the same positions and damage; export includes the warning and unfinished field. Restart and garage controls remain available. A warning does not claim the track is physically impassable. Manual driving remains interactive. AI can route around permanent wrecks and stationary non-servicing traffic when a clear paved path exists, while yielding to active service and moving traffic.

The series uses seed `20261112` for reproducibility. The four-street-class revision's independent runs finished with all twenty entrants completing Easy and Medium; all twenty retired on Extreme, with the leader reaching 13 of its 20 scheduled laps. Its results are recorded separately in [the current endurance report](artifacts/street-classes/endurance/ENDURANCE-REPORT.md). The [previous guaranteed-tire report](artifacts/guaranteed-pit-tires/endurance/ENDURANCE-REPORT.md), [original endurance report](artifacts/endurance/ENDURANCE-REPORT.md), [actual original visible-watch record](artifacts/endurance/VISIBLE-WATCH-RECORD.md), [intermediate wheel/pit revision](artifacts/wheel-damage/endurance/ENDURANCE-REPORT.md), [expanded-straight revision](artifacts/straight-pits/endurance/ENDURANCE-REPORT.md), and [predictive-avoidance revision](artifacts/manual-pits-avoidance/endurance/ENDURANCE-REPORT.md) remain preserved as historical evidence. Their different outcomes belong to different physics revisions. A race ending through complete attrition is recorded as such.

## Verification

```sh
npm test
node tests/straight-pits.mjs --output=artifacts/manual-pits-avoidance
node tests/browser-manual-pits.mjs
node tests/browser-guaranteed-tires.mjs
node tests/browser-street-classes.mjs
node tests/extreme-opening.mjs
node tests/compare-extreme-opening.mjs
node tests/endurance.mjs --scenario=easy-10
node tests/endurance.mjs --scenario=medium-15
node tests/endurance.mjs --scenario=extreme-20
```

Browser checks require a local server and an installed Microsoft Edge browser. The current `browser-manual-pits.mjs` defaults to the isolated candidate server at port 4174. To test stable play, set `RACE_URL` to `http://127.0.0.1:4173/` (in PowerShell: `$env:RACE_URL = 'http://127.0.0.1:4173/'`). It writes screenshots and `artifacts/manual-pits-avoidance/browser-manual-pits.json`. Run browser and endurance checks serially rather than alongside each other. The current manual-service browser scenarios and the 60-car AI parking check use normal five-second service. The separately preserved earlier full-row photograph used a declared 600-second service hold to keep all twenty arrivals visible.

The engine suite exercises exact field sizes, lap limits/counting, collision momentum and damage, braking, deterministic simulation, full three-lap races in both classes, difficulty-dependent potholes, persistent wrecks, pit gating and service quality, and pit entry/service/exit on all three circuits with both classes. The complete race checks use normal per-frame AI driving controls without injecting distance or laps. Pit approach checks use controlled initial positions, then ordinary driving physics.

Browser checks use real keyboard and pointer input for short drives, setup controls, camera, pause, and mobile controls. Targeted pit-service and retirement UI scenarios deliberately inject a starting position or damage; these are distinct from completing a race manually in the browser.

The four-street-class revision passed **129 engine/controller tests: 123 engine tests and 6 watch-controller tests**. Coverage includes strict Truck protection, actual AI braking and pull-off behavior, 15-second mobile service, completed-pit recharge, final-tick contact, permanent collision disablement, crew-area traffic avoidance, and all twenty cars entering, servicing, and exiting the pits on each circuit. Independent untouched-grid races ended Easy **20 FIN / 0 DNF in 523.50 simulated seconds**, Medium **20 FIN / 0 DNF in 1,116.43 seconds**, and Extreme **0 FIN / 20 DNF in 1,584.98 seconds**, with no stall watchdog. The watch controller matches all 60 classifications and mobile-service states/counts. Medium and Extreme each included one naturally initiated and completed SUV mobile repair. **Five isolated browser scenarios also passed with zero reported errors**, covering role selection, Truck protection, roadside service and recharge, collision disablement, and mobile-screen controls. The exact accepted candidate was promoted to the stable play server on November 13, 2026; HTTP and served asset hashes were verified, and existing user tabs were left untouched. See [the current QA report](artifacts/street-classes/QA-REPORT.md) and [endurance report](artifacts/street-classes/endurance/ENDURANCE-REPORT.md) for the recorded scope and results.

The previous guaranteed-tire revision passed **55 focused service/component/pit tests plus 5 watch-controller tests**, followed by **one desktop/mobile browser scenario with zero JavaScript/console errors**. Tests include both classes at four difficulty levels, forced Extreme crew mistakes, permanent wrecks, and fresh tires taking damage on later road impacts. In the browser, an actual E tap and normal five-second service restored all four tires while the forced crew mistake worsened non-tire damage; all four 100% pressures and the outcome message remained readable. Its independent full races ended Easy **20 FIN / 0 DNF**, Medium **19 FIN / 1 DNF**, and Extreme **0 FIN / 20 DNF**; its watch controller matches all 60 classifications. See [that tire-service QA report](artifacts/guaranteed-pit-tires/QA-REPORT.md) and [endurance report](artifacts/guaranteed-pit-tires/endurance/ENDURANCE-REPORT.md) for scope and evidence boundaries.

The preceding practical-pit and predictive-avoidance acceptance passed **93 engine/controller tests** and **3 browser checks with zero JavaScript/console errors**. Both classes physically drove into an off-center stop with W/S and completed normal five-second service after a single E tap; a separate service-button click also passed. Normal five-second AI parking checks covered **60 actual visits**, twenty per circuit, with mixed body/component damage, full-chassis containment, and no position/yaw snapping. Across five unchanged Extreme layouts, wheel impacts fell **63.25% at equal distance traveled**, with contacts falling from **171 to 12** and no grass or wall exposure. See [that revision's QA report](artifacts/manual-pits-avoidance/QA-REPORT.md) and [opening comparison](artifacts/manual-pits-avoidance/OPENING-COMPARISON.md) for its recorded evidence and explicit fixture boundaries.

Historical evidence is preserved separately: initial game acceptance passed 33 engine tests and 11 browser scenarios; the original autonomous-series extension brought that earlier revision to 36 tests; the intermediate component/pit model passed 56 tests and 9 browser checks; the expanded-straight and heat revision passed 83 tests and 5 browser checks. Its [expanded-straight QA report](artifacts/straight-pits/QA-REPORT.md), [intermediate QA report](artifacts/wheel-damage/QA-REPORT.md), [original QA report](artifacts/QA-REPORT.md), and [actually watched browser series](artifacts/endurance/VISIBLE-WATCH-RECORD.md) describe those earlier revisions.

## Race length

Choose any whole-number race length starting at **3 laps** and ending at the selected event's scheduled distance:

| Track inspiration | Actual game lap | Real reference lap | Allowed race length | Reference event |
| --- | --- | --- | --- | --- |
| Daytona | 2.5 miles | 2.5 miles | 3–200 laps | Daytona 500 |
| Talladega | 2.66 miles | 2.66 miles | 3–188 laps | Talladega 500-mile Cup race |
| Bristol / expanded Thunder Bowl | About 1.076 miles | 0.533 miles | 3–500 laps | Food City 500 |

NASCAR race lengths vary by event. These limits use scheduled laps; NASCAR overtime is not simulated. The oval artwork and driving model are simplified interpretations rather than surveyed reproductions of the real circuits. Thunder Bowl's straights were lengthened to accommodate all twenty pit bays without curving the row; the original turn radius is retained and actual lap distance is recomputed as 1,731.824 meters.

Official 2026 references, checked November 12, 2026:

- [NASCAR: Daytona 500 race preview](https://www.nascar.com/news-media/2026/02/13/cup-series-2026-what-to-watch-daytona-500-preview/) — 2.5 miles, 200 laps.
- [NASCAR: Talladega race preview](https://www.nascar.com/news-media/2026/04/25/cup-series-2026-talladega-what-to-watch-jack-links-500-preview/) — 2.66 miles, 188 laps.
- [NASCAR: Bristol race preview](https://www.nascar.com/news-media/2026/04/11/cup-series-2026-bristol-what-to-watch-food-city-500-preview/) — 0.533 miles, 500 laps.

## Scope

This is a single-player, simulation-inspired arcade racer, with AI opponents. Vehicle performance values are gameplay tuning, not manufacturer-certified specifications. NASCAR and vehicle model names identify the inspiration; this is an independent project with no official affiliation. Vehicle and track art is generated locally by the renderer rather than downloaded branded assets.

The physics focuses on speed, braking, lane control, traffic, drafting, contact, per-wheel failures, grass-related engine heat/wear, and difficulty-dependent pit repairs. Wheel pressure, component damage, and engine condition affect the gameplay model; this is not a full mechanical or thermodynamic simulation. Fuel use, NASCAR flags/stages, and online multiplayer are not modeled.
