# Observed visible watch series — preserved baseline

This records the **actual normal-speed browser series** that the supervisor opened and observed for the user, before the later wheel-component and 20-bay pit-lane upgrade. It is distinct from the fast engine harness.

The actual browser export was copied from `C:\Users\b-tuc\Downloads\split-grid-watch-results.json` into [visible-watch-baseline.json](visible-watch-baseline.json). The original download was left in place. The export records a start at **November 12, 2026, 2:30:30.519 p.m. Eastern** and completion at **2:38:01.399 p.m. Eastern**, a wall-clock duration of **7 minutes 30.88 seconds**. These correspond to `19:30:30.519Z` and `19:38:01.399Z` in the raw export.

The supervisor observed the final series UI and relayed these results:

| Run | Target | Actual final classification | Race elapsed time | Target distance reached? |
| --- | ---: | --- | --- | --- |
| Easy, difficulty 0 | 10 laps | 20 finished, 0 DNF | 4:51.33 | Yes, all 20 cars |
| Medium, difficulty 50 | 15 laps | 0 finished, 20 DNF | 1:36.90 | No; maximum 2 completed laps |
| Extreme, difficulty 100 | 20 laps | 0 finished, 20 DNF | 0:33.32 | No; maximum 0 completed laps |

Easy's stock winner was **#24**, finishing in **3:32.97**. The street winner was the **Volkswagen Golf**, finishing in **3:55.02**. Each race had ten stock cars and ten civilian cars. Every race remained active until all 20 cars were finished or wrecked. Medium and Extreme concluded through complete attrition, not by completing their scheduled lap targets.

`node tests/compare-visible-watch.mjs` compared the actual exported browser results against the independently preserved engine runs. **All 60 car records matched**, including class and overall ordering, completed laps, finish/DNF status, finish and wreck times, wreck causes, final damage, and pothole counts. Race elapsed times, pothole-layout counts, contact totals, and cross-class contacts also matched. Numeric comparison tolerance was 0.0001 seconds or damage units, accounting for rounding in the engine report.

The [machine-readable comparison](visible-watch-comparison.json) records this verification. The [independent endurance report](ENDURANCE-REPORT.md) contains the per-car classifications and pit-service history for the same baseline physics revision. Later wheel/pit changes must write new evidence to a separate directory; these files are historical evidence of the series the user actually watched.
