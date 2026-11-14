# Future ideas — not yet committed

| Idea | Value | Condition before implementation |
| --- | --- | --- |
| Live AI Mission Director | Narrative variety and new missions | Confirm API/budget, server-side key handling, validated output, and offline fallback |
| Earth-data farming scenario | Genuine Field Shift connection | Add NASA Earth data, location/soil/crop inputs, rotation logic, uncertainty, and source ledger |
| Full spacecraft assembly | Richer engineering choices before launch | Confirm scope and model requirements; keep existing mission loop playable |
| Moon scenario | Different power and environment trade-offs | Design sourced assumptions and a separate balanced scenario |
| Longer campaign | Persistent colony growth | Clarify save/version migration and difficulty progression |
| Multiplayer or shared scores | Collaboration and replayability | Confirm hosting/account scope and abuse controls |

Keep proposals labeled. Add the player benefit, estimated effort, and dependencies before implementing. Do not silently reinterpret a brainstorm as an approved feature.


## Challenge gap analysis — Space Mission Design Game (Proposed)

**Source:** [challenge Details tab](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/?tab=details), read 2026-11-14. The brief asks for a game where players **design, manage, and simulate a complete mission** from objective through operation. It names six key resources: mass, power, budget, data, communications, and time. Everything below is a **proposal**, not approved work.

| Challenge element | Ares today | Gap |
| --- | --- | --- |
| Define mission objective and requirements | Fixed goal: survive 10 Sols with 70 science | No objective choice or requirements |
| Spacecraft components (structure, power, batteries, comms, computer, attitude control) | None | Missing |
| Instruments with mass/power/cost/data/science value | `instruments` is one cargo item | Missing |
| Launch vehicle and orbit, with a payload/orbit compatibility check | None; arrival on Mars is assumed | Missing |
| Mass | Cargo mass cap of 8 | Partial |
| Power | Energy resource and allocation priority | Covered |
| Budget | Cargo budget of 70 only | Partial |
| Data and communications to ground stations | Science points are instant | Missing |
| Time / mission lifetime | Fixed 10 Sols | Partial |
| Random events / unexpected constraints | 4 authored events with choices | Covered |
| Explain why a mission succeeded or failed | Win/partial/fail outcome | Partial: no post-mission analysis |
| Redesign and re-simulate; save/compare designs | Restart with a seed | Partial |
| Team mode for up to 4 players with roles | Single-player | Missing |
| Scenarios, difficulty levels, scoring, sandbox | One scenario | Missing |

### Proposed direction (needs team agreement)

| Idea | Value | Condition before implementation |
| --- | --- | --- |
| **Design phase before launch:** objective → spacecraft components → instruments → launch vehicle + orbit/transfer, with mass, power, and budget totals and a launch-capacity check | Covers the central "design" requirement; design choices set colony starting conditions (energy, materials, science rate) | Keep the existing colony loop as the "operate" phase; all calculations in `ares/engine.py`; label values as simplified game numbers |
| **Data and communications:** science produces data that must be downlinked within a comms budget or window | Adds the data/comms trade-off the brief names | Decide whether it replaces or accompanies instant science points; rebalance the 70-science target |
| **Post-mission report:** explain the result by linking it to design choices and event decisions | Directly answers "why the mission succeeded or failed" | Generate in Python from recorded state and log; no live LLM |
| **Redesign and replay:** keep the seed, change the design, and compare results | Encourages experimenting with trade-offs | Save-format versioning for design data |
| **Team roles (hot-seat first):** roles such as mission lead, spacecraft, science, comms on one screen | Partly meets the up-to-4-player collaboration ask without a server | True online multiplayer conflicts with the stateless local server; see "Multiplayer or shared scores" above |
| **Scenarios and difficulty:** e.g., simple vs. advanced components, a Moon scenario | Replayability and accessibility | Each scenario needs separately balanced values |

**Suggested order:** design phase → post-mission report → data/comms → redesign/replay → team roles → scenarios.
