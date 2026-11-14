# Decision log

## D-001 — Preserve the selected game interaction

**Status:** User-confirmed. **Date:** 2026-11-13.

Build turn-based hybrid strategy with an interactive colony, hidden terrain, and instant discovery. Do not replace instant scanning with manual rover movement or real-time timers.

**V2 extension (2026-11-14):** Instant **nearby** scans remain free. Distant surveys are rover expeditions that take time and resources, with the actual tile revealed when the rover arrives. The user explicitly removed V2 action-point limits; Classic V1 retains them.

## D-002 — One small but complete mission

**Status:** First-version implementation choice. **Date:** 2026-11-13.

Use one Mars map, 10 Sols, two actions per Sol, and transparent science/survival goals. This keeps the full mission loop achievable for a two-person team. Grid size, costs, and targets are tunable game values, not validated NASA specifications.

**Historical:** This applies to Classic V1, **not** the default open-ended interplanetary campaign.

## D-003 — Original static browser game with separated simulation

**Status:** First-version implementation choice. **Date:** 2026-11-13.

Use buildless ES modules, browser-local saves, and a pure state-transition engine. This avoids a server, credentials, installation friction, and model-service failures. New assistants can test the rules independently of the UI.

**Edition note (2026-11-14):** This was the original JavaScript-edition choice. The separately requested Python edition deliberately replaces the state-transition engine with Python; see D-008. Keep this older decision for history, not as current Python guidance.

## D-004 — Authored events before live AI

**Status:** First-version implementation choice, live AI deferred. **Date:** 2026-11-13.

Keep event effects deterministic and show their costs. Authored scenarios are not labeled as AI-generated. A future AI Mission Director may vary narrative or validated event choices, but it must not invent arbitrary physics, resource values, or NASA facts.

## D-005 — Seeded maps with reachable starting resources

**Status:** First-version implementation choice. **Date:** 2026-11-13.

Generate replayable terrain from a seed and guarantee accessible essential opportunities. Survival should depend on player choices, not a map that lacks necessary resources. Regression tests should cover fairness and a complete winning path.

## D-006 — Honest science boundary

**Status:** Required content safeguard. **Date:** 2026-11-13.

NASA facts explain real constraints; gameplay values are simplified fiction. NASA POWER describes Earth, not Mars. Greenhouse crop choices are not agronomic recommendations, and this version is not a full Field Shift tool. No NASA endorsement is implied.

## D-007 — Shared constrained resource allocation

**Status:** Implemented. **Date:** 2026-11-13.

Solar generation precedes reserved crew needs. Water extraction, oxygen recycling, greenhouse production, laboratories, and shielding then receive resources in a stable priority order. Buildings lacking their full power/water input remain idle instead of producing free output; crew needs continue even during a shortage.

The tile inspector, forecast, and end-of-Sol resolution share the same allocation plan. This avoids contradictory UI predictions and gives players a clear survival-versus-science trade-off. The order is an explicit educational game rule, not a claim about real mission control policy.

## D-008 — Python is authoritative in a separately delivered edition

**Status:** Implemented. **Date:** 2026-11-14. **Reason:** User requested a full Python-based web game after selecting the web format.

Port simulation state transitions, events, validation, and Sol resolution into Python's standard library. Reuse the original illustrated browser UI, but forward all mutating actions through an HTTP bridge to Python. Keep the legacy JS engine only as read-only UI projections; never let it execute gameplay transitions. Preserve seeded-map and save-state compatibility, and verify parity against the original edition.

Keep the previously existing static JavaScript Site unaffected. A separate process-capable host would be needed to publicly deploy this Python edition. This choice does **not** add a live AI service or NASA data feed.

## D-009 — User-selected AP-free interplanetary campaign

**Status:** Implemented as separate Campaign V2. **Date:** 2026-11-14.

User requested spacecraft and mission design, a much larger playable network, multiple hubs **on the same planet** plus orbital stations, physical ship/convoy resource transfer, and missions to **Venus, Mercury, and Europa** as well as Mars. Ship hull/propulsion/trajectory/payload trade-offs affect estimated mass, risk, cost, and travel time. Separate hub stockpiles are never automatically pooled. Freight dispatch consumes source resources and takes turns, establishing reusable routes upon delivery; a first shipment is permitted to **open** the route. No action points limit orders; available assets, time, construction site validity, and resources are the constraints.

Retain the small Classic V1 unchanged. V2 must have its own state schema, JSON endpoints, browser save key, and tests so the two modes do not interfere.

