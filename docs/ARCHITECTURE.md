# Python edition — dual-mode architecture

## Runtime

Python 3.9+, standard library only. `python3 -m ares.server` starts a local `ThreadingHTTPServer` (default `127.0.0.1:8000`) serving **Campaign V2 at `/`** and **Classic Mars V1 at `/classic.html`** with separate JSON APIs. No pip install, database, external model, or NASA API connection is required. `package.json` exists solely for optional preview; **Node is not a runtime requirement**.

| Path | Responsibility |
| --- | --- |
| `ares/campaign_data.py` | V2 worlds, transfer estimates, ship hulls, engines, payloads, buildings, technologies |
| `ares/campaign.py` | **Authoritative campaign simulation (rules V3)**: modular missions, launch outcomes, arrivals decided by flight software, hubs, AP-free scans and construction, shipments, forecast hazards, standing orders, wear/repair, base loss and rescue, programme reviews and goals, research. Migrates V2 saves |
| `ares/flight.py` | Launch windows per turn, rocket capacity, capture/landing delta-v, launch checks (scrub / stranded / flyby / go) |
| `ares/data/campaign_windows.json` | Offline table built by `tools/build_campaign_windows.py` (+ `tools/gmat_spk.py`) from NASA GMAT's DE421 ephemeris and Atlas V 401 polynomial: 80 turns x 4 destinations x 3 options, arcs, light-times |
| `ares/faults.py`, `ares/fault_data.py` | Player flight-software validator and deterministic fault simulator (12 steps, four approach scenarios, per-mission intensity) |
| `ares/orders.py` | Base standing-order validator and evaluator |
| `web/index.html`, `web/campaign.js`, `web/campaign.css` | Campaign navigation, ship design, logistics, research, AURA, browser autosave |
| `web/rule-editor.js`, `web/program-ui.js`, `web/flight-view.js`, `web/program.css` | Rule editor, SOFTWARE and PROGRAMME screens, first-mission guide, launch/arrival animations. View-only |
| `web/map-ui.js`, `web/map-game.css` | Game-screen HUD and map-first styling; shipyard/research/logistics remain optional in-game panels |
| `web/solar-system.js`, `web/solar-system.css` | View-only solar-system dialog, schematic SVG planets/orbits, current hub and in-flight traffic details, pan/zoom; campaign.js owns navigation and keyboard/focus handling |
| `web/planet-map.js` | Isometric Canvas2D rendering, drag pan, zoom, minimap, selection, Python-supplied biomes/elevation, ambient motion, and building art. No game state mutation |
| `ares/surface.py` | Seeded natural regions, elevation, biome metadata, coastal access and shared nominal production rules |
| `ares/rules.py` | Classic V1 definitions for buildings, cargo, crops, research, events, and terrain |
| `ares/engine.py` | **Authoritative Classic V1 simulation**: new games, legal actions, Sol resolution, forecasts, saves |
| `ares/server.py` | Serves `web/` files; accepts structured JSON game commands |
| `web/classic.html`, `web/styles.css`, `web/art.js` | Classic presentation, responsive layout, SVG art |
| `web/app.js` | Classic interaction controller, panels, dialogs, browser-local autosave |
| `web/bridge.js` | **All mutating browser actions go through this adapter to Python** |
| `web/engine-view.js` | Read-only UI projections from the prior edition: tile display, building validation highlights, forecasts, labels |
| `web/science.js` | Field-guide education and source citations; no live NASA feed |
| `tests/test_campaign.py`, `tests/test_flight.py`, `tests/test_faults.py`, `tests/test_balance.py`, `tests/test_engine.py`, `tests/test_server.py` | Campaign rules, GMAT table and rocket checks (recompute test runs when `GMAT/` is present), fault simulator, automated careful-vs-careless playthroughs, Classic V1 regression, HTTP behavior |

## API contract

