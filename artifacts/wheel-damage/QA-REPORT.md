# Wheel, pit-capacity, and stable-play verification

Verified locally on November 12, 2026. The current revision passed **56 serial engine/controller tests**, **9 isolated browser scenarios**, and a stable production build. No browser JavaScript or console errors were recorded. No publishing or commits were performed.

## Repeatable engine verification

Command: `node --test --test-concurrency=1`.

Result: **56 passed, 0 failed, 0 skipped**, in **20.817 seconds**. The process ran at Windows BelowNormal priority with a 45-second external bound. See [actual test output](unit-tests.stdout.txt).

The suite covers both selectable classes, exactly 10+10 cars, all track lap limits, mixed-class collision response, ordered lap counting, complete three-lap driving runs, pause/restart, permanent wrecks, and all terminal classifications. New checks exercise:

- Larger/faster pothole impacts increasing all five failure risks; stationary zero-risk guard and one roll per wheel contact entry.
- Actual pressure loss over time, pause freezing pressure, and low-pressure collapse into a blowout without another random roll.
- Distinct abrupt blowout pull/limp behavior, bent-wheel physical vibration and steering loss, severe but drivable broken suspension, and permanent assembly destruction.
- Measured healthy/damaged/Easy-repaired steering response, braking distance, and corner grip for stock and civilian cars.
- All five failure types appearing in seeded actual impacts, reproducible outcomes, complete Easy component restoration, and coherent partial/failed harder repairs.
- Blown-tire AI physically driving to its assigned bay, servicing, and leaving with restored components on Easy.
- Twenty distinct, physically spaced bays on all three circuits; another driver's bay rejecting service; a separate through lane.
- All 20 cars approaching, using their own bays, servicing, and physically exiting on every circuit. Nineteen cars also complete that route with a permanent wreck occupying one bay.
- Reconstructed real pit-exit and pre-entry queues physically passing permanent wrecks, with continuous movement and no forced retirements or obstacle removal.

The crowded-pit and precise component tests use controlled initial positions/condition and isolate random hazards where needed. After setup, route tests use ordinary per-frame AI, steering, braking, collisions, and physics. They do not teleport cars out of queues. This is distinct from the untouched-grid endurance runs below.

## Full-race engine endurance

Commands were run in **separate sequential processes**, each BelowNormal, with an internal 40-wall-second watchdog and an external 45-second bound:

```sh
node tests/endurance.mjs --scenario=easy-10
node tests/endurance.mjs --scenario=medium-15
node tests/endurance.mjs --scenario=extreme-20
```

All use Bristol-inspired Thunder Bowl, stock player #88, seed `20261112`, normal starting grid, and fixed 1/60-second updates with ordinary AI driving controls. No position, lap, damage, clock, or random-state injection occurs.

| Difficulty | Scheduled laps | FIN | DNF | Still running | Final simulated race time | Harness wall time | Completed pit services |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| Easy 0 | 10 | 20 | 0 | 0 | 5:13.17 | 2.4653 s | 23 |
| Medium 50 | 15 | 5 | 15 | 0 | 14:33.15 | 5.3091 s | 113 |
| Extreme 100 | 20 | 0 | 20 | 0 | 5:57.77 | 1.6601 s | 0 |

Every field reached an actual terminal result without a watchdog. Easy and Medium finishers completed their scheduled distances. Extreme ended through total attrition; its longest run completed two laps, **not the twenty-lap target**. One Extreme service was interrupted by retirement.

Player #88 finished Easy second overall/stock at 4:08.96 and Medium fourth overall/third stock at 13:56.22. On Extreme, the player retired after one completed lap at 1:56.56 due to pothole damage.

The independent watch-controller test reproduced all 60 classifications, class ranks, lap counts, finish times, retirement reasons, field times, and contact totals from these new fixtures. [Full per-car report and JSON](endurance/ENDURANCE-REPORT.md).

All final endurance runs use simulation SHA-256 `03c712b6e2aec3268cf58d4706d4c3af68fab2dceb2712ef07989079520f4076`.

These are **accelerated engine runs**, not another observed real-time browser series. The earlier user-visible Edge watch and export remain unchanged under [the historical visible-watch record](../endurance/VISIBLE-WATCH-RECORD.md). Its different outcomes belong to the earlier physics revision. Current pothole totals count per-wheel contact entries and are not directly comparable to that earlier car-level hit counter.

## Failures found and fixed

