# Current status — Python interplanetary game

**Updated:** 2026-11-14. **State:** Locally playable **map-first Campaign UI V3** atop Python Campaign V2 is the default; Classic Mars V1 is still accessible. **No public Python deployment**.

## Built in V2

- **Mission Designer:** choose source hub, destination world, site/objective, modular ship hull, propulsion, transfer mode, and payload; get Python-validated estimates for mass, capacity, fuel, credit/material costs, turns, and risk.
- **Solar-system expansion:** Mars, Venus, Mercury, and Europa. Establish **multiple surface hubs per world** at different sites; orbital hub per destination; independent resource stockpiles for all hubs including Earth Mission Control.
- **Logistics:** real ships for interplanetary freight, local convoys for surface-to-surface, orbital transfers, delivered-only route establishment, per-turn arrivals, costs, and no teleportation.
- **Exploration and buildings:** 32×32 hidden terrain per surface hub, free instant near-building scans, paid/time-delayed rover expeditions revealing 3×3 clusters, connected construction with building costs and online dates, production and environmental hazards. Older 5×5 saves migrate to the larger layout.
- **Strategy progression:** unlimited AP-free orders, turn-based production/shipments/mission arrivals/research, branching research, Mars astronaut assignments and survival, narrated hazard choices, System Pathfinder milestone after visiting Venus/Mercury/Europa.
- **Browser UX:** full-screen game map with isometric tiles, visible structures, world-specific palettes (Mars/Venus/Mercury/Europa), mouse/touch drag panning, wheel zoom, overview/minimap, bottom construction bay and side inspector. Shipyard/research/logistics open as in-game overlays. Local autosave, AURA briefing on each load, authored help topics and save validation remain. Original 10-Sol classic remains at `/classic.html`.

## Observed checks

- **38 automated tests passed** (including large per-hub planetary maps, rover 3×3 reveal and legacy save migration, classic parity, HTTP APIs). `node --check` passed for `campaign.js`, `map-ui.js` and `planet-map.js`.
- Desktop browser preview verified: AURA intro, 32×32 Mars isometric map, switching to distinct Europa terrain preview, rover dispatch by clicking the Mars canvas and seeing arrival ETA, full-map overview/zoom, Europa landing mission CTA opening the configured shipyard. The preview was stopped after testing; no published URL.
- Legacy classic server files and API are still available. Touch/small-screen layout and extended campaign balance were not manually tested this turn.

## Honest limitations

- **GMAT trajectory data has not been provided.** Fuel, time, hazards, science, solar yields, and risk are game-balanced coefficients, not validated NASA/GMAT results. Europa is Jupiter's moon.
- AURA is **offline scripted, not a live LLM**. No live NASA datasets, full Field Shift Earth farming, real transfer-window optimizers, 3D physics, or secure multiplayer/account systems.
- Browser saves use `localStorage` and send client-owned JSON state to a local Python server. The API is **not** secure for a competitive/public client-server environment. Planetary terrain imagery is procedurally stylized, **not actual elevation imagery**.
- Python-hosting/public deployment is not included. Old separately hosted JavaScript Site was not changed. Mobile responsive CSS exists but was not manually tested at phone size.

## Next steps

1. Play-test economic balance and mission pacing with both teammates; adjust per-world hazard impact and hub resource flows.
2. Integrate user-provided GMAT inputs using explicit units/assumptions and regression scenarios.
3. Test touch controls and small-screen layouts; add richer terrain art/animations if time permits, and decide whether future AI narration warrants backend/keys/fallback.
4. Choose Python-capable hosting if a public version is wanted. Keep per-change guidebook updates in the same commits as code.

