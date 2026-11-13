# Prompts for a new chat

## Orient without editing

> Read `AGENTS.md`, `docs/START_HERE.md`, `docs/PROJECT.md`, `docs/STATUS.md`, and `docs/ARCHITECTURE.md`, then inspect the actual game source and tests. Summarize what works, what remains uncertain, and the next smallest useful change. Do not edit files yet.

**Reminder:** This is the **Python edition**. The single authority for game rules is `ares/engine.py`, and all browser state changes must be routed through `web/bridge.js` to Python.

## Implement a scoped change

> Follow the repository guidebook. Implement **[one feature or fix]**, preserving the user's chosen turn-based, colony-map, fog-of-war, and instant-discovery mechanics. Inspect the engine/UI boundary first. Run relevant checks, update `docs/STATUS.md`, and add one unique `docs/changes/` entry with changed paths, rationale, observed tests, and remaining issues. Keep unrelated work intact.

When changing rules, update Python and any affected **read-only** UI projections in `web/engine-view.js`. Do not put game mutations into JavaScript. Run `python3 -m unittest discover -s tests -v`.

## Record an idea only

> Read `docs/PROJECT.md`, `docs/DECISIONS.md`, and `docs/IDEAS.md`. Assess **[idea]** for player value, NASA relevance, scope, and implementation cost. Add it to the idea bank as Proposed. Do not change game code or mark it as approved.

## Handoff to a teammate

> Check the current source, Git diff, and tests against the guidebook. Update stale documentation using only verified facts. Record any meaningful unlogged work, known bugs, and next actions. Do not invent test outcomes or overwrite a previous worklog.

