# Current status — Python interplanetary game

**Updated:** 2026-11-14. **State:** `main` runs the map-first campaign UI with **Campaign rules V3** (higher stakes, GMAT-derived Earth launches). Classic Mars V1 is still at `/classic.html`. The nested snapshot folders were already deleted in the working tree; those unrelated deletions are preserved. **No public Python deployment.**

## Built

- **Living isometric surfaces:** Seeded natural regions/elevation on all five playable worlds, including Earth seas, coasts, rivers/lakes, forest, fertile land and mountains. Joined terrain surfaces, vegetation, rock formations, sparse ground detail, animated water/foliage/haze, pause/reduced-motion support, landscape minimap, keyboard selection and elevation-aware picking. Orbital imagery shows geography; deposits still require surveys.
- **Surveys and terrain economy:** Campaign rovers removed from UI, payloads and tech. Free local scans plus energy-funded 3×3 regional surveys (1–3 turns). Explicit survey/build buttons follow Python-supplied cost/output previews. Coastal water plants, soil/mining/high-ground bonuses, preparation costs and blocked terrain make sites matter. Added oxygen plants (2 water + 4 energy → 6 oxygen); production follows a stable supply-chain order. Old buildings, inventory, missions, research and surveys migrate on a copy. Classic V1 and the solar navigator are preserved.

- **Solar-system navigator:** Compact open/close launcher replaces the always-open planet list. Expanded schematic chart includes Sun, eight planets and Europa; world inspection, zoom/pan/fit, route visibility, hub selection, map and mission shortcuts. Includes live hub/traffic summaries, keyboard controls/focus restoration, and responsive styles. Outer planets are landmarks; campaign destinations are unchanged.

- **Lively solar chart:** Planet images now travel around a centered Sun, with Europa orbiting the moving Jupiter. Complete orbits fit the chart; labels/hit targets and route endpoints follow the bodies. Rotating textures, Sun effects, stars and ambient light remain. Pause/Play, reduced motion, hidden tabs, hovering and keyboard focus hold the visual clock; motion resumes without resetting. Ship journey completion still follows campaign turns.

- **Playable Earth hub:** Earth HQ now has a real 32×32 map, command center and solar array, with Mars-style scans, regional surveys, connected construction, delayed production, upkeep, and repairs. All eight build options are available, including greenhouses. Existing V2/V3 Earth saves gain the map automatically without resetting progress. Mission funding, fuel, launches, and shipments are retained; Earth command stays available without off-world hazards or crew survival. The Mission Control chip selects the map; Outposts opens its mission/supply panel.

- **Map-first campaign (UI V3):** 32×32 isometric maps per surface hub, pan/zoom, minimap, construction bay, overlays for Shipyard, Supply lines, Tech tree, **Software** and **Programme**. AURA briefing on load; one-step first-mission guide on the map.
- **GMAT launch windows:** each turn is 90 days from 2028-07-01. Earth launches to Mercury, Venus, Mars and Jupiter/Europa read a precomputed table built from NASA GMAT's DE421 ephemeris and Atlas V 401 data (`tools/build_campaign_windows.py`). The Shipyard shows launch/arrival dates, C3, arrival speed, delta-v need vs have, launch mass vs rocket capacity, and a 12-turn window chart.
- **Launch outcomes:** scrubbed (declination), stranded (too heavy), flyby/drift (too little propellant) or go. Failing plans need an explicit "launch anyway". Animations play the launch along the real arc and the arrival.
- **Flight software:** player-written WHEN/AND/FOR/THEN rules on a basic/standard/advanced computer; lab test against all four approach scenarios. At arrival the saved software runs the destination's scenario at a seeded 85-125% intensity: nominal, degraded (lost module, damaged base, off-target landing, half science) or lost.
- **Bases:** forecast hazards (two turns ahead), manual preparation at least a turn ahead, player-written standing orders that react inside the turn, building wear with upkeep and repair, crewed bases lost at 0% health and reopened by a new landing, uncrewed stations going dark and revived by energy shipments. Signal delay shown from DE421 light-time.
- **Programme:** seven goals with deadlines and rewards; yearly reviews move the budget between 4 and 30 credits per turn; mission debriefs explain each outcome.
- V2 browser saves migrate to V3 in Python on load (the legacy event pop-up still resolves).

## Observed checks

- Living surfaces, 2026-11-14: **91 tests run, OK, 1 optional GMAT check skipped**. Added geography determinism/diversity, safe starts, legacy-save preservation, survey cost/timing, construction/production bonuses, coastal intake, water-to-oxygen/food sequencing, input shortages, malformed requests and the HTTP inspection endpoint. Node checks cover projected picking at several zooms, click vs drag, camera limits, keyboard input, pause/reduced-motion/hidden states, cleanup, UI cost rendering, controller actions and stale inspection replies. Offline Canvas renders of all five worlds were inspected; JS syntax and diff checks pass. Actual browser layout/interactions/performance remain unverified because the earlier preview permission denial is still in effect. Restart Python and refresh to load both server and UI changes.

