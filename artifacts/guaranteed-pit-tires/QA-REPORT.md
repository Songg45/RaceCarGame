# Guaranteed four-tire pit service

Every completed normal five-second pit service now installs four intact tires with 100% pressure and zero leaks, at every difficulty. Body, engine, wheel-rim, and suspension repairs retain their difficulty-dependent outcomes. An Extreme crew mistake can worsen those conditions while still delivering new tires. Permanent wrecks and destroyed wheel assemblies cannot receive service or be revived.

**55 focused tests passed in 24.603 seconds**, including fifteen new tire-guarantee cases plus existing wheel, hazard, and pit checks. Both classes were exercised at difficulty 0, 50, 75, and 100 with mixed punctures, blowouts, low pressure, and leaks. Tests wait through ordinary five-second service, verify all four replacement identities and immediately coherent handling, and reject early or interrupted replacement. Forced Extreme mistakes still worsen non-tire damage. Catastrophic body/engine repair failures remain permanent retirements despite fresh tires. A subsequent physical road/pothole encounter still damages newly fitted tires.

**All five watch-controller tests passed in 22.832 seconds.** The original exact-result compatibility check first found the expected changed race outcome (19 finishers instead of the previous 20). Independent fixtures were then refreshed in this directory, preserving every previous revision. Only the reference paths changed; classification, lap, class-rank, timing, and contact assertions remain intact. The final complete controller reproduced all sixty drivers' outcomes.

| Seed 20261112, expanded Thunder Bowl | Scheduled laps | FIN | DNF | Still running | Field terminal time | Recorder wall time |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| Easy 0 | 10 | 20 | 0 | 0 | 8:31.35 | 5.3347 s |
| Medium 50 | 15 | 19 | 1 | 0 | 17:17.07 | 11.1046 s |
| Extreme 100 | 20 | 0 | 20 | 0 | 9:58.53 | 5.1357 s |

These were independent accelerated engine runs from the untouched twenty-car grid with ordinary AI controls and fixed-step updates. No car positions, laps, damage, clocks, or RNG state were injected in endurance. All fields terminated naturally without a watchdog; Extreme ended through attrition, with at most four completed laps, rather than completing twenty laps. [Full classifications and events](endurance/ENDURANCE-REPORT.md).

Checks ran one process at a time at BelowNormal priority, with a 45-second external bound. Current test commands:

```sh
node --test --test-concurrency=1 tests/guaranteed-pit-tires.test.js tests/wheel-damage.test.js tests/hazards-and-pits.test.js tests/pit-capacity.test.js
node --test --test-concurrency=1 tests/watch-series.test.js
```

Local run logs are retained as `focused.stdout.log`, `watch-final.stdout.log`, and `watch-compatibility.stdout.log`; the last preserves the obsolete-fixture mismatch before the expected results were refreshed.

The endurance recorder now identifies completed visits from the engine's completed-visit counter rather than parsing repair-message wording. This accommodates the new explicit tire message and correctly distinguishes a completed catastrophic repair from an interrupted service.

**The isolated browser scenario passed with zero JavaScript/console errors**, using a declared Extreme mixed-tire in-bay fixture and a forced bad-crew outcome. An actual short E keypress started ordinary real-time five-second service. No direct repair call, accelerated clock, or later component/position injection was used.

All four tires ended intact at 100% pressure with zero leaks. The same completed service increased body damage from 35% to 43%, engine wear from 25% to 29.8%, front-left suspension damage from 30% to 38%, and front-left rim bend from 20% to 24.8%. The vehicle's position and heading stayed unchanged. The repair event identified all four tire replacements, and the visible message began **All four tires replaced. Crew mistake:** before explaining the remaining damage.

Desktop and mobile captures confirmed readable wrapped outcome text, four visible 100% pressure readings, retained suspension/rim warnings, and clear mobile pedals. [Machine-readable browser evidence](browser-guaranteed-tires.json). Screenshots are retained locally as `extreme-four-fresh-tires-other-damage-desktop.png` and `extreme-four-fresh-tires-other-damage-mobile.png`. The supervisor visually accepted the result and authorized exact-byte promotion. The isolated browser closed, and a host process check found zero owned browser/harness processes.

This was a controlled repair-outcome UI scenario, not a naturally occurring failure during a full browser race. Both classes and all selected difficulties were covered by the engine tests. The previously accepted manual driving geometry and five-seed avoidance checks were not rerun for this narrow service change.

The exact browser-accepted candidate is now serving at [http://127.0.0.1:4173/](http://127.0.0.1:4173/), promoted without rebuilding. HTTP and asset fingerprints were verified; the temporary 4174 candidate server was stopped and user tabs were untouched. Served source-manifest SHA-256: `e8c7bf6b0c38e76e74b950b566db9bf8fca9a91010857db44373c182d438b20b`. Served build-manifest SHA-256: `990328233b665c605020abab66930a8e9bb66fd3c7690b61614a56411266bc82`.

Simulation SHA-256: `83e9f4356811dc653e2a63d310f9324db8df51df9f3a9a22adb36d1ede6da6c8`. All application source is frozen; no GPU/browser work ran alongside the CPU checks.
