# Selecting sectors behind facilities

- Added Ground view beside the hub name in `web/map-ui.js`. `web/campaign.js` also enables it during placement and restores the previous view afterward.
- Updated `web/planet-map.js` to draw flat facility footprints with the construction icons, expose the terrain grid and pick the projected ground polygon on hover, click and tap. In the normal view, clicking a building still selects it.
- Added a clustered-base regression in `tests/surface_map_check.mjs` for empty and occupied rear sectors, three zoom levels, normal roof selection, touch, mouse and construction controls. Updated the README, architecture and status.
- Verified the updated scripts on the local game server and ran the full suite in the Downloads checkout. 161 tests passed and one optional GMAT recomputation was skipped. Touch was exercised with simulated pointer events.
