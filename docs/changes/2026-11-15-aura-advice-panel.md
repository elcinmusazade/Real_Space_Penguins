# Change: AURA advice panel

- **Date:** 2026-11-15
- **Author:** Claude (coding assistant) with the user
- **Scope:** Feature (branch `feature/tutorial`)
- **State:** Complete

## Changed paths and behavior

- `ares/advice.py` (new), `ares/server.py`: `POST /api/campaign/advice`, read-only prioritised advice with typed actions.
- `web/advisor.js`, `web/advisor.css` (new), `web/campaign.js`, `web/index.html`: ✺ opens the advice panel; badge for urgent/warning; action buttons; topics; welcome briefing replay.
- `web/tutorial.js`: final hint describes the real ✺ behaviour.
- Tests: `tests/test_advice.py` (new), `tests/test_server.py`.

## Why

The tutorial told players ✺ gives advice, but it only reopened the welcome briefing.

## Observed verification

- 142 tests OK, 6 skipped (Node-only). Browser walk-through of the panel and every action type.

## Remaining work and ideas

- Advice wording is English-only; thresholds (5 turns of supplies, 4-turn goal reminder) are game choices.
