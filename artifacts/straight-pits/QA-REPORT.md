# Expanded straight, centered pits, traffic recovery, and engine heat

Final local acceptance on November 12, 2026: **83 engine/controller tests passed**, **60 normal-service physical pit visits passed**, and **5 isolated browser checks passed with zero JavaScript/console errors**. The exact tested candidate was promoted without another build and is serving at http://127.0.0.1:4173/. No user browser tab was controlled by this QA employee.

## Straight geometry and actual parking

The previous Bristol-inspired home straight was 162.978 m while the complete 20-bay row occupied 318 m and the pit lane 480 m. Only 10 whole bay footprints fitted the straight. Actual old AI visits also stopped as much as 6.499 m before the bay center. [Measured before-fix evidence](parking-before-fix.json).

The current Thunder Bowl has **600 m straights, a 500 m pit lane, and 50 m clearance between each pit endpoint and the turn**. All 20 complete bay footprints, entry, and exit lie on the home straight. The original turn radius is preserved; actual game lap length is now **1,731.824 m / about 1.076 mi**, distinct from Bristol's 0.533 mi reference. Daytona- and Talladega-inspired geometry already accommodates the row.

`node tests/straight-pits.mjs` initializes 20 cars two-wide on the racing surface before entry, with ordinary body damage and a mixture of repairable blown-tire/bent-wheel/suspension conditions. Every later approach, maneuver, service, and exit uses ordinary AI controls and physics. No bay-center position or heading is injected. Each track's 20 cars used their own bays and exited after the normal **five-second service**.

| Track | Actual visits completed | Maximum longitudinal error during service | Maximum lateral error | Maximum heading error |
| --- | ---: | ---: | ---: | ---: |
| Atlantic / Daytona | 20 | 0.249993 m | 0.149919 m | 0.123737° |
| Alabama / Talladega | 20 | 0.249985 m | 0.142810 m | 0.119096° |
| Thunder Bowl / expanded Bristol | 20 | 0.249981 m | 0.054922 m | 1.110215° |

Every full rotated chassis remained inside its stall. Accepted limits are 0.25 m longitudinal, 0.15 m lateral, 0.04 rad heading, 0.15 m/s forward speed, and 0.10 m/s lateral speed. Instrumentation around service acceptance recorded **zero position snaps and zero heading snaps**. [All 60 measurements](parking-verification.json).

## Serial tests and traffic findings

All tests used `node --test --test-concurrency=1`, Windows BelowNormal priority, and a 45-second external bound per process. Files were split into two sequential batches to keep each process bounded:

- 34 focused tests in 8.824 s: `pit-capacity.test.js`, `pit-obstacles.test.js`, `damaged-recovery.test.js`, and `engine-heat.test.js`. [Output](focused-regressions.stdout.txt).
- 49 remaining tests in 27.079 s: `simulation.test.js`, `hazards-and-pits.test.js`, `wheel-damage.test.js`, and `watch-series.test.js`. [Output](remaining-tests.stdout.txt).

The 83 tests include original 10+10 field/class selection, laps, collisions, braking, orientation, full three-lap drives, permanent wrecks, five distinct wheel failures, repair quality, and the new geometry/centering checks. Targeted traffic coverage includes multiple permanent wrecks before entry and near exit, a wreck occupying one service bay while 19 others service/exit, a damaged stationary live car, and a stationary wreck 67 m behind a bay that must not reserve its merge lane forever. Wreck positions remain fixed; passing cars must move continuously and may not be forcibly retired to make the test pass.

The precise user-reported pit-jam state was not captured. These are controlled obstruction regressions and previously recorded development failures, not a claim to have reproduced that exact user incident. A physically open path is required for passing; the tests do not prove every conceivable obstruction can be resolved.

Actual failures found during this revision were preserved:

- Tighter centering initially stranded cars at the longitudinal stop point while still laterally offset. [Failure](parking-incomplete-lateral-alignment.json). The AI now completes its lateral alignment before stopping.
- A later steering change exposed inadequate stopping distance and inward-merge yielding with degraded brakes. [Failure](parking-incomplete-after-low-speed-change.json). Traffic spacing now accounts for actual braking capability, and yielding cars hold their outer line until the inward merge is clear.
- A Medium endurance attempt reached its 40-second wall-clock bound with five severely damaged live cars still circling on grass. [Incomplete evidence](endurance/medium-incomplete-wall-bound.json). This was not declared complete. Their damage pull exceeded available countersteering authority. Ten focused tests using those five saved component states prove manual countersteering can return to pavement and AI can physically center in a bay for repair. These passed **before engine burnout was introduced**, and passed again afterward; thermal retirement did not mask that defect.

The watch controller independently pauses after 45 simulated seconds without meaningful active-car forward progress and with no active service. It reports **Traffic stalled**, keeps the race unfinished and live drivers classified as racing, and offers retry/export/restart/garage. Retry preserves the same simulation and positions. Legitimate service does not trip this guard. Manual racing remains interactive.

## Engine heat and permanent mechanical failure

Both stock and civilian cars were driven through actual ordinary physics on a long uninterrupted grass section with full throttle. A five-second excursion remained survivable. In this controlled exposure, the measured warning appeared at 35.767 s, wear began at 42.267 s, and burnout occurred at 113.633 s. These are gameplay-model measurements for that input/route, not real vehicle thermal specifications.

Tests verify road/pit cooling without erasing wear, no driving heat while stationary, pause freezing engine state, reduced power from wear, complete legitimate Easy repair, and seeded Extreme service mistakes that worsen wear or burn the engine. A burnt engine becomes a permanent collidable wreck, cannot recover or repair, and preserves the actual body damage and wheel conditions. Cold engine wear is distinguished from active overheating in the HUD and event messages.

