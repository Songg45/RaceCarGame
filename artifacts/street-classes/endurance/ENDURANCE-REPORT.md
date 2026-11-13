# Autonomous race endurance report — four street classes and roadside repair

Run each scenario serially: `node tests/endurance.mjs --scenario=easy-10`, then `--scenario=medium-15`, then `--scenario=extreme-20`.

**This report covers fast, independent engine runs. The normal-speed visible browser watch series is a separate run and must be observed separately.**

All scenarios used the unmodified 20-car starting grid, Thunder Bowl (Bristol inspired), stock player #88, seed **20261112**, and fixed 1/60-second updates. Medium means slider **50**, the midpoint. All movement, damage, laps, pit visits, and retirement events came from ordinary engine updates and AI controls; no positions, laps, damage, clocks, or random state were injected.

| Scenario | Scheduled laps | Potholes | Finished | DNF | Still racing | Field terminal time | Player outcome |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Easy (0) | 10 | 6 | 20 | 0 | 0 | 8:43.50 | P7 stock / P7 overall at 6:24.68 |
| Medium (50) | 15 | 68 | 20 | 0 | 0 | 18:36.43 | P8 stock / P11 overall at 16:03.05 |
| Extreme (100) | 20 | 151 | 0 | 20 | 0 | 26:24.98 | DNF after 1 completed laps at 5:01.89 |

Finished drivers reached the scheduled distance. DNF drivers retired before completing it. Complete field attrition is a terminal race simulation, not a completed scheduled distance. A watchdog result is explicitly incomplete; no running driver is silently removed.

| Scenario | Contacts | Cross-class contacts | Pothole impacts | Service starts | Completed services | Destroyed during service |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Easy | 0 | 0 | 4 | 0 | 0 | 0 |
| Medium | 19 | 13 | 1169 | 46 | 46 | 0 |
| Extreme | 43 | 23 | 934 | 21 | 21 | 0 |

| Scenario | Roadside attempts | Completed roadside repairs | Crews permanently disabled by contact |
| --- | ---: | ---: | ---: |
| Easy | 0 | 0 | 0 |
| Medium | 1 | 1 | 0 |
| Extreme | 1 | 1 | 0 |

Contact and pothole totals run until the whole field terminates, including coasting after an individual finish. The JSON separates each car's terminal snapshot from its final field-completion snapshot. Pit damage deltas are net changes between service start and end: another car may collide with a car during service. The recorded repair message reports the crew outcome. A wreck during unfinished service is not counted as a completed repair.

## Full classifications

### Easy — 10 scheduled laps

[Detailed per-car data and event timeline](easy-10.json). Maximum completed laps: **10**. Termination: `all-cars-finished-or-wrecked`.

| Overall | Class rank | Car | Result | Laps | Finish / wreck time | Wreck cause | Pothole hits at termination | Completed pit services |
| ---: | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| 1 | stock 1 | #48 V8 Stock Car | FINISHED | 10 | 5:51.50 | — | 0 | 0 |
| 2 | stock 2 | #12 V8 Stock Car | FINISHED | 10 | 5:57.46 | — | 0 | 0 |
| 3 | stock 3 | #19 V8 Stock Car | FINISHED | 10 | 5:59.79 | — | 0 | 0 |
| 4 | stock 4 | #7 V8 Stock Car | FINISHED | 10 | 5:59.92 | — | 0 | 0 |
| 5 | stock 5 | #9 V8 Stock Car | FINISHED | 10 | 6:10.23 | — | 0 | 0 |
| 6 | stock 6 | #24 V8 Stock Car | FINISHED | 10 | 6:10.48 | — | 0 | 0 |
| 7 | stock 7 | #88 V8 Stock Car (player) | FINISHED | 10 | 6:24.68 | — | 0 | 0 |
| 8 | stock 8 | #22 V8 Stock Car | FINISHED | 10 | 6:25.24 | — | 0 | 0 |
| 9 | stock 9 | #43 V8 Stock Car | FINISHED | 10 | 6:26.14 | — | 0 | 0 |
| 10 | stock 10 | #3 V8 Stock Car | FINISHED | 10 | 6:29.05 | — | 0 | 0 |
| 11 | civilian 1 | #105 Honda Civic | FINISHED | 10 | 7:05.07 | — | 0 | 0 |
| 12 | civilian 2 | #110 Dodge Charger | FINISHED | 10 | 7:13.11 | — | 0 | 0 |
| 13 | civilian 3 | #103 Toyota Camry | FINISHED | 10 | 7:13.66 | — | 0 | 0 |
| 14 | civilian 4 | #101 Ford Mustang | FINISHED | 10 | 7:13.96 | — | 0 | 0 |
| 15 | civilian 5 | #107 Volkswagen Golf | FINISHED | 10 | 7:20.98 | — | 0 | 0 |
| 16 | civilian 6 | #106 Mazda3 | FINISHED | 10 | 7:28.98 | — | 2 | 0 |
| 17 | civilian 7 | #102 Toyota Corolla | FINISHED | 10 | 7:30.97 | — | 0 | 0 |
| 18 | civilian 8 | #104 Honda Accord | FINISHED | 10 | 7:31.44 | — | 0 | 0 |
| 19 | civilian 9 | #109 Toyota RAV4 | FINISHED | 10 | 8:12.77 | — | 0 | 0 |
| 20 | civilian 10 | #108 Ford F-150 | FINISHED | 10 | 8:43.49 | — | 0 | 0 |

