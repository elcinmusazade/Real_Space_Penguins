"""Fault-protection catalog: flight computers, sensors, responses and scripted fault scenarios.

All numbers are simplified game values, not spacecraft measurements.
"""

FAULT_TURNS = 12
FAULT_SPACECRAFT = {
    "batteryStart": 80, "batteryMax": 100, "solar": 34, "busLoad": 8,
    "storageMax": 120, "downlink": 70, "downlinkPower": 4,
    "boostDownlink": 110, "boostPower": 10, "brownoutsToLose": 2,
}

FAULT_COMPUTERS = {
    "basic": {"name": "Basic flight computer", "slots": 3, "power": 1, "mass": 4, "cost": 8},
    "standard": {"name": "Standard flight computer", "slots": 5, "power": 2, "mass": 6, "cost": 14},
    "advanced": {"name": "Advanced flight computer", "slots": 8, "power": 4, "mass": 9, "cost": 24},
}

FAULT_INSTRUMENTS = {
    "camera": {"name": "Camera", "power": 6, "data": 12, "science": 1.0},
    "radar": {"name": "Ice radar", "power": 14, "data": 20, "science": 0.8},
    "spectrometer": {"name": "Spectrometer", "power": 7, "data": 8, "science": 2.0},
}

# kind "number": compared with < or >; kind "bool": compared with "is".
FAULT_SENSORS = {
    "battery": {"name": "Battery charge", "unit": "%", "kind": "number", "min": 0, "max": 100},
    "storage": {"name": "Data storage used", "unit": "%", "kind": "number", "min": 0, "max": 100},
    "radiation": {"name": "Radiation level", "unit": "", "kind": "number", "min": 0, "max": 100},
    "dust": {"name": "Dust opacity", "unit": "%", "kind": "number", "min": 0, "max": 100},
    "contact": {"name": "Ground contact window open", "unit": "", "kind": "bool"},
    "camera_health": {"name": "Camera health", "unit": "%", "kind": "number", "min": 0, "max": 100},
    "radar_health": {"name": "Ice radar health", "unit": "%", "kind": "number", "min": 0, "max": 100},
    "spectrometer_health": {"name": "Spectrometer health", "unit": "%", "kind": "number", "min": 0, "max": 100},
    "temperature": {"name": "Outside temperature", "unit": " °C", "kind": "number", "min": -250, "max": 500},
    "impacts": {"name": "Particle impacts", "unit": "", "kind": "number", "min": 0, "max": 100},
    "wind": {"name": "Wind speed", "unit": "", "kind": "number", "min": 0, "max": 100},
}

FAULT_RESPONSES = {
    "safe_mode": {"name": "Enter safe mode", "target": False, "help": "All instruments off this turn. Protects against radiation; no new science."},
    "instrument_off": {"name": "Turn instrument off", "target": True, "help": "Saves its power; it collects no data this turn."},
    "instrument_on": {"name": "Keep instrument on", "target": True, "help": "Claims the instrument so a lower-priority rule cannot switch it off."},
    "downlink_boost": {"name": "High-power downlink", "target": False, "help": "During a contact window, send 110 data units instead of 70 for 10 power instead of 4."},
    "compress": {"name": "Compress data", "target": False, "help": "New data takes half the storage but keeps 80% of its science."},
    "stow_arrays": {"name": "Stow solar arrays", "target": False, "help": "Protects arrays from dust damage but cuts solar power to 30%."},
    "switch_backup": {"name": "Switch to backup camera", "target": False, "help": "One use: replaces a damaged camera with a healthy spare."},
    "thermal_protect": {"name": "Thermal protection mode", "target": False, "help": "Turns radiators and sun shade toward the heat. Stops heat damage, but solar power halves and instruments collect a quarter less this turn."},
    "heaters_on": {"name": "Heaters on", "target": False, "help": "Keeps instruments and battery warm. Stops cold damage but uses 6 extra power this turn."},
    "shield_attitude": {"name": "Shield attitude", "target": False, "help": "Points the antenna dish into the particle stream as a shield. Stops impact damage, but no data can be sent home this turn."},
    "descend": {"name": "Descend to calmer layer", "target": False, "help": "Drops the platform below the jet stream. Stops wind damage, but solar power falls to 60% this turn."},
}

