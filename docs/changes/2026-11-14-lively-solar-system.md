# Change: livelier solar-system map

- **Date:** 2026-11-14. **Why:** User requested rotation and more life while keeping the existing navigator.
- **Changed:** `web/solar-system.js` and `.css` add rotating surface textures/clouds, moving orbit highlights, Sun texture/flares, twinkling stars, background light and Saturn ring glints. Labels and hit targets stay steady; route dashes animate while ship progress remains tied to turns. Keyboard recentering uses the fixed hit circle.
- **Controls:** `web/campaign.js` wires Pause/Play and retains a separate visual clock through re-renders/reopening. Hidden tabs and reduced-motion preferences pause all chart effects; teardown removes event listeners. Toolbar spacing accommodates the new control. No engine, save or dependency changes.
- **Verified:** Python suite: 76 tests run, OK, 1 optional GMAT check skipped. JavaScript syntax/diff checks and generated SVG XML parsing pass. Node rendering/navigation/camera checks pass; controlled-clock checks cover pause/resume, hidden tabs, reduced-motion changes, remount continuity and cleanup. Scratch checks saved under the chat workspace's `work/lively-solar/`.
- **Documentation:** Updated README controls, STATUS, ARCHITECTURE and D-014 in DECISIONS.
- **Pending:** Browser preview remains blocked by the earlier permission denial. Rendered appearance, animation performance and small-screen behavior have not been visually verified.
- **Use:** Refresh the game, open **SOLAR SYSTEM**, and use **PAUSE / PLAY** beside Routes. No server restart required for this change.
