# Autonomous race endurance report

Run command: `node tests/endurance.mjs`.

**This report covers fast, independent engine runs. The normal-speed visible browser watch series is a separate run and must be observed separately.**

The subsequent actual browser series was observed to completion and exported. [The visible-watch record](VISIBLE-WATCH-RECORD.md) confirms that all 60 exported car records matched these independent results, with 7 minutes 30.88 seconds of actual wall-clock runtime. This directory now preserves the baseline revision before the wheel-component and 20-bay pit upgrade.

All scenarios used the unmodified 20-car starting grid, Thunder Bowl (Bristol inspired), stock player #88, seed **20261112**, and fixed 1/60-second updates. Medium means slider **50**, the midpoint. All movement, damage, laps, pit visits, and retirement events came from ordinary engine updates and AI controls; no positions, laps, damage, clocks, or random state were injected.

| Scenario | Scheduled laps | Potholes | Finished | DNF | Still racing | Field terminal time | Player outcome |
| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Easy (0) | 10 | 6 | 20 | 0 | 0 | 4:51.33 | P7 stock / P7 overall at 3:53.35 |
| Medium (50) | 15 | 34 | 0 | 20 | 0 | 1:36.90 | DNF after 1 completed laps at 1:06.26 |
| Extreme (100) | 20 | 75 | 0 | 20 | 0 | 0:33.32 | DNF after 0 completed laps at 0:12.45 |

Easy completed the full ten-lap distance with all 20 cars. Medium and Extreme ended when every car was wrecked; those are completed race simulations, **not fifteen- or twenty-lap finishes**. No active driver was silently removed, no watchdog fired, and no race was called complete with a running car remaining.

| Scenario | Contacts | Cross-class contacts | Pothole impacts | Service starts | Completed services | Destroyed during service |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Easy | 53 | 25 | 242 | 6 | 6 | 0 |
| Medium | 213 | 64 | 332 | 14 | 13 | 1 |
| Extreme | 45 | 25 | 208 | 0 | 0 | 0 |

Contact and pothole totals run until the whole field terminates, including coasting after an individual finish. The JSON separates each car's terminal snapshot from its final field-completion snapshot. Pit damage deltas are net changes between service start and end: another car may collide with a car during service. The recorded repair message reports the crew outcome. A wreck during unfinished service is not counted as a completed repair.

## Full classifications

### Easy — 10 scheduled laps

[Detailed per-car data and event timeline](easy-10.json). Maximum completed laps: **10**. Termination: `all-cars-finished-or-wrecked`.

| Overall | Class rank | Car | Result | Laps | Finish / wreck time | Wreck cause | Pothole hits at termination | Completed pit services |
| ---: | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| 1 | stock 1 | #24 V8 Stock Car | FINISHED | 10 | 3:32.97 | — | 5 | 0 |
| 2 | stock 2 | #7 V8 Stock Car | FINISHED | 10 | 3:34.45 | — | 10 | 0 |
| 3 | stock 3 | #12 V8 Stock Car | FINISHED | 10 | 3:35.06 | — | 9 | 0 |
| 4 | stock 4 | #22 V8 Stock Car | FINISHED | 10 | 3:35.21 | — | 4 | 0 |
| 5 | stock 5 | #43 V8 Stock Car | FINISHED | 10 | 3:36.81 | — | 5 | 0 |
| 6 | stock 6 | #48 V8 Stock Car | FINISHED | 10 | 3:38.22 | — | 9 | 0 |
| 7 | stock 7 | #88 V8 Stock Car (player) | FINISHED | 10 | 3:53.35 | — | 12 | 1 |
| 8 | stock 8 | #19 V8 Stock Car | FINISHED | 10 | 3:55.00 | — | 14 | 1 |
| 9 | civilian 1 | #107 Volkswagen Golf | FINISHED | 10 | 3:55.02 | — | 2 | 0 |
| 10 | stock 9 | #9 V8 Stock Car | FINISHED | 10 | 3:55.33 | — | 11 | 1 |
| 11 | stock 10 | #3 V8 Stock Car | FINISHED | 10 | 3:56.20 | — | 16 | 1 |
| 12 | civilian 2 | #101 Ford Mustang | FINISHED | 10 | 3:56.80 | — | 1 | 0 |
| 13 | civilian 3 | #110 Dodge Charger | FINISHED | 10 | 4:02.45 | — | 4 | 0 |
| 14 | civilian 4 | #106 Mazda3 | FINISHED | 10 | 4:06.74 | — | 7 | 0 |
| 15 | civilian 5 | #104 Honda Accord | FINISHED | 10 | 4:10.20 | — | 8 | 0 |
| 16 | civilian 6 | #105 Honda Civic | FINISHED | 10 | 4:11.39 | — | 12 | 0 |
| 17 | civilian 7 | #103 Toyota Camry | FINISHED | 10 | 4:12.76 | — | 9 | 0 |
| 18 | civilian 8 | #109 Toyota RAV4 | FINISHED | 10 | 4:24.99 | — | 8 | 0 |
| 19 | civilian 9 | #102 Toyota Corolla | FINISHED | 10 | 4:38.80 | — | 19 | 1 |
| 20 | civilian 10 | #108 Ford F-150 | FINISHED | 10 | 4:51.32 | — | 21 | 1 |

