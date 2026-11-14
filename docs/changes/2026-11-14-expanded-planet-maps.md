# Expanded playable maps — 2026-11-14

- **Request:** Make the playable map larger while retaining the existing game.
- **Engine:** `ares/campaign_data.py` sets 96×96 regions (9,216 sectors; 9× area). `ares/surface.py` extends the original geography. `ares/campaign.py` centers older 32×32/5×5 maps, preserves tile contents/stocks and remaps surveys; completed survey history rotates at its 1,000-entry limit.
- **Interface:** `web/campaign.js` derives center selection from catalog size; `web/planet-map.js` adds adaptive overview zoom, early offscreen culling, less distant detail and a minimap viewport outline. `web/map-ui.js` uses the larger fallback size.
- **Saving:** New `web/campaign-save.js` uses IndexedDB, reads older localStorage saves, and deletes the legacy copy only after a successful commit. Read errors do not replace saved progress. Browsers without IndexedDB retain a localStorage fallback and report quota failures. `ares/server.py` serves the module and raises only campaign requests to 96 MB.
- **Checks:** Full `python3 -B -m unittest discover -s tests -v`: 97 run, OK, 1 optional GMAT skip. Added migration/geography/history/storage tests and a >4 MB multi-hub HTTP action; updated map-size, center-selection and desktop/mobile overview checks. JS syntax and `git diff --check` pass. Offline Canvas renders generated for five worlds; Earth close-up/overview inspected. Sample frame times: 18–26 ms local, 31–36 ms overview; these are offline measurements.
- **Docs:** Updated AGENTS, README, PROJECT, ARCHITECTURE, DECISIONS (D-016) and STATUS.
- **Run/open:** Restart `python3 -m ares.server` from the repository and refresh the game. Existing saves expand automatically.
- **Open:** Actual browser/device performance and IndexedDB persistence need browser verification; prior preview denial remains in effect. Classic mode, solar navigation and flight rules are unchanged. No deployment or commit performed.