- `GET /` — loads Campaign V2; `GET /classic.html` loads Classic V1. Other static files use a strict allowlist.
- `GET /api/health` — reports that the Python server is running.
- `GET /api/campaign/catalog` — returns the ship/mission/planet/building/research catalog, `mapSize: 32`, rockets, physics constants, fault and standing-order menus, goals, hazards, orbit tracks and per-turn light times.
- `POST /api/campaign/faults/test` with `{ "design": {"computer": ..., "rules": [...]} }` — lab-tests flight software against all four approach scenarios (and a no-rules baseline).
- `POST /api/campaign/new` with `{ "seed": "HORIZON-01" }` — creates an interplanetary campaign.
- `POST /api/campaign/inspect` with `{ "state": {...}, "hub": "H1", "tile": 529 }` — read-only survey/build costs, availability/reasons, nominal facility inputs/outputs and site bonuses, using the same helpers as execution.
- `POST /api/campaign/quote` with `{ "state": {...}, "design": {...} }` — quotes/validates a configured ship and destination.
- `POST /api/campaign/action` with `{ "state": {...}, "action": "launch", "args": {"design": {...}} }` — returns an updated V2 state. Launch takes `confirm: true` to fly a plan that fails a check. Other actions: `shipment`, `explore`, `construct`, `assignCrew`, `research`, `eventChoice` (V2 saves only), `advance`, `setSoftware`, `setOrders`, `prepare`, `repair`.
- `POST /api/campaign/validate` with `{ "state": {...} }` — checks a V2 save envelope.

Classic endpoints (unchanged):

- `POST /api/new` with `{ "seed": "ARES-01", "loadout": [...] }` — returns `{ "ok": true, "state": {...} }`.
- `POST /api/action` with `{ "state": {...}, "action": "explore", "args": [12] }` — validates the prior state and executes one Python rule, returning `{ "ok": true, "state": {...}, "message": "..." }` or a failure.
- `POST /api/validate` with `{ "state": {...} }` — checks a saved game.

Both APIs are stateless: the client submits its current JSON state for each action; Python validates its envelope and returns a new state. V2 uses `ares.first-light.campaign.v2` for browser saves, separate from Classic V1. **Do not expose this development server as a secure multiplayer or authoritative online competitive service**; client-supplied state is not cryptographically trusted. The development server deliberately binds loopback by default.

## V2 mechanics boundary

`web/campaign.js` never directly changes authoritative campaign state; its local variables are **UI draft controls** (ship configuration, chosen hub/tile, freight draft, active tab). Python `ares/campaign.py` owns valid actions, economic costs, ship arrivals, settlement generation, hazards, and resource quantities. Each hub has its own inventory. A shipment deducts origin cargo/fuel immediately and credits globally; destination stock and persistent route update **only on arrival**. Every surface hub owns an independent **32×32 map**. Free near-facility scans reveal immediately; regional surveys cost energy and reveal up to nine tiles after 1–3 turns. Remote Sensing reduces that time by one turn (minimum one). One regional survey runs per hub; nearby scans remain available while it runs. The canvas displays seeded `biome` and `elevation` fields from Python as orbital imagery. The separate `terrain` field remains null until discovery, so deposits and anomalies stay hidden. `ares/surface.py` caches immutable landscapes by seed/world/site and copies metadata into independent saved tiles. Every site has its own camera remembered during play. Building orders cost resources and activate after the specified number of turns. No AP gate exists in V2. Existing 5×5 Campaign V2 JSON saves are migrated to 32×32 by the Python validator. Classic V1 6×6 maps are unaffected. Earth retains `kind: control` and its hub ID for launch, income, and cargo compatibility, but `_has_surface` gives it the same 32×32 terrain, exploration, construction, repair, and production rules. Empty Earth HQ maps in V2/V3 saves migrate on a deep copy, adding starter tiles without resetting progress. The browser selects playable hubs by their nonempty tile arrays. Earth pays building upkeep and allows greenhouses; it retains permanent command availability, without off-world hazard forecasts or crew survival.

**Campaign rules V3.** One turn is 90 days from 2028-07-01. Earth launches read the turn's row of `campaign_windows.json`: `efficient` (lowest total delta-v), `balanced` (lowest delta-v within ±28.5° declination) or `fast`; `assist` (Mercury/Europa) leaves on that turn's Venus transfer, then uses game-estimate flyby timing. Launch mass = hull dry + engine + payload + flight computer + propellant (1 fuel unit = 25 kg) and must fit the rocket's capacity at that C3; propellant gives delta-v by the rocket equation; Mars/Venus landers enter directly, Mercury/Europa need capture first. At arrival the mission's saved flight software runs the destination scenario at a seeded 85-125% intensity: lost / degraded (module lost, damaged base, off-target landing, half science) / nominal. Each turn, surface hubs evaluate standing orders, then any forecast hazard, production, upkeep (1 material per two buildings, else wear), and crew needs; crew health 0 loses the base, three unpowered turns darken an uncrewed one. Every 4 turns a review scores the year and moves the budget between 4 and 30 credits per turn. AURA is state-aware authored text in the UI, not model-generated dialogue.

