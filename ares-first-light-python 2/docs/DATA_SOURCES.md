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

**None.** The game's terrain, resources, crops, timing, and scenarios are authored or seed-generated game content. Do not claim live NASA data, realistic crop growth, or engineering certification.

**Campaign V2 extension (2026-11-14):** The Venus, Mercury, and Europa locations and broad environment descriptions are educational flavor; their hazard chances, transfer turn counts, fuel coefficients, ship masses, and construction yields in `ares/campaign_data.py` are **authored game assumptions**. Europa is a Jovian moon. The player has not yet supplied GMAT trajectory outputs, so no mission route in V2 is claimed to be a computed or verified trajectory. When GMAT files arrive, document inputs, epoch, coordinate frame, spacecraft parameters, solver configuration, units, and numerical results before integrating them.

## If adding real data later

Record its dataset/version, exact query, location, time range, units, retrieval date, processing, missing-data behavior, and attribution/reuse terms. Keep the original data distinct from transformed game values. NASA Earth observations must not silently become Martian observations.

## Public disclosure

The field guide includes an explicit simplified-simulation notice. This is an independent project without NASA endorsement. Challenge inspiration is not a claim that every challenge requirement has been fulfilled.