## Final untouched-grid endurance

Each command ran in its own bounded BelowNormal process, sequentially:

```sh
node tests/endurance.mjs --scenario=easy-10
node tests/endurance.mjs --scenario=medium-15
node tests/endurance.mjs --scenario=extreme-20
```

All use the expanded Thunder Bowl, stock player #88, seed 20261112, the normal 20-car grid, and ordinary 1/60-second physics/AI updates. No positions, laps, damage, clocks, or random state are injected.

| Difficulty | Scheduled laps | FIN | DNF | Still running | Field terminal time | Maximum completed laps | Completed services | Harness wall time |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| Easy 0 | 10 | 20 | 0 | 0 | 9:46.02 | 10 | 29 | 5.7503 s |
| Medium 50 | 15 | 0 | 20 | 0 | 13:16.43 | 6 | 65 | 7.0094 s |
| Extreme 100 | 20 | 0 | 20 | 0 | 2:09.60 | 0 | 0 | 1.3456 s |

All fields reached actual terminal outcomes without a watchdog. Medium/Extreme ended through attrition; they did **not** complete the scheduled 15/20 laps. **None of these three final seeded endurance races had an engine-burn retirement**; natural burnout is demonstrated by the separate continuous-grass tests. The watch-controller test matched all 60 classifications and associated lap/timing/contact data. [Full report and every car's data](endurance/ENDURANCE-REPORT.md).

These are accelerated engine runs, not another observed real-time series. The [original real-time visible watch/export](../endurance/VISIBLE-WATCH-RECORD.md) and [intermediate wheel revision](../wheel-damage/QA-REPORT.md) remain separate historical evidence with their original outcomes.

## Final browser evidence

`node tests/browser-straight-pits.mjs` passed 5 focused checks against the final candidate at port 4174, using one isolated headless Edge process at a time, DPR 1, desktop 1440×900 and mobile 390×844. [Machine-readable results](browser-straight-pits.json). The browser closed through `finally`; a host process query confirmed zero owned QA Node or Playwright Edge processes afterward.

The row/closeup photographs use a declared **accelerated physics fixture**. All 20 cars start on the road before entry during countdown. The real watch controller is paused while ordinary 1/60-second engine updates and AI controls run; no later car positions or headings are injected. Service is extended to 600 simulated seconds solely to hold earlier arrivals for the photograph. All 20 distinct cars physically reached their own centered bays by 188.483 simulated seconds; 21 accepted service starts include one repeat visit. The normal five-second service/exit behavior is separately verified by the 60-visit run above.

- [All 20 physically parked along the complete straight](twenty-physically-parked-straight-bays.png): camera-only overview, HUD hidden for clarity.
- [Centered car and vehicle outline](physically-centered-own-bay.png): actual service pose and refreshed HUD; no stale countdown.
- [Controlled engine heat on mobile](mobile-controlled-engine-heat.png) and [cold engine wear](mobile-controlled-cold-engine-wear.png): explicit heat/wear fixtures, visible warning/condition, no pedal overlap.
- [Controlled engine-only retirement](controlled-engine-burn-retirement.png): body condition/shape preserved and repair/recovery unavailable.
- [Stalled-traffic review](stalled-traffic-review.png) and [export](controlled-stall-export.json): a separate brake-only fixture with an explicit 46-second clock advance verifies modal/export/retry. Actual 45-second guard timing is independently tested using ordinary controller ticks. Export retains all 20 unfinished drivers as racing, and retry keeps the same simulation.

The first real-time photo attempt stopped at its 90 s harness limit. Its failure is preserved as [timeout data](browser-first-timeout.json) and [image](browser-first-timeout.png); it was not marked passed. A deterministic CPU reconstruction found 17 cars parked at 90 s and three still circulating at 30–33 m/s after missed entries, then all 20 parked later. The fixture was changed to accelerated ordinary physics to avoid another long GPU wait. The earlier browser did not retain per-car state, so the reconstruction is not asserted to be an exact trace of that browser run.

A distant-camera depth-precision defect initially hid the flat paving. Adaptive near clipping for the distant pit/overhead views fixed it; chase/hood/menu retain their close clipping range. The final screenshots were rechecked after this renderer-only correction. A final harness synchronization correction waits for the visible stalled-traffic title rather than reading it before the UI refresh. Neither correction changes race outcomes.

## Version identity and limits

- Simulation SHA-256: `1e063005838c42596a67b95c3a2e300a1cbec10c4eab6d2e9802e89fd199a5d6`.
- Track catalog SHA-256: `5a8b98405c23fd6fbc9c3757d88649802cfcfd352944014a66c5913456a39ad8`.
- Combined catalog/simulation parking fingerprint: `94b39eba43ce628f4252e7394183fb034dfa091fc2c0d3f7bf80ee7ea6d75076`.
- Final candidate source-manifest SHA-256: `01a8268560592c8d23590802f624a8a91296ae861af12f6ae9b88614c09fde61`.
- Final candidate build-manifest SHA-256: `c809122b60ea21db7d26a7a22a6b7fe0283f9def22ba14bd669221dbb3dc6c1b`.

The final renderer-only rebuild retained the tested engine, catalog, and watch-controller code. Exact candidate bytes were promoted to stable play without rebuilding; `/build-info.json` provides the full manifest. No broader guarantee is made for every random layout, damaged-car configuration, or GPU. No new real-time full-series browser watch was performed for this revision.
