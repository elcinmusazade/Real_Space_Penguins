# 2026-11-14 — Python-backed playable web edition

## Why

The user requested a full Python-based version of the previously built web game while preserving the original UI, turn-based exploration/building loop, and cross-assistant guidebook.

## Changes

- Added `ares/rules.py`, `ares/engine.py`, and `ares/server.py`: dependency-free Python game rules, full deterministic simulation, validated command API, and local static+JSON server.
- Added `web/bridge.js` and adapted `web/app.js` to send every game-changing command to Python. Reused `web/index.html`, `web/styles.css`, `web/art.js`, and `web/science.js`; `web/engine-view.js` supplies read-only UI metadata and projections for compatibility.
- Added Python engine/API tests in `tests/`, including a complete ten-Sol victory and cross-runtime parity checks when Node is available.
- Added root `README.md`, `AGENTS.md`, `CLAUDE.md`, and `.gitignore`; revised the guidebook's architecture, status, decisions, project brief, and fresh-chat prompts.
- Preserved the older JavaScript-hosted edition; this is a separate project, not a replacement deployment.

## Observed verification

- `python3 -m unittest discover -s tests -v`: **22 tests passed** (no failures).
- `python3 -m compileall -q ares`: passed.
- `node --check web/app.js` and `node --check web/bridge.js`: passed.
- Starting state for the same seed and the terminal outcome of a scripted full ten-Sol mission were equal between Python and the original JavaScript engine.
- Local desktop browser walkthrough: launch, A3 scan, water extractor construction, End Sol and activation, C1 scan, laboratory construction, Sol 3 event, and protective event choice all produced expected state/UI changes. No preview console errors observed.

## Limitations / follow-up

- No public deployment or dedicated mobile viewport check was performed.
- This local stateless server is not secure multiplayer hosting; browser-supplied state is untrusted.
- Client-side view helpers still mirror some rules and must stay synchronized with Python if future mechanics change.
- NASA content remains educational; no live API, validated mission physics, or actual AI director was integrated.