### Medium — 15 scheduled laps

[Detailed per-car data and event timeline](medium-15.json). Maximum completed laps: **15**. Termination: `all-cars-finished-or-wrecked`.

| Overall | Class rank | Car | Result | Laps | Finish / wreck time | Wreck cause | Pothole hits at termination | Completed pit services |
| ---: | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| 1 | stock 1 | #43 V8 Stock Car | FINISHED | 15 | 14:16.83 | — | 47 | 1 |
| 2 | stock 2 | #19 V8 Stock Car | FINISHED | 15 | 14:17.70 | — | 40 | 1 |
| 3 | stock 3 | #9 V8 Stock Car | FINISHED | 15 | 14:37.44 | — | 41 | 2 |
| 4 | stock 4 | #12 V8 Stock Car | FINISHED | 15 | 14:47.62 | — | 49 | 2 |
| 5 | stock 5 | #48 V8 Stock Car | FINISHED | 15 | 15:11.34 | — | 67 | 3 |
| 6 | stock 6 | #24 V8 Stock Car | FINISHED | 15 | 15:24.17 | — | 55 | 3 |
| 7 | stock 7 | #7 V8 Stock Car | FINISHED | 15 | 15:32.40 | — | 66 | 3 |
| 8 | civilian 1 | #101 Ford Mustang | FINISHED | 15 | 15:41.78 | — | 43 | 2 |
| 9 | civilian 2 | #105 Honda Civic | FINISHED | 15 | 15:56.09 | — | 56 | 2 |
| 10 | civilian 3 | #110 Dodge Charger | FINISHED | 15 | 15:58.66 | — | 36 | 2 |
| 11 | stock 8 | #88 V8 Stock Car (player) | FINISHED | 15 | 16:03.05 | — | 71 | 3 |
| 12 | civilian 4 | #106 Mazda3 | FINISHED | 15 | 16:03.56 | — | 42 | 2 |
| 13 | civilian 5 | #102 Toyota Corolla | FINISHED | 15 | 16:32.59 | — | 55 | 2 |
| 14 | civilian 6 | #104 Honda Accord | FINISHED | 15 | 16:39.88 | — | 51 | 3 |
| 15 | civilian 7 | #107 Volkswagen Golf | FINISHED | 15 | 16:44.32 | — | 50 | 2 |
| 16 | stock 9 | #3 V8 Stock Car | FINISHED | 15 | 16:45.94 | — | 66 | 3 |
| 17 | civilian 8 | #109 Toyota RAV4 | FINISHED | 15 | 16:57.79 | — | 57 | 1 |
| 18 | civilian 9 | #103 Toyota Camry | FINISHED | 15 | 17:35.90 | — | 73 | 4 |
| 19 | stock 10 | #22 V8 Stock Car | FINISHED | 15 | 17:44.65 | — | 81 | 5 |
| 20 | civilian 10 | #108 Ford F-150 | FINISHED | 15 | 18:36.43 | — | 25 | 0 |

### Extreme — 20 scheduled laps