## D-010 — Authored onboarding and provisional mission science

**Status:** Implemented with explicit limits. **Date:** 2026-11-14.

An AURA introduction opens on each load, with context-aware authored help for ship design, exploration, life support, and cargo. It does **not** call an LLM; adding model inference requires a later explicit integration decision. The player will supply **GMAT data** later; until then, all trajectory durations, fuel requirements, risks, and solar/production coefficients are labeled **illustrative game parameters**. Europa is accurately labeled Jupiter's moon; robotic outposts on extreme worlds avoid assuming viable crewed Venus surfaces.

## D-011 — Map-first interplanetary campaign

**Status:** Implemented as UI V3 atop Python Campaign V2. **Date:** 2026-11-14. **Reason:** The user explicitly said the dashboard looked like a website and wanted big game maps on other planets too.

Make a **32×32 interactive isometric world map the primary screen**, not a tabular overview. Every separate surface hub has its own map; Mars, Venus, Mercury, and Europa use distinct palettes and surface details. Show planets without outposts as cosmetic remote previews with a landing-mission action. Allow drag/zoom, minimap recenter, sector selection, immediate scans close to buildings, resource/time-gated rovers that chart small areas, and direct connected construction. Existing mission planning, logistics, research and AURA remain available as in-game overlays. Preserve Classic V1 unchanged and migrate 5×5 Campaign V2 saves to 32×32 without dropping buildings or in-flight rover targets. Cosmetic rendering is not NASA terrain data.


## D-012 — Campaign rules V3: real stakes from real data

**Status:** Implemented. **Date:** 2026-11-14. **Reason:** User asked to raise the stakes, build on the map-first V3 as the base on `main`, and hold off on any campaign ending.

- Promote `ares-first-light-python 3/` to the repository root; keep the `2/` and `3/` folders as snapshots.
- One turn = 90 days from 2028-07-01, so launch windows from GMAT data map onto turns. Earth launches can be scrubbed (declination), stranded (too heavy for the rocket at that C3) or fly past (too little propellant); the player may launch a failing plan only after confirming.
- Player-written flight software (WHEN/AND/FOR/THEN rules on a chosen computer) decides arrivals against each destination's scripted fault scenario at a seeded 85-125% intensity, so a lab pass is not a guarantee.
- Base hazards are forecast two turns ahead. Manual preparation must be ordered at least one turn ahead; on the hazard turn only standing orders react. **Communication delay is shown as real light-time (minutes) rather than a multi-turn order delay**, because a turn-scale delay would misstate physics.
- Buildings wear; crews can die and bases can be lost, then reopened by a landing at the same site. Uncrewed stations go dark after three unpowered turns and revive with an energy shipment.
- Yearly reviews move the budget (4-30 credits per turn) and goals pay rewards. **No cancellation, end or loss condition** until the user decides on endings.
- Only the Atlas V 401 has GMAT performance data; heavy and super-heavy classes are labelled estimates. Real terrain elevation data was not added: it needs a new external download, which needs the user's approval.


## D-013 — Playable Earth headquarters

**Status:** Implemented. **Date:** 2026-11-14. **Reason:** The user explicitly requested “a hub like on Mars” after the cosmetic headquarters and operations panel did not provide map gameplay.

Earth HQ now shares the surface map, rover, construction, production, upkeep, and repair systems. Greenhouses work on Earth as well as Mars. Preserve the existing command hub ID/type, launch rules, cargo references, passive materials/fuel, and budget income. Keep Earth command available without off-world hazards or crew survival; all new terrain/yield/wear values are game estimates. Existing V2/V3 saves gain the Earth map without resetting their stockpiles or progress. This supersedes the earlier Earth-only-as-mission-control implementation default.


## D-014 — Collapsible solar-system navigation

**Status:** Implemented; browser verification pending permission. **Date:** 2026-11-14. **Reason:** User requested an opening/closing planet-selection sidebar that looks and behaves like the supplied solar-system image.

Use a compact map launcher and an expanded interactive solar-system dialog with inspectable planets, zoom/pan/fit, destination shortcuts, live hub status, and active mission/cargo links. Keep existing Python destinations and save mechanics. The Sun and outer planets are navigation landmarks; Europa belongs to the Jupiter system. Positions, orbit paths, and visual sizes are explicitly schematic. Use local SVG/CSS artwork, native keyboard-accessible controls, responsive layout, and reduced-motion support without external services or dependencies.

