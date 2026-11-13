# Project brief

**Ares: First Light** is a small browser-based mission-design, exploration, and colony-survival strategy game for a two-person NASA Space Apps team.

## Confirmed by the user

- A full playable web game, rather than only a mockup.
- Hybrid mission planning, survival, and expansion gameplay.
- Turn-based progression.
- An interactive colony map where buildings can be placed.
- Fog of war hiding undiscovered terrain.
- Instant tile discovery, without manual rover movement.
- Shared repository documentation usable by humans, ChatGPT/Codex, and Claude in later chats.

## First-version implementation defaults

These were selected to make the game buildable; they are **not separately confirmed user decisions**:

- Mars setting, one 6×6 map, a 10-Sol mission, two action points per Sol.
- Cargo selection before launch: 70 budget units and 8 mass units.
- 70 science points plus crew survival for full success; survival without enough science is partial success.
- Basic rover and core habitat equipment included in every mission.
- Authored event choices, deterministic simulation, and browser-local saving; no account, multiplayer, cloud database, or live LLM requirement.
- Original illustrated JavaScript interface with a **Python server/engine** (this edition); keep the previous all-JavaScript version intact.

## Challenge alignment

The primary inspiration is [Space Mission Design Game](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/): choices in planning must visibly affect mission operation and outcome.

[Junior Astronaut Mission Trainer](https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/) supports the outpost's life-support, energy, food, and shielding trade-offs.

[Field Shift](https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/) is future inspiration. A simplified Mars greenhouse alone does **not** fulfill an Earth crop-rotation decision-support challenge.

## Quality bar

The game needs a complete launch-to-debrief loop, meaningful choices, a reachable win, an understandable failure, honest NASA attribution, and a repeatable simulation. A visually complete screen is not enough without working controls.