### Medium — 15 scheduled laps

[Detailed per-car data and event timeline](medium-15.json). Maximum completed laps: **2**. Termination: `all-cars-finished-or-wrecked`.

| Overall | Class rank | Car | Result | Laps | Finish / wreck time | Wreck cause | Pothole hits at termination | Completed pit services |
| ---: | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| 1 | civilian 1 | #101 Ford Mustang | DNF | 2 | 1:24.46 | Collision with a wreck | 9 | 0 |
| 2 | civilian 2 | #103 Toyota Camry | DNF | 2 | 1:26.46 | Collision with a wreck | 15 | 0 |
| 3 | civilian 3 | #108 Ford F-150 | DNF | 2 | 1:36.89 | Collision with a wreck | 9 | 0 |
| 4 | stock 1 | #12 V8 Stock Car | DNF | 2 | 1:14.33 | Pothole damage | 23 | 1 |
| 5 | stock 2 | #43 V8 Stock Car | DNF | 1 | 0:57.33 | Collision damage | 14 | 0 |
| 6 | civilian 4 | #104 Honda Accord | DNF | 1 | 0:58.80 | Collision damage | 17 | 0 |
| 7 | civilian 5 | #106 Mazda3 | DNF | 1 | 1:00.67 | Collision with a wreck | 13 | 0 |
| 8 | civilian 6 | #102 Toyota Corolla | DNF | 1 | 1:01.27 | Collision with a wreck | 15 | 0 |
| 9 | stock 3 | #7 V8 Stock Car | DNF | 1 | 1:04.81 | Collision with a wreck | 17 | 1 |
| 10 | stock 4 | #88 V8 Stock Car (player) | DNF | 1 | 1:06.26 | Collision with a wreck | 19 | 1 |
| 11 | civilian 7 | #109 Toyota RAV4 | DNF | 1 | 1:21.97 | Collision with a wreck | 19 | 1 |
| 12 | stock 5 | #24 V8 Stock Car | DNF | 1 | 1:06.26 | Collision with a wreck | 18 | 1 |
| 13 | civilian 8 | #105 Honda Civic | DNF | 1 | 1:24.38 | Collision with a wreck | 16 | 1 |
| 14 | stock 6 | #3 V8 Stock Car | DNF | 1 | 1:19.70 | Collision with a wreck | 17 | 1 |
| 15 | civilian 9 | #107 Volkswagen Golf | DNF | 1 | 1:26.46 | Collision with a wreck | 19 | 1 |
| 16 | stock 7 | #48 V8 Stock Car | DNF | 1 | 0:55.37 | Pothole damage | 23 | 1 |
| 17 | stock 8 | #22 V8 Stock Car | DNF | 1 | 0:58.48 | Collision with a wreck | 17 | 1 |
| 18 | stock 9 | #9 V8 Stock Car | DNF | 1 | 1:00.02 | Collision with a wreck | 18 | 1 |
| 19 | stock 10 | #19 V8 Stock Car | DNF | 1 | 1:02.38 | Collision with a wreck | 19 | 1 |
| 20 | civilian 10 | #110 Dodge Charger | DNF | 1 | 1:13.13 | Collision with a wreck | 15 | 1 |

