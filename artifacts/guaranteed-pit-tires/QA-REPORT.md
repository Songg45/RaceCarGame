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

[Focused test log](focused.stdout.log), [final watch log](watch-final.stdout.log), and [preserved obsolete-fixture mismatch](watch-compatibility.stdout.log).

The endurance recorder now identifies completed visits from the engine's completed-visit counter rather than parsing repair-message wording. This accommodates the new explicit tire message and correctly distinguishes a completed catastrophic repair from an interrupted service.

Browser status: the presentation employee is preparing one isolated Extreme crew-mistake acceptance, using a declared mixed-tire in-bay fixture, an actual E keypress, and normal five-second service. It will inspect desktop/mobile tire pressures, retained non-tire damage, and the readable repair message. The previously accepted manual driving geometry and five-seed avoidance checks were not rerun for this narrow service change.

Simulation SHA-256: `83e9f4356811dc653e2a63d310f9324db8df51df9f3a9a22adb36d1ede6da6c8`. All application source is frozen; no GPU/browser work ran alongside the CPU checks.