Solar navigation keeps open/closed state, inspected body, route visibility, and camera position outside the campaign save. It uses existing map, mission-planning, and cargo actions. Background controls are inert while the dialog is open, focus stays in the dialog, and closing restores focus to its launcher. Sun/Jupiter/Saturn/Uranus/Neptune are inspectable landmarks, not new engine destinations; Europa remains a moon of Jupiter. Orbit paths and transit markers are schematic navigation graphics, not the GMAT trajectory renderer.

Solar chart motion uses a view-only `requestAnimationFrame` loop to move complete body groups along fitted schematic ellipses. `solarPositions` computes positions from elapsed visual time; Europa's orbit is relative to moving Jupiter. Labels and hit targets move with their bodies, and route curves/markers follow the endpoints while retaining their turn-based progress fraction. CSS separately animates surface textures and Sun/star/background effects. `campaign.js` retains a pause flag and visual time; `mountSolarSystem` restores phases across re-renders, pauses for hidden tabs/reduced motion/hover/keyboard focus, and cancels frames/listeners on destruction. No game timers, save fields or runtime dependencies are added. The optional Node regression in `tests/test_solar_navigation.py` checks actual SVG position updates and the motion lifecycle.

Living surface rendering shares corner heights between tiles, hides permanent grid outlines outside construction/selection, and picks sectors against their projected polygons. Atmosphere, water and foliage animation does not advance game time; Pause, reduced motion and hidden tabs freeze it. Arrow keys select sectors; drag, zoom, minimap and fit controls remain. Canvas listeners and frames are cleaned up on remount. Selecting a sector only inspects it; explicit **Scan Sector / Start Regional Survey / Build Here** buttons spend resources. The controller discards stale inspection replies when selection or authoritative state changes.

Surface construction uses biome preparation costs and rejects open water, lava/ice fissures and discovered hazards. Water plants accept discovered ice or dry land beside Earth water. Nominal production comes from `surface.production` for both the inspector and the turn engine. Solar generation runs first, followed by water, oxygen, food, heat, habitat/shield support, mining and research; tile ID breaks ties. Each facility requires all its inputs or stays idle without partial spending. Existing condition, weather, orders, upkeep, crew consumption and stock caps still apply. UI rates are explicitly full-condition rates before weather/orders/shortages.

Old `expeditions` and hub `roverBusyUntil` fields migrate to `surveys` and `surveyUntil`; rover counts are removed. The `rover` payload becomes `survey` (same mass/cost), and `robotics` becomes `surveying`, preserving purchased/research-in-progress records and mission arrival dates. Missing geography is added without changing old revealed deposits or buildings; an old building that would otherwise be on blocked geography gets a safe landing plain. Migration is idempotent and does not mutate caller saves. Classic rover fields remain independent.

## Classic V1 compatibility boundary

The interface was ported from the original JavaScript edition. `web/engine-view.js` remains the old engine for synchronous, **read-only** calculations used by UI views (including construction previews and forecast displays). It still contains old mutation functions as legacy source, but `web/bridge.js` overrides the exported names of all state-changing actions. The UI imports `bridge.js`, never the old engine directly. If you adjust operating rules in Python, update the read-only JS projections or migrate those projections into Python API responses. No JavaScript mutation fallback is permitted when Python fails.

Python uses the original seeded map algorithm (FNV-1a + Mulberry32), compatible save shape, and equivalent resource-rounding semantics. Tests compare creation and a complete victorious mission against the original JS engine when Node is available.

## Classic V1 operating priority

The engine's one resource-allocation plan underlies production, forecasts, and end-of-Sol resolution:

1. Online solar arrays generate power.
2. Reserve habitat/crew needs first; water recovery depends on sufficient power, but crew consumption still occurs.
3. Optional producers run in order: **water extractors, oxygen recyclers, greenhouses, laboratories, shields, batteries**. Within each building type, lower tile IDs operate first.
4. A producer lacking its complete energy/water inputs is idle, with zero output and zero optional operating consumption.
5. After the Sol resolves, apply health consequences and storage caps. A just-built structure starts operating on the **next** Sol.

The priority is a transparent game rule, not an asserted NASA operating procedure.

## Development checks

```bash
python3 -m unittest discover -s tests -v
python3 -m compileall -q ares
python3 -m ares.server  # open http://127.0.0.1:8000
```

If Node.js is available, `node --check web/campaign.js`, `node --check web/app.js`, and `node --check web/bridge.js` are useful syntax checks, and Python's parity test exercises `web/engine-view.js`. Public hosting needs a process-capable Python host; the older static-only Site cannot host this server.
