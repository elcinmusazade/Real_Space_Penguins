# Ares: First Light — Python Edition

A complete, locally playable turn-based Mars exploration and colony-survival **web game**, built for a two-person NASA Space Apps team. Python controls all game-state changes; a browser supplies the illustrated interactive interface.

## Run the game

Requires **Python 3.10 or newer**. No package installation, API key, database, or Node.js is required to play.

From this folder:

```bash
python3 -m ares.server
```

Open **http://127.0.0.1:8000** in a browser. To choose a different port, run `python3 -m ares.server --port 8080`. Keep the terminal open while playing; press Ctrl+C to stop the server. Do **not** open `web/index.html` directly—the game needs the Python API.

## Play

1. Open **Fault lab** and design your relay orbiter's onboard fault-protection rules; run the fault tests.
2. Back in mission control, pick a 2028 launch date and propellant load, and choose your crew cargo. **Launch** shows whether the orbiter reached Mars orbit (decided in Python from NASA GMAT data); only a successful orbiter lets the crew land.
3. Click an unexplored frontier tile to reveal its terrain instantly.
4. Select a building, then click a valid revealed adjacent tile to construct it. New buildings activate the following Sol.
5. Spend up to **two actions per Sol** on scanning, building, studying, upgrading, or other available choices.
6. Use **End Sol** to run production and crew consumption. Resolve mission events and survive through Sol 10 while gathering **70 science**.

The 6×6 Mars sector, energy/oxygen/water/food/materials, weather, research, and events are governed by a repeatable seeded simulation. Game values are **educational simplifications**, not NASA operational calculations. The terrain is illustrative, not a downloaded NASA landing-site map.

The browser automatically stores progress in its local storage. No account or cloud save is provided. Seeds let you replay the same starting terrain.

## Tests

```bash
python3 -m unittest discover -s tests -v
```

The tests exercise the Python engine, complete ten-Sol missions, save validation, and live HTTP endpoints. A JavaScript/Python compatibility test runs additionally when Node.js is installed; it is optional.

## Project map

| Path | Purpose |
| --- | --- |
| `ares/engine.py` | **Authoritative Python game rules and state transitions** |
| `ares/rules.py` | Game constants, terrain, buildings, cargo, events, research |
| `ares/server.py` | Dependency-free HTTP server and JSON action API |
| `web/app.js` | Browser screens, actions, event dialogs, local saves |
| `web/bridge.js` | Sends **every state-changing command** to Python |
| `web/engine-view.js` | Legacy JS read-only view helpers; **do not call its mutating functions** |
| `web/art.js`, `web/styles.css` | Original illustrated interface and styles |
| `web/science.js` | Educational notes, sources, and disclaimers |
| `tests/` | Automated regression and server checks |
| `AGENTS.md`, `CLAUDE.md`, `docs/` | **Living cross-agent guidebook** and change history |

## Working with ChatGPT and Claude

Start a new coding chat with: “Read `AGENTS.md` and `docs/START_HERE.md` before editing anything.” Both assistants must update `docs/STATUS.md` and add a new dated file in `docs/changes/` after any meaningful modification, recording the actual changes, reasoning, checks, and limitations. See `docs/PROMPTS.md` for copyable handoff prompts.

This Python edition is a separate project. It does **not** modify or replace the existing JavaScript edition. Python requires a Python-capable host for public deployment; a static-only site host cannot run `ares.server`. No public deployment of this edition is claimed.
# Real_Space_Penguins
