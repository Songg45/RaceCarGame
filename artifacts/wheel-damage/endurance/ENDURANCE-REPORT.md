# Autonomous race endurance report — wheel and pit revision

Run each scenario serially: `node tests/endurance.mjs --scenario=easy-10`, then `--scenario=medium-15`, then `--scenario=extreme-20`.

**This report covers fast, independent engine runs. The normal-speed visible browser watch series is a separate run and must be observed separately.**

All scenarios used the unmodified 20-car starting grid, Thunder Bowl (Bristol inspired), stock player #88, seed **20261112**, and fixed 1/60-second updates. Medium means slider **50**, the midpoint. All movement, damage, laps, pit visits, and retirement events came from ordinary engine updates and AI controls; no positions, laps, damage, clocks, or random state were injected.

| Scenario | Scheduled laps | Potholes | Finished | DNF | Still racing | Field terminal time | Player outcome |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Easy (0) | 10 | 6 | 20 | 0 | 0 | 5:13.17 | P2 stock / P2 overall at 4:08.96 |
| Medium (50) | 15 | 34 | 5 | 15 | 0 | 14:33.15 | P3 stock / P4 overall at 13:56.22 |
| Extreme (100) | 20 | 75 | 0 | 20 | 0 | 5:57.77 | DNF after 1 completed laps at 1:56.56 |

Finished drivers reached the scheduled distance. DNF drivers retired before completing it. Complete field attrition is a terminal race simulation, not a completed scheduled distance. A watchdog result is explicitly incomplete; no running driver is silently removed.

| Scenario | Contacts | Cross-class contacts | Pothole impacts | Service starts | Completed services | Destroyed during service |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Easy | 62 | 35 | 637 | 23 | 23 | 0 |
| Medium | 228 | 135 | 2814 | 113 | 113 | 0 |
| Extreme | 51 | 24 | 897 | 1 | 0 | 1 |

Contact and pothole totals run until the whole field terminates, including coasting after an individual finish. The JSON separates each car's terminal snapshot from its final field-completion snapshot. Pit damage deltas are net changes between service start and end: another car may collide with a car during service. The recorded repair message reports the crew outcome. A wreck during unfinished service is not counted as a completed repair.

## Full classifications

### Easy — 10 scheduled laps

[Detailed per-car data and event timeline](easy-10.json). Maximum completed laps: **10**. Termination: `all-cars-finished-or-wrecked`.

| Overall | Class rank | Car | Result | Laps | Finish / wreck time | Wreck cause | Pothole hits at termination | Completed pit services |
| ---: | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| 1 | stock 1 | #7 V8 Stock Car | FINISHED | 10 | 4:01.50 | — | 16 | 1 |
| 2 | stock 2 | #88 V8 Stock Car (player) | FINISHED | 10 | 4:08.96 | — | 16 | 1 |
| 3 | stock 3 | #22 V8 Stock Car | FINISHED | 10 | 4:16.54 | — | 36 | 1 |
| 4 | civilian 1 | #105 Honda Civic | FINISHED | 10 | 4:17.11 | — | 30 | 0 |
| 5 | stock 4 | #24 V8 Stock Car | FINISHED | 10 | 4:18.22 | — | 44 | 1 |
| 6 | stock 5 | #9 V8 Stock Car | FINISHED | 10 | 4:19.70 | — | 38 | 1 |
| 7 | civilian 2 | #101 Ford Mustang | FINISHED | 10 | 4:32.99 | — | 12 | 1 |
| 8 | stock 6 | #12 V8 Stock Car | FINISHED | 10 | 4:34.85 | — | 20 | 2 |
| 9 | civilian 3 | #108 Ford F-150 | FINISHED | 10 | 4:36.51 | — | 18 | 0 |
| 10 | civilian 4 | #104 Honda Accord | FINISHED | 10 | 4:40.77 | — | 26 | 1 |
| 11 | civilian 5 | #110 Dodge Charger | FINISHED | 10 | 4:42.74 | — | 24 | 1 |
| 12 | civilian 6 | #106 Mazda3 | FINISHED | 10 | 4:45.33 | — | 18 | 1 |
| 13 | stock 7 | #3 V8 Stock Car | FINISHED | 10 | 4:46.35 | — | 32 | 2 |
| 14 | civilian 7 | #103 Toyota Camry | FINISHED | 10 | 4:46.81 | — | 32 | 1 |
| 15 | civilian 8 | #102 Toyota Corolla | FINISHED | 10 | 4:46.91 | — | 26 | 1 |
| 16 | stock 8 | #48 V8 Stock Car | FINISHED | 10 | 4:55.39 | — | 30 | 2 |
| 17 | civilian 9 | #109 Toyota RAV4 | FINISHED | 10 | 4:57.85 | — | 46 | 0 |
| 18 | stock 9 | #19 V8 Stock Car | FINISHED | 10 | 5:01.05 | — | 36 | 2 |
| 19 | stock 10 | #43 V8 Stock Car | FINISHED | 10 | 5:03.13 | — | 33 | 2 |
| 20 | civilian 10 | #107 Volkswagen Golf | FINISHED | 10 | 5:13.15 | — | 32 | 2 |