**Visual extension (2026-11-14):** User requested a more lively, rotating map while retaining the rest. Animate planet surfaces, orbit highlights and ambient light with a Pause/Play control. Keep selectable body positions steady in the existing reference composition; rotation speeds are decorative, not physical timing. Suspend motion for reduced-motion preferences and hidden tabs, and preserve animation phase during navigation.

**Orbital correction (2026-11-14):** The user clarified that the planet images themselves must move. This supersedes the fixed-position choice above: fit complete ellipses around a centered Sun and move body groups, labels and click targets along them. Europa orbits moving Jupiter, and route endpoints follow their bodies. Hover and keyboard focus hold motion for selection. Orbital speeds remain decorative and do not advance campaign turns; remove the standalone moving orbit-line highlights.


## D-015 — Living isometric regions, surveys and terrain-dependent production

**Status:** Implemented from the user's request. **Date:** 2026-11-14.

The user chose Living isometric, asked for richer geography including seas, removed the rover mechanic, and requested deeper game logic. This supersedes the campaign rover requirements in D-001/D-009; Classic V1 is preserved. Earth gets seas, fresh water, coastlines, forests, fertile ground and mountains; other worlds get distinct fictional landscapes. Orbital imagery exposes biome/elevation, while surveys reveal deposits/anomalies. No external terrain data or NASA validation is implied.

Use terrain and production as the depth implementation: coastal water intake, fertile-food/geology/solar bonuses, site preparation costs, blocked water/fissures and a water-to-oxygen plant. Inspection and execution share Python rules. Selecting a tile does not spend resources; explicit survey/build buttons follow visible cost and availability information. Nearby scans remain free; a hub can run one energy-funded regional 3×3 survey in 1–3 turns. Survey Station payload and Remote Sensing research replace rover options while keeping old saves and missions usable.

Use code-native Canvas2D landscapes and subtle ambient animation, preserving the existing solar navigator and all flight mechanics. No map rotation or real-time simulation is introduced. Long-run balancing and actual browser layout/performance still need play-testing.


## D-016 — Expanded playable regions

**Status:** Implemented. **Date:** 2026-11-14. **Reason:** The user found the playable map too small.

Increase campaign surfaces to 96×96 sectors (9,216), nine times the previous area. Center existing 32×32/5×5 saves without moving their relative buildings, discovered deposits or survey destinations. Extend seeded geography using its original coordinate origin. This supersedes D-009's map dimensions; the Classic 6×6 mode remains unchanged.

Retain survey costs/timing and building rules. Fit zoom, viewport-aware rendering and a minimap viewport outline make the larger regions navigable. Retire completed survey history at its existing cap so exploration can continue. Use IndexedDB for the larger multi-hub saves, committing before deleting the old localStorage copy, and raise only the campaign HTTP request limit to 96 MB. No external database or dependency is introduced.


## D-017 — Earth-only beginning and optional mission planning

**Status:** Implemented. **Date:** 2026-11-14. **Reason:** User rejected a free Mars hub before going to Mars and automatic mission-page opening.

New campaigns start on the playable Earth map with Earth HQ only, no off-world visited flags, and no automatic AURA or Shipyard overlay. Browsing Mars shows the pre-landing preview; arriving surface missions create its hubs. Starting the planner or opening AURA is an explicit action. The first guide step teaches scanning Earth, and Logistics explains the need for a second hub before dispatch.

Preserve existing saved campaigns, including their Mars hubs; users can select New campaign → Start on Earth for the revised beginning. This supersedes earlier automatic-startup-briefing and pre-established-Mars defaults. Flight rules, starting Earth resources and Classic V1 are unchanged. Existing Mars survival/balance regression tests now use an explicit established-colony fixture; separate tests cover the real Earth-only start, first landing and UI startup/reset.


## D-018 — Connected research with strategic consequences

**Status:** Implemented. **Date:** 2026-11-15. **Reason:** User requested a tree appearance, more depth and importance for technology.

Replace the small card grid with a connected four-branch, four-tier technology tree. Display each benefit, prerequisite, lab/field requirement, cost and completion time; allow inspection of locked nodes and highlight the path to a selection. Keep one paid project at a time. Early technologies improve ordinary operations on Earth; later projects need research infrastructure or experience and open significant equipment or supply-chain capabilities. The exact 16 technologies and balance values are implementation choices, not independently supplied requirements.

