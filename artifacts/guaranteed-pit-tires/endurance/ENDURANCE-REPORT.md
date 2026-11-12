# Autonomous race endurance report — guaranteed four-tire service

Run each scenario serially: `node tests/endurance.mjs --scenario=easy-10`, then `--scenario=medium-15`, then `--scenario=extreme-20`.

**This report covers fast, independent engine runs. The normal-speed visible browser watch series is a separate run and must be observed separately.**

All scenarios used the unmodified 20-car starting grid, Thunder Bowl (Bristol inspired), stock player #88, seed **20261112**, and fixed 1/60-second updates. Medium means slider **50**, the midpoint. All movement, damage, laps, pit visits, and retirement events came from ordinary engine updates and AI controls; no positions, laps, damage, clocks, or random state were injected.

| Scenario | Scheduled laps | Potholes | Finished | DNF | Still racing | Field terminal time | Player outcome |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Easy (0) | 10 | 6 | 20 | 0 | 0 | 8:31.35 | P3 stock / P3 overall at 6:08.85 |
| Medium (50) | 15 | 68 | 19 | 1 | 0 | 17:17.07 | P5 stock / P9 overall at 15:58.00 |
| Extreme (100) | 20 | 151 | 0 | 20 | 0 | 9:58.53 | DNF after 1 completed laps at 2:53.16 |

Finished drivers reached the scheduled distance. DNF drivers retired before completing it. Complete field attrition is a terminal race simulation, not a completed scheduled distance. A watchdog result is explicitly incomplete; no running driver is silently removed.

| Scenario | Contacts | Cross-class contacts | Pothole impacts | Service starts | Completed services | Destroyed during service |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Easy | 1 | 0 | 16 | 0 | 0 | 0 |
| Medium | 8 | 4 | 1143 | 53 | 53 | 0 |
| Extreme | 40 | 33 | 1081 | 35 | 35 | 0 |

Contact and pothole totals run until the whole field terminates, including coasting after an individual finish. The JSON separates each car's terminal snapshot from its final field-completion snapshot. Pit damage deltas are net changes between service start and end: another car may collide with a car during service. The recorded repair message reports the crew outcome. A wreck during unfinished service is not counted as a completed repair.

## Full classifications

### Easy — 10 scheduled laps

[Detailed per-car data and event timeline](easy-10.json). Maximum completed laps: **10**. Termination: `all-cars-finished-or-wrecked`.

| Overall | Class rank | Car | Result | Laps | Finish / wreck time | Wreck cause | Pothole hits at termination | Completed pit services |
| ---: | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| 1 | stock 1 | #7 V8 Stock Car | FINISHED | 10 | 5:47.50 | — | 2 | 0 |
| 2 | stock 2 | #12 V8 Stock Car | FINISHED | 10 | 6:08.58 | — | 2 | 0 |
| 3 | stock 3 | #88 V8 Stock Car (player) | FINISHED | 10 | 6:08.85 | — | 2 | 0 |
| 4 | stock 4 | #24 V8 Stock Car | FINISHED | 10 | 6:13.81 | — | 0 | 0 |
| 5 | stock 5 | #9 V8 Stock Car | FINISHED | 10 | 6:18.99 | — | 0 | 0 |
| 6 | stock 6 | #22 V8 Stock Car | FINISHED | 10 | 6:23.81 | — | 2 | 0 |
| 7 | stock 7 | #3 V8 Stock Car | FINISHED | 10 | 6:24.25 | — | 2 | 0 |
| 8 | stock 8 | #48 V8 Stock Car | FINISHED | 10 | 6:24.73 | — | 0 | 0 |
| 9 | stock 9 | #43 V8 Stock Car | FINISHED | 10 | 6:25.38 | — | 0 | 0 |
| 10 | stock 10 | #19 V8 Stock Car | FINISHED | 10 | 6:29.64 | — | 2 | 0 |
| 11 | civilian 1 | #101 Ford Mustang | FINISHED | 10 | 6:56.31 | — | 0 | 0 |
| 12 | civilian 2 | #110 Dodge Charger | FINISHED | 10 | 7:07.01 | — | 0 | 0 |
| 13 | civilian 3 | #105 Honda Civic | FINISHED | 10 | 7:26.66 | — | 0 | 0 |
| 14 | civilian 4 | #107 Volkswagen Golf | FINISHED | 10 | 7:27.28 | — | 0 | 0 |
| 15 | civilian 5 | #106 Mazda3 | FINISHED | 10 | 7:28.26 | — | 0 | 0 |
| 16 | civilian 6 | #103 Toyota Camry | FINISHED | 10 | 7:34.60 | — | 0 | 0 |
| 17 | civilian 7 | #104 Honda Accord | FINISHED | 10 | 7:37.22 | — | 4 | 0 |
| 18 | civilian 8 | #102 Toyota Corolla | FINISHED | 10 | 8:07.07 | — | 0 | 0 |
| 19 | civilian 9 | #109 Toyota RAV4 | FINISHED | 10 | 8:07.37 | — | 0 | 0 |
| 20 | civilian 10 | #108 Ford F-150 | FINISHED | 10 | 8:31.34 | — | 0 | 0 |

