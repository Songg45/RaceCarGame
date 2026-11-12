# Autonomous race endurance report — practical pit service and predictive avoidance

Run each scenario serially: `node tests/endurance.mjs --scenario=easy-10`, then `--scenario=medium-15`, then `--scenario=extreme-20`.

**This report covers fast, independent engine runs. The normal-speed visible browser watch series is a separate run and must be observed separately.**

All scenarios used the unmodified 20-car starting grid, Thunder Bowl (Bristol inspired), stock player #88, seed **20261112**, and fixed 1/60-second updates. Medium means slider **50**, the midpoint. All movement, damage, laps, pit visits, and retirement events came from ordinary engine updates and AI controls; no positions, laps, damage, clocks, or random state were injected.

| Scenario | Scheduled laps | Potholes | Finished | DNF | Still racing | Field terminal time | Player outcome |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Easy (0) | 10 | 6 | 20 | 0 | 0 | 8:31.35 | P3 stock / P3 overall at 6:08.85 |
| Medium (50) | 15 | 68 | 20 | 0 | 0 | 19:37.55 | P2 stock / P2 overall at 14:18.74 |
| Extreme (100) | 20 | 151 | 0 | 20 | 0 | 8:19.15 | DNF after 1 completed laps at 4:32.89 |

Finished drivers reached the scheduled distance. DNF drivers retired before completing it. Complete field attrition is a terminal race simulation, not a completed scheduled distance. A watchdog result is explicitly incomplete; no running driver is silently removed.

| Scenario | Contacts | Cross-class contacts | Pothole impacts | Service starts | Completed services | Destroyed during service |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Easy | 1 | 0 | 16 | 0 | 0 | 0 |
| Medium | 8 | 4 | 1196 | 49 | 49 | 0 |
| Extreme | 54 | 32 | 1053 | 29 | 19 | 1 |

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
| 1 | stock 1 | #9 V8 Stock Car | FINISHED | 15 | 13:51.36 | — | 36 | 0 |
| 2 | stock 2 | #88 V8 Stock Car (player) | FINISHED | 15 | 14:18.74 | — | 37 | 1 |
| 3 | civilian 1 | #106 Mazda3 | FINISHED | 15 | 14:29.10 | — | 30 | 0 |
| 4 | stock 3 | #3 V8 Stock Car | FINISHED | 15 | 14:47.66 | — | 61 | 2 |
| 5 | civilian 2 | #110 Dodge Charger | FINISHED | 15 | 15:15.64 | — | 36 | 1 |
| 6 | civilian 3 | #105 Honda Civic | FINISHED | 15 | 15:18.96 | — | 33 | 1 |
| 7 | stock 4 | #22 V8 Stock Car | FINISHED | 15 | 15:19.87 | — | 54 | 2 |
| 8 | stock 5 | #7 V8 Stock Car | FINISHED | 15 | 15:22.74 | — | 59 | 3 |
| 9 | stock 6 | #43 V8 Stock Car | FINISHED | 15 | 15:36.33 | — | 52 | 2 |
| 10 | civilian 4 | #102 Toyota Corolla | FINISHED | 15 | 15:47.14 | — | 40 | 1 |
| 11 | stock 7 | #24 V8 Stock Car | FINISHED | 15 | 15:49.94 | — | 72 | 3 |
| 12 | stock 8 | #19 V8 Stock Car | FINISHED | 15 | 16:00.58 | — | 57 | 3 |
| 13 | stock 9 | #12 V8 Stock Car | FINISHED | 15 | 16:28.87 | — | 64 | 5 |
| 14 | civilian 5 | #101 Ford Mustang | FINISHED | 15 | 16:34.66 | — | 59 | 4 |
| 15 | civilian 6 | #107 Volkswagen Golf | FINISHED | 15 | 16:52.14 | — | 66 | 3 |
| 16 | civilian 7 | #103 Toyota Camry | FINISHED | 15 | 16:55.32 | — | 50 | 3 |
| 17 | civilian 8 | #104 Honda Accord | FINISHED | 15 | 17:00.47 | — | 54 | 3 |
| 18 | civilian 9 | #109 Toyota RAV4 | FINISHED | 15 | 17:07.52 | — | 64 | 2 |
| 19 | stock 10 | #48 V8 Stock Car | FINISHED | 15 | 17:54.90 | — | 83 | 5 |
| 20 | civilian 10 | #108 Ford F-150 | FINISHED | 15 | 19:37.55 | — | 71 | 5 |