# Each scenario is a scripted environment, indexed by turn (1-based).
FAULT_SCENARIOS = {
    "dust": {
        "name": "Regional dust storm",
        "description": "Dust thickens from turn 3 to turn 8, starving the solar arrays and scouring exposed panels.",
        "dust": [10, 15, 45, 70, 85, 85, 80, 65, 40, 25, 15, 10],
        "contactEvery": 2, "target": 200,
    },
    "radiation": {
        "name": "Solar particle event",
        "description": "A solar flare floods the orbit with energetic particles on turns 4-6.",
        "radiation": [10, 10, 30, 95, 92, 70, 30, 10, 10, 10, 10, 10],
        "contactEvery": 2, "target": 250,
    },
    "camera": {
        "name": "Failing camera cooler",
        "description": "Heat soak degrades the camera's cooler from turn 3: every turn the camera runs, it loses 20% health. The mapping objective needs 100 camera science.",
        "cameraFaultFrom": 3, "instrumentTarget": ["camera", 100],
        "contactEvery": 2, "target": 300,
    },
    # --- One danger per destination (Campaign rules V3, shipyard rework) ---
    "sunside": {
        "name": "Sun side, then night side",
        "description": "Mercury's day side bakes the spacecraft (up to 380 °C) on turns 2-7, then the night side freezes it (-150 °C) with no sunlight on turns 8-11.",
        "temperature": [150, 280, 380, 420, 430, 410, 300, -120, -170, -170, -140, 60],
        "solarFactor": [1, 1, 1, 1, 1, 1, 1, .05, .05, .05, .05, 1],
        "contactEvery": 2, "target": 410, "hazard": "temperature",
    },
    "heat": {
        "name": "Hot, crushing descent",
        "description": "Venus heats the spacecraft as it sinks through thick clouds: 30 °C at the top, over 450 °C by turn 6. Clouds also dim the sunlight.",
        "temperature": [30, 90, 180, 300, 420, 455, 465, 465, 460, 465, 465, 460],
        "solarFactor": [1, .8, .6, .4, .3, .2, .2, .2, .2, .2, .2, .2],
        "contactEvery": 2, "target": 385, "hazard": "temperature",
    },
    "reentry": {
        "name": "Re-entry radio blackout",
        "description": "Hot plasma around the spacecraft blocks the radio on turns 3-7. Data piles up on board and is lost if storage fills.",
        "blackout": [3, 4, 5, 6, 7, 8], "contactEvery": 1, "target": 365, "hazard": "blackout",
    },
    "europa": {
        "name": "Europa radiation dose",
        "description": "Europa orbits inside Jupiter's radiation belts: a dose spike on turns 4-6 damages instruments that stay on and can corrupt stored data.",
        "radiation": [10, 10, 30, 95, 92, 70, 30, 10, 10, 10, 10, 10],
        "contactEvery": 2, "target": 416, "hazard": "radiation",
    },
    "belts": {
        "name": "Jupiter radiation belts",
        "description": "Passes through Jupiter's radiation belts on turns 3-9, far stronger and longer than at Europa's orbit.",
        "radiation": [10, 30, 75, 95, 95, 85, 95, 90, 70, 30, 10, 10],
        "contactEvery": 2, "target": 300, "hazard": "radiation",
    },
    "rings": {
        "name": "Ring-plane crossing",
        "description": "Crossing Saturn's ring plane on turns 3-8 peppers the spacecraft with ice particles that scour panels and instruments.",
        "impacts": [0, 10, 40, 75, 90, 85, 65, 30, 5, 0, 0, 0],
        "contactEvery": 2, "target": 326, "hazard": "impacts",
    },
    "cold": {
        "name": "Long cold dark",
        "description": "Uranus's tilted seasons leave the platform in near-darkness at about -210 °C. Cold damages unheated instruments and contact comes every 3 turns.",
        "temperature": [-200, -205, -210, -215, -215, -215, -215, -215, -215, -210, -205, -200],
        "solarFactor": [.4] * 12,
        "contactEvery": 3, "target": 352, "hazard": "temperature",
    },
    "wind": {
        "name": "Supersonic winds",
        "description": "Neptune's jet stream, the fastest winds in the Solar System, batters the platform on turns 3-10.",
        "wind": [20, 45, 70, 85, 90, 75, 60, 80, 90, 70, 40, 20],
        "contactEvery": 2, "target": 380, "hazard": "wind",
    },
    # --- Second danger per destination: a mission meets one of its planet's two dangers ---
    "flare": {
        "name": "Solar flare",
        "description": "Mars has no global magnetic field, so a solar flare's particle storm reaches the spacecraft directly on turns 4-6.",
        "radiation": [10, 10, 25, 90, 95, 75, 30, 10, 10, 10, 10, 10],
        "contactEvery": 2, "target": 276, "hazard": "radiation",
    },
    "flare_close": {
        "name": "Close-range solar flare",
        "description": "So close to the Sun, a flare's particle storm is fierce and arrives fast: turns 3-7.",
        "radiation": [10, 20, 80, 95, 100, 90, 70, 20, 10, 10, 10, 10],
        "contactEvery": 2, "target": 228, "hazard": "radiation",
    },
    "superrotation": {
        "name": "Super-rotating winds",
        "description": "Venus's upper clouds race around the planet at over 300 km/h, buffeting the spacecraft on turns 3-9.",
        "wind": [30, 50, 70, 80, 85, 80, 75, 70, 60, 40, 30, 20],
        "contactEvery": 2, "target": 381, "hazard": "wind",
    },
    "hurricane": {
        "name": "Hurricane at the landing site",
        "description": "A tropical storm crosses Earth's landing zone on turns 4-8 with violent winds.",
        "wind": [10, 20, 40, 75, 90, 95, 80, 60, 30, 10, 10, 10],
        "contactEvery": 2, "target": 356, "hazard": "wind",
    },
    "plumes": {
        "name": "Water-vapour plumes",
        "description": "Europa's geysers throw ice grains into space; flying through a plume on turns 4-7 sandblasts the spacecraft.",
        "impacts": [0, 5, 30, 70, 85, 80, 60, 20, 5, 0, 0, 0],
        "contactEvery": 2, "target": 331, "hazard": "impacts",
    },
    "great_storm": {
        "name": "Great Red Spot storm",
        "description": "A giant anticyclone like the Great Red Spot drags the platform through violent winds on turns 3-9.",
        "wind": [30, 55, 75, 90, 95, 90, 85, 70, 60, 40, 30, 20],
        "contactEvery": 2, "target": 366, "hazard": "wind",
    },
    "hexagon": {
        "name": "Polar hexagon storm",
        "description": "Saturn's six-sided polar jet stream and its central vortex, a planet-sized tornado, batter the platform on turns 3-10.",
        "wind": [25, 45, 70, 85, 95, 95, 90, 85, 75, 60, 35, 20],
        "contactEvery": 2, "target": 371, "hazard": "wind",
    },
    "dark_rings": {
        "name": "Dark ring crossing",
        "description": "Uranus's narrow dark rings are hard to see; crossing them on turns 4-7 brings sudden particle hits.",
        "impacts": [0, 0, 15, 65, 90, 80, 40, 10, 0, 0, 0, 0],
        "contactEvery": 3, "target": 336, "hazard": "impacts",
    },
    "deep_cold": {
        "name": "Deep cold",
        "description": "Neptune's cloud tops sit near -220 °C; long cold spells freeze unheated instruments and drain the battery.",
        "temperature": [-200, -210, -220, -225, -225, -225, -225, -220, -220, -215, -210, -205],
        "solarFactor": [.4] * 12,
        "contactEvery": 2, "target": 352, "hazard": "temperature",
    },
    "eclipse": {
        "name": "Long eclipse season",
        "description": "Turns 2-11 spend long stretches in the planet's shadow (55% solar power), and contact windows come only every 3 turns.",
        "solarFactor": [1, .55, .55, .55, .55, .55, .55, .55, .55, .55, .55, 1],
        "contactEvery": 3, "target": 250,
    },
}

FAULT_EXAMPLE_RULES = [
    {"when": [{"sensor": "radiation", "op": ">", "value": 60}], "for": 1, "then": "safe_mode"},
    {"when": [{"sensor": "battery", "op": "<", "value": 40}], "for": 1, "then": "instrument_off", "target": "radar"},
    {"when": [{"sensor": "storage", "op": ">", "value": 60}, {"sensor": "contact", "op": "is", "value": True}], "for": 1, "then": "downlink_boost"},
]

