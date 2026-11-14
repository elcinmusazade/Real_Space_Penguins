# Change: First playable release — desktop QA handoff

- **Date:** 2026-11-13
- **Author:** ChatGPT Site owner; results recorded by documentation task
- **Scope:** Integrated browser game and shared status record
- **State:** Gameplay verified; source publication pending

## Observed verification

- **Engine:** `npm test` passed 29 tests, 0 failures in the preceding verification pass.
- **Complete browser mission:** Actual UI playthrough of seed `ARES-SZC04` reached a 10-Sol victory with 112 science, 100 crew health, score 817, 7 modules, and 12/36 sectors surveyed.
- **Preflight:** Default cargo selection shown; over-budget cargo disabled Launch.
- **Gameplay:** Immediate frontier scans, next-Sol building activation, event decisions, and unused-action-point confirmation exercised through the browser.
- **Persistence:** Reload at Sol 3 restored the saved mission.

## Handoff limits

- Desktop was tested. Responsive CSS exists, but no explicit phone-viewport run was performed.
- Source synchronization, packaging, and publication must still succeed; this entry does not claim deployment.
- Live AI missions, real NASA numerical data integration, and a full Field Shift Earth crop-rotation tool remain deferred ideas, not completed features.

## Documentation changed

- `docs/STATUS.md` now separates completed desktop/engine checks from pending publication and device-test limits.

