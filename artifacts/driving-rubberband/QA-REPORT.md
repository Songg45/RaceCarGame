# Forward/backward visual jumping — verification

November 13, 2026. **The clear-road camera defect was reproduced and the renderer-only correction passed the targeted browser checks with zero JavaScript/console errors.** Engine, catalog, and watch-controller physics were unchanged. The earlier 129-test engine/controller acceptance was not unnecessarily rerun.

## Diagnosis and measured improvement

An isolated Microsoft Edge browser, 1366 × 768 at device-pixel ratio 1, performed actual 12-second held-W drives on a clear Daytona straight and ordinary Easy/Extreme grids. The clear-road case used a declared initial pose with hazards removed and opponents isolated; neither traffic case changed the grid or hazards. After setup, ordinary input and simulation updates drove every case.

Instrumentation sampled **after rendering**, recording physical distance/world position, rendered mesh position, camera/look position, projected car position, raw frame intervals, simulated elapsed time, speed, nearby field poses, and actual collision corrections. The first two simulated seconds were excluded from primary comparisons; the matched steady window starts after eight seconds.

All three original drives had **zero backward player-distance steps and zero player collision corrections**. Nevertheless, the follow camera moved forward and backward relative to the car. In the clear-road steady window, its longitudinal gap decreased on 179 frames and increased on 40; individual gap changes ranged from **−0.137703 m to +0.528025 m**. The car visibly moved on screen while continuing forward physically.

| Check | Original renderer | Corrected renderer |
| --- | ---: | ---: |
| Matched clear-road replay, largest vertical screen step after 8 s | 4.1485465 px | Less than 0.000001 px |
| Matched replay, camera-to-car gap range after 8 s | Oscillating gap | 0 m |
| Fresh held-W clear-road drive, largest vertical screen step after initial transient | 4.1485465 px | Less than 0.000001 px |
| Fresh ordinary Extreme-grid drive, largest vertical screen step | 3.7915682 px | Less than 0.000001 px |

The matched replay feeds **the identical recorded baseline car poses and frame intervals** through the candidate renderer. Its measured maximum screen step was approximately `8.95e-13` pixels, numerical noise. Fresh clear-road and Extreme-grid drives measured approximately `1.79e-12` and `1.96e-12` pixels. The fresh traffic runs are supplementary; their random traffic evolution is not treated as a matched physics comparison.

The renderer now carries the following camera and look target by the car's world displacement before damping the relative camera offset. It no longer damps forward world translation behind a moving car. Chase, hood, and overhead modes follow this rule; the fixed pit overview remains fixed. The rendered vehicle continues to use its exact physical position.

## Targeted regression results

- Actual held-W driving passed on the clear straight and ordinary Extreme grid, with no backward player-distance frames.
- Exact baseline pose/frame replay retained the stable camera gap and exact vehicle mesh position.
- Chase, hood, and overhead cameras moved exactly with a controlled five-meter car translation. The pit overview did not move. Repeated paused renders kept each camera still.
- The straight-to-turn transition remained finite and kept the vehicle mesh at its physical world position.
- A real recovery call preserved longitudinal distance, changed the allowed lateral pose, and retained a valid following camera.
- Ordinary collision processing still corrected physical distance by **−0.879516 m** in a controlled overlap fixture. The mesh matched that corrected position exactly; the camera change does not remove, reverse, or interpolate away collision physics.
- Spectator focus changes and fresh-race initialization reset the camera correctly.
- Both isolated diagnostic browser instances closed. A host process query after the final run found **zero owned harness/Playwright Edge processes**. User tabs were not touched.

The first restricted-sandbox launch exited before loading the game because Edge could not initialize its named-pipe/proxy context. The successful runs used the approved host execution path without changing security settings. That launch failure is not app evidence.

## Performance and limits

Original simulation-update CPU p95 was 0.20 ms on the clear road, 0.40 ms on the Easy grid, and 0.60 ms on the Extreme grid. Render-submission CPU p95 was about 3.8–4.4 ms. These values include light trace instrumentation, measure CPU submission rather than GPU completion, and are not a claim of a universal frame-rate improvement. Raw frame intervals had a median around 18.2 ms. The demonstrated fix concerns camera-relative vehicle jumping.

No full endurance races were rerun because the change is limited to ten renderer lines. Physical collisions can still move a vehicle backward when resolving overlap. The controlled collision fixture is separate from the clear-road camera reproduction. The short browser drives do not prove every possible hardware, traffic, and frame-cadence case.

## Reproduction and release evidence

The harness is `tests/browser-driving-continuity.mjs`. Default execution records a baseline against port 4173. For the candidate assertions, set `RACE_URL=http://127.0.0.1:4174/` and `CONTINUITY_PHASE=candidate`, then run `node tests/browser-driving-continuity.mjs`. Run one browser process at a time. The browser has a 75-second deadline and closes in `finally`.

Committed compact evidence:

- [Precise before/after comparison](comparison.json).
- [Baseline browser summary](baseline-browser.json).
- [Precise baseline steady-window measurements](baseline-steady-window.json).
- [Exact recorded pose/frame replay fixture](clear-straight-replay-fixture.json), projected without changing any input values from the full baseline trace.
- [Candidate browser evidence and assertions](candidate-browser.json).

Full frame traces, screenshots, process metadata, and launch logs remain local in this artifact directory. The original baseline is preserved rather than overwritten by the candidate run.

Validated candidate source fingerprint: `33b7a01838efacb57443316442cd8643ff369f37c6c3c03eddeea74a955038ea`.

Validated build fingerprint: `25c03d402ca9156876cd38fa7f3d1648fd0fd7faca0a578122b95d769f8e873c`.

Promotion is recorded separately by the release owner; the browser tests used those immutable candidate bytes.
