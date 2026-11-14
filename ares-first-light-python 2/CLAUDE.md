# Claude / AI teammate entry point

Read and follow **`AGENTS.md`** as the primary repository instructions, then read `docs/START_HERE.md` and `docs/STATUS.md`.

The default **interplanetary campaign V2** is in `ares/campaign.py` (rules), `ares/campaign_data.py` (catalog), `web/campaign.js` (interface), and `web/campaign.css` (styling). The browser sends every state change to Python. Its main page is `/`. **Classic Mars V1** remains at `/classic.html` and uses `ares/engine.py`, `ares/rules.py`, `web/app.js`, and `web/bridge.js`. Never implement a browser-side game-state transition or change the classic without a specific request.

Campaign V2 has **no action points**. Ship design, mission planning, surface/orbital hubs, freight routes, separate inventories, and Mars/Venus/Mercury/Europa are the active requirements. Flight numbers are illustrative until the user supplies GMAT data.

After changes, run `python3 -m unittest discover -s tests -v`, update `docs/STATUS.md`, and add a uniquely named `docs/changes/` entry. Preserve unrelated edits from the other teammate or assistant.