Use real Python effects and unlocks: 5×5 surveys, production/resource savings, construction discounts, hazard mitigation, advanced engines/freighters/super-heavy launches, Europa landings and a sunlight-independent reactor. Basic Mars missions and Europa remote/orbital science remain possible without these unlocks. Lab requirements apply at project start; existing paid research, flights and buildings are preserved. New quotes/construction enforce unlocks; saved assets are not removed. Physical flight checks and GMAT attribution are unchanged, and all research coefficients remain explicit game estimates. Preserve Earth-first startup, no campaign AP, no ending and Classic V1.

Use native HTML controls plus SVG dependency paths without new runtime dependencies. Python supplies both availability and execution rules. Browser verification remains pending under the earlier preview denial; engine/HTTP tests, Node controller checks and an offline diagram inspection provide bounded verification.


## D-019 — Mars headquarters and Earth reached through travel

**Status:** Implemented. **Date:** 2026-11-15. **Reason:** The user explicitly made Mars the home page and starting place, with no Earth hub until travelling there. This supersedes D-017 and the Earth-headquarters defaults in D-013/D-018.

Start with one playable Mars control hub, command center, solar array and the former headquarters stockpile/income. Preserve the protected, uncrewed command role so the programme can finance missions without an Earth supply base. Ordinary Mars settlements retain their existing crew/hazard mechanics. The home button, startup, reset, guide and lab shortcut use Mars. Do not automatically open planning.

Add Earth surface/orbital/science missions from non-Earth origins, with three landing sites and a game-estimate approach. Earth landings get ordinary outpost supplies and construction; no free Earth headquarters inventory or income. Remote survey, flyby and orbital missions do not unlock an Earth surface base. Delayed shipments and Earth departures remain usable. Existing Earth GMAT departure checks remain intact; Mars-to-Earth transfers, Earth capture/entry and reused eclipse fault scenario are game assumptions, not new validated trajectories. Reuse the Earth's constants already present in the local window builder.

Keep existing browser saves intact; Start on Mars explicitly replaces a prior run. Historical saves with a Mars base open there, while Earth-only legacy saves fall back to their existing base until reset. Do not silently delete earned hubs or missions. Mars HQ counts as a surface base for programme goals, but home-world presence alone does not satisfy a completed Mars mission requirement in research. Classic V1 and the rest of the technology tree are preserved.


## D-020 — Maps for the four outer planets

**Status:** Implemented. **Date:** 2026-11-15. **Reason:** User asked for maps on planets that lacked them.

Jupiter, Saturn, Uranus and Neptune become map/mission destinations alongside the existing five worlds. Use distinct seeded 96×96 cloud layers and fictional floating robotic platforms, rather than claiming these giants have solid landing surfaces. This implementation choice reuses the existing saved surface objective/hub type, surveys, connected construction, hazards, supplies and research system. Deep-Space Engineering unlocks platform deployment; a survey station and shield are mandatory, habitats rejected, and an actual successful deployment creates the hub. Previewing a map creates nothing. Keep Mars HQ, Earth travel, old saves, Classic V1 and no campaign ending unchanged.

Give platforms a condition-scaled 6-energy command supply so weak sunlight does not make them unusable before expansion. Condensers/refineries reuse water/material building mechanics with appropriate names. Their technology and all coefficients are fictional game balance. Blocked currents/vortices, condensate deposits, site preparation, ring shadows and weak light preserve meaningful site and supply choices.

Do not expand or relabel the existing four-destination GMAT table. New outer routes, Earth launch energy/direction, capture allowances and light-time approximations are explicit estimates. Retain rocket mass checks and propellant checks, hide nonexistent launch windows, and identify estimated light-times in the map. Live browser verification remains pending under the earlier preview denial; use engine/HTTP/controller checks and offline production-Canvas renders.


## D-021 — Interactive tutorial and Settings

**Status:** Implemented on `feature/tutorial`. **Date:** 2026-11-15. **Reason:** User asked for a typical game tutorial with mechanics, objectives and hints, closable and restartable from settings.

Use spotlight coach marks over the real interface rather than a separate sandbox, so the player learns the actual controls. Action steps wait for the real action and advance on their own, but SKIP STEP is always offered so no one gets stuck. The tutorial is presentation only: it reads state, never changes it, and stores its progress as a browser preference (not in the Python-validated save). Settings is a new ⚙ dialog for tutorial control plus the existing guide-card and ambient-motion preferences. The overlay sits above the map HUD but below the solar navigator, dialogs and flight animations.
