# Extreme opening comparison

Five predetermined seeds use untouched twenty-car grids, identical pothole positions/sizes/severity, and ordinary fixed-step AI driving. No vehicle positions, damage, clocks, laps, or random state are injected. Both classes contain ten drivers.

| Seed | Holes | Hits at 30 s, before → after | Hits at 60 s | Retirements at 60 s | Contacts at 60 s | Field progress at 60 s (m) |
| --- | ---: | --- | --- | --- | --- | --- |
| 20261112 | 151 | 559 → 219 | 766 → 351 | 15 → 0 | 86 → 4 | 15448.8 → 23027.9 |
| 1 | 130 | 454 → 150 | 723 → 284 | 10 → 0 | 69 → 1 | 17765.0 → 24750.1 |
| 7 | 88 | 282 → 67 | 547 → 165 | 8 → 0 | 77 → 5 | 21810.8 → 26557.1 |
| 19 | 91 | 349 → 113 | 571 → 179 | 4 → 0 | 122 → 1 | 22590.0 → 30664.8 |
| 42 | 128 | 494 → 102 | 671 → 267 | 11 → 0 | 100 → 5 | 16880.3 → 23685.4 |

Equal progress means a total of 10,000 meters of forward progress across the twenty cars, measured from their original grid positions. Every seed reaches that checkpoint within sixty seconds in both versions; simply stopping cars cannot improve this comparison.

| Seed | Time to equal progress, before → after (s) | Wheel impacts | Sum of body damage | Retired | Contacts | Grass driving (car-seconds) | Wall episodes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 20261112 | 25.55 → 28.75 | 494 → 215 | 13.675 → 3.674 | 2 → 0 | 42 → 3 | 0.00 → 0.00 | 0 → 0 |
| 1 | 22.65 → 26.15 | 373 → 124 | 10.810 → 2.069 | 1 → 0 | 33 → 0 | 0.00 → 0.00 | 0 → 0 |
| 7 | 16.78 → 23.23 | 136 → 54 | 6.159 → 1.027 | 1 → 0 | 22 → 5 | 0.00 → 0.00 | 0 → 0 |
| 19 | 18.67 → 23.45 | 218 → 93 | 6.965 → 1.694 | 0 → 0 | 33 → 1 | 0.00 → 0.00 | 0 → 0 |
| 42 | 19.62 → 25.18 | 319 → 80 | 9.929 → 1.434 | 0 → 0 | 41 → 3 | 0.00 → 0.00 | 0 → 0 |

Across the equal-distance checkpoints, wheel impacts decreased by **63.2%**. The full JSON retains separate stock/civilian totals, all twenty cars' damage/components/positions at each checkpoint, and individual 250/500-meter exposures. These are first-minute AI measurements, not full-race completion or a universal safety guarantee.

[Baseline data](extreme-opening-baseline.json), [updated data](extreme-opening-after.json), [comparison data](opening-comparison.json).

Baseline simulation SHA-256: `1e063005838c42596a67b95c3a2e300a1cbec10c4eab6d2e9802e89fd199a5d6`. Updated simulation SHA-256: `b4c16c979d10bf534067f92052a6d0d21a2c50093a1c17d84d9cddcd63947ac8`.