- Moving planets, 2026-11-14: 77 Python tests run, OK, 1 optional GMAT check skipped. New optional Node regression checks actual SVG body movement after one second, a complete Earth orbit, Europa-relative motion, chart bounds, attached routes with unchanged turn progress, pause/hover/keyboard/reduced-motion/hidden-tab controls, remount continuity and frame/listener cleanup. SVG XML parsing, JavaScript syntax, prior navigation checks and diff checks pass. Browser preview remains blocked by the earlier permission denial; rendered performance/appearance is unverified. Refresh the game to load the change.

- Solar animation, 2026-11-14: 76 Python tests run, OK, 1 optional GMAT check skipped. JS syntax, SVG parsing, rendering and mocked navigation/camera checks pass. Controlled-clock checks cover Pause/Play, hidden-tab suspension, reduced-motion changes, phase persistence across remounts and listener cleanup. Browser preview remains blocked by the earlier permission denial, so animation appearance/performance and responsive rendering are unverified. Refresh the existing game to load these frontend changes.

- Solar navigation, 2026-11-14: 76 Python tests run, OK, 1 optional GMAT check skipped; HTTP tests include both new assets. JavaScript syntax, SVG XML parsing, rendering/data checks (all destinations, landmarks, routes, dark hubs, escaping, immutable saves), and mocked-controller checks (navigation, mission selection, hub actions, Escape/Enter) plus camera checks (wheel/drag, zoom limits, fit, resize, cleanup) pass. Browser security denied the localhost preview; visual layout, actual pointer/keyboard behavior, and responsive rendering remain unverified. Restart the server and refresh for the new static-asset allowlist.

- Playable Earth hub, 2026-11-14: 76 tests run, OK, 1 optional GMAT recomputation skipped (clone absent). Five new engine tests cover Earth actions, delayed production/income, rover return, repair, save migration/immutability, and orbital rejection. Browser verified Earth scanning, extractor/greenhouse construction and production, Mission Control chip, persistence after reload, and Mars controls. No captured browser warnings/errors; JS syntax and diff checks passed. Restart the Python server and refresh the page to load the new engine.

- Earth interaction fix, 2026-11-14: headquarters clicks, the Mission Control chip (including Enter), and Earth’s Outposts tab open an operations panel. Mission design, research navigation, and a 20-material Earth-to-Mars shipment were verified in an isolated browser game. HQ hit tests passed at three zoom levels and two camera offsets. Full suite: 71 tests run, OK, 1 optional GMAT check skipped; JavaScript syntax and diff checks passed.
- Earth hub fix, 2026-11-14: `python3 -B -m unittest discover -s tests -v`: **71 tests run, OK, 1 skipped** (GMAT recomputation; local `GMAT/` clone absent). Node parity ran. `node --check` passed for `web/campaign.js`, `web/map-ui.js`, and `web/planet-map.js`. Browser preview confirmed the Earth marker and stockpile, Earth departure selection after a Mars source draft, Supply Lines navigation, Mars construction controls, Venus pre-landing preview, and no captured console warnings/errors.
- Browser (in-app preview, ~900 px and 375 px wide): briefing, Shipyard checks and window chart, Software rule editing → lab test 4/4 → save, launch in the turn-2 Mars window with animation, advance to turn 6, nominal arrival, standing order firing in a dust storm, Programme goals/reviews/forecasts/Prepare, debrief, launch-anyway dialog, no horizontal overflow on a phone-width screen, no console errors.

## Honest limitations

- Trajectories are Sun-only two-body Lambert solutions on GMAT's ephemeris, not full GMAT runs. Gravity-assist timing, heavy/super-heavy rockets, capture orbits, landing delta-v, boil-off, hazards, wear and yields are **game estimates**, labelled in the UI.
- **No campaign ending or loss condition** (on hold by user request). Reviews cut budget but never cancel.
- Planet maps are stylized seeded terrain, not real elevation data (needs an approved download).
- Touch gestures on a real phone were not tested; only the emulated phone viewport was. Long-campaign balance beyond 24 turns is unchecked.
- AURA is scripted, not a live LLM. Saves are client-owned JSON in localStorage; not secure for public multiplayer.

## Next steps

Living isometric is selected and implemented. Next visual check is actual browser/mobile play-testing when preview access is available; tune terrain economy and survey pacing using player feedback.

1. Decide the campaign ending (length, final debrief, loss conditions).
2. Play-test the economy past turn 24 with both teammates; tune hazard chances, upkeep and goal deadlines.
3. Optional: real landing-site terrain; more launch-vehicle curves; GMAT-backed off-Earth departures.
