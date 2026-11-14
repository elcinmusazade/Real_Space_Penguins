# Current status — Python interplanetary game

**Updated:** 2026-11-14. **State:** `main` runs the map-first campaign UI with **Campaign rules V3** (higher stakes, GMAT-derived Earth launches). Classic Mars V1 is still at `/classic.html`. The `ares-first-light-python 2/` and `3/` folders are kept as snapshots. **No public Python deployment.**

## Built

- **Map-first campaign (UI V3):** 32×32 isometric maps per surface hub, pan/zoom, minimap, construction bay, overlays for Shipyard, Supply lines, Tech tree, **Software** and **Programme**. AURA briefing on load; one-step first-mission guide on the map.
- **GMAT launch windows:** each turn is 90 days from 2028-07-01. Earth launches to Mercury, Venus, Mars and Jupiter/Europa read a precomputed table built from NASA GMAT's DE421 ephemeris and Atlas V 401 data (`tools/build_campaign_windows.py`). The Shipyard shows launch/arrival dates, C3, arrival speed, delta-v need vs have, launch mass vs rocket capacity, and a 12-turn window chart.
- **Launch outcomes:** scrubbed (declination), stranded (too heavy), flyby/drift (too little propellant) or go. Failing plans need an explicit "launch anyway". Animations play the launch along the real arc and the arrival.
- **Flight software:** player-written WHEN/AND/FOR/THEN rules on a basic/standard/advanced computer; lab test against all four approach scenarios. At arrival the saved software runs the destination's scenario at a seeded 85-125% intensity: nominal, degraded (lost module, damaged base, off-target landing, half science) or lost.
- **Bases:** forecast hazards (two turns ahead), manual preparation at least a turn ahead, player-written standing orders that react inside the turn, building wear with upkeep and repair, crewed bases lost at 0% health and reopened by a new landing, uncrewed stations going dark and revived by energy shipments. Signal delay shown from DE421 light-time.
- **Programme:** seven goals with deadlines and rewards; yearly reviews move the budget between 4 and 30 credits per turn; mission debriefs explain each outcome.
- V2 browser saves migrate to V3 in Python on load (the legacy event pop-up still resolves).

## Observed checks

- `python3 -m unittest discover -s tests -v`: **71 tests OK, 1 skipped** (Node parity; Node is not installed here). Includes the GMAT recompute test (runs because the local `GMAT/` clone exists) and automated careful-vs-careless playthroughs over 24 turns on three seeds.
- Browser (in-app preview, ~900 px and 375 px wide): briefing, Shipyard checks and window chart, Software rule editing → lab test 4/4 → save, launch in the turn-2 Mars window with animation, advance to turn 6, nominal arrival, standing order firing in a dust storm, Programme goals/reviews/forecasts/Prepare, debrief, launch-anyway dialog, no horizontal overflow on a phone-width screen, no console errors.

## Honest limitations

- Trajectories are Sun-only two-body Lambert solutions on GMAT's ephemeris, not full GMAT runs. Gravity-assist timing, heavy/super-heavy rockets, capture orbits, landing delta-v, boil-off, hazards, wear and yields are **game estimates**, labelled in the UI.
- **No campaign ending or loss condition** (on hold by user request). Reviews cut budget but never cancel.
- Planet maps are stylized seeded terrain, not real elevation data (needs an approved download).
- Touch gestures on a real phone were not tested; only the emulated phone viewport was. Long-campaign balance beyond 24 turns is unchecked.
- AURA is scripted, not a live LLM. Saves are client-owned JSON in localStorage; not secure for public multiplayer.

## Next steps

1. Decide the campaign ending (length, final debrief, loss conditions).
2. Play-test the economy past turn 24 with both teammates; tune hazard chances, upkeep and goal deadlines.
3. Optional: real landing-site terrain; more launch-vehicle curves; GMAT-backed off-Earth departures.
