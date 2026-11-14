# Ares: First Light — Python Interplanetary Command

An interactive, turn-based, **Python-powered web strategy game** for a two-person NASA Space Apps team. Design spacecraft, plan missions, establish outposts, survive environmental challenges, and create a connected supply network across **Mars, Venus, Mercury, and Europa** (Jupiter's moon).

## Run

Requires **Python 3.10+**. No pip installation, API keys, database, or Node.js required to play.

```bash
python3 -m ares.server
```

Open **http://127.0.0.1:8000**. Keep the terminal open. Change port with `--port 8080`. The HTML file cannot be opened directly because Python operates the game rules.

- `/` — **Map-first Interplanetary Campaign V3 UI** (same Python Campaign V2 simulation)
- `/classic.html` — preserved **Classic Mars V1** (10-Sol survival game)

## Campaign controls

1. **AURA briefing:** On every page load, the offline mission assistant explains the loop. It also offers help topics throughout play.
2. **Mission Designer:** Choose departure hub, target world, surface/orbital/science mission, landing site, ship hull, engine, trajectory, and modular payload. Python calculates *estimated* mass, materials, fuel, travel turns, cost, and risk before launch.
3. **Planetary maps:** Mars, Venus, Mercury, and Europa each have a huge **32×32 (1,024-sector) isometric map**. Each established surface hub gets a separate playable map for its landing site. Drag to pan, wheel to zoom, use the minimap to recenter, and choose another planet from the left rail. Before landing, see a cosmetic planetary preview and open the Shipyard to establish a new base. Click unexplored tiles near facilities for **instant free scans**; distant tiles send a time-delayed rover revealing a 3×3 area. Choose a facility in the bottom build bar and click a revealed adjacent tile to construct it. Other hubs can be selected from the site chips.
4. **Logistics:** Dispatch real cargo between any two established hubs. The source loses resources immediately; the destination gains them **after the vessel/convoy arrives**. The first delivery establishes a reusable route. Surface and orbital hubs are separate inventories; no teleportation.
5. **Research:** Spend science and credits on a branching technology tree. **Advance Turn** runs facility production, consumption, ship arrivals, expedition results, cargo delivery, research, and hazards.
6. **Expand:** Multiple surface sites and an orbital hub can coexist per world. Reach Venus, Mercury, and Europa to earn the System Pathfinder milestone.

**There are no action points in the interplanetary campaign.** Orders are limited by available assets, resources, valid sites, active rovers, and the time required for travel or construction. The classic Mars mode retains its separate two-actions-per-Sol rules.

## Design boundaries

Spacecraft trajectories, hazards, yields, risk percentages, and transit durations are **illustrative game values**, **not** orbital calculations or NASA measurements. The team intends to provide **GMAT inputs later**. AURA is an authored state-aware offline guide, **not** a live language model. No NASA endorsement or public Python deployment is claimed. Browser saves use local storage; they are not accounts or secure multiplayer records.

## Tests

```bash
python3 -m unittest discover -s tests -v
python3 -m compileall -q ares
node --check web/campaign.js  # optional Node syntax check
node --check web/planet-map.js
node --check web/map-ui.js
```

## Code map

| Path | Responsibility |
| --- | --- |
| `ares/campaign.py`, `ares/campaign_data.py` | Authoritative V2 rules and editable game catalogs |
| `web/index.html`, `web/campaign.js`, `web/campaign.css` | Campaign interface, mission designer, and local saves |
| `web/map-ui.js`, `web/map-game.css`, `web/planet-map.js` | Map-first in-game HUD, presentation, and draggable/zoomable isometric canvas |
| `ares/engine.py`, `ares/rules.py` | Preserved classic Mars V1 rules |
| `web/classic.html`, `web/app.js`, `web/bridge.js` | Preserved V1 browser game and Python bridge |
| `web/engine-view.js`, `web/art.js`, `web/styles.css`, `web/science.js` | Legacy V1 read-only projections, art, theme, education |
| `ares/server.py` | Python HTTP server, static assets, distinct versioned game APIs |
| `tests/` | Campaign, classic, JavaScript parity, and live HTTP tests |
| `AGENTS.md`, `CLAUDE.md`, `docs/` | Cross-assistant **living guidebook** and change records |

## Team handoff

Start a fresh ChatGPT or Claude coding chat with: **“Read `AGENTS.md` and `docs/START_HERE.md` before editing. Implement my task in Campaign V2 unless I explicitly say Classic. Run tests, update `docs/STATUS.md`, and add a dated `docs/changes/` entry.”**

The guidebook explains what is implemented, what is provisional, and why each major design decision was made. See `docs/PROMPTS.md` for copyable prompts.
