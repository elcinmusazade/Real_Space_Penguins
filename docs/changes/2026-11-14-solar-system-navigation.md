# Change: collapsible solar-system navigator

- **Date:** 2026-11-14. **Why:** User requested open/close world selection using the supplied solar-system reference.
- **Changed:** New `web/solar-system.js` and `.css` provide schematic SVG planets/orbits, pan/zoom/fit, selectable bodies, live hubs/traffic, route toggle, responsive layout, and reduced motion. `web/map-ui.js` replaces the list with a compact launcher; `web/campaign.js` wires map/mission/hub actions, close/backdrop/Escape, focus trapping/restoration.
- **Integration:** `web/index.html` loads the stylesheet; `ares/server.py` allows the two assets; `tests/test_server.py` checks their HTTP responses. Updated README, PROJECT, ARCHITECTURE, DECISIONS (D-014), and STATUS. Campaign simulation and saves unchanged.
- **Verified:** Python 76 tests run, OK, 1 optional GMAT recomputation skipped. JS syntax/diff checks, SVG XML parsing, destination/landmark/traffic rendering checks and controller navigation/camera checks (zoom bounds, wheel, drag, fit, resize, cleanup) pass.
- **Pending:** Browser security denied localhost preview permission. Actual rendered layout, pointer interactions, focus behavior, and small-screen QA remain unverified. No screenshot claimed.
- **Use:** Restart the Python server, refresh, and open SOLAR SYSTEM. Select a planet, then open its surface/hub or plan a mission. Close with ×, Escape, or outside the panel.
- **Scope:** Sun and outer planets are inspectable landmarks; existing five campaign destinations remain playable. Visual orbits and sizes are schematic.
- **Cleanup:** Stopped the temporary port-8768 preview and the previous port-8767 test server after filesystem/process permissions were restored.
