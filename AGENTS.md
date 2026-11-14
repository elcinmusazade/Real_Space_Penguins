# Ares: First Light — instructions for every coding assistant

This file is the standing workflow for **ChatGPT/Codex, Claude, and human teammates**. Treat it as repository-level project instructions. Read it before acting, even in a chat with zero memory.

## Begin every task

1. Read `README.md` and `docs/START_HERE.md`, `docs/PROJECT.md`, `docs/STATUS.md`, `docs/ARCHITECTURE.md`, and `docs/DECISIONS.md`.
2. Inspect the source and relevant tests; documentation can be stale. Check `git status` before editing and preserve another contributor's changes.
3. Confirm the smallest requested scope. Ideas in `docs/IDEAS.md` are proposals, not permission to implement.
4. If the task changes requirements or scientific assumptions, record the reasoning in `docs/DECISIONS.md`.

## Non-negotiable implementation boundaries

- **Python is authoritative in both modes.** The default **interplanetary campaign V2** uses `ares/campaign.py` and `ares/campaign_data.py`; the original **classic Mars V1** uses `ares/engine.py` and `ares/rules.py`. `ares/server.py` serves both separate APIs.
- The browser never changes authoritative game state directly. `web/campaign.js` submits V2 commands to `/api/campaign/action`, quotes to `/api/campaign/quote`, and reads catalog data from `/api/campaign/catalog`.
- Legacy V1 uses `web/app.js` and `web/bridge.js` to submit commands through `/api/action`. `web/engine-view.js` contains legacy **read-only UI projections**; do not call its mutating functions or extend them. Changes to one mode must not silently break the other.
- Keep saves JSON-serializable, seeded maps deterministic, game mechanics internally consistent, and bad requests handled safely.
- **Campaign confirmed design:** Turn-based strategy with **no action points**; free instant scans near buildings, longer rover expeditions revealing 3×3 areas; **32×32 maps at each surface hub**, with full-screen isometric canvas, pan/zoom, and each planet's own terrain; building connectivity/cost/time; modular spacecraft and mission/trajectory planning; Earth Mission Control; multiple surface hubs on a world; orbital stations; **separate hub stockpiles with delayed, paid ship/convoy shipments**; Mars, Venus, Mercury, and Europa. AURA's intro appears on load. Do not reintroduce AP.
- **V1 classic only:** Preserve its existing 2-action/Sol, 6×6 map, instant tile discovery, adjacency, and next-Sol construction behavior unless explicitly changing the classic mode.
- The trajectories in V2 are **game estimates**. The user plans to supply GMAT inputs; do not present the current fuel/time/risk model as validated orbital mechanics. Europa is a moon of Jupiter, not a planet.
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