[Detailed per-car data and event timeline](extreme-20.json). Maximum completed laps: **13**. Termination: `all-cars-finished-or-wrecked`.

| Overall | Class rank | Car | Result | Laps | Finish / wreck time | Wreck cause | Pothole hits at termination | Completed pit services |
| ---: | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| 1 | civilian 1 | #108 Ford F-150 | DNF | 13 | 26:24.97 | Collision with a wreck | 43 | 0 |
| 2 | civilian 2 | #106 Mazda3 | DNF | 3 | 6:42.31 | Collision with a wreck | 40 | 1 |
| 3 | civilian 3 | #103 Toyota Camry | DNF | 2 | 6:15.82 | Pit crew repair failure | 52 | 3 |
| 4 | stock 1 | #12 V8 Stock Car | DNF | 2 | 4:36.64 | Pothole damage | 41 | 1 |
| 5 | civilian 4 | #105 Honda Civic | DNF | 2 | 5:44.77 | Pothole damage | 44 | 2 |
| 6 | civilian 5 | #109 Toyota RAV4 | DNF | 2 | 4:42.40 | Pit crew repair failure | 49 | 1 |
| 7 | stock 2 | #43 V8 Stock Car | DNF | 2 | 4:50.13 | Pit crew repair failure | 56 | 2 |
| 8 | stock 3 | #22 V8 Stock Car | DNF | 2 | 4:33.18 | Pit crew repair failure | 51 | 2 |
| 9 | stock 4 | #88 V8 Stock Car (player) | DNF | 1 | 5:01.89 | Pit crew repair failure | 56 | 1 |
| 10 | stock 5 | #3 V8 Stock Car | DNF | 1 | 4:26.15 | Pothole damage | 56 | 0 |
| 11 | civilian 6 | #102 Toyota Corolla | DNF | 1 | 3:29.69 | Pothole damage | 39 | 1 |
| 12 | stock 6 | #19 V8 Stock Car | DNF | 1 | 4:17.37 | Pothole damage | 47 | 1 |
| 13 | civilian 7 | #107 Volkswagen Golf | DNF | 1 | 4:29.23 | Pothole damage | 44 | 1 |
| 14 | stock 7 | #7 V8 Stock Car | DNF | 1 | 3:49.63 | Pothole damage | 42 | 1 |
| 15 | stock 8 | #24 V8 Stock Car | DNF | 1 | 4:39.96 | Collision with a wreck | 59 | 0 |
| 16 | civilian 8 | #104 Honda Accord | DNF | 1 | 3:49.47 | Pothole damage | 55 | 0 |
| 17 | stock 9 | #9 V8 Stock Car | DNF | 1 | 3:48.99 | Pothole damage | 43 | 1 |
| 18 | stock 10 | #48 V8 Stock Car | DNF | 1 | 4:09.97 | Pothole damage | 50 | 1 |
| 19 | civilian 9 | #101 Ford Mustang | DNF | 1 | 2:47.16 | Pothole damage | 32 | 1 |
| 20 | civilian 10 | #110 Dodge Charger | DNF | 1 | 3:31.98 | Pothole damage | 35 | 1 |

## Reproducibility and limits

Simulation source SHA-256: `d8bf4d8492a49a27730f7460f4c988703906e799276671fdcc50d435bf2d4c1e`. The harness checks finite state, sequential timing-line crossings, exactly 10+10 cars, all finishers reaching their scheduled lap count, and all 20 cars being terminal before declaring completion. Stalled drivers or a two-hour simulation watchdog produce an explicitly incomplete result.

Track catalog SHA-256: `4db8a7c88bf0f29ffa4c2baa32b34a190fae5b4405a158e3436cc0ac53876179`. The expanded game circuit has an actual lap distance of 1731.824 meters (1.076 miles); its historical venue inspiration is not a claim that the expanded game track retains the real venue's dimensions.

A single deterministic seed demonstrates these exact races, not general difficulty balance or every possible random layout. The wheel and pit revision has separate results from the earlier actually watched baseline. Pothole hits now count individual wheel contacts, so their totals are not directly comparable with the earlier car-level counter. The three-second countdown is excluded from reported race times. Fast engine wall time does not demonstrate the user-visible normal-speed watch elapsed time.

[Machine-readable summary](summary.json).
