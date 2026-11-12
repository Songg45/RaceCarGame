# Practical pit service and predictive hazard avoidance

The current revision passed **93 engine/controller tests**, **60 normal-service physical AI pit visits**, **five unchanged-layout Extreme opening comparisons**, and **3 browser checks with zero JavaScript/console errors**. The supervisor visually accepted the off-center parking and service screenshots. The exact tested candidate was then promoted without rebuilding and is serving at [http://127.0.0.1:4173/](http://127.0.0.1:4173/).

## Manual service eligibility and AI precision

A manually driven car can now receive service at a practical stop inside its assigned bay. Its entire rotated chassis must fit with 15 cm clearance, heading must be within 0.18 rad (about 10.3°), forward speed at most 0.5 m/s, and lateral speed at most 0.2 m/s. Service requires repairable damage. Other bays, the through lane, racing surface, protruding vehicles, unsafe motion, and terminal wrecks remain ineligible.

Engine tests cover both classes on all three tracks at stops 2 m longitudinally off-center, 1 m laterally off-center, and a combined 1.8 m longitudinal / 0.8 m lateral / 0.12 rad angle. Each accepted stop completes the ordinary **five-second Easy service**, preserves its position and angle, and receives the actual repair. Pressing E once is sufficient; keydown and button click request service directly through the same engine eligibility check.

AI drivers retain separate precision parking targets. All twenty cars on each circuit physically approached from outside the pits, parked, received normal five-second service, and exited with mixed repairable body/component damage. Across all 60 visits, the largest recorded errors during service were **0.249985 m longitudinal, 0.141670 m lateral, and 1.131893° heading**, within the strict AI limits. No service position or angle snapping occurred. [Measurements](parking-verification.json).

## Extreme openings on identical layouts

Five predetermined seeds—20261112, 1, 7, 19, and 42—use unchanged twenty-car grids and exact matching pothole positions, radii, severity, and difficulty 100. Every driver, including the player, uses ordinary AI controls and fixed-step physics. No positions, laps, damage, clocks, or random state are injected.

At equal field progress of 10,000 m in each race, wheel impacts fell from **1,540 to 566 (63.25%)**, and contacts fell from **171 to 12**. Both versions recorded zero grass-driving seconds and zero wall episodes at these checkpoints. Every revised seed reaches the checkpoint within 60 seconds. Initial progress is more cautious, taking 23.23–28.75 seconds versus 16.78–25.55 seconds, but all five revised fields travel farther by 60 seconds because fewer cars become damaged or retire.

| Class across five races, at 60 seconds | Impacts before → after | Retirements before → after | Forward progress before → after |
| --- | --- | --- | --- |
| Stock, 50 cars | 1,627 → 674 | 21 → 0 | 47,118.5 → 66,729.2 m |
| Civilian, 50 cars | 1,651 → 572 | 27 → 0 | 47,376.3 → 61,956.1 m |

The five-run offline recorder took **3.49 seconds before and 4.16 seconds after**. This is an offline simulation timing measurement, **not browser FPS**. Damage and failures remain active; controlled direct impacts still harm both classes. [Full per-seed comparison](OPENING-COMPARISON.md), [baseline data](extreme-opening-baseline.json), and [updated data](extreme-opening-after.json) retain all twenty cars and per-class totals at 30/60 seconds, equal-progress checkpoints, and individual 250/500 m exposures.

Ten focused avoidance cases exercise multi-hole clear paths, a blocked escape lane, adjacent moving traffic requiring actual braking/yielding, and scanning across the partial final 40 m spatial bucket and lap boundary on all three tracks. Passing must use continuous ordinary motion, stay on pavement, preserve obstacles, and avoid replacing pothole impacts with collisions. These tests do not claim all dense layouts are harmless.

## Serial regression and full races

All checks ran serially at BelowNormal priority with a 45-second external process bound:

- 50 tests in 14.851 s: pit capacity/service, AI avoidance, hazards/pits, and wheel damage.
- 43 tests in 26.891 s: simulation, pit obstacles, damaged recovery, engine heat, and the complete watch controller.
- Separate 60-visit AI parking recorder: every visit completed service and exited.

There were no failed, skipped, cancelled, or forced-terminal tests in the final runs. Logs: [focused batch](focused.stdout.log), [remaining batch](remaining.stdout.log), [parking](parking.stdout.log).

Three independent full races use the untouched grid, seed 20261112, expanded Thunder Bowl, and ordinary fixed-step AI controls. They are accelerated engine verification, not a new observed real-time user watch.

| Mode | Scheduled laps | FIN | DNF | Still running | Actual field terminal time | Recorder wall time |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Easy 0 | 10 | 20 | 0 | 0 | 8:31.35 | 3.8563 s |
| Medium 50 | 15 | 20 | 0 | 0 | 19:37.55 | 12.8026 s |
| Extreme 100 | 20 | 0 | 20 | 0 | 8:19.15 | 4.5052 s |

All fields terminated naturally without watchdog intervention. Extreme ended through attrition, with a maximum of three completed laps; it did not complete twenty laps. The complete watch controller independently reproduced all 60 classifications, lap counts, class ranks, times, and contact totals. Only the reference paths changed to the newly recorded fixtures; semantic assertions were retained. [Current full classifications](endurance/ENDURANCE-REPORT.md).

## Browser boundary and version

The final browser run passed all three scenarios at 1366×768 and DPR 1 against the isolated candidate. Each keyboard case starts 18 m before its own bay, already on the pit apron, with a 0.8 m lateral offset and 40% body damage. After that declared setup, actual W/S keyboard input drove and stopped the car inside its bay. One short E tap started and completed normal five-second service after key release, while the car remained visibly off-center. No post-setup car-position mutation, direct service call, or accelerated photo hold was used. This verifies manual bay arrival and service rather than an entire road-to-pit entry journey.

| Actual keyboard approach | Distance driven | Longitudinal stop offset | Lateral offset | Speed at stop | Damage after service |
| --- | ---: | ---: | ---: | ---: | ---: |
| Stock | 15.856 m | −2.144 m | +0.800 m | 0 m/s | 0 |
| Civilian | 15.996 m | −2.004 m | +0.800 m | 0 m/s | 0 |

A read-only wrapper recorded the pose immediately before and after the actual E-triggered service acceptance. Neither position nor heading snapped, and position stayed fixed throughout service. The third scenario used a declared off-center/angled starting pose to verify that one actual service-button click starts and completes repair. That button check is UI wiring evidence, separate from the two physically driven approaches. [Browser results](browser-manual-pits.json).

- [Stock ready off-center](stock-manual-off-center-ready.png) and [service after one E tap](stock-manual-off-center-servicing.png).
- [Civilian ready off-center](civilian-manual-off-center-ready.png) and [service after one E tap](civilian-manual-off-center-servicing.png).

The first browser attempt successfully repaired the stock car and started civilian service, but failed a harness comparison between a pre-key observation and the later service pose. The car had been allowed residual speed below 0.1 m/s and coasted 1.36 mm before E. This was not a service snap. The corrected harness holds the brake until actual zero speed and records the actual acceptance pose; no application change was made for this retry. [Preserved first-attempt data](browser-first-stale-observation.json) and [image](browser-first-stale-observation.png). Both isolated browser processes closed through `finally`; host process checks confirmed zero owned test or Playwright Edge processes after the successful run.

The earlier full-row image used a separately documented 600-second photo hold; it is historical visual evidence, not the normal service duration used here. All previous reports and failed fixtures remain preserved under their original revision directories.

Simulation SHA-256: `b4c16c979d10bf534067f92052a6d0d21a2c50093a1c17d84d9cddcd63947ac8`.

Track catalog SHA-256: `5a8b98405c23fd6fbc9c3757d88649802cfcfd352944014a66c5913456a39ad8`.

Tested candidate source-manifest SHA-256: `b4feb76c5d5d2cdaddf5b75f2f1e4961e1879f48ee7a6eaf96923918eea29500`.

Tested candidate build-manifest SHA-256: `bc18a48ce1ecf03dd895860bbed6710482bef6afdec813edaeec311dabc457b5`.

No application source changed after this candidate build. Exact-byte publication is complete: the stable server returned HTTP 200 with matching source/build fingerprints, and the temporary 4174 candidate listener was stopped. [Served build verification](stable-health.json). No broader guarantee is made for every possible traffic configuration, random layout, or browser/GPU.
