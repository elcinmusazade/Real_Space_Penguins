// Educational context only. Game balance is defined independently in engine.js.
export const SIMULATION_NOTICE = "A fictional, simplified strategy simulation inspired by NASA science. Resource units, terrain, crops, construction times, risks, and mission outcomes are game rules—not validated engineering or agricultural predictions. This independent project is not endorsed by NASA.";

export const SCIENCE_NOTES = [
  {
    id: "atmosphere",
    title: "Life support is not optional",
    body: "Mars has a very thin atmosphere composed mostly of carbon dioxide, nitrogen, and argon. Our habitat and oxygen systems turn this real environmental challenge into a simplified resource trade-off.",
    url: "https://science.nasa.gov/mars/facts/",
    source: "NASA Science · Mars Facts"
  },
  {
    id: "ice",
    title: "Water may be beneath your feet",
    body: "NASA's SWIM project maps evidence of subsurface water ice to inform future landing-site choices. The game's ice deposits illustrate that idea; they are generated tiles, not an actual map of Mars.",
    url: "https://science.nasa.gov/resource/swim-map-shows-subsurface-water-ice-on-mars/",
    source: "NASA/JPL-Caltech · SWIM"
  },
  {
    id: "dust",
    title: "Dust is a power problem",
    body: "Martian dust storms can affect the availability of solar energy, as well as electronics and health. Keeping an energy reserve is a useful game strategy; the event's exact penalty is fictional balance, not a measured forecast.",
    url: "https://science.nasa.gov/solar-system/planets/mars/10-things-dust-in-the-wind-on-mars-and-well-beyond/",
    source: "NASA Science · Dust in the Wind"
  },
  {
    id: "radiation",
    title: "Invisible hazards matter",
    body: "Curiosity's Radiation Assessment Detector measures radiation from galactic cosmic rays and solar energetic particles. Our shielding mechanic represents the planning challenge, not an astronaut radiation-dose calculation.",
    url: "https://science.nasa.gov/resource/radiation-measurements-on-mars/",
    source: "NASA/JPL-Caltech/SwRI · Curiosity RAD"
  },
  {
    id: "agriculture",
    title: "Earth data stays Earth data",
    body: "NASA POWER offers solar and meteorological data for Earth applications, including agroclimatology. It could support a future Earth farming module, but it does not predict Martian greenhouse yields. This game's crop strategies use simplified fictional values.",
    url: "https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
    source: "NASA POWER · Daily API"
  }
];

export const SOURCES = [
  {
    title: "NASA Mars Facts",
    url: "https://science.nasa.gov/mars/facts/",
    description: "Atmosphere, surface, climate, and planetary context. Educational reference, not a numerical engine input."
  },
  {
    title: "SWIM: Subsurface Water Ice on Mars",
    url: "https://science.nasa.gov/resource/swim-map-shows-subsurface-water-ice-on-mars/",
    description: "NASA mission evidence for buried water ice and its relevance to landing-site planning."
  },
  {
    title: "Dust in the Wind",
    url: "https://science.nasa.gov/solar-system/planets/mars/10-things-dust-in-the-wind-on-mars-and-well-beyond/",
    description: "Dust storms, solar-energy availability, and other effects of fine particles on Mars."
  },
  {
    title: "Radiation Measurements on Mars",
    url: "https://science.nasa.gov/resource/radiation-measurements-on-mars/",
    description: "Historical Curiosity RAD observations; not a validated crew-exposure model for this game."
  },
  {
    title: "NASA POWER Daily API",
    url: "https://power.larc.nasa.gov/docs/services/api/temporal/daily/",
    description: "Candidate Earth-data source for a future agricultural module. No POWER dataset is currently loaded by the game."
  },
  {
    title: "Space Mission Design Game",
    url: "https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/",
    description: "Primary NASA Space Apps challenge: mission design, resource constraints, and engineering trade-offs."
  },
  {
    title: "Build a Junior Astronaut Mission Trainer",
    url: "https://www.spaceappschallenge.org/2026/challenges/junior-astronaut-mission-trainer/",
    description: "Supporting challenge: make outpost life-support trade-offs tangible and understandable."
  },
  {
    title: "Field Shift: Adapting Farms with NASA Data",
    url: "https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/",
    description: "Future inspiration only. The current greenhouse is not a real Earth crop-rotation decision-support tool."
  }
];

export const FIELD_GUIDE = [
  {
    title: "The objective",
    body: "Keep the crew alive through Sol 10 and reach 70 science. Surviving without enough science is a partial mission success. Losing all crew health ends the mission."
  },
  {
    title: "Two decisions each day",
    body: "Every Sol grants two action points. Scanning, construction, research, repairs, and upgrades compete for those actions. Inspecting the map is free; always check a button's displayed cost."
  },
  {
    title: "Instant exploration",
    body: "The basic rover is included in every mission. Scan a hidden tile beside revealed territory to uncover it immediately. Scanning uses an action and energy; there is no rover movement to micromanage."
  },
  {
    title: "Connected construction",
    body: "Build on revealed, empty tiles beside an existing colony structure. Diagonals do not connect. Water extractors need ice; exposed ridges improve solar output; scientific terrain benefits laboratories."
  },
  {
    title: "Plan one Sol ahead",
    body: "New structures come online on the following Sol, so today's construction will not cover today's consumption. The resource forecast shows the current end-of-Sol balance."
  },
  {
    title: "Power follows a priority order",
    body: "Each Sol, solar power is generated first and crew needs are reserved. The colony then runs water extractors, oxygen recyclers, greenhouses, laboratories, and shielding—in that order. A module without enough energy or water stays idle: no output and no operating cost. Check its warning, switch off a lower-priority module, or expand your supply."
  },
  {
    title: "Crew needs cannot be switched off",
    body: "Astronauts still need oxygen, food, water, and habitat power when supplies are short. Unpowered habitat water recovery stops, but crew consumption continues. Any remaining life-support shortage at the end of the Sol reduces crew health."
  },
  {
    title: "Read the mission report",
    body: "Authored scenario events introduce clear choices and costs. Resolve a pending event before ending the Sol. Your log explains what changed; the events are not live AI output."
  },
  {
    title: "Science and technology",
    body: "An online laboratory produces science and enables extra experiments. Technology upgrades require science milestones plus materials and energy; accumulated science is not spent when unlocking a technology."
  },
  {
    title: "Grow carefully",
    body: "Greenhouse crops trade food production against water and energy demand. These are fast educational game cycles, not realistic crop growth times or farming advice."
  }
];
