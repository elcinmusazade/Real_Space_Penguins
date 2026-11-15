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
- **V2 requirements:** No action points; free nearby scans and energy/time-gated regional surveys; an optional assistant briefing; missions to **Mars, Venus, Mercury, and Europa**; hands-on spacecraft design and mission planning; Mars Mission Control plus **multiple separate surface and orbital hubs** on a world; resource transfer through actual ships/convoys, with time and cost.
- Earth-departure trajectories to Mars, Venus, Mercury and Europa use NASA GMAT's bundled data (DE421, Atlas V 401) through an offline Lambert table; everything else in flight planning is a labelled game estimate. A campaign ending is on hold by user request.
- **Map-first visual redesign:** The game must feel like a strategy game, with a very large explorable map on each planet and at each planetary outpost, not a dashboard.

- **Solar-system navigation (2026-11-14):** Replace the planet-list sidebar with an open/close solar-system navigator, selectable worlds, zoom/pan, hub and traffic details, and working map/mission shortcuts. Use the supplied solar-system image as the visual reference. Planet images must visibly orbit the Sun, with Europa orbiting Jupiter; moving line highlights alone do not satisfy the motion request.

- **Colony economy (2026-11-15).** The user requested deeper building and resource decisions. Local fuel production, repair and fitting parts, supplier placement and configurable reserves implement that direction.

- **Living isometric terrain (2026-11-14):** User selected this direction, requested more diversity including seas, removal of the rover mechanic, and deeper game logic. Implemented natural regions, elevation, site costs/yields, coastal water and a water-to-oxygen supply chain. Terrain/production is the implementation choice for depth; no additional preference was received.

- **Larger maps (2026-11-14):** User requested more playable space. Each region now has nine times the area of the former 32×32 map, with the existing settlement centered and its progress retained.

- **Meaningful technology tree (2026-11-15):** User requested a tree-shaped research section with more depth and importance. Implemented 16 connected technologies in four branches, exact requirements and effects, real equipment unlocks and production/exploration/survival improvements. Branch names, costs, lab/field requirements and balance values are implementation choices.

- **Mars home and earned Earth access (2026-11-15):** User superseded the Earth-only start: Mars is the homepage and initial base; Earth has no starting hub and requires travel. Headquarters funding and stock production move to Mars. Old saved progress is preserved until an explicit Start on Mars reset.

- **Missing planetary maps (2026-11-15):** User requested maps for planets without them. Jupiter, Saturn, Uranus and Neptune now have full 96×96 maps and mission access. Cloud-layer maps and fictional robotic floating platforms are the implementation choice for gas/ice giants; the Sun remains a non-playable star. New bases require travel and Deep-Space Engineering; none are granted by previewing a map.

## Current campaign implementation defaults

- 96×96 (9,216-sector) living isometric map per surface hub; overview/minimap/pan/zoom, instant local scans, regional 3×3 surveys (5×5 after research), no action-point cap. Mars HQ has a playable map and the command funding/materials/fuel role. Earth is a travel destination with three authored landing sites: Cape Canaveral, Pacific Coast and Mediterranean Basin. Earth surface bases use the same construction/production rules after landing.
- Three ship hulls, three engines, four trajectory choices, six payload choices; surface/orbital/science missions with selected sites. Research gates new electric/cryogenic engines, freighters, super-heavy launches and Europa surface missions / outer-planet platforms; basic Earth/Mars missions and Europa remote/orbital science remain available.
- Four research branches × four tiers, one paid project at a time; advanced projects require one/two online labs, discoveries or Mars experience. Nine facility types, including a research-unlocked reactor. Early benefits make research useful at Mars HQ before expansion. Starting at Mars does not count as a completed Mars mission for deep-space research.
- Multiple separate hubs across all eight planets and Europa, orbital depots, delayed transit shipments, research, hazard choices, robotic world missions, and a System Pathfinder milestone. Mission results are deterministic for a saved seed and mission ID.
- New campaigns have Mars Mission Control only, no previsited destinations and no Earth colony. Successful arriving landers establish Earth and other surface bases; orbital/science/flyby missions do not grant surface access. Startup/reset and the home button select Mars with no mission/intro overlay; AURA and Shipyard remain explicit choices. Headquarters is protected and uncrewed, retaining the prior command role; crewed survival is modeled at Mars outposts, while other destinations have robotic bases. Existing saves retain their hubs: navigation prefers an existing Mars base, falling back to the historical command hub when Mars is absent. Start on Mars explicitly replaces the old run.
- Browser local saves (IndexedDB, migrating older localStorage campaigns) and authored AURA guidance; no account, multiplayer, live LLM, live NASA feed, or validated physics.

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
