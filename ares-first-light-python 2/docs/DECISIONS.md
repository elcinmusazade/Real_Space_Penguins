# Decision log

## D-001 — Preserve the selected game interaction

**Status:** User-confirmed. **Date:** 2026-11-13.

Build turn-based hybrid strategy with an interactive colony, hidden terrain, and instant discovery. Do not replace instant scanning with manual rover movement or real-time timers.

**V2 extension (2026-11-14):** Instant **nearby** scans remain free. Distant surveys are rover expeditions that take time and resources, with the actual tile revealed when the rover arrives. The user explicitly removed V2 action-point limits; Classic V1 retains them.

## D-002 — One small but complete mission

**Status:** First-version implementation choice. **Date:** 2026-11-13.

Use one Mars map, 10 Sols, two actions per Sol, and transparent science/survival goals. This keeps the full mission loop achievable for a two-person team. Grid size, costs, and targets are tunable game values, not validated NASA specifications.

**Historical:** This applies to Classic V1, **not** the default open-ended interplanetary campaign.

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

## D-008 — Python is authoritative in a separately delivered edition

**Status:** Implemented. **Date:** 2026-11-14. **Reason:** User requested a full Python-based web game after selecting the web format.

Port simulation state transitions, events, validation, and Sol resolution into Python's standard library. Reuse the original illustrated browser UI, but forward all mutating actions through an HTTP bridge to Python. Keep the legacy JS engine only as read-only UI projections; never let it execute gameplay transitions. Preserve seeded-map and save-state compatibility, and verify parity against the original edition.

Keep the previously existing static JavaScript Site unaffected. A separate process-capable host would be needed to publicly deploy this Python edition. This choice does **not** add a live AI service or NASA data feed.

## D-009 — User-selected AP-free interplanetary campaign

**Status:** Implemented as separate Campaign V2. **Date:** 2026-11-14.

User requested spacecraft and mission design, a much larger playable network, multiple hubs **on the same planet** plus orbital stations, physical ship/convoy resource transfer, and missions to **Venus, Mercury, and Europa** as well as Mars. Ship hull/propulsion/trajectory/payload trade-offs affect estimated mass, risk, cost, and travel time. Separate hub stockpiles are never automatically pooled. Freight dispatch consumes source resources and takes turns, establishing reusable routes upon delivery; a first shipment is permitted to **open** the route. No action points limit orders; available assets, time, construction site validity, and resources are the constraints.

Retain the small Classic V1 unchanged. V2 must have its own state schema, JSON endpoints, browser save key, and tests so the two modes do not interfere.

## D-010 — Authored onboarding and provisional mission science

**Status:** Implemented with explicit limits. **Date:** 2026-11-14.

An AURA introduction opens on each load, with context-aware authored help for ship design, exploration, life support, and cargo. It does **not** call an LLM; adding model inference requires a later explicit integration decision. The player will supply **GMAT data** later; until then, all trajectory durations, fuel requirements, risks, and solar/production coefficients are labeled **illustrative game parameters**. Europa is accurately labeled Jupiter's moon; robotic outposts on extreme worlds avoid assuming viable crewed Venus surfaces.

