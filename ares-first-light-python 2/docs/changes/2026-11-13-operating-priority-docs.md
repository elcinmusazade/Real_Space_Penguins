# Change: Explain constrained module operation and record engine verification

- **Date:** 2026-11-13
- **Author:** ChatGPT science/documentation task
- **Scope:** `dist/science.js`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/STATUS.md`
- **State:** Complete for the inspected engine revision; browser/deployment checks still pending

## Changes and rationale

- Added player-facing instructions for solar generation, reserved crew needs, and water/oxygen/crops/lab/shield operating priority.
- Explained that an optional module without full power/water inputs stays idle with no output or operating consumption, while crew needs continue.
- Documented the shared allocation plan behind `getTileOutput`, `forecast`, and turn resolution, including `starved` / `reason` diagnostics.
- Added decision D-007 so future assistants preserve the intended deterministic rule and do not reintroduce free production or inconsistent forecasts.

## Observed verification

- Read the current `operationPlan`, `getTileOutput`, and `forecast` implementation in `dist/engine.js`.
- Ran `npm test`: **29 tests passed, 0 failed**.
- Inspected the passing default-loadout victory test: completes Sol 10, meets the science target, and retains 100 crew health.
- Browser interaction and publication status are deliberately not claimed as complete in this entry.