### Medium — 15 scheduled laps

[Detailed per-car data and event timeline](medium-15.json). Maximum completed laps: **15**. Termination: `all-cars-finished-or-wrecked`.

| Overall | Class rank | Car | Result | Laps | Finish / wreck time | Wreck cause | Pothole hits at termination | Completed pit services |
| ---: | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| 1 | stock 1 | #3 V8 Stock Car | FINISHED | 15 | 13:55.43 | — | 48 | 1 |
| 2 | stock 2 | #22 V8 Stock Car | FINISHED | 15 | 14:07.91 | — | 42 | 1 |
| 3 | stock 3 | #7 V8 Stock Car | FINISHED | 15 | 14:57.79 | — | 49 | 3 |
| 4 | civilian 1 | #101 Ford Mustang | FINISHED | 15 | 15:13.28 | — | 40 | 2 |
| 5 | civilian 2 | #105 Honda Civic | FINISHED | 15 | 15:28.65 | — | 41 | 1 |
| 6 | civilian 3 | #106 Mazda3 | FINISHED | 15 | 15:31.05 | — | 44 | 1 |
| 7 | stock 4 | #19 V8 Stock Car | FINISHED | 15 | 15:44.37 | — | 68 | 3 |
| 8 | civilian 4 | #110 Dodge Charger | FINISHED | 15 | 15:49.23 | — | 42 | 2 |
| 9 | stock 5 | #88 V8 Stock Car (player) | FINISHED | 15 | 15:58.00 | — | 65 | 3 |
| 10 | stock 6 | #12 V8 Stock Car | FINISHED | 15 | 16:01.21 | — | 68 | 4 |
| 11 | civilian 5 | #104 Honda Accord | FINISHED | 15 | 16:01.99 | — | 49 | 2 |
| 12 | civilian 6 | #107 Volkswagen Golf | FINISHED | 15 | 16:22.82 | — | 56 | 3 |
| 13 | stock 7 | #24 V8 Stock Car | FINISHED | 15 | 16:32.64 | — | 72 | 5 |
| 14 | stock 8 | #9 V8 Stock Car | FINISHED | 15 | 16:40.30 | — | 90 | 4 |
| 15 | stock 9 | #48 V8 Stock Car | FINISHED | 15 | 16:42.70 | — | 82 | 5 |
| 16 | stock 10 | #43 V8 Stock Car | FINISHED | 15 | 16:49.66 | — | 78 | 4 |
| 17 | civilian 7 | #103 Toyota Camry | FINISHED | 15 | 17:10.13 | — | 50 | 3 |
| 18 | civilian 8 | #109 Toyota RAV4 | FINISHED | 15 | 17:16.53 | — | 56 | 3 |
| 19 | civilian 9 | #108 Ford F-150 | FINISHED | 15 | 17:17.06 | — | 40 | 2 |
| 20 | civilian 10 | #102 Toyota Corolla | DNF | 6 | 6:53.42 | Front left wheel assembly destroyed | 25 | 1 |

### Extreme — 20 scheduled laps

[Detailed per-car data and event timeline](extreme-20.json). Maximum completed laps: **4**. Termination: `all-cars-finished-or-wrecked`.

