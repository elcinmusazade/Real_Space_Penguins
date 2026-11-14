# Change: playable Earth hub

- **Date:** 2026-11-14. **Why:** User requested an Earth hub like Mars, with actual map gameplay.
- **Engine:** `ares/campaign.py` adds Earth terrain, a starter rover, surface actions/production/repair, and non-destructive V2/V3 save migration. Keeps the control hub identity, launch/cargo links, income, and permanent command availability. `ares/campaign_data.py` permits Earth greenhouse production and defines upkeep wear.
- **UI:** `web/campaign.js` and `web/map-ui.js` use Earth's real tiles and show exploration, minimap, and all seven construction controls. The Mission Control chip selects the map; Outposts retains mission/supply actions.
- **Docs:** Updated README, PROJECT, ARCHITECTURE, DECISIONS (D-013), and STATUS. Earlier change logs retained.
- **Verified:** Five new engine tests; full suite 76 tests run, OK, 1 optional GMAT check skipped. Browser scanned Earth, built an extractor and greenhouse, advanced production, reloaded the saved game, and checked Mars controls; no captured warnings/errors. JS syntax and diff checks passed.
- **Apply:** Restart `python3 -m ares.server` and refresh. Existing saves upgrade automatically.
- **Limits:** Earth has no off-world hazards or crew survival; long-term economy balance with Earth production is untested. Terrain/yields/wear remain game estimates.
- **Preview cleanup:** Test browser tab closed. Automatic approval review blocked interrupting the temporary server; port 8767 may remain running.
