# Four street classes and SUV roadside repair — QA report

Date: November 13, 2026. Acceptance: **129 engine/controller tests and 5 isolated browser checks passed, zero JavaScript/console errors**. Production promotion is recorded separately after the supervisor's visual review.

## Verified behavior

- The field remains exactly 10 stock and 10 street cars, with all four street roles represented. Choosing any role produces exactly one player. Performance role is separate from body artwork; the Charger remains a sedan-shaped Sports/Muscle car.
- Actual clear-straight acceleration and travel distance rank Sports, Sedan, SUV, Truck. At 15 seconds the measured speeds were 63.410, 53.313, 45.682, and 42.723 m/s. Braking from 25 m/s took 29.345 m for Sedan, versus 36.185 m for SUV and 37.953 m for Truck. These are gameplay measurements, not real vehicle specifications.
- Matched 35 m/s, radius 1.2 m, single-wheel impacts follow the requested vulnerability order. Across 64 paired stratified impact draws, accumulated body damage was 1.8453 / 1.4763 / 1.0334 / 0.6643 and tire/assembly failures were 5 / 4 / 3 / 2 for Sports / Sedan / SUV / Truck. Each trial asserts exactly one physical wheel exposure, avoiding unequal exposure from different vehicle dimensions. The paired random draws are a controlled comparison, not an untouched race sample.
- Truck protection uses actual speed **strictly below 15 mph (6.7056 m/s)**. Below/exact/above boundary checks, an ordinary moving crossing, and acceleration above the threshold during an existing wheel overlap pass. Protection prevents all new pothole effects without healing previous damage. Collisions and grass-related engine heat still apply. AI brakes below the threshold for an unavoidable row of ordinary-size holes, remains on pavement, and accelerates again after clearing them. A separate oversized-crater regression verifies rear-wheel clearance; that diagnostic crater exceeds normal generated sizes.
- SUV roadside service requires a completely stopped, clear location outside racing traffic and the pit through lane. Actual 15-second updates grant no partial repair. Only a valid start spends the charge. Success or movement abort leaves it spent; a completed five-second pit service recharges it. Healthy spent SUVs can pit solely to recharge, and nonfatal poor pit work still recharges.
- Contact with the car or deployed crew area cancels before completion, independently of ordinary collision cooldown, including zero-speed overlap and the final service tick. It applies the severe non-tire penalty once, grants no fresh tires, and disables the ability for the rest of the race. Even full Easy pit repair cannot restore that disabled ability. Fatal ordinary contact still records the crew failure. New races start with a fresh ability.
- Completed roadside repair shares pit quality rules: four fresh tires at every difficulty, with other repairs still subject to poor outcomes. Wrecks and destroyed assemblies cannot be revived. Pause freezes service time. Actual AI movement pulls an SUV clear, stops for service, then rejoins; mixed traffic passes the active crew area without contact.
- Watch mode recognizes active roadside service near its 45-second no-progress limit. Completion or cancellation does not hide a later real stall. Stalled races retain actual unfinished statuses and retry the same state.

## Serial checks and full races

All CPU work ran one process at a time at BelowNormal priority. Each process had a 45-second external limit; independent races retained their existing 40-second internal wall bound and honest liveness watchdogs. No limit was relaxed to obtain completion.

| Check | Result | Wall time |
| --- | --- | ---: |
| `node --test --test-concurrency=1` over all `*.test.js` except watch | 123 / 123 passed | 19.803 s |
| `node --test --test-concurrency=1 tests/watch-series.test.js` | 6 / 6 passed | 24.246 s |
| Easy independent endurance | All 20 finished 10 laps | 3.943 s |
| Medium independent endurance | All 20 finished 15 laps | 12.737 s |
| Extreme independent endurance | All 20 retired; maximum 13 completed laps | 7.178 s |

The surrounding suite includes the existing wheel/engine, practical pit service, saved damaged-driver recovery, permanent obstruction, and crowded pit regressions. All twenty cars physically approached, serviced their assigned stalls, and exited on each of the three tracks. No extra five-seed opening benchmark was rerun for this update.

The three independent commands were `node tests/endurance.mjs --scenario=easy-10`, `--scenario=medium-15`, and `--scenario=extreme-20`. Each started from the untouched 20-car grid with seed **20261112**, a stock player, Thunder Bowl, and ordinary 1/60-second updates with AI controls. Positions, damage, laps, elapsed time, and random state were not injected. These are accelerated offline engine runs, **not browser FPS measurements or a newly observed real-time user watch series**.

| Difficulty | Scheduled laps | FIN | DNF | Field terminal time | Natural SUV mobile attempts / completions | Crews disabled by contact |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Easy 0 | 10 | 20 | 0 | 523.5000 s | 0 / 0 | 0 |
| Medium 50 | 15 | 20 | 0 | 1116.4333 s | 1 / 1 | 0 |
| Extreme 100 | 20 | 0 | 20 | 1584.9833 s | 1 / 1 | 0 |

