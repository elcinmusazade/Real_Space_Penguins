# Ares: First Light — instructions for every coding assistant

This file is the standing workflow for **ChatGPT/Codex, Claude, and human teammates**. Treat it as repository-level project instructions. Read it before acting, even in a chat with zero memory.

## Begin every task

1. Read `README.md` and `docs/START_HERE.md`, `docs/PROJECT.md`, `docs/STATUS.md`, `docs/ARCHITECTURE.md`, and `docs/DECISIONS.md`.
2. Inspect the source and relevant tests; documentation can be stale. Check `git status` before editing and preserve another contributor's changes.
3. Confirm the smallest requested scope. Ideas in `docs/IDEAS.md` are proposals, not permission to implement.
4. If the task changes requirements or scientific assumptions, record the reasoning in `docs/DECISIONS.md`.

## Non-negotiable implementation boundaries

- **Python is authoritative.** `ares/engine.py` computes **all state changes**, turn resolution, science, resources, and events. `ares/rules.py` owns constants. `ares/server.py` exposes the API.
- The browser never mutates game state directly. `web/bridge.js` forwards each state-changing action to `/api/action`; `/api/new` creates missions.
- `web/engine-view.js` is a compatibility copy used **only for read-only labels, tile construction previews, and forecasts** while the existing browser artwork/UI is reused. Its exported mutation functions exist in the source but **must not be called or extended**. All state changes travel through `web/bridge.js` to Python. For gameplay changes, keep JS read-only projections consistent with Python, or deliberately replace them with Python-backed queries.
- Keep saves JSON-serializable, seeded maps deterministic, game mechanics internally consistent, and bad requests handled safely.
- Preserve the user's chosen turn-based 2-action/Sol hybrid, 6×6 fog-of-war colony map, **instant tile discovery**, building adjacency, and next-Sol construction activation unless the user explicitly changes the design.
- Don't represent fictional game coefficients, seeded terrain, or crop choices as real NASA measurements or recommendations. No live LLM, API key, external service, or paid integration is authorized by default.
- Do not overwrite, redeploy, or alter the older JavaScript Site from this Python repository without an explicit instruction.

## Finish every task

1. Run `python3 -m unittest discover -s tests -v`; add or update tests for engine changes. If the UI is affected, test in a browser as practical.
2. Update `docs/STATUS.md` with observed results, known limitations, and next actions. Record claims only when checked.
3. Add **one new uniquely named** `docs/changes/YYYY-MM-DD-short-description.md` for meaningful work. Document files changed, what/why, tests actually run, and what remains open. Do not rewrite old entries.
4. Update `docs/ARCHITECTURE.md`, `docs/PROJECT.md`, `docs/DATA_SOURCES.md`, `docs/IDEAS.md`, `docs/DECISIONS.md`, or `README.md` only when their content is affected.
5. In the handoff, mention the actual outcome, how to run it, and any unverified part. Do not claim deployment merely because local preview works.

## Collaboration

Prefer small focused commits and separate branches for parallel work. Never force-push over a teammate's work. Both ChatGPT and Claude use this same guidebook; commit code and documentation together. Use `docs/PROMPTS.md` for fresh-chat and teammate handoff prompts.
