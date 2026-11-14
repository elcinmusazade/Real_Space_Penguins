# Project brief

**Ares: First Light** is a browser-based mission-design, exploration, and colony-survival strategy game for a two-person NASA Space Apps team. **Campaign V2 is the default**; the earlier Mars survival game is preserved as Classic V1.

## Confirmed by the user

- A full playable web game, rather than only a mockup.
- Hybrid mission planning, survival, and expansion gameplay.
- Turn-based progression.
- An interactive colony map where buildings can be placed.
- Orbital imagery shows geography; surveys reveal hidden deposits and anomalies.
- Instant local scans and delayed regional surveys, without campaign rovers.
- Shared repository documentation usable by humans, ChatGPT/Codex, and Claude in later chats.
- **V2 requirements:** No action points; free nearby scans and energy/time-gated regional surveys; a startup assistant briefing; missions to **Mars, Venus, Mercury, and Europa**; hands-on spacecraft design and mission planning; Earth Mission Control plus **multiple separate surface and orbital hubs** on a world; resource transfer through actual ships/convoys, with time and cost.
- Earth-departure trajectories use NASA GMAT's bundled data (DE421, Atlas V 401) through an offline Lambert table; everything else in flight planning is a labelled game estimate. A campaign ending is on hold by user request.
- **Map-first visual redesign:** The game must feel like a strategy game, with a very large explorable map on each planet and at each planetary outpost, not a dashboard.

- **Solar-system navigation (2026-11-14):** Replace the planet-list sidebar with an open/close solar-system navigator, selectable worlds, zoom/pan, hub and traffic details, and working map/mission shortcuts. Use the supplied solar-system image as the visual reference. Planet images must visibly orbit the Sun, with Europa orbiting Jupiter; moving line highlights alone do not satisfy the motion request.

- **Living isometric terrain (2026-11-14):** User selected this direction, requested more diversity including seas, removal of the rover mechanic, and deeper game logic. Implemented natural regions, elevation, site costs/yields, coastal water and a water-to-oxygen supply chain. Terrain/production is the implementation choice for depth; no additional preference was received.

## Current campaign implementation defaults

- 32×32 living isometric map per surface hub; overview/minimap/pan/zoom, instant local scans, regional 3×3 surveys, no action-point cap. Earth Mission Control also has a playable map and the same construction/production controls as Mars (user request, 2026-11-14). Its existing launch, funding, and supply role is retained; there are no additional Earth landing sites.
- Three ship hulls, three engines, three trajectories, six payload choices; surface/orbital/science missions with selected sites.
- Multiple separate hubs across all four destinations, orbital depots, delayed transit shipments, research, hazard choices, robotic world missions, and a System Pathfinder milestone. Mission results are deterministic for a saved seed and mission ID.
- Starting Mars colony is already established alongside Earth Mission Control; Venus/Mercury/Europa bases are robotic with simplified hazards. Crewed survival gameplay is currently modeled only for Mars.
- Browser local saves and authored AURA guidance; no account, multiplayer, live LLM, live NASA feed, or validated physics.

## Preserved Classic V1 implementation defaults

These were selected to make the game buildable; they are **not separately confirmed user decisions**:

- Mars setting, one 6×6 map, a 10-Sol mission, two action points per Sol.
- Cargo selection before launch: 70 budget units and 8 mass units.
- 70 science points plus crew survival for full success; survival without enough science is partial success.
- Basic rover and core habitat equipment included in every mission.
- Authored event choices, deterministic simulation, and browser-local saving; no account, multiplayer, cloud database, or live LLM requirement.
- Original illustrated JavaScript interface with a **Python server/engine** at `/classic.html`; keep the separately hosted earlier all-JavaScript version intact as well.

## Challenge alignment

The primary inspiration is [Space Mission Design Game](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/): choices in spacecraft components and planning must visibly affect cost, fuel, duration, risk, and outcome.

[Junior Astronaut Mission Trainer](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/) inspires the Mars crew's life-support, energy, food, and shielding trade-offs.

[Field Shift](https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/) is future inspiration. A simplified Mars greenhouse alone does **not** fulfill an Earth crop-rotation decision-support challenge.

## Quality bar

The game needs a complete launch-to-debrief loop, meaningful choices, a reachable win, an understandable failure, honest NASA attribution, and a repeatable simulation. A visually complete screen is not enough without working controls.