### Medium — 15 scheduled laps

[Detailed per-car data and event timeline](medium-15.json). Maximum completed laps: **15**. Termination: `all-cars-finished-or-wrecked`.

| Overall | Class rank | Car | Result | Laps | Finish / wreck time | Wreck cause | Pothole hits at termination | Completed pit services |
| ---: | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| 1 | stock 1 | #3 V8 Stock Car | FINISHED | 15 | 12:51.19 | Pothole damage | 192 | 12 |
| 2 | civilian 1 | #104 Honda Accord | FINISHED | 15 | 13:28.13 | Pothole damage | 240 | 12 |
| 3 | stock 2 | #22 V8 Stock Car | FINISHED | 15 | 13:44.96 | — | 202 | 12 |
| 4 | stock 3 | #88 V8 Stock Car (player) | FINISHED | 15 | 13:56.22 | — | 221 | 13 |
| 5 | civilian 2 | #107 Volkswagen Golf | FINISHED | 15 | 14:33.15 | — | 212 | 9 |
| 6 | stock 4 | #12 V8 Stock Car | DNF | 13 | 11:23.73 | Pothole damage | 169 | 10 |
| 7 | stock 5 | #48 V8 Stock Car | DNF | 11 | 9:29.30 | Pothole damage | 169 | 8 |
| 8 | stock 6 | #24 V8 Stock Car | DNF | 11 | 10:41.22 | Collision with a wreck | 168 | 8 |
| 9 | stock 7 | #19 V8 Stock Car | DNF | 11 | 11:30.63 | Collision with a wreck | 174 | 8 |
| 10 | civilian 3 | #105 Honda Civic | DNF | 8 | 8:05.13 | Collision with a wreck | 142 | 5 |
| 11 | civilian 4 | #110 Dodge Charger | DNF | 8 | 9:07.48 | Pothole damage | 124 | 4 |
| 12 | stock 8 | #7 V8 Stock Car | DNF | 7 | 11:38.17 | Pothole damage | 51 | 0 |
| 13 | civilian 5 | #101 Ford Mustang | DNF | 7 | 8:01.77 | Wall impact | 106 | 4 |
| 14 | civilian 6 | #108 Ford F-150 | DNF | 6 | 6:43.88 | Collision with a wreck | 106 | 2 |
| 15 | civilian 7 | #106 Mazda3 | DNF | 6 | 7:37.25 | Pothole damage | 111 | 2 |
| 16 | stock 9 | #43 V8 Stock Car | DNF | 5 | 6:06.77 | Pothole damage | 74 | 0 |
| 17 | civilian 8 | #102 Toyota Corolla | DNF | 5 | 7:34.66 | Collision with a wreck | 83 | 2 |
| 18 | stock 10 | #9 V8 Stock Car | DNF | 4 | 5:11.93 | Pothole damage | 80 | 1 |
| 19 | civilian 9 | #103 Toyota Camry | DNF | 4 | 5:03.73 | Pothole damage | 89 | 1 |
| 20 | civilian 10 | #109 Toyota RAV4 | DNF | 3 | 3:08.12 | Pothole damage | 68 | 0 |

