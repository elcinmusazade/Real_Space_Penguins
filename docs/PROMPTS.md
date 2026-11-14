# Prompts for a new chat

## Orient without editing

> Read `AGENTS.md`, `docs/START_HERE.md`, `docs/PROJECT.md`, `docs/STATUS.md`, and `docs/ARCHITECTURE.md`, then inspect the actual game source and tests. Summarize what works, what remains uncertain, and the next smallest useful change. Do not edit files yet.

**Reminder:** The default **Campaign V2** rules live in `ares/campaign.py` and `ares/campaign_data.py`; web commands go from `web/campaign.js` to `/api/campaign/*`. The older **Classic Mars V1** is distinct at `/classic.html` (`ares/engine.py` and `web/bridge.js`). Do not mix rules or saves.

## Implement a scoped change

> Follow the repository guidebook. Implement **[one feature or fix]** in Campaign V2. Preserve the user's turn-based AP-free design, modular spacecraft/missions, fogged hub maps, free local scans, delayed rover expeditions, multiple surface/orbital hubs, independent inventories, and physically shipped cargo. Read the rules and UI boundary first. Run relevant tests, update `docs/STATUS.md`, and add one unique `docs/changes/` entry with paths, rationale, observed tests, and remaining issues. Keep unrelated work intact.

For V2, implement rules in Python (`ares/campaign.py`, config in `ares/campaign_data.py`) and controls in `web/campaign.js`; never put authoritative state changes into browser JavaScript. For Classic V1-only changes, update Python (`ares/engine.py`) and affected **read-only** legacy projections (`web/engine-view.js`) together. Run `python3 -m unittest discover -s tests -v`.

## Expand interplanetary mission planning after GMAT inputs arrive

> The user provided GMAT data **[attach actual files/fields]**. Inspect the real units, scenario setup, reference frames, departure/arrival conditions, and assumptions; record provenance and data limitations. Upgrade `ares/campaign.py` / `ares/campaign_data.py` to quote validated scenarios without erasing the existing simplified fallback. Distinguish measured/derived transfer values from invented game balance values. Add tests with specified numerical expectations, update UI explanations, and update the cross-agent guidebook. Do not claim NASA/GMAT validation unless there is direct evidence.

## Record an idea only

> Read `docs/PROJECT.md`, `docs/DECISIONS.md`, and `docs/IDEAS.md`. Assess **[idea]** for player value, NASA relevance, scope, and implementation cost. Add it to the idea bank as Proposed. Do not change game code or mark it as approved.

## Handoff to a teammate

> Check the current source, Git diff, and tests against the guidebook. Update stale documentation using only verified facts. Record any meaningful unlogged work, known bugs, and next actions. Do not invent test outcomes or overwrite a previous worklog.

