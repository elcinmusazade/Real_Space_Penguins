# 2026-11-14 — Large planetary game maps (V3 UI)

## Reason

The user said the prior campaign looked like a website and explicitly requested a game-style experience with a **really big map and a map on every other planet**. The update makes map exploration the default screen without replacing the Python-authoritative mission, construction, and logistics simulation.

## Implemented

- Replaced the dashboard landing UI with a full-screen isometric Canvas2D map; overlay HUD includes planet selector, hub selector, sector inspector, stockpiles, tactical minimap, zoom/recenter/full-map controls, next-turn control and direct building placement.
- Mars, Venus, Mercury, Europa (and a cosmetic Earth preview) have independent 32×32 world displays. Each surface outpost has its own separate 1,024-sector state and camera; uncolonized worlds have non-interactive cosmetic maps with a CTA into the spacecraft designer.
- Distant rover expeditions discover 3×3 tile clusters on arrival. Near-building hidden tiles can be scanned for free. Construction still requires adjacency, suitable terrain, and local resources.
- Expanded Python validation and tile-neighbor checks to 32×32; old 5×5 saves migrate while retaining structures and old rover destinations. Increased bounded request body size to accommodate large JSON campaigns.
- Preserved original Mars Classic V1 and Campaign V2 flight/cargo/turn/science mechanics. Shipyard, logistics and research remain functional as overlays. AURA onboarding still opens on load.

## Files touched

- `ares/campaign.py`, `ares/campaign_data.py`, `ares/server.py`
- `web/campaign.js`, `web/index.html`, added `web/planet-map.js`, `web/map-ui.js`, `web/map-game.css`
- `tests/test_campaign.py`, `README.md`, `AGENTS.md`, `docs/PROJECT.md`, `docs/STATUS.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, this entry

## Verification

- `python3 -m unittest discover -s tests -q`: 38 tests passed.
- `node --check` on all three modified/new JS modules: passed.
- Managed local browser QA: AURA intro, map-first Mars UI, Europa terrain, map click → timed rover expedition with ETA, whole-map overview, Europa landing planner overlay. Preview stopped after checks.

## Known gaps / next actions

- Test mobile/touch interactions on actual devices, tune game balance for the enlarged exploration grid, and enrich terrain art if desired.
- NASA/GMAT inputs have not been provided, so mission time/fuel/risk remain illustrative. No public Python deployment.