| Overall | Class rank | Car | Result | Laps | Finish / wreck time | Wreck cause | Pothole hits at termination | Completed pit services |
| ---: | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| 1 | stock 1 | #3 V8 Stock Car | DNF | 4 | 9:26.88 | Pothole damage | 75 | 2 |
| 2 | civilian 1 | #109 Toyota RAV4 | DNF | 3 | 9:58.53 | Collision with a wreck | 68 | 3 |
| 3 | civilian 2 | #108 Ford F-150 | DNF | 3 | 7:56.91 | Pit crew repair failure | 53 | 3 |
| 4 | stock 2 | #9 V8 Stock Car | DNF | 2 | 8:04.16 | Pothole damage | 74 | 2 |
| 5 | stock 3 | #48 V8 Stock Car | DNF | 2 | 7:06.72 | Pothole damage | 59 | 2 |
| 6 | civilian 3 | #103 Toyota Camry | DNF | 2 | 6:38.33 | Pothole damage | 58 | 2 |
| 7 | civilian 4 | #101 Ford Mustang | DNF | 2 | 5:48.78 | Pothole damage | 57 | 2 |
| 8 | civilian 5 | #104 Honda Accord | DNF | 2 | 5:25.07 | Pothole damage | 38 | 2 |
| 9 | stock 4 | #24 V8 Stock Car | DNF | 2 | 5:35.43 | Collision with a wreck | 48 | 2 |
| 10 | stock 5 | #22 V8 Stock Car | DNF | 2 | 5:53.56 | Pothole damage | 67 | 1 |
| 11 | stock 6 | #7 V8 Stock Car | DNF | 2 | 5:12.52 | Rear right wheel assembly destroyed | 40 | 2 |
| 12 | civilian 6 | #106 Mazda3 | DNF | 2 | 5:19.51 | Pothole damage | 49 | 2 |
| 13 | stock 7 | #43 V8 Stock Car | DNF | 2 | 5:04.79 | Collision damage | 40 | 1 |
| 14 | civilian 7 | #105 Honda Civic | DNF | 1 | 5:07.46 | Pit crew repair failure | 39 | 2 |
| 15 | civilian 8 | #102 Toyota Corolla | DNF | 1 | 4:19.51 | Pit crew repair failure | 49 | 2 |
| 16 | stock 8 | #12 V8 Stock Car | DNF | 1 | 4:34.97 | Pit crew repair failure | 62 | 2 |
| 17 | civilian 9 | #107 Volkswagen Golf | DNF | 1 | 4:51.33 | Pothole damage | 59 | 0 |
| 18 | civilian 10 | #110 Dodge Charger | DNF | 1 | 4:55.46 | Pothole damage | 69 | 1 |
| 19 | stock 9 | #19 V8 Stock Car | DNF | 1 | 3:13.52 | Pothole damage | 38 | 1 |
| 20 | stock 10 | #88 V8 Stock Car (player) | DNF | 1 | 2:53.16 | Pothole damage | 39 | 1 |

## Reproducibility and limits

Simulation source SHA-256: `83e9f4356811dc653e2a63d310f9324db8df51df9f3a9a22adb36d1ede6da6c8`. The harness checks finite state, sequential timing-line crossings, exactly 10+10 cars, all finishers reaching their scheduled lap count, and all 20 cars being terminal before declaring completion. Stalled drivers or a two-hour simulation watchdog produce an explicitly incomplete result.

Track catalog SHA-256: `5a8b98405c23fd6fbc9c3757d88649802cfcfd352944014a66c5913456a39ad8`. The expanded game circuit has an actual lap distance of 1731.824 meters (1.076 miles); its historical venue inspiration is not a claim that the expanded game track retains the real venue's dimensions.

A single deterministic seed demonstrates these exact races, not general difficulty balance or every possible random layout. The wheel and pit revision has separate results from the earlier actually watched baseline. Pothole hits now count individual wheel contacts, so their totals are not directly comparable with the earlier car-level counter. The three-second countdown is excluded from reported race times. Fast engine wall time does not demonstrate the user-visible normal-speed watch elapsed time.

[Machine-readable summary](summary.json).
