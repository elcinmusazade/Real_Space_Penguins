# Change: planet images travel along their orbits

- **Date:** 2026-11-14. **Why:** User reported that only a small white orbit highlight moved; the previous implementation kept planet positions fixed.
- **Changed:** `web/solar-system.js` now computes orbital positions and updates complete SVG planet groups each animation frame. Full orbits fit around a centered Sun; Europa orbits moving Jupiter. Labels/click targets follow the images, routes stay attached, and ship completion fractions remain tied to turns. Removed standalone orbit-line highlights from `.js`/`.css`.
- **Controls:** Existing Pause/Play, reduced-motion, hidden-tab and phase persistence support now includes orbital movement. Hover/keyboard focus briefly holds targets for selection; camera recentering uses current coordinates. Closing cancels the frame loop and listeners. Gameplay and saves are unchanged.
- **Verified:** Added `tests/test_solar_navigation.py` and optional Node helper `tests/solar_navigation_check.mjs`, checking actual SVG movement after one second, a full orbit, Europa-relative motion, fitted bounds, routes, pause/resume/hold, reduced motion, hidden tabs, remounts, cleanup and camera controls. Full suite: 77 tests run, OK, 1 optional GMAT check skipped. Prior mocked navigation checks, JS syntax, SVG XML parsing and diff checks pass.
- **Documentation:** Updated README, PROJECT, STATUS, ARCHITECTURE and D-014 in DECISIONS.
- **Pending:** Browser preview remains blocked by the earlier permission denial; actual rendered appearance/performance has not been verified.
- **Use:** Refresh and open **SOLAR SYSTEM**. Move the pointer away from a planet to watch the orbits, or use **PAUSE / PLAY**. No server restart is needed.
