# Python edition — dual-mode architecture

## Runtime

Python 3.10+, standard library only. `python3 -m ares.server` starts a local `ThreadingHTTPServer` (default `127.0.0.1:8000`) serving **Campaign V2 at `/`** and **Classic Mars V1 at `/classic.html`** with separate JSON APIs. No pip install, database, external model, or NASA API connection is required. `package.json` exists solely for optional preview; **Node is not a runtime requirement**.

| Path | Responsibility |
| --- | --- |
| `ares/campaign_data.py` | V2 worlds, transfer estimates, ship hulls, engines, payloads, buildings, technologies |
| `ares/campaign.py` | **Authoritative V2 simulation**: modular missions, hubs, AP-free scans and construction, shipments, turns, events, research |
| `web/index.html`, `web/campaign.js`, `web/campaign.css` | Campaign navigation, ship design, logistics, research, AURA, browser autosave |
| `web/map-ui.js`, `web/map-game.css` | Game-screen HUD and map-first styling; shipyard/research/logistics remain optional in-game panels |
| `web/planet-map.js` | Isometric Canvas2D rendering, drag pan, zoom, minimap, selection, cosmetic planet-specific terrain, and building art. No game state mutation |
| `ares/rules.py` | Classic V1 definitions for buildings, cargo, crops, research, events, and terrain |
| `ares/engine.py` | **Authoritative Classic V1 simulation**: new games, legal actions, Sol resolution, forecasts, saves |
| `ares/server.py` | Serves `web/` files; accepts structured JSON game commands |
| `web/classic.html`, `web/styles.css`, `web/art.js` | Classic presentation, responsive layout, SVG art |
| `web/app.js` | Classic interaction controller, panels, dialogs, browser-local autosave |
| `web/bridge.js` | **All mutating browser actions go through this adapter to Python** |
| `web/engine-view.js` | Read-only UI projections from the prior edition: tile display, building validation highlights, forecasts, labels |
| `web/science.js` | Field-guide education and source citations; no live NASA feed |
| `tests/test_campaign.py`, `tests/test_engine.py`, `tests/test_server.py` | V2 rules, Classic V1 regression, cross-runtime parity, and HTTP behavior |

## API contract

- `GET /` — loads Campaign V2; `GET /classic.html` loads Classic V1. Other static files use a strict allowlist.
- `GET /api/health` — reports that the Python server is running.
- `GET /api/campaign/catalog` — returns the V2 ship/mission/planet/building/research catalog, `mapSize: 32`, and game-estimate caveat.
- `POST /api/campaign/new` with `{ "seed": "HORIZON-01" }` — creates an interplanetary campaign.
- `POST /api/campaign/quote` with `{ "state": {...}, "design": {...} }` — quotes/validates a configured ship and destination.
- `POST /api/campaign/action` with `{ "state": {...}, "action": "launch", "args": {"design": {...}} }` — returns an updated V2 state. Other actions: `shipment`, `explore`, `construct`, `assignCrew`, `research`, `eventChoice`, `advance`.
- `POST /api/campaign/validate` with `{ "state": {...} }` — checks a V2 save envelope.

Classic endpoints (unchanged):

- `POST /api/new` with `{ "seed": "ARES-01", "loadout": [...] }` — returns `{ "ok": true, "state": {...} }`.
- `POST /api/action` with `{ "state": {...}, "action": "explore", "args": [12] }` — validates the prior state and executes one Python rule, returning `{ "ok": true, "state": {...}, "message": "..." }` or a failure.
- `POST /api/validate` with `{ "state": {...} }` — checks a saved game.

Both APIs are stateless: the client submits its current JSON state for each action; Python validates its envelope and returns a new state. V2 uses `ares.first-light.campaign.v2` for browser saves, separate from Classic V1. **Do not expose this development server as a secure multiplayer or authoritative online competitive service**; client-supplied state is not cryptographically trusted. The development server deliberately binds loopback by default.

## V2 mechanics boundary

`web/campaign.js` never directly changes authoritative campaign state; its local variables are **UI draft controls** (ship configuration, chosen hub/tile, freight draft, active tab). Python `ares/campaign.py` owns valid actions, economic costs, ship arrivals, settlement generation, hazards, and resource quantities. Each hub has its own inventory. A shipment deducts origin cargo/fuel immediately and credits globally; destination stock and persistent route update **only on arrival**. Every surface hub owns an independent **32×32 map**. Free near-facility scans reveal immediately; farther rover expeditions cost resources and reveal up to nine tiles on arrival. The canvas depicts unrevealed land using non-authoritative cosmetic features; it never leaks the Python terrain type before discovery. Every site has its own camera remembered during play. Building orders cost resources and activate after the specified number of turns. No AP gate exists in V2. Existing 5×5 Campaign V2 JSON saves are migrated to 32×32 by the Python validator. Classic V1 6×6 maps are unaffected.

The catalog `ares/campaign_data.py` contains **illustrative** transfer durations/fuel factors until GMAT evidence is supplied. Keep unit conversion, trajectory provenance, and uncertainty explicit when replacing them. AURA is state-aware authored text in the UI, not model-generated dialogue.

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

