# Ares: First Light — Python Interplanetary Command

An interactive, turn-based, **Python-powered web strategy game** for a two-person NASA Space Apps team. Design spacecraft, plan missions, establish outposts, survive environmental challenges, and create a connected supply network across **Mars, Venus, Mercury, and Europa** (Jupiter's moon).

## Run

Requires **Python 3.10+**. No pip installation, API keys, database, or Node.js required to play.

```bash
python3 -m ares.server
```

Open **http://127.0.0.1:8000**. Keep the terminal open. Change port with `--port 8080`. The HTML file cannot be opened directly because Python operates the game rules.

- `/` — **Interplanetary Campaign V2** (default, new game)
- `/classic.html` — preserved **Classic Mars V1** (10-Sol survival game)

## Campaign controls

1. **AURA briefing:** On every page load, the offline mission assistant explains the loop. It also offers help topics throughout play.
2. **Mission Designer:** Choose departure hub, target world, surface/orbital/science mission, landing site, ship hull, engine, trajectory, and modular payload. Python calculates *estimated* mass, materials, fuel, travel turns, cost, and risk before launch.
3. **Planetary Hubs:** Every hub has its own 5×5 fogged map and local resource inventory. Click adjacent hidden sectors for instant **free scans**; distant sectors use a rover expedition, energy/fuel, and transit time. Choose and place buildings on revealed connected sectors; construction costs materials and takes turns. Manage Mars crew assignments.
4. **Logistics:** Dispatch real cargo between any two established hubs. The source loses resources immediately; the destination gains them **after the vessel/convoy arrives**. The first delivery establishes a reusable route. Surface and orbital hubs are separate inventories; no teleportation.
5. **Research:** Spend science and credits on a branching technology tree. **Advance Turn** runs facility production, consumption, ship arrivals, expedition results, cargo delivery, research, and hazards.
6. **Expand:** Multiple surface sites and an orbital hub can coexist per world. Reach Venus, Mercury, and Europa to earn the System Pathfinder milestone.

**There are no action points in Campaign V2.** Orders are limited by available assets, resources, valid sites, active rovers, and the time required for travel or construction. The classic Mars mode retains its separate two-actions-per-Sol rules.

## Design boundaries

Spacecraft trajectories, hazards, yields, risk percentages, and transit durations are **illustrative game values**, **not** orbital calculations or NASA measurements. The team intends to provide **GMAT inputs later**. AURA is an authored state-aware offline guide, **not** a live language model. No NASA endorsement or public Python deployment is claimed. Browser saves use local storage; they are not accounts or secure multiplayer records.

## Tests

```bash
python3 -m unittest discover -s tests -v
python3 -m compileall -q ares
node --check web/campaign.js  # optional Node syntax check
```

## Code map

| Path | Responsibility |
| --- | --- |
| `ares/campaign.py`, `ares/campaign_data.py` | Authoritative V2 rules and editable game catalogs |
| `web/index.html`, `web/campaign.js`, `web/campaign.css` | V2 responsive web interface and local saves |
| `ares/engine.py`, `ares/rules.py` | Preserved classic Mars V1 rules |
| `web/classic.html`, `web/app.js`, `web/bridge.js` | Preserved V1 browser game and Python bridge |
| `web/engine-view.js`, `web/art.js`, `web/styles.css`, `web/science.js` | Legacy V1 read-only projections, art, theme, education |
| `ares/server.py` | Python HTTP server, static assets, distinct versioned game APIs |
| `tests/` | Campaign, classic, JavaScript parity, and live HTTP tests |
| `AGENTS.md`, `CLAUDE.md`, `docs/` | Cross-assistant **living guidebook** and change records |

## Team handoff

Start a fresh ChatGPT or Claude coding chat with: **“Read `AGENTS.md` and `docs/START_HERE.md` before editing. Implement my task in Campaign V2 unless I explicitly say Classic. Run tests, update `docs/STATUS.md`, and add a dated `docs/changes/` entry.”**

The guidebook explains what is implemented, what is provisional, and why each major design decision was made. See `docs/PROMPTS.md` for copyable prompts.