The initial crowded-pit route moved cars into grass before the paved entrance. The engine now stages its approach on the racing surface and physically merges when pavement is available.

Natural Medium endurance then exposed two separate liveness failures:

1. Two wrecks blocked the normal pit through lane while adjacent pavement remained open. The 180-s no-progress watchdog stopped the race with 14 live cars at 480.1167 simulated seconds. [Preserved incomplete evidence](endurance/medium-incomplete-before-exit-fix.json).
2. A permanent wreck before the entrance blocked pit-bound road traffic. The same unchanged watchdog stopped that revision with 18 live cars at 398.2667 seconds. [Preserved incomplete evidence](endurance/medium-incomplete-before-entry-fix.json).

The engine now chooses a persistent, vehicle-footprint-clear route on the available paved surface, including before the entrance, and uses that route for stall merging. Regression fixtures reconstruct the measured queues and require physical progress while the wrecks remain unchanged. The final natural Medium run completed without weakening the watchdog, deleting obstacles, teleporting cars, or forcing DNFs.

## Isolated browser verification

Command: `node tests/browser-wheel-check.mjs`, against `http://127.0.0.1:4173/`.

One headless Microsoft Edge session, DPR 1, first 1366×768 then 390×844. **9 checks passed; zero JavaScript/console errors.** The browser closed in its `finally` path; a host process query afterward confirmed zero owned QA Node or Playwright Edge processes. [Machine-readable browser evidence](browser-wheel-verification.json).

The checks verified:

- Stable production assets without the Vite HMR client; an idle garage held its render count at 2 rather than drawing continuously.
- Twenty engine bays and twenty rendered bay groups, four correct corner identities, and the selected car's assigned bay in the HUD.
- Active rendering below the 60fps cap: 44 draws during the sampled second. A deliberately controlled DOM visibility event froze simulation and draw counts; this tests the real visibility handler, not a manual foreground-tab observation.
- Actual `WEBGL_lose_context` loss/restoration paused the field and retained the same simulation object and position. The explicit Continue button resumed that race. This is a controlled browser recovery test, not evidence of a spontaneous GPU failure.
- A controlled front-left puncture dropped pressure from 95% to about 86.1% during real-time play; pause stopped both pressure loss and repeated rendering.
- Controlled front-left puncture, front-right blowout, rear-left bend, and rear-right broken suspension appeared on the correct HUD corners and wheel meshes. Grip/steer/brake factors decreased, with actual throttle input afterward.
- An injected own-bay starting position followed by real E input and the full five-second service restored all Easy components and 100% grip/steer/brake displays.
- Mobile HUD remained inside the viewport without overlapping touch controls.
- A controlled front-left assembly loss hid that wheel, retired the car, and disabled service/recovery.

The component and bay scenarios intentionally inject initial damage/position so each specific UI state can be reviewed. They **do not claim those failures happened naturally in the browser**. Their physical origin, persistence, repair behavior, and full-race effects are separately covered by engine tests and untouched-grid endurance.

## Review images and stable build

- [Untouched stable garage](stable-play-garage.png). At 768px height the setup panel scrolls to reveal its lower action buttons; the start action was exercised successfully.
- [Desktop controlled four-corner damage](desktop-four-corner-damage.png).
- [Mobile controlled four-corner damage](mobile-four-corner-damage.png).
- [Twenty-bay pit overview](twenty-bay-pit-overview.png).
- [Own-bay service](assigned-bay-service.png).
- [Easy restored components](easy-components-restored.png).
- [Controlled permanent assembly failure](assembly-failure-retirement.png).

`npm run build:play` passed and the final immutable server returned HTTP 200. Source-manifest SHA-256: `d9ac2680b13adc347907f11953f54dbcda32d7fb4b9ead0c1092499f41f5b10b`; build-manifest SHA-256: `a15f1a4aa7a32860b3aabd90de05d8a9f6ea09f727a7d07629bbd4f2b9f19865`. Full fingerprint details are served at `/build-info.json`.

The stable server loads its bytes once, uses no hot reload, and is separate from the development server. Source edits/builds cannot silently replace the running snapshot. Renderer safeguards were verified as above; the bounded Windows restart investigation is recorded separately in [the restart-log review](RESTART-LOG-REVIEW.md), with no unsupported claim about a game causing the earlier restart.

One seed and these targeted checks establish these results, not every random layout or every GPU/browser configuration. No new real-time full-series browser watch was performed for this revision.
