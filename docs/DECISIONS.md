# Decision log

## D-001 — Preserve the selected game interaction

**Status:** User-confirmed. **Date:** 2026-11-13.

Build turn-based hybrid strategy with an interactive colony, hidden terrain, and instant discovery. Do not replace instant scanning with manual rover movement or real-time timers.

## D-002 — One small but complete mission

**Status:** First-version implementation choice. **Date:** 2026-11-13.

Use one Mars map, 10 Sols, two actions per Sol, and transparent science/survival goals. This keeps the full mission loop achievable for a two-person team. Grid size, costs, and targets are tunable game values, not validated NASA specifications.

## D-003 — Original static browser game with separated simulation

**Status:** First-version implementation choice. **Date:** 2026-11-13.

Use buildless ES modules, browser-local saves, and a pure state-transition engine. This avoids a server, credentials, installation friction, and model-service failures. New assistants can test the rules independently of the UI.

**Edition note (2026-11-14):** This was the original JavaScript-edition choice. The separately requested Python edition deliberately replaces the state-transition engine with Python; see D-008. Keep this older decision for history, not as current Python guidance.

## D-004 — Authored events before live AI

**Status:** First-version implementation choice, live AI deferred. **Date:** 2026-11-13.

Keep event effects deterministic and show their costs. Authored scenarios are not labeled as AI-generated. A future AI Mission Director may vary narrative or validated event choices, but it must not invent arbitrary physics, resource values, or NASA facts.

## D-005 — Seeded maps with reachable starting resources

**Status:** First-version implementation choice. **Date:** 2026-11-13.

Generate replayable terrain from a seed and guarantee accessible essential opportunities. Survival should depend on player choices, not a map that lacks necessary resources. Regression tests should cover fairness and a complete winning path.

## D-006 — Honest science boundary

**Status:** Required content safeguard. **Date:** 2026-11-13.

NASA facts explain real constraints; gameplay values are simplified fiction. NASA POWER describes Earth, not Mars. Greenhouse crop choices are not agronomic recommendations, and this version is not a full Field Shift tool. No NASA endorsement is implied.

## D-007 — Shared constrained resource allocation

**Status:** Implemented. **Date:** 2026-11-13.

Solar generation precedes reserved crew needs. Water extraction, oxygen recycling, greenhouse production, laboratories, and shielding then receive resources in a stable priority order. Buildings lacking their full power/water input remain idle instead of producing free output; crew needs continue even during a shortage.

The tile inspector, forecast, and end-of-Sol resolution share the same allocation plan. This avoids contradictory UI predictions and gives players a clear survival-versus-science trade-off. The order is an explicit educational game rule, not a claim about real mission control policy.

## D-009 — Launch outcome from GMAT data, precomputed offline

**Status:** Implemented. **Date:** 2026-11-14. **Reason:** The user asked for GMAT to decide launch pass/fail. GMAT is not built or installed locally, and the user chose to use GMAT's bundled data instead of installing or building it.

Read GMAT's DE421 ephemeris and Atlas V performance curve offline and commit the derived table. Runtime stays standard-library Python with no GMAT dependency, and teammates without the GMAT clone can still play and run tests (the recompute test skips). If GMAT is installed later, its scripts can replace the Lambert builder and produce the same JSON shape.

## D-008 — Python is authoritative in a separately delivered edition

**Status:** Implemented. **Date:** 2026-11-14. **Reason:** User requested a full Python-based web game after selecting the web format.

Port simulation state transitions, events, validation, and Sol resolution into Python's standard library. Reuse the original illustrated browser UI, but forward all mutating actions through an HTTP bridge to Python. Keep the legacy JS engine only as read-only UI projections; never let it execute gameplay transitions. Preserve seeded-map and save-state compatibility, and verify parity against the original edition.

Keep the previously existing static JavaScript Site unaffected. A separate process-capable host would be needed to publicly deploy this Python edition. This choice does **not** add a live AI service or NASA data feed.

