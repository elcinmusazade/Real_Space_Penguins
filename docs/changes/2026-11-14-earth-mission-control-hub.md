# Change: display Earth Mission Control on the map

- **Date:** 2026-11-14
- **Author:** Codex
- **Scope:** Minimal UI fix for Earth showing an online hub but an empty, unclaimed surface
- **State:** Complete

## Changed paths and behavior

- `web/map-ui.js`: distinguish the control hub from worlds awaiting a surface landing; show headquarters status, stockpiles, mission design and supply controls. Hide exploration prompts and the surface minimap on Earth.
- `web/campaign.js`: pass the existing control-hub presence to the renderer; ignore surface selections on Earth; start mission designs from Earth Mission Control when opened from Earth.
- `web/planet-map.js`: reuse the existing command-building artwork as a presentation-only headquarters marker. No authoritative tiles or buildings are added.
- `docs/STATUS.md` and this change record: record verified behavior and checks.

## Why

The map HUD only recognized surface hubs. Earth has a `control` hub with no playable tiles, so it incorrectly used the pre-landing display despite being counted as online. Keep the existing non-colonizable Earth design and repair its presentation without changing Python mechanics or saves.

## Observed verification

- `python3 -B -m unittest discover -s tests -v` in the original repository: 71 tests run, OK, 1 skipped because the optional GMAT clone is absent. Node parity passed.
- `node --check` for all three changed JavaScript files: passed.
- Isolated local browser preview: Earth headquarters visible; desktop stockpiles match the starting inventory; mission design selects Earth even after a Mars source draft; Send Resources opens Supply Lines. Returning to Mars retains its colony and seven build controls; Venus retains its pre-landing preview. No captured console warnings/errors.
- Existing compact-screen styling continues to hide the stockpile grid. No responsive-layout redesign was included.

## Remaining work

- Refresh the running game to load the updated JavaScript. No save reset is required.
- Public deployment and optional GMAT recomputation were not performed.