### Extreme — 20 scheduled laps

[Detailed per-car data and event timeline](extreme-20.json). Maximum completed laps: **2**. Termination: `all-cars-finished-or-wrecked`.

| Overall | Class rank | Car | Result | Laps | Finish / wreck time | Wreck cause | Pothole hits at termination | Completed pit services |
| ---: | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| 1 | stock 1 | #12 V8 Stock Car | DNF | 2 | 5:57.76 | Pothole damage | 39 | 0 |
| 2 | civilian 1 | #105 Honda Civic | DNF | 2 | 4:00.23 | Collision with a wreck | 53 | 0 |
| 3 | civilian 2 | #104 Honda Accord | DNF | 1 | 4:13.79 | Pit crew repair failure | 46 | 0 |
| 4 | civilian 3 | #103 Toyota Camry | DNF | 1 | 1:50.99 | Pothole damage | 52 | 0 |
| 5 | civilian 4 | #108 Ford F-150 | DNF | 1 | 1:54.01 | Pothole damage | 50 | 0 |
| 6 | civilian 5 | #107 Volkswagen Golf | DNF | 1 | 2:20.78 | Pothole damage | 41 | 0 |
| 7 | stock 2 | #88 V8 Stock Car (player) | DNF | 1 | 1:56.56 | Pothole damage | 47 | 0 |
| 8 | civilian 6 | #110 Dodge Charger | DNF | 0 | 1:06.41 | Pothole damage | 49 | 0 |
| 9 | stock 3 | #24 V8 Stock Car | DNF | 0 | 0:39.91 | Pothole damage | 42 | 0 |
| 10 | stock 4 | #22 V8 Stock Car | DNF | 0 | 1:06.47 | Pothole damage | 59 | 0 |
| 11 | civilian 7 | #102 Toyota Corolla | DNF | 0 | 0:41.80 | Pothole damage | 48 | 0 |
| 12 | civilian 8 | #109 Toyota RAV4 | DNF | 0 | 0:43.73 | Pothole damage | 44 | 0 |
| 13 | civilian 9 | #101 Ford Mustang | DNF | 0 | 0:34.73 | Pothole damage | 50 | 0 |
| 14 | civilian 10 | #106 Mazda3 | DNF | 0 | 0:47.68 | Collision with a wreck | 39 | 0 |
| 15 | stock 5 | #48 V8 Stock Car | DNF | 0 | 0:36.55 | Pothole damage | 43 | 0 |
| 16 | stock 6 | #19 V8 Stock Car | DNF | 0 | 0:38.83 | Collision damage | 47 | 0 |
| 17 | stock 7 | #3 V8 Stock Car | DNF | 0 | 0:37.82 | Collision with a wreck | 46 | 0 |
| 18 | stock 8 | #9 V8 Stock Car | DNF | 0 | 0:53.21 | Collision with a wreck | 49 | 0 |
| 19 | stock 9 | #43 V8 Stock Car | DNF | 0 | 0:28.41 | Collision damage | 31 | 0 |
| 20 | stock 10 | #7 V8 Stock Car | DNF | 0 | 0:12.03 | Rear left wheel assembly destroyed | 22 | 0 |

## Reproducibility and limits

Simulation source SHA-256: `03c712b6e2aec3268cf58d4706d4c3af68fab2dceb2712ef07989079520f4076`. The harness checks finite state, sequential timing-line crossings, exactly 10+10 cars, all finishers reaching their scheduled lap count, and all 20 cars being terminal before declaring completion. Stalled drivers or a two-hour simulation watchdog produce an explicitly incomplete result.

A single deterministic seed demonstrates these exact races, not general difficulty balance or every possible random layout. The wheel and pit revision has separate results from the earlier actually watched baseline. Pothole hits now count individual wheel contacts, so their totals are not directly comparable with the earlier car-level counter. The three-second countdown is excluded from reported race times. Fast engine wall time does not demonstrate the user-visible normal-speed watch elapsed time.

[Machine-readable summary](summary.json).
