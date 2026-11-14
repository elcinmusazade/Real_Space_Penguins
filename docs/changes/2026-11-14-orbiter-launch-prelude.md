# Change: Orbiter launch prelude with GMAT-derived pass/fail

- **Date:** 2026-11-14
- **Author:** Claude (Claude Code)
- **Scope:** Feature
- **State:** Complete locally; branch `feature/fault-protection-lab`

## Changed paths and behavior

- `tools/gmat_spk.py`, `tools/build_mars_launch_table.py` (new): offline builder that reads the DE421 ephemeris and Atlas V 401 curve bundled with the local GMAT clone, solves Lambert transfers, and writes `ares/data/mars_launch_windows.json` (7 launch dates, C3, declination, arrival v∞, trajectory and orbit-track points).
- `ares/launch.py` (new), `ares/rules.py`: assessment of the launch plan (date, propellant, fault design). Checks the declination limit, launch mass vs Atlas V capacity at that C3, and capture Δv (rocket equation, Isp 320 s) vs the burn needed for a 400 km orbit. Outcomes: success / scrub / stranded / flyby. The flight computer's mass counts toward launch mass.
- `ares/server.py`: `GET /api/launch/catalog`, `POST /api/launch/assess`, `POST /api/launch` (creates the colony game only on success); serves `launch-view.js`, `launch.css`.
- `web/launch-view.js`, `web/launch.css` (new): setup panel (fault status, date cards, propellant slider, live Python readout) and the outcome animation (countdown/ascent, Earth parking orbit, heliocentric cruise on the real arc, capture or flyby, outcome card with every check).
- `web/app.js`, `web/bridge.js`, `web/index.html`: Launch now goes through `/api/launch` and the animation; it needs a fault design. The existing "GO FOR LANDING" overlay still plays on success.
- `web/faults.js`: saves the design on load, stores the last test score for the launch panel, and adds "Continue to orbiter launch".
- `tests/test_launch.py` (new), `tests/test_server.py`: table integrity, Atlas curve vs MRO, the four outcomes, computer mass, input validation, determinism, the HTTP flow, and a recompute against GMAT's ephemeris (skipped without the clone).
- Docs: README, STATUS, ARCHITECTURE, DATA_SOURCES, DECISIONS (D-009).

## Why

- The user asked for the fault lab to become a prelude to the colony, with a launch animation whose pass/fail is set by GMAT. GMAT isn't runnable here, and the user chose the GMAT-data route. Precomputing keeps the game standard-library only and playable for teammates without the 1.9 GB clone.

## Observed verification

- `python3 tools/build_mars_launch_table.py`: optimum 2028-11-24, C3 9.10 km²/s², arrival v∞ 2.97 km/s, 300 days; every arc ends within 0.0002 AU of Mars.
- `python3 -m unittest discover -s tests -v`: 42 tests, OK (1 skipped: Node parity). The GMAT recompute test ran (the clone is present).
- Browser (local preview, port 8765): fault lab → Continue → launch panel showed the fault status and live numbers; Oct 16 at 900 kg → stranded animation and card; Nov 18 at 500 kg → cruise, then flyby card; Nov 18 at 1,250 kg → cruise, capture, success card → colony map with the touchdown toast. All requests returned 200.

## Remaining work and ideas

- GMAT itself is not run. If installed later, a GMAT script could refine the trajectories (finite burns, launch-site geometry) and write the same JSON.
- The fault-lab score is shown but doesn't affect the launch outcome. Fault scenarios could be replayed during cruise later.
- The capture orbit is fixed at 400 km; an orbit choice (e.g. an elliptical relay orbit needing less Δv) is a natural next trade-off.
- The animation was checked in a background browser pane; frame timing in a foreground window wasn't measured.
