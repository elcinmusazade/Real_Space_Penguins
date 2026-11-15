# Change: Shipyard & Software rework

- **Date:** 2026-11-15
- **Author:** Claude (coding assistant) with the user
- **Scope:** Feature (branch `feature/shipyard-rework`, based on `feature/tutorial`)
- **State:** Complete

## Changed paths and behavior

- `ares/ship.py` (new): part slots, environments, fit check, simulator ship profile.
- `ares/fault_data.py`, `ares/faults.py`: 14 new dangers (two per planet with the existing ones), new sensors (temperature, impacts, wind) and responses (thermal protection, heaters, shield attitude, descend); simulator flies a ship profile; failure hints.
- `ares/campaign.py`, `ares/campaign_data.py`, `ares/flight.py`: parts in quotes/mass/cost, fit in quotes and arrivals, per-planet rules (`softwareProfiles`, `setSoftware` with `world`/`clear`), mission meets one of two dangers.
- `ares/server.py`: lab test per planet with the player's ship; new static files. `ares/advice.py`: checks Earth/Mars and destinations in flight with planet rules.
- `web/ship-view.js`, `web/shipyard.css` (new), `web/campaign.js`, `web/program-ui.js`, `web/program.css`, `web/tutorial.js`, `web/advisor.js`, `web/index.html`.
- Tests: `tests/test_ship.py` (new); `test_faults.py`, `test_balance.py`, `test_advice.py` updated.

## Observed verification

- Full suite OK (6 Node-only skipped). Browser walk-through of Shipyard and Software on port 8002.

## Remaining work and ideas

- Real 3D ship (deferred). Balance of outer-planet missions with the new parts needs play-testing.
