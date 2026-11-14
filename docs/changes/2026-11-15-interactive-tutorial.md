# Change: Interactive tutorial and Settings

- **Date:** 2026-11-15
- **Author:** Claude (coding assistant) with the user
- **Scope:** Feature (branch `feature/tutorial`)
- **State:** Complete

## Changed paths and behavior

- `web/tutorial.js`, `web/tutorial.css` (new): 24-step coach-mark tutorial with spotlight, chapter label, body, hint, progress bar, Back / Next / Skip step / Take me there / ✕; first-load offer; Settings dialog markup.
- `web/campaign.js`: creates the tutorial with a read-only context, syncs it after each render, adds the ⚙ Settings button and dialog (tutorial restart/resume/close, guide-card and ambient-motion toggles), hides the old guide card while the tutorial runs.
- `ares/server.py`, `web/index.html`: serve and link the new assets.
- `tests/test_tutorial.py` (new), `tests/test_server.py`: anchor/wiring checks and asset serving.
- README, ARCHITECTURE, STATUS, DECISIONS (D-021).

## Why

The user asked for a typical game tutorial that explains mechanics, objectives and hints for the first missions, can be closed, and can be restarted from settings.

## Observed verification

- `python3 -m unittest discover -s tests -v`: 133 OK, 6 skipped (Node-only).
- Full in-app browser walk-through on desktop and phone width (see STATUS).

## Remaining work and ideas

- Steps are written for the Mars-HQ start; very old saves (Earth HQ) still work, but the wording mentions Mars HQ.
- No translations; tutorial progress is per browser, not part of the save.