No watchdog fired. Extreme's terminal attrition is not completion of the scheduled 20-lap distance. The exact watch-controller test independently reran the series and matched all 60 classifications, lap counts, ordering, times, contacts, and roadside state/counts. One seed does not prove all random layouts remain free of traffic stalls. See the [full endurance report](endurance/ENDURANCE-REPORT.md) and [machine-readable summary](endurance/summary.json).

## Investigation provenance

Early controlled impact fixtures exposed different numbers of wheels because vehicle dimensions differ. They were corrected to assert one wheel exposure and pair the random impact draw. A fatal-contact expectation was also corrected for floating-point representation. The watchdog cancellation fixture now explicitly cancels an active service; nonplayer AI is intentionally not consulted during an ongoing repair. These changes correct observation/setup errors without relaxing gameplay invariants.

The oversized Truck approach exposed a real planner defect: it stopped retaining a hazard before rear wheels cleared it and accelerated during overlap. The engine now retains crater radius plus rear footprint; ordinary-size and oversized cases both pass. Nearby-pit preference also keeps deliberate pit approaches from taking an unnecessary roadside detour. Historical failed logs remain local in this directory. The prior guaranteed-tire race JSONs remain untouched; only the current watch fixture reference moved to the independently recorded street-class revision.

## Browser acceptance

`node tests/browser-street-classes.mjs` used one isolated Microsoft Edge instance, device-pixel ratio 1, a 1366 × 768 desktop viewport and a 390 × 844 mobile viewport. Its five checks passed:

1. All four actual street-role cards select the intended player and retain the 10+10 field. The model dropdown is absent.
2. The Truck panel shows protection at actual 14.9 mph and no protection at exactly 15.0 mph. Paused speed fixtures prevent coasting from changing the threshold under observation.
3. A real M key press starts the normal 15-second service. Two mechanics and the hood animate from simulation time in the fixed crew footprint. P freezes the timer and animation. The real visibility handler also freezes them under a declared `document.hidden` fixture. Completion delivers repairs and leaves the charge spent.
4. An actual E tap and normal five-second pit service restore that spent charge, including when the repaired SUV needs only the recharge.
5. The mobile button starts a second deployment. A declared stationary vehicle overlaps the crew area without touching the SUV body; ordinary next-tick processing cancels service, adds the severe penalty, hides the crew, and permanently disables the ability. A subsequent full Easy pit repair restores the car but cannot restore that crew. Mobile status, warning, button, and pedals remain within the viewport without overlap.

The controlled Easy contact increased body damage from 0.24 to 0.49 and engine wear from 0.12 to 0.32, while keeping interrupted tires unrepaired. The model flags, completed counts, component states, and exact poses are retained in [browser evidence](browser-street-classes.json).

The browser deliberately initializes off-road/pit poses, repairable damage, one crew-area contact, and visibility state. Keyboard/button requests and service timing are real browser actions with ordinary updates; no elapsed-time acceleration or charge/disabled-state injection is used. It does not claim a naturally driven roadside approach or native tab-background observation. Those physical approach/traffic behaviors are covered by the engine tests. The user's visible tabs were not used.

The first attempt captured the previously rendered 0.0 mph text immediately after a paused speed fixture. Its wait checked an already-active protection class, so it returned before the idle HUD refreshed. The wait now synchronizes both state and exact speed text; app bytes were unchanged. The local-only `browser-first-threshold-sync.json` is retained separately, not counted as current acceptance.

Useful local-only screenshots in this artifact directory: `four-street-role-cards-desktop.png`, `suv-roadside-active-desktop.png`, `suv-roadside-active-mobile.png`, and `suv-crew-contact-permanently-disabled-mobile.png`. Screenshots are not included in the Git repository.

## Fingerprints

- Simulation SHA-256: `d8bf4d8492a49a27730f7460f4c988703906e799276671fdcc50d435bf2d4c1e`.
- Catalog SHA-256: `4db8a7c88bf0f29ffa4c2baa32b34a190fae5b4405a158e3436cc0ac53876179`.
- Watch controller SHA-256: `ff5ea80bbab0804ec05ac21255598911b59116d6af025c1141895b08a35f8d67`.
- Candidate source fingerprint: `51f015e71d3d1157f1ef38025d5bb89bfd0f212877e31fefe3a4008e6012760f`.
- Candidate build fingerprint: `6d2f61e2f8162195cb5a772616544d023207d3d49ead1e9c3df170360bcb0815`.

The browser evidence reports these same candidate fingerprints. Engine and catalog hashes in every independent race also match the frozen files tested above.
