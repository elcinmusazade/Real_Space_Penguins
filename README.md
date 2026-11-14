# Ares: First Light — Python Interplanetary Command

An interactive, turn-based, **Python-powered web strategy game** for a two-person NASA Space Apps team. Design spacecraft, plan missions, establish outposts, survive environmental challenges, and create a connected supply network across **all eight planets and Europa** (Jupiter's moon).

## Run

Requires **Python 3.9+** (tested on 3.9.6). No pip installation, API keys, database, or Node.js required to play.

```bash
python3 -m ares.server
```

Open **http://127.0.0.1:8000**. Keep the terminal open. Change port with `--port 8080`. The HTML file cannot be opened directly because Python operates the game rules.

- `/` — **Map-first Interplanetary Campaign V3 UI** (same Python Campaign V2 simulation)
- `/classic.html` — preserved **Classic Mars V1** (10-Sol survival game)

Existing saves retain their hubs and progress. To use the Mars-only beginning with no Earth hub, select **↻ New campaign → Start on Mars**; this replaces the current save.

## Campaign controls

1. **Start on Mars:** New campaigns begin at Mars HQ with a playable command hub, starting supplies, mission funding and fuel production. There is no Earth hub. The Mars map opens directly, and the Ares home button returns there. Explore and build locally; open AURA with the ✺ button whenever you want guidance. The intro and mission designer do not open automatically.
2. **Mission Designer:** Open Shipyard when you are ready, then choose departure hub, target world, surface/orbital/science mission, landing site, ship hull, engine, trajectory, and modular payload. Python calculates *estimated* mass, materials, fuel, travel turns, cost, and risk before launch.
3. **Planetary maps:** All eight planets and Europa each have a huge **96×96 (9,216-sector) isometric map**. Each established surface hub gets a separate playable map for its landing site. Drag to pan, wheel to zoom, choose Overview to fit the full region, use the minimap and its viewport outline to recenter, and open **Solar System** at the upper left to switch worlds. The collapsible navigator has selectable planets, drag/scroll navigation, zoom and fit controls, hub details, and active mission/cargo routes. Planet images orbit a centered Sun, and Europa orbits Jupiter; their surfaces, the Sun and stars also animate. **Pause / Play** controls motion, with automatic reduced-motion and hidden-tab support. Hover over a planet or focus it with the keyboard to hold it for selection. Choose **Open Surface Map** or **Plan Landing Mission** from the selected world; close with ×, Escape, or the backdrop. Europa appears beside Jupiter. Jupiter, Saturn, Uranus and Neptune offer **Preview Cloud Map** and **Plan Platform Mission**; their robotic floating platforms are fictional game technology, not solid-surface colonies. Earth and other worlds without an established surface hub show only a remote preview until a lander arrives. Previewing a world does not unlock its controls. A surface hub is created when a lander successfully arrives; browsing the map creates nothing. Open the Shipyard to establish a new base. Select a sector to inspect it. **Scan Sector** is free and instant near an online facility; **Start Regional Survey** uses energy to reveal a 3×3 area in 1–3 turns. Choose a facility in the bottom bar, select a surveyed connected site, review its cost/output, then choose **Build Here**. Other hubs can be selected from the site chips. Mars HQ starts with a command center and solar array and supplies the programme budget, materials and fuel each turn. A landed Earth base supports scans, construction and production with its own outpost stockpile; shipments can supply it from Mars. Existing 32×32 and 5×5 saves expand around their original center on load, preserving buildings, discoveries and pending surveys.
4. **Logistics:** Dispatch real cargo between any two established hubs. The source loses resources immediately; the destination gains them **after the vessel/convoy arrives**. The first delivery establishes a reusable route. Surface and orbital hubs are separate inventories; no teleportation.
5. **Research:** Open **Tech Tree** for 16 connected technologies across Exploration, Flight, Industry and Habitation. Select a node to highlight its prerequisite path and inspect exact costs, requirements, benefits and future unlocks. Use zoom/Fit and scroll to explore; **Start Research** pays once for one active project. Advanced tiers require online labs, discoveries or a completed Mars mission (starting on Mars alone does not satisfy this requirement). **Advance Turn** runs facility production, consumption, ship arrivals, survey results, cargo delivery, research, and hazards.
6. **Raise the stakes (Campaign rules V3):** each turn is three months starting July 2028. Launch windows follow the real planets; every Earth launch must pass the launch-direction, launch-mass and delta-v checks or it is scrubbed, stranded in Earth orbit, or flies past its target. Write **flight software** (SOFTWARE tab) that must survive each destination's approach faults, and **standing orders** that react to forecast storms at every base. Buildings wear out, crews can die and bases can be lost (and reopened by a new landing). The **PROGRAMME** tab shows goals, hazard forecasts, mission debriefs, and yearly reviews that raise or cut your budget.
7. **Expand:** Multiple surface sites and an orbital hub can coexist per world. Reach Venus, Mercury, and Europa to earn the System Pathfinder milestone.

**Outer-planet platforms:** Preview their 96×96 regions from Solar System immediately. To operate a base, research **Deep-Space Engineering**, launch a lander/freighter carrying a **Survey Station + Environmental Shield**, and wait for arrival. Platforms support surveys, connected construction, local stockpiles, hazards and delayed shipments. A platform core produces 6 energy/turn; sunlight is weak. Cloud Condensers gather surveyed condensate, Atmospheric Refineries provide materials, and additional power/supply planning sustains larger facilities. These are fictional game systems. Existing saves can use them after restarting Python and refreshing; no reset is needed.

**Living landscapes:** Earth has seas, coasts, rivers/lakes, forests, fertile plains and mountains. Mars has dunes, dry basins, frost and mesas; Venus basalt/sulfur plains and volcanic fissures; Mercury crater floors/rims and shadowed depressions; Europa ice sheets, ridges and fissures. Jupiter has amber/cream cloud belts and red vortices; Saturn golden clouds, ring shadows and polar jets; Uranus cyan clouds, cold haze and shear; Neptune blue clouds, bright plumes and dark vortices. Subtle water, foliage and atmospheric motion has a pause control and respects reduced motion. Terrain is fictional, seeded game geography. Orbital imagery reveals geography; surveys uncover deposits and anomalies.

**Research matters:** Early projects improve solar power, materials output, survey speed, cargo efficiency and hazard protection. Later projects expand surveys to 5×5, reduce construction costs/time, improve food/water/oxygen/science production, and unlock electric/cryogenic engines, heavy spacecraft, Europa landings, outer-planet platforms and Fission Reactors. Basic Earth and Mars missions need no research. Build labs at Mars HQ to fund progression; the tree shows missing requirements and links to lab construction. Existing saves keep completed research and paid projects; restart Python and refresh to load the new tree, without starting over. All research bonuses are game-balancing values.

**Terrain and supply chains:** Water plants extract ice or draw from adjacent Earth water (12 water for 6 energy on a coast). Fertile soil boosts food; rich geology boosts drill output; high ground improves solar output but costs more to prepare. Open water and unstable ground block building. The new oxygen plant turns 2 water + 4 energy into 6 oxygen per turn. Water production runs before oxygen and food, so location and shared local resources matter. Earth landings are planned in Shipyard: choose an origin, Earth and a landing site, review costs/checks, launch, then advance until arrival. A flyby or remote survey does not create a surface base. Mars-to-Earth transfers and Earth entry/capture are game estimates; launches back from Earth use the existing GMAT-derived departure table. Older saves migrate their buildings, stocks, surveys and mission payloads automatically; campaign rovers are removed.

**There are no action points in the interplanetary campaign.** Orders are limited by available assets, resources, valid sites, one regional survey per hub, and the time required for travel or construction. The classic Mars mode retains its separate two-actions-per-Sol rules.

## Design boundaries

**Earth launches to Mars, Venus, Mercury and Europa use NASA GMAT data**: launch dates, launch energy (C3), departure direction and arrival speed come from GMAT's bundled DE421 planetary ephemeris, and the Atlas V 401 limits from GMAT's launch-vehicle library, solved offline as Sun-only two-body transfers (`tools/build_campaign_windows.py`). Outer-planet routes (including Earth launches), floating platforms, off-Earth departures, gravity-assist routes, the larger rocket classes, capture orbits, hazards and yields are **labelled game estimates**, not NASA measurements. AURA is an authored state-aware offline guide, **not** a live language model. No NASA endorsement or public Python deployment is claimed. Campaign saves use browser IndexedDB with automatic migration from older localStorage saves; Classic keeps its existing localStorage save. Saves are not accounts or secure multiplayer records.

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
| `web/solar-system.js`, `web/solar-system.css` | Collapsible solar navigation, schematic orbits, hub/traffic details and pan/zoom |
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