### Extreme — 20 scheduled laps

[Detailed per-car data and event timeline](extreme-20.json). Maximum completed laps: **0**. Termination: `all-cars-finished-or-wrecked`.

| Overall | Class rank | Car | Result | Laps | Finish / wreck time | Wreck cause | Pothole hits at termination | Completed pit services |
| ---: | --- | --- | --- | ---: | --- | --- | ---: | ---: |
| 1 | civilian 1 | #102 Toyota Corolla | DNF | 0 | 0:31.73 | Pothole damage | 9 | 0 |
| 2 | stock 1 | #24 V8 Stock Car | DNF | 0 | 0:20.55 | Pothole damage | 11 | 0 |
| 3 | civilian 2 | #109 Toyota RAV4 | DNF | 0 | 0:27.68 | Pothole damage | 13 | 0 |
| 4 | stock 2 | #19 V8 Stock Car | DNF | 0 | 0:15.38 | Pothole damage | 12 | 0 |
| 5 | stock 3 | #22 V8 Stock Car | DNF | 0 | 0:15.71 | Collision with a wreck | 11 | 0 |
| 6 | civilian 3 | #101 Ford Mustang | DNF | 0 | 0:18.19 | Pothole damage | 10 | 0 |
| 7 | civilian 4 | #107 Volkswagen Golf | DNF | 0 | 0:17.73 | Pothole damage | 12 | 0 |
| 8 | stock 4 | #9 V8 Stock Car | DNF | 0 | 0:22.16 | Collision with a wreck | 9 | 0 |
| 9 | civilian 5 | #104 Honda Accord | DNF | 0 | 0:24.37 | Collision with a wreck | 10 | 0 |
| 10 | civilian 6 | #106 Mazda3 | DNF | 0 | 0:24.82 | Pothole damage | 13 | 0 |
| 11 | stock 5 | #12 V8 Stock Car | DNF | 0 | 0:11.91 | Pothole damage | 12 | 0 |
| 12 | civilian 7 | #103 Toyota Camry | DNF | 0 | 0:16.12 | Collision damage | 9 | 0 |
| 13 | stock 6 | #48 V8 Stock Car | DNF | 0 | 0:13.03 | Collision with a wreck | 10 | 0 |
| 14 | civilian 8 | #108 Ford F-150 | DNF | 0 | 0:26.13 | Pothole damage | 10 | 0 |
| 15 | stock 7 | #7 V8 Stock Car | DNF | 0 | 0:11.15 | Pothole damage | 11 | 0 |
| 16 | civilian 9 | #110 Dodge Charger | DNF | 0 | 0:33.31 | Collision with a wreck | 10 | 0 |
| 17 | stock 8 | #3 V8 Stock Car | DNF | 0 | 0:13.11 | Collision with a wreck | 11 | 0 |
| 18 | stock 9 | #88 V8 Stock Car (player) | DNF | 0 | 0:12.45 | Collision with a wreck | 8 | 0 |
| 19 | civilian 10 | #105 Honda Civic | DNF | 0 | 0:15.06 | Collision with a wreck | 10 | 0 |
| 20 | stock 10 | #43 V8 Stock Car | DNF | 0 | 0:15.13 | Collision with a wreck | 7 | 0 |

## Reproducibility and limits

Simulation source SHA-256: `935ff7718b05416421b540cd51ce7724a884cba8110614d161603773552a860f`. The harness checks finite state, sequential timing-line crossings, exactly 10+10 cars, all finishers reaching their scheduled lap count, and all 20 cars being terminal before declaring completion. Stalled drivers or a two-hour simulation watchdog produce an explicitly incomplete result.

A single deterministic seed demonstrates these exact races, not general difficulty balance or every possible random layout. Medium and Extreme caused complete field attrition in this seed; no difficulty tuning was changed to manufacture finishers. The three-second countdown is excluded from reported race times. Fast engine wall time does not demonstrate the user-visible normal-speed watch elapsed time.

[Machine-readable summary](summary.json).