### Extreme — 20 scheduled laps

[Detailed per-car data and event timeline](extreme-20.json). Maximum completed laps: **3**. Termination: `all-cars-finished-or-wrecked`.

| Overall | Class rank | Car | Result | Laps | Finish / wreck time | Wreck cause | Pothole hits at termination | Completed pit services |
| ---: | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| 1 | stock 1 | #7 V8 Stock Car | DNF | 3 | 8:19.15 | Pothole damage | 72 | 3 |
| 2 | stock 2 | #3 V8 Stock Car | DNF | 3 | 5:39.89 | Pothole damage | 45 | 1 |
| 3 | civilian 1 | #106 Mazda3 | DNF | 2 | 6:27.93 | Pothole damage | 78 | 2 |
| 4 | civilian 2 | #101 Ford Mustang | DNF | 2 | 6:16.31 | Pothole damage | 69 | 2 |
| 5 | stock 3 | #48 V8 Stock Car | DNF | 2 | 7:23.29 | Pothole damage | 72 | 2 |
| 6 | civilian 3 | #108 Ford F-150 | DNF | 2 | 6:29.88 | Pothole damage | 49 | 2 |
| 7 | civilian 4 | #107 Volkswagen Golf | DNF | 2 | 6:35.07 | Pothole damage | 54 | 1 |
| 8 | civilian 5 | #104 Honda Accord | DNF | 2 | 6:40.49 | Pothole damage | 51 | 1 |
| 9 | civilian 6 | #102 Toyota Corolla | DNF | 2 | 5:13.98 | Front right wheel assembly destroyed | 45 | 1 |
| 10 | stock 4 | #12 V8 Stock Car | DNF | 2 | 5:20.88 | Pothole damage | 66 | 2 |
| 11 | civilian 7 | #103 Toyota Camry | DNF | 2 | 5:17.11 | Collision with a wreck | 60 | 1 |
| 12 | stock 5 | #24 V8 Stock Car | DNF | 1 | 4:52.98 | Pit crew repair failure | 46 | 0 |
| 13 | stock 6 | #22 V8 Stock Car | DNF | 1 | 4:17.04 | Collision damage | 57 | 0 |
| 14 | stock 7 | #43 V8 Stock Car | DNF | 1 | 4:28.89 | Pothole damage | 36 | 0 |
| 15 | stock 8 | #19 V8 Stock Car | DNF | 1 | 4:29.78 | Pothole damage | 38 | 0 |
| 16 | stock 9 | #88 V8 Stock Car (player) | DNF | 1 | 4:32.89 | Pothole damage | 40 | 0 |
| 17 | civilian 8 | #105 Honda Civic | DNF | 1 | 4:31.91 | Pothole damage | 45 | 0 |
| 18 | stock 10 | #9 V8 Stock Car | DNF | 1 | 3:04.86 | Pothole damage | 40 | 0 |
| 19 | civilian 9 | #110 Dodge Charger | DNF | 1 | 3:13.64 | Pothole damage | 53 | 1 |
| 20 | civilian 10 | #109 Toyota RAV4 | DNF | 1 | 2:53.01 | Pothole damage | 37 | 0 |

## Reproducibility and limits

Simulation source SHA-256: `b4c16c979d10bf534067f92052a6d0d21a2c50093a1c17d84d9cddcd63947ac8`. The harness checks finite state, sequential timing-line crossings, exactly 10+10 cars, all finishers reaching their scheduled lap count, and all 20 cars being terminal before declaring completion. Stalled drivers or a two-hour simulation watchdog produce an explicitly incomplete result.

Track catalog SHA-256: `5a8b98405c23fd6fbc9c3757d88649802cfcfd352944014a66c5913456a39ad8`. The expanded game circuit has an actual lap distance of 1731.824 meters (1.076 miles); its historical venue inspiration is not a claim that the expanded game track retains the real venue's dimensions.

A single deterministic seed demonstrates these exact races, not general difficulty balance or every possible random layout. The wheel and pit revision has separate results from the earlier actually watched baseline. Pothole hits now count individual wheel contacts, so their totals are not directly comparable with the earlier car-level counter. The three-second countdown is excluded from reported race times. Fast engine wall time does not demonstrate the user-visible normal-speed watch elapsed time.

[Machine-readable summary](summary.json).
