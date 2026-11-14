# Science references and data boundaries

Verified primary-source pages on **2026-11-13**. The application currently uses these as **educational references**, not as downloaded numerical inputs to the simulation.

| Reference | Supports | Does not support |
| --- | --- | --- |
| [NASA Mars Facts](https://science.nasa.gov/mars/facts/) | Thin atmosphere and planetary context | Habitat production rates or crew consumption coefficients |
| [NASA SWIM subsurface water-ice map](https://science.nasa.gov/resource/swim-map-shows-subsurface-water-ice-on-mars/) | Evidence of buried ice and its relevance to future landing sites | The game's procedural tile coordinates or extractor yields |
| [NASA: Dust in the Wind](https://science.nasa.gov/solar-system/planets/mars/10-things-dust-in-the-wind-on-mars-and-well-beyond/) | Dust can affect solar-energy availability, electronics, and health | Exact event probabilities, penalties, or damage values |
| [Curiosity RAD radiation measurements](https://science.nasa.gov/resource/radiation-measurements-on-mars/) | Cosmic-ray and solar-particle radiation context | A validated crew-dose or shielding model |
| [NASA POWER Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) | Candidate solar/meteorological data source for an Earth agriculture extension | Mars weather, greenhouse yields, or a currently implemented live data feed |

## Currently integrated datasets

**NASA GMAT R2026a bundled data (Campaign rules V3, 2026-11-14).** Used offline only; the game ships the derived table, not GMAT.

| Input | GMAT path | Used for |
| --- | --- | --- |
| JPL DE421 planetary ephemeris (SPK, Type 2 Chebyshev) | `application/data/planetary_ephem/spk/de421.bsp` | Heliocentric Earth, Mercury, Venus, Mars and Jupiter positions/velocities; Earth-target light-time |
| EMTG launch-vehicle library, `Atlas_V_401` row | `application/data/emtg/NLSII_August2018_Augmented.emtg_launchvehicleopt` | Delivered mass vs C3 polynomial, C3 range 0-60, declination limit ±28.5° |

**Processing** (`tools/build_campaign_windows.py`, standard library): for each 90-day turn from 2028-07-01 (80 turns) and each destination, Earth departures every 6 days are paired with a time-of-flight grid (Mercury 70-260 d, Venus 80-330 d, Mars 120-420 d, Jupiter 500-1300 d) and solved as prograde single-revolution Lambert problems around the Sun (universal variables). Kept per turn: lowest total delta-v (departure from a 200 km Earth orbit + capture), lowest within ±28.5° departure declination, and the fastest within 1.5 km/s of the lowest. Units: km, km/s, km²/s², days, UTC dates (TDB approximated as UTC + 69.184 s). Sanity checks: the 2028 Mars window comes out at C3 ≈ 9.2 km²/s²; Mars windows recur about every 26 months; Mars light-time ranges 3-22 minutes; the Atlas curve gives ~2,069 kg at C3 16.4 (MRO launched 2,180 kg). `tests/test_flight.py` recomputes one entry when the GMAT clone is present.

**Limits:** Sun-only two-body patched conics (no planetary perturbations, no launch-day targeting, no flybys). The game's gravity-assist route, heavy and super-heavy rockets, capture orbits, landing delta-v, cryogenic boil-off, ion-engine factors, off-Earth departures, hazards, wear and yields are **game estimates**, labelled in the UI.

Terrain, resources, crops and scenarios remain authored or seed-generated game content. Do not claim live NASA data, realistic crop growth, or engineering certification.

**Campaign V2 extension (2026-11-14):** The Venus, Mercury, and Europa locations and broad environment descriptions are educational flavor; their hazard chances, transfer turn counts, fuel coefficients, ship masses, and construction yields in `ares/campaign_data.py` are **authored game assumptions**. Europa is a Jovian moon. (Superseded for Earth departures by the GMAT-derived table above.) When GMAT files arrive, document inputs, epoch, coordinate frame, spacecraft parameters, solver configuration, units, and numerical results before integrating them.

**Map-first V3 presentation (2026-11-14):** All 32×32 surface maps and decorative crater/ridge colors in `web/planet-map.js` are stylized, seeded **fictional game terrain**. They are not derived from NASA planetary elevation rasters, scientific maps, or planetary imagery. Hidden terrain decorations are cosmetic and independent of authoritative Python resource types until exploration reveals them.

**Earth destination (2026-11-15):** Mars-to-Earth travel uses the existing authored route duration and a 3.0 km/s nominal arrival speed (modified by trajectory choice), not a new GMAT solution. Earth capture uses the existing window-builder constants (GM 398600.4418 km³/s² and radius 6378.137 km) with an authored 200×36,000 km orbit; direct atmospheric entry uses a 0.1 km/s landing allowance plus the normal correction allowance. Capture/entry design, landing sites, resources and the reused eclipse fault scenario are game assumptions. Earth departures to Mars, Venus, Mercury and Europa keep the previously derived GMAT table. Map light-times are labelled as Earth-referenced rather than implying Mars-origin communications.

**Outer-planet expansion (2026-11-15):** Jupiter, Saturn, Uranus and Neptune maps are procedural, fictional cloud operating zones, not real atmospheric imagery, elevation or measured weather. Floating platforms, radioisotope core yield, aerosol refining/condensate yields, hazard rates and all routes to these destinations are authored game assumptions. Capture uses a named game delta-v allowance; no new gravitational constants or GMAT transfers were introduced. Earth-to-outer departures use fixed estimated launch C3 and zero-degree departure direction with existing rocket-capacity checks; there are no launch-window charts or ephemeris arcs for these routes. Fixed Earth-reference light-time approximations are explicitly marked EST. The existing Earth→Europa table targets Jupiter's system but does not silently become a new Jupiter-platform transfer solution.

## If adding real data later

Record its dataset/version, exact query, location, time range, units, retrieval date, processing, missing-data behavior, and attribution/reuse terms. Keep the original data distinct from transformed game values. NASA Earth observations must not silently become Martian observations.

## Public disclosure

The field guide includes an explicit simplified-simulation notice. This is an independent project without NASA endorsement. Challenge inspiration is not a claim that every challenge requirement has been fulfilled.

