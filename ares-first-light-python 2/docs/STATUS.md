# Current status — Python interplanetary game

**Updated:** 2026-11-14. **State:** Locally playable interplanetary Campaign V2 is the default; Classic Mars V1 is still accessible. **No public Python deployment**.

## Built in V2

- **Mission Designer:** choose source hub, destination world, site/objective, modular ship hull, propulsion, transfer mode, and payload; get Python-validated estimates for mass, capacity, fuel, credit/material costs, turns, and risk.
- **Solar-system expansion:** Mars, Venus, Mercury, and Europa. Establish **multiple surface hubs per world** at different sites; orbital hub per destination; independent resource stockpiles for all hubs including Earth Mission Control.
- **Logistics:** real ships for interplanetary freight, local convoys for surface-to-surface, orbital transfers, delivered-only route establishment, per-turn arrivals, costs, and no teleportation.
- **Exploration and buildings:** 5×5 hidden terrain per surface hub, instant free adjacent scans, paid/time-delayed distant rover expeditions, connected construction with building costs and online dates, productions and environmental hazards.
- **Strategy progression:** unlimited AP-free orders, turn-based production/shipments/mission arrivals/research, branching research, Mars astronaut assignments and survival, narrated hazard choices, System Pathfinder milestone after visiting Venus/Mercury/Europa.
- **Browser UX:** new responsive mission command dashboard, local autosave, ship blueprint, AURA briefing on each load, state-aware authored help topics, saved game validation. Original 10-Sol classic remains at `/classic.html`.

## Observed checks

- **36 automated tests passed** (campaign mechanics, shield mitigation, corrupted-save rejection, classic rules, Python/legacy JS parity, and live HTTP API including campaign quote/launch/arrival/assets). `node --check web/campaign.js` passed.
- Desktop browser preview verified: AURA intro, solar system dashboard, valid Venus spacecraft quote and launch, turn progression and new Venus surface hub, environmental event resolution, selecting hubs, free Mars/Venus tile scans, building order/notification, and an in-flight Earth-to-Mars cargo dispatch.
- Legacy classic server files and API are still available. No console-error audit or dedicated mobile browser walkthrough claimed for V2.

## Honest limitations

- **GMAT trajectory data has not been provided.** Fuel, time, hazards, science, solar yields, and risk are game-balanced coefficients, not validated NASA/GMAT results. Europa is Jupiter's moon.
- AURA is **offline scripted, not a live LLM**. No live NASA datasets, full Field Shift Earth farming, real transfer-window optimizers, 3D physics, or secure multiplayer/account systems.
- Browser saves use `localStorage` and send client-owned JSON state to a local Python server. The API is **not** secure for a competitive/public client-server environment.
- Python-hosting/public deployment is not included. Old separately hosted JavaScript Site was not changed. Mobile responsive CSS exists but was not manually tested at phone size.

## Next steps

1. Play-test economic balance and mission pacing with both teammates; adjust per-world hazard impact and hub resource flows.
2. Integrate user-provided GMAT inputs using explicit units/assumptions and regression scenarios.
3. Test touch controls and small-screen layouts; decide whether future AI narration warrants backend/keys/fallback.
4. Choose Python-capable hosting if a public version is wanted. Keep per-change guidebook updates in the same commits as code.

