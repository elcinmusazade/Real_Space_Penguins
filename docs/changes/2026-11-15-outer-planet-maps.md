# 2026-11-15 — Maps for the outer planets

User request: add maps to planets that lacked them.

- Added Jupiter, Saturn, Uranus and Neptune: distinct 96×96 cloud regions, three deployment zones each, animated cloud textures, floating facilities, previews and map/planner shortcuts. Sun remains a star landmark.
- Reused existing surveys, construction, inventory, hazards, repair and shipping. Platforms require Deep-Space Engineering, a lander/freighter, Survey Station + Environmental Shield, and mission arrival. Added a 6-energy platform core, weak sunlight, condensers/refineries and blocked storm sectors; all are fictional game mechanics.
- Added estimated routes/capture/launch checks and marked light-time estimates. Preserved the four-destination GMAT table, Mars home, Earth travel, existing saves and Classic V1. Corrected arrival colors for every playable world.
- Files: `ares/campaign_data.py`, `surface.py`, `campaign.py`, `flight.py`; `web/campaign.js`, `map-ui.js`, `planet-map.js`, `solar-system.js/.css`, `flight-view.js`; engine, HTTP, navigation, renderer and startup tests. Updated README, AGENTS and current architecture/project/data/status documentation; recorded D-020.
- Checks: full suite **129 run, 128 passed, 1 optional GMAT skip** (61.802 s); Node controller/render tests, Python 3.9 grammar, JS syntax and diff checks. Inspected offline Canvas renders for all four planets. Initial regressions were outdated five-world/landmark expectations; new orbital test needed sufficient propellant, and power assertions now account for existing station upkeep.
- No dependencies, saved-game resets, commits or deployment. Actual browser layout and extended late-game balance remain unverified; browser preview was previously denied. Restart Python and refresh; no new campaign needed.
