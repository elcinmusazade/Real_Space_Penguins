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

**Orbiter launch prelude only** (`ares/data/mars_launch_windows.json`, built 2026-11-14 by `tools/build_mars_launch_table.py`):

| Data | Source | Processing |
| --- | --- | --- |
| Earth and Mars positions/velocities, 2028-09 to 2029-03 | JPL DE421 ephemeris as bundled with NASA GMAT R2026a (`GMAT/application/data/planetary_ephem/spk/de421.bsp`, Apache-2.0 distribution) | Read with a pure-Python SPK Type 2 reader; Sun-only two-body Lambert transfers on a 3-day × 4-day grid; for each launch date, the time of flight with the lowest C3 + arrival v∞² is kept |
| Atlas V 401 deliverable mass vs C3, declination limits ±28.5° | EMTG launch-vehicle library bundled with GMAT (`data/emtg/NLSII_August2018_Augmented.emtg_launchvehicleopt`) | Polynomial copied as is. The value after the C3 bounds is read as adapter mass (0 kg); the curve gives about 2,069 kg at C3 16.4, consistent with MRO's 2,180 kg on that vehicle |

Limitations: patched-conic simplification (no launch-site geometry beyond the declination check, no planetary gravity during cruise, no trajectory correction manoeuvres). This is not a GMAT-computed or mission-certified trajectory. Orbiter dry mass (1,100 kg), Isp (320 s) and the 400 km orbit are game assumptions. Terrain, resources, crops, timing and colony scenarios remain authored or seed-generated game content.

## If adding real data later

Record its dataset/version, exact query, location, time range, units, retrieval date, processing, missing-data behavior, and attribution/reuse terms. Keep the original data distinct from transformed game values. NASA Earth observations must not silently become Martian observations.

## Public disclosure

The field guide includes an explicit simplified-simulation notice. This is an independent project without NASA endorsement. Challenge inspiration is not a claim that every challenge requirement has been fulfilled.

