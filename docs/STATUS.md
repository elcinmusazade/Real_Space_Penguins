# Current status — Python edition

**Updated:** 2026-11-14. **State:** Complete locally playable Python-backed web game; **not publicly deployed**.

## Built and checked

- Python 3.10+ stdlib-only authoritative game engine with seeded 6×6 terrain, instant discovery, construction, research, resource allocation, event decisions, and all ten Sols.
- Original illustrated browser UI retained with an HTTP bridge. Every mutating UI action goes to `/api/action`, and launches go to `/api/new`. Local browser autosaves are retained.
- `AGENTS.md`, `CLAUDE.md`, `README.md`, and `docs/` provide the shared guidebook and cross-assistant update instructions.
- **22 Python unit/API tests passed**: rules, save validation, a full ten-Sol winning mission, JS/Python deterministic parity when Node is available, and live HTTP tests.
- Python and JavaScript produced identical starting state for seed `ARES-01`; full winning mission final states were also equal in parity testing.
- Browser desktop QA on local preview verified launch/cargo, A3 ice reveal, water-extractor placement and next-Sol activation, C1 science discovery, laboratory construction, Sol progression, and the Sol 3 dust-storm choice. **No browser console errors** were observed from the local preview.

## Honest limitations

- This Python edition has **not been published**. The previous JavaScript Site is untouched; its static host cannot execute Python.
- Only a desktop browser interaction flow was checked directly. Responsive styles are present, but no dedicated mobile viewport test is claimed.
- Browser read-only rendering helpers remain in `web/engine-view.js` for compatibility; future mechanics changes must coordinate Python rules and those projections.
- State is stored locally and submitted by the browser; the server is appropriate for local single-player gameplay, not a secure multiplayer backend.
- Scenarios and quantities are illustrative and authored; this is not a validated NASA simulator, live NASA data interface, full Field Shift farm service, or live LLM-integrated game.

## Suggested next work

1. Review the game with the two-person team, especially pacing, clarity of resource shortages, and NASA relevance.
2. Test phone and tablet viewport interactions.
3. If public Python hosting is desired, choose a process-capable host and deployment workflow; preserve the original JS Site unless explicitly replacing it.
4. Implement future requests as scoped changes with tests and new `docs/changes/` entries.

