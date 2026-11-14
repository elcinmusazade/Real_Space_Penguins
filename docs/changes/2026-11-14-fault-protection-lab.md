# Change: Fault Protection Lab example slice

- **Date:** 2026-11-14
- **Author:** Claude (Claude Code)
- **Scope:** Feature (example slice of the mission-design direction)
- **State:** Complete as a standalone page; not yet connected to the colony game

## Changed paths and behavior

- `ares/rules.py`: fault-lab constants: orbiter power/data values, 3 flight computers, 3 instruments, 8 sensors, 7 responses, 4 scenarios, starter rules.
- `ares/faults.py` (new): `validate_design`, `simulate`, `run_tests`, `catalog`, `describe_rule`. Rules are evaluated in priority order every turn. A higher-priority rule claims a subsystem (mode, an instrument, downlink, compression, arrays, spare camera), and lower-priority rules that want the same subsystem are logged as blocked. "For N turns" needs the condition to hold N turns in a row.
- `ares/server.py`: `GET /api/faults/catalog` and `POST /api/faults/test`; serves `faults.html/js/css`.
- `web/faults.html`, `web/faults.js`, `web/faults.css` (new): editor (computer cards, rule cards with WHEN/AND/FOR/THEN menus, reorder/delete, slot counter), test report (pass/fail, science vs target and vs no-rules baseline, battery/storage chart with contact windows and safe-mode markers, failure reasons, turn-by-turn log). Rules autosave in `localStorage`.
- `web/app.js`: **Fault lab** nav button.
- `tests/test_faults.py` (new), `tests/test_server.py`: validation, determinism, priority conflicts, "for" delay, spare camera single use, radiation protection, balance, HTTP endpoints.

## Why

- The user chose player-designed onboard fault protection as the "AI handles it" mechanic instead of a live LLM. Real Mars missions can't be steered live because of signal delay. The slice tests whether building rules is fun and teachable before a full design phase is built.
- The rule outcomes stay in Python, per AGENTS.md. The browser only edits the rule list.

## Observed verification

- `python3 -m unittest discover -s tests -v`: 33 tests, OK (1 skipped: Node parity).
- Balance: no rules 0/4, starter rules 2/4, radiation-safe + spare-camera + low-battery-safe 4/4.
- Local browser at port 8765: built a 5-rule design through the UI → 4/4 passed; switching to the 3-slot computer showed the slot error and the server's 400 message; 375 px viewport had no horizontal overflow; no console errors.

## Remaining work and ideas

- Connect the lab to a design phase (the computer choice should cost mass/budget there) and to orbit/launch choices.
- Scenario numbers are hand-tuned; a basic computer can do slightly worse than a standard one in the eclipse scenario, because safe mode then triggers at different turns.
- Running a test while over the slot limit shows the old (marked stale) report under the error.
