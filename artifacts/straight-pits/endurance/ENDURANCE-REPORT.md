# Autonomous race endurance report — expanded pits and engine-heat revision

Run each scenario serially: `node tests/endurance.mjs --scenario=easy-10`, then `--scenario=medium-15`, then `--scenario=extreme-20`.

**This report covers fast, independent engine runs. The normal-speed visible browser watch series is a separate run and must be observed separately.**

All scenarios used the unmodified 20-car starting grid, Thunder Bowl (Bristol inspired), stock player #88, seed **20261112**, and fixed 1/60-second updates. Medium means slider **50**, the midpoint. All movement, damage, laps, pit visits, and retirement events came from ordinary engine updates and AI controls; no positions, laps, damage, clocks, or random state were injected.

| Scenario | Scheduled laps | Potholes | Finished | DNF | Still racing | Field terminal time | Player outcome |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Easy (0) | 10 | 6 | 20 | 0 | 0 | 9:46.02 | P6 stock / P6 overall at 7:46.29 |
| Medium (50) | 15 | 68 | 0 | 20 | 0 | 13:16.43 | DNF after 5 completed laps at 13:16.43 |
| Extreme (100) | 20 | 151 | 0 | 20 | 0 | 2:09.60 | DNF after 0 completed laps at 0:46.14 |

Finished drivers reached the scheduled distance. DNF drivers retired before completing it. Complete field attrition is a terminal race simulation, not a completed scheduled distance. A watchdog result is explicitly incomplete; no running driver is silently removed.

| Scenario | Contacts | Cross-class contacts | Pothole impacts | Service starts | Completed services | Destroyed during service |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Easy | 65 | 21 | 674 | 29 | 29 | 0 |
| Medium | 145 | 96 | 2709 | 65 | 65 | 0 |
| Extreme | 86 | 44 | 812 | 0 | 0 | 0 |

Contact and pothole totals run until the whole field terminates, including coasting after an individual finish. The JSON separates each car's terminal snapshot from its final field-completion snapshot. Pit damage deltas are net changes between service start and end: another car may collide with a car during service. The recorded repair message reports the crew outcome. A wreck during unfinished service is not counted as a completed repair.

## Full classifications

### Easy — 10 scheduled laps

[Detailed per-car data and event timeline](easy-10.json). Maximum completed laps: **10**. Termination: `all-cars-finished-or-wrecked`.

| Overall | Class rank | Car | Result | Laps | Finish / wreck time | Wreck cause | Pothole hits at termination | Completed pit services |
| ---: | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| 1 | stock 1 | #7 V8 Stock Car | FINISHED | 10 | 6:24.29 | — | 24 | 1 |
| 2 | stock 2 | #24 V8 Stock Car | FINISHED | 10 | 6:33.73 | — | 36 | 1 |
| 3 | stock 3 | #19 V8 Stock Car | FINISHED | 10 | 6:47.30 | — | 36 | 1 |
| 4 | stock 4 | #12 V8 Stock Car | FINISHED | 10 | 6:55.41 | — | 28 | 1 |
| 5 | stock 5 | #9 V8 Stock Car | FINISHED | 10 | 7:33.64 | — | 28 | 2 |
| 6 | stock 6 | #88 V8 Stock Car (player) | FINISHED | 10 | 7:46.29 | — | 30 | 2 |
| 7 | stock 7 | #3 V8 Stock Car | FINISHED | 10 | 7:54.50 | — | 24 | 2 |
| 8 | stock 8 | #48 V8 Stock Car | FINISHED | 10 | 8:13.95 | — | 32 | 2 |
| 9 | civilian 1 | #107 Volkswagen Golf | FINISHED | 10 | 8:14.45 | — | 12 | 1 |
| 10 | stock 9 | #22 V8 Stock Car | FINISHED | 10 | 8:22.82 | — | 28 | 2 |
| 11 | stock 10 | #43 V8 Stock Car | FINISHED | 10 | 8:26.47 | — | 36 | 2 |
| 12 | civilian 2 | #106 Mazda3 | FINISHED | 10 | 8:28.68 | — | 26 | 1 |
| 13 | civilian 3 | #104 Honda Accord | FINISHED | 10 | 8:29.95 | — | 28 | 1 |
| 14 | civilian 4 | #105 Honda Civic | FINISHED | 10 | 8:30.00 | — | 16 | 1 |
| 15 | civilian 5 | #101 Ford Mustang | FINISHED | 10 | 8:37.04 | — | 28 | 2 |
| 16 | civilian 6 | #110 Dodge Charger | FINISHED | 10 | 8:48.11 | — | 30 | 1 |
| 17 | civilian 7 | #103 Toyota Camry | FINISHED | 10 | 8:53.02 | — | 34 | 1 |
| 18 | civilian 8 | #108 Ford F-150 | FINISHED | 10 | 9:22.78 | — | 26 | 1 |
| 19 | civilian 9 | #102 Toyota Corolla | FINISHED | 10 | 9:27.95 | — | 8 | 2 |
| 20 | civilian 10 | #109 Toyota RAV4 | FINISHED | 10 | 9:46.01 | — | 20 | 2 |

