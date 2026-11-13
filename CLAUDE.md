# Claude / AI teammate entry point

Read and follow **`AGENTS.md`** as the primary repository instructions, then read `docs/START_HERE.md` and `docs/STATUS.md`.

This is the **Python-backed** Ares edition. `ares/engine.py` changes the game state; `web/bridge.js` sends browser actions to Python. Never implement a new browser-side state transition in `web/engine-view.js`.

After changes, run `python3 -m unittest discover -s tests -v`, update `docs/STATUS.md`, and add a uniquely named `docs/changes/` entry. Preserve unrelated edits from the other teammate or assistant.
