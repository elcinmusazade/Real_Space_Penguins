# Python edition — architecture

## Runtime

Python 3.10+, standard library only. `python3 -m ares.server` starts a local `ThreadingHTTPServer` (default `127.0.0.1:8000`) serving a complete browser game plus JSON API. No pip install, database, external model, or NASA API connection is required. `package.json` exists solely to support optional managed preview commands; **Node is not a runtime requirement**.

| Path | Responsibility |
| --- | --- |
| `ares/rules.py` | Definitions for buildings, cargo, crops, research, events and terrain |
| `ares/engine.py` | **Authoritative deterministic Python simulation**: new games, legal actions, turn resolution, forecasts, saves |
| `ares/faults.py` | Fault Protection Lab: rule validation and deterministic orbiter fault simulation (constants in `rules.py`) |
| `web/faults.html`, `web/faults.js`, `web/faults.css` | Rule editor and test-report page; edits rules only and asks Python for results |
| `ares/server.py` | Serves `web/` files; accepts structured JSON game commands |
| `web/index.html`, `web/styles.css`, `web/art.js` | Presentation, responsive layout, SVG art |
| `web/app.js` | Main interaction controller, panels, dialog flow, browser-local autosave |
| `web/bridge.js` | **All mutating browser actions go through this adapter to Python** |
| `web/engine-view.js` | Read-only UI projections from the prior edition: tile display, building validation highlights, forecasts, labels |
| `web/science.js` | Field-guide education and source citations; no live NASA feed |
| `tests/test_engine.py`, `tests/test_server.py` | Rules, full missions, cross-runtime parity, and HTTP behavior |

## API contract

- `GET /` — loads the web game. Other static files are served from a strict allowlist.
- `GET /api/health` — reports that the Python server is running.
- `POST /api/new` with `{ "seed": "ARES-01", "loadout": [...] }` — returns `{ "ok": true, "state": {...} }`.
- `POST /api/action` with `{ "state": {...}, "action": "explore", "args": [12] }` — validates the prior state and executes one Python rule, returning `{ "ok": true, "state": {...}, "message": "..." }` or a failure.
- `POST /api/validate` with `{ "state": {...} }` — checks a saved game.
- `GET /api/faults/catalog` — sensors, responses, computers, and scenarios for the Fault Protection Lab editor.
- `POST /api/faults/test` with `{ "design": { "computer": "standard", "rules": [...] } }` — validates the rules (`ares/faults.py`) and returns per-scenario results plus a no-rules baseline. A bad design returns 400 with a readable error.

The API is stateless: the client submits its current JSON state for each action; Python validates it and returns a new state. Browser `localStorage` keeps saves locally. **Do not expose this development server as a secure multiplayer or authoritative online competitive service**; client-supplied state is not cryptographically trusted. The development server deliberately binds loopback by default.

## Frontend compatibility boundary

The interface was ported from the original JavaScript edition. `web/engine-view.js` remains the old engine for synchronous, **read-only** calculations used by UI views (including construction previews and forecast displays). It still contains old mutation functions as legacy source, but `web/bridge.js` overrides the exported names of all state-changing actions. The UI imports `bridge.js`, never the old engine directly. If you adjust operating rules in Python, update the read-only JS projections or migrate those projections into Python API responses. No JavaScript mutation fallback is permitted when Python fails.

Python uses the original seeded map algorithm (FNV-1a + Mulberry32), compatible save shape, and equivalent resource-rounding semantics. Tests compare creation and a complete victorious mission against the original JS engine when Node is available.

## Operating priority

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

If Node.js is available, `node --check web/app.js` and `node --check web/bridge.js` are useful extra syntax checks, and Python's parity test exercises `web/engine-view.js`. Public hosting needs a process-capable Python host; the older static-only Site cannot host this server.