### Medium — 15 scheduled laps

[Detailed per-car data and event timeline](medium-15.json). Maximum completed laps: **6**. Termination: `all-cars-finished-or-wrecked`.

| Overall | Class rank | Car | Result | Laps | Finish / wreck time | Wreck cause | Pothole hits at termination | Completed pit services |
| ---: | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| 1 | civilian 1 | #104 Honda Accord | DNF | 6 | 13:11.88 | Pothole damage | 184 | 6 |
| 2 | stock 1 | #88 V8 Stock Car (player) | DNF | 5 | 13:16.43 | Pothole damage | 213 | 5 |
| 3 | civilian 2 | #107 Volkswagen Golf | DNF | 5 | 13:11.87 | Collision with a wreck | 186 | 5 |
| 4 | stock 2 | #9 V8 Stock Car | DNF | 5 | 12:16.21 | Collision with a wreck | 163 | 5 |
| 5 | stock 3 | #3 V8 Stock Car | DNF | 5 | 12:37.23 | Collision with a wreck | 212 | 5 |
| 6 | civilian 3 | #110 Dodge Charger | DNF | 5 | 12:35.31 | Collision with a wreck | 177 | 5 |
| 7 | stock 4 | #7 V8 Stock Car | DNF | 5 | 12:01.68 | Pothole damage | 199 | 4 |
| 8 | civilian 4 | #109 Toyota RAV4 | DNF | 4 | 11:04.87 | Pothole damage | 159 | 4 |
| 9 | civilian 5 | #105 Honda Civic | DNF | 4 | 9:51.51 | Collision with a wreck | 115 | 4 |
| 10 | civilian 6 | #106 Mazda3 | DNF | 4 | 10:09.17 | Collision with a wreck | 140 | 4 |
| 11 | stock 5 | #19 V8 Stock Car | DNF | 4 | 10:37.33 | Collision with a wreck | 142 | 4 |
| 12 | stock 6 | #24 V8 Stock Car | DNF | 4 | 10:39.48 | Collision with a wreck | 166 | 4 |
| 13 | civilian 7 | #101 Ford Mustang | DNF | 3 | 8:14.48 | Pothole damage | 142 | 3 |
| 14 | civilian 8 | #102 Toyota Corolla | DNF | 3 | 8:09.75 | Pothole damage | 133 | 3 |
| 15 | civilian 9 | #108 Ford F-150 | DNF | 2 | 5:35.02 | Collision with a wreck | 87 | 2 |
| 16 | stock 7 | #43 V8 Stock Car | DNF | 2 | 5:23.47 | Pothole damage | 93 | 2 |
| 17 | stock 8 | #12 V8 Stock Car | DNF | 1 | 3:11.95 | Pothole damage | 62 | 0 |
| 18 | civilian 10 | #103 Toyota Camry | DNF | 1 | 4:13.21 | Pothole damage | 60 | 0 |
| 19 | stock 9 | #48 V8 Stock Car | DNF | 1 | 2:51.40 | Collision damage | 52 | 0 |
| 20 | stock 10 | #22 V8 Stock Car | DNF | 0 | 0:59.49 | Rear left wheel assembly destroyed | 24 | 0 |

### Extreme — 20 scheduled laps

