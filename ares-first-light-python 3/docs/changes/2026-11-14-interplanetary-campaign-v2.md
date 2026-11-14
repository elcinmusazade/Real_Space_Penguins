# 2026-11-14 — Modular interplanetary campaign V2

## Request and rationale

The user selected ship and mission design (A2), a multi-hub planetary network with orbital hubs (B2/B3), realistic resource movement by ships, no action points, an arrival AURA briefing, and playable Venus/Mercury/Europa worlds (C1/C2/C3). A separate V2 engine lets the original Python Mars game remain playable.

## Implemented files

- `ares/campaign_data.py`: game-world catalog; hull/engine/trajectory/payload choices; transfer estimates; buildings and research.
- `ares/campaign.py`: Python-owned campaign state and rules, distinct inventories/hub types, multiple planetary sites, orbital depots, ship design quotes, surface/survey/orbit missions, freight and route establishment, rover exploration, resource-driven construction, production, crew, events, research, and milestone.
- `ares/server.py`: versioned Campaign V2 GET/POST JSON endpoints plus new static-file allowlist, leaving Classic V1 API intact.
- `web/index.html`, `web/campaign.js`, `web/campaign.css`: V2 responsive browser game, AURA introduction on load, ship preview and plan form, solar-system board, hub maps, cargo dispatch, research, local saving, Python API calls. `web/classic.html` preserves the previous UI at a separate route.
- `tests/test_campaign.py` and `tests/test_server.py`: V2 state-machine, resource transfer, multiple hubs/worlds, delayed arrivals, mission quotes, live HTTP requests, and Classic V1 compatibility checks.
- `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/PROJECT.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/IDEAS.md`, `docs/PROMPTS.md`, `docs/STATUS.md`: explain the new default mode, separate classic, tested behavior, and limitations for future ChatGPT/Claude contributors.

## Observed verification

- `python3 -m unittest discover -s tests -q`: **36 passed** (V2, shield mitigating a hazard, corrupted-save checks, V1, HTTP, JS/Python parity).
- `node --check web/campaign.js`: **passed**.
- Desktop managed browser preview: AURA intro, new solar dashboard, Venus ship quote/launch, turn progression to Venus arrival, event resolution, local-sector scans, Mars solar build order, and shipment dispatch with future ETA all visibly operated.
- Existing classic HTML/JS bridge and API served successfully through HTTP tests; classic interactive UI was not re-walked this turn.

## Limitations / next

- All flight/risk/yield numbers are game coefficients **pending user-provided GMAT data**. No live NASA feed or actual LLM service is present; AURA is authored offline help.
- No public Python deployment. Save state is client-controlled and not tamper-proof; do not reuse as secure multiplayer backend.
- Dedicated phone/tablet UI review is still open. Multi-hub cargo ships are abstract costed dispatches, not individually designed freight fleets.
