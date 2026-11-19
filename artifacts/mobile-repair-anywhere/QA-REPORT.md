# Manual mobile repair anywhere — QA report

November 18, 2026. **49 focused engine tests and 3 isolated browser checks passed, with zero browser JavaScript/console errors.** The change removes the manual location restriction while retaining the AI's independent safe-site policy.

## Verified behavior

- A fully stopped, repairable SUV/Van can request mobile service on the racing surface, in the pit through lane, in its own bay, in another car's bay, or on grass. Each location completed the normal **15 simulated seconds**, with no partial repair before completion, no position snapping, four fresh tires afterward, and one spent charge.
- Nearby traffic does not reject a manual request. A controlled vehicle just outside actual contact allowed completion. An existing crew-area overlap allowed the request but immediately caused the ordinary contact cancellation, severe penalty, and permanent disable on the next physics tick. No tires or early repairs were granted, and the penalty occurred once despite continued overlap and a high ordinary-contact cooldown.
- Wrong vehicle classes, forward or lateral movement, pause, finished/wrecked state, a spent charge, permanent disable, and active pit service still reject deployment without wasting a charge.
- Existing tests passed for movement cancellation, paused service timing, normal completed-pit recharge, interrupted pit service, Extreme repair mistakes, contact on the final service tick, fatal contact, and permanent disable even after perfect Easy pit repairs.
- AI still physically pulls into a clear off-line area before deployment, stops, completes service, and rejoins without teleportation. The recorded AI deployment explicitly asserts the work area satisfies its safe-site policy. Mixed traffic passes an active crew area without contact.

The focused command was:

```sh
node --test --test-concurrency=1 tests/mobile-repair.test.js tests/guaranteed-pit-tires.test.js tests/hazards-and-pits.test.js
```

All **49 tests passed in 9.948 seconds**, in one BelowNormal process under a 45-second bound. The updated mobile file has 17 tests; the existing guaranteed-tire and hazard/pit cases supply the remaining 32. The old manual road/through-lane rejection expectations were replaced by the new acceptance contract; nonlocation guards were retained and expanded. Full watch/endurance races were not rerun for this narrow eligibility change. Earlier full-race results remain historical evidence, not new measurements.

## Browser acceptance

`node tests/browser-mobile-anywhere.mjs` ran one isolated Microsoft Edge instance against the immutable candidate, with a 75-second browser deadline. It used real input and ordinary service timing:

1. A real **M** tap started and completed 15-second service while the SUV was stopped on the racing lane. Its location deliberately failed the AI safe-site predicate, confirming manual eligibility is separate.
2. An actual **E** tap completed the normal five-second pit service and restored the spent charge.
3. The visible mobile button was clicked in the pit through lane at a **390 × 844** viewport and completed another normal 15-second repair. The mobile button, pit-service button, and contact warning were also checked at **1366 × 768**. Both layouts fit without horizontal overflow, overlapping repair buttons, or pedal obstruction. The pit-service button correctly remained disabled in the through lane because the SUV was outside its assigned bay; the mobile button remained enabled and reachable.

All three checks passed with zero errors. The final host query confirmed **zero owned harness/Playwright Edge processes**. User browser tabs were not touched.

The browser initializes declared positions and damage and isolates other traffic. It does not inject elapsed time, successful completion, charge state, or disable state. These checks establish keyboard/button behavior and layout, not a naturally driven pit approach. Traffic/contact consequences are exercised independently by the engine tests.

See [the browser evidence](browser-mobile-anywhere.json) for exact initial/completed states and measured control rectangles. Local-only screenshots in this directory are `road-mobile-service-desktop.png`, `pit-mobile-button-desktop.png`, `pit-mobile-button-mobile.png`, and `pit-mobile-service-mobile.png`; they are not required repository fixtures.

## Release identity

Validated candidate source SHA-256: `1aa43066ac9dead27f2c212023124cc28da0820a6086ce7c39358034bd031819`.

Validated candidate build SHA-256: `f22965be0f0d41e4ef0b52c33da67b763304e0db53d7f125d455ab79a8b6a35b`.

The browser evidence reports these same fingerprints. Promotion and GitHub publication are recorded by the release owner after visual acceptance; no further QA tests are pending.
