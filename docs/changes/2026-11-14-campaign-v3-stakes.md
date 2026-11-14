# Change: Campaign rules V3 — higher stakes on the map-first base

- **Date:** 2026-11-14
- **Author:** Claude (coding assistant) with the user
- **Scope:** Feature
- **State:** Complete (campaign ending deliberately on hold)

## Changed paths and behavior

- Repository root now holds the former `ares-first-light-python 3/` (commit "Promote ares-first-light-python 3 to the repo root"); `GMAT/` is git-ignored.
- `tools/gmat_spk.py`, `tools/build_campaign_windows.py`, `ares/data/campaign_windows.json`: offline GMAT-derived launch table (DE421 + Atlas V 401), 80 turns × 4 destinations.
- `ares/flight.py`: windows, rockets, capture/landing delta-v, launch checks.
- `ares/faults.py`, `ares/fault_data.py`: flight-software simulator (from the fault-lab branch) with per-mission intensity.
- `ares/orders.py`: base standing orders.
- `ares/campaign.py`, `ares/campaign_data.py`: state version 3 with V2 migration; kg-based ships, rockets, propellant; launch outcomes; arrivals decided by flight software; hazards, standing orders, wear/repair, base loss/rescue, dark stations; goals and yearly reviews; new actions `setSoftware`, `setOrders`, `prepare`, `repair`.
- `ares/server.py`: V3 catalog, `POST /api/campaign/faults/test`, new static files.
- `web/rule-editor.js`, `web/program-ui.js`, `web/flight-view.js`, `web/program.css`; `web/campaign.js`, `web/map-ui.js`, `web/index.html` updated.
- Tests: `tests/test_campaign.py` rewritten for V3; new `tests/test_flight.py`, `tests/test_faults.py`, `tests/test_balance.py`; `tests/test_server.py` extended.
- Docs: README, AGENTS, CLAUDE, ARCHITECTURE, DATA_SOURCES, DECISIONS (D-012), IDEAS, PROJECT, STATUS.

## Why

The V2/V3 campaign could not be lost: missions always arrived and nothing wore out. The user asked to raise the stakes with all proposed changes except campaign endings. GMAT data gives the launch windows real consequences, and player-written rules make the outcome the player's design.

## Observed verification

- `python3 -m unittest discover -s tests -v`: 71 OK, 1 skipped (Node parity).
- `python3 -m compileall -q ares tools`: OK.
- Browser checks as listed in `docs/STATUS.md`.

## Remaining work and ideas

- Campaign ending/loss (on hold), real terrain data (needs download approval), more launch-vehicle curves, balance past turn 24, touch testing on a real phone.
