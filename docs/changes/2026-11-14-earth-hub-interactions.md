# Change: make Earth headquarters interactive

- **Date:** 2026-11-14. **State:** Complete.
- **Why:** The previous fix drew HQ but ignored its clicks; the Earth Outposts tab also had no rendered panel.
- **Changed:** `web/campaign.js` connects HQ, Mission Control chip, and Earth Outposts to a panel with mission design, shipments, research, and live inventory. Supply actions select Earth as their source. `web/planet-map.js` adds a building hit area that follows pan/zoom and a pointer cursor. `web/map-ui.js` adds click guidance and connects the supply action. Updated `docs/STATUS.md`.
- **Verified:** Browser building click, chip via Enter, Outposts, mission source, research, and a 20-material Earth→Mars dispatch (inventory deducted, shipment in transit). Hit-area checks passed at 3 zoom levels × 2 camera offsets. Python: 71 tests run, OK, 1 skipped (GMAT clone absent). Three JS syntax checks and `git diff --check` passed.
- **Limits:** No Python rules or save schema changes. No public deployment or real-phone test. Refresh the game to load the fix.
