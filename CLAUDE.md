# Claude / AI teammate entry point

Read and follow **`AGENTS.md`** as the primary repository instructions, then read `docs/START_HERE.md` and `docs/STATUS.md`.

The default **interplanetary Python Campaign V2** is in `ares/campaign.py` (rules), `ares/campaign_data.py` (catalog), and `web/campaign.js` (controls). Its **V3 game-map interface** lives in `web/map-ui.js`, `web/map-game.css`, and `web/planet-map.js` (32×32 isometric maps). Browser actions must always go to Python. Its main page is `/`. **Classic Mars V1** remains at `/classic.html` and uses `ares/engine.py`, `ares/rules.py`, `web/app.js`, and `web/bridge.js`. Never implement a browser-side game-state transition or change classic without a specific request.

Campaign V2 has **no action points**. Ship design, mission planning, surface/orbital hubs, freight routes, separate inventories, and Mars/Venus/Mercury/Europa are the active requirements.

**Campaign rules V3 (2026-11-14)** raise the stakes: `ares/flight.py` checks Earth launches against `ares/data/campaign_windows.json` (built offline by `tools/build_campaign_windows.py` from NASA GMAT's DE421 ephemeris and Atlas V 401 data), `ares/faults.py` + `ares/fault_data.py` run the player's flight software at arrival, `ares/orders.py` runs base standing orders against forecast hazards, and `ares/campaign.py` adds wear, base loss, programme reviews and goals. UI: `web/rule-editor.js`, `web/program-ui.js`, `web/flight-view.js`, `web/program.css`. A campaign **ending / lose condition is deliberately on hold** (user request).

After changes, run `python3 -m unittest discover -s tests -v`, update `docs/STATUS.md`, and add a uniquely named `docs/changes/` entry. Preserve unrelated edits from the other teammate or assistant.