[Detailed per-car data and event timeline](extreme-20.json). Maximum completed laps: **0**. Termination: `all-cars-finished-or-wrecked`.

| Overall | Class rank | Car | Result | Laps | Finish / wreck time | Wreck cause | Pothole hits at termination | Completed pit services |
| ---: | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| 1 | civilian 1 | #105 Honda Civic | DNF | 0 | 1:40.08 | Pothole damage | 53 | 0 |
| 2 | stock 1 | #22 V8 Stock Car | DNF | 0 | 2:09.60 | Pothole damage | 46 | 0 |
| 3 | civilian 2 | #101 Ford Mustang | DNF | 0 | 1:22.13 | Pothole damage | 48 | 0 |
| 4 | stock 2 | #48 V8 Stock Car | DNF | 0 | 1:25.71 | Pothole damage | 59 | 0 |
| 5 | stock 3 | #43 V8 Stock Car | DNF | 0 | 1:00.75 | Pothole damage | 47 | 0 |
| 6 | civilian 3 | #106 Mazda3 | DNF | 0 | 0:56.71 | Pothole damage | 44 | 0 |
| 7 | stock 4 | #7 V8 Stock Car | DNF | 0 | 0:49.52 | Pothole damage | 48 | 0 |
| 8 | stock 5 | #24 V8 Stock Car | DNF | 0 | 0:51.87 | Collision with a wreck | 38 | 0 |
| 9 | stock 6 | #12 V8 Stock Car | DNF | 0 | 0:54.85 | Pothole damage | 44 | 0 |
| 10 | civilian 4 | #104 Honda Accord | DNF | 0 | 0:50.31 | Pothole damage | 37 | 0 |
| 11 | civilian 5 | #107 Volkswagen Golf | DNF | 0 | 0:48.79 | Pothole damage | 45 | 0 |
| 12 | stock 7 | #88 V8 Stock Car (player) | DNF | 0 | 0:46.14 | Pothole damage | 43 | 0 |
| 13 | civilian 6 | #102 Toyota Corolla | DNF | 0 | 0:52.85 | Collision with a wreck | 32 | 0 |
| 14 | civilian 7 | #109 Toyota RAV4 | DNF | 0 | 0:50.69 | Collision with a wreck | 43 | 0 |
| 15 | stock 8 | #19 V8 Stock Car | DNF | 0 | 0:51.52 | Collision with a wreck | 38 | 0 |
| 16 | civilian 8 | #110 Dodge Charger | DNF | 0 | 0:57.67 | Collision with a wreck | 34 | 0 |
| 17 | civilian 9 | #108 Ford F-150 | DNF | 0 | 0:53.12 | Pothole damage | 44 | 0 |
| 18 | stock 9 | #9 V8 Stock Car | DNF | 0 | 0:48.58 | Pothole damage | 47 | 0 |
| 19 | stock 10 | #3 V8 Stock Car | DNF | 0 | 0:18.13 | Pothole damage | 20 | 0 |
| 20 | civilian 10 | #103 Toyota Camry | DNF | 0 | 0:09.32 | Rear left wheel assembly destroyed | 2 | 0 |

## Reproducibility and limits

Simulation source SHA-256: `1e063005838c42596a67b95c3a2e300a1cbec10c4eab6d2e9802e89fd199a5d6`. The harness checks finite state, sequential timing-line crossings, exactly 10+10 cars, all finishers reaching their scheduled lap count, and all 20 cars being terminal before declaring completion. Stalled drivers or a two-hour simulation watchdog produce an explicitly incomplete result.

Track catalog SHA-256: `5a8b98405c23fd6fbc9c3757d88649802cfcfd352944014a66c5913456a39ad8`. The expanded game circuit has an actual lap distance of 1731.824 meters (1.076 miles); its historical venue inspiration is not a claim that the expanded game track retains the real venue's dimensions.

A single deterministic seed demonstrates these exact races, not general difficulty balance or every possible random layout. The wheel and pit revision has separate results from the earlier actually watched baseline. Pothole hits now count individual wheel contacts, so their totals are not directly comparable with the earlier car-level counter. The three-second countdown is excluded from reported race times. Fast engine wall time does not demonstrate the user-visible normal-speed watch elapsed time.

[Machine-readable summary](summary.json).
