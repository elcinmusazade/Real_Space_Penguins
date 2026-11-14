"""Game-design values. These are fictional balance numbers, not NASA measurements."""

GRID_SIZE = 6
RESOURCE_KEYS = ("energy", "oxygen", "water", "food", "materials")
FLOW_KEYS = (*RESOURCE_KEYS, "science")
DEFAULT_LOADOUT = ("supplies", "materials", "battery")

TERRAINS = {
    "plain": {"name": "Basalt plain", "color": "#805547"},
    "ridge": {"name": "Sunlit ridge", "color": "#a87953"},
    "ice": {"name": "Subsurface ice", "color": "#79a8ad"},
    "science": {"name": "Geological site", "color": "#9d83b1"},
    "salvage": {"name": "Supply cache", "color": "#a6a578"},
    "hazard": {"name": "Unstable terrain", "color": "#a3645d"},
}

BUILDINGS = {
    "habitat": {"name": "Crew habitat", "cost": 0, "production": {"water": 1}, "consumption": {"energy": 2, "oxygen": 6, "water": 4, "food": 5}},
    "solar": {"name": "Solar array", "cost": 14, "production": {"energy": 12}, "consumption": {}},
    "oxygen": {"name": "Oxygen recycler", "cost": 14, "production": {"oxygen": 8}, "consumption": {"energy": 3, "water": 1}},
    "water": {"name": "Water extractor", "cost": 16, "production": {"water": 9}, "consumption": {"energy": 4}},
    "greenhouse": {"name": "Greenhouse", "cost": 18, "production": {"food": 7}, "consumption": {"water": 3, "energy": 3}},
    "lab": {"name": "Research laboratory", "cost": 20, "production": {"science": 5}, "consumption": {"energy": 4}},
    "battery": {"name": "Battery bank", "cost": 10, "production": {}, "consumption": {}},
    "shield": {"name": "Radiation shelter", "cost": 16, "production": {}, "consumption": {"energy": 1}},
}

CARGO = {
    "supplies": {"cost": 20, "mass": 2},
    "materials": {"cost": 25, "mass": 3},
    "battery": {"cost": 20, "mass": 2},
    "instruments": {"cost": 25, "mass": 2},
    "rover": {"cost": 25, "mass": 2},
    "shielding": {"cost": 30, "mass": 3},
}

CROPS = {
    "greens": {"name": "Fast greens", "production": {"food": 7}, "consumption": {"water": 3, "energy": 3}},
    "starch": {"name": "Starch crops", "production": {"food": 10}, "consumption": {"water": 5, "energy": 5}},
    "legumes": {"name": "Low-input legumes", "production": {"food": 5}, "consumption": {"water": 2, "energy": 2}},
}

RESEARCH = {
    "rover": {"name": "Efficient surveying", "description": "Reduce scan energy costs and improve geological rewards.", "requiredScience": 15, "cost": 10, "energy": 3},
    "solar": {"name": "High-efficiency arrays", "description": "All solar arrays produce 25% more energy.", "requiredScience": 25, "cost": 12, "energy": 3},
    "recycling": {"name": "Closed-loop recovery", "description": "The habitat recovers 2 additional water per Sol.", "requiredScience": 35, "cost": 10, "energy": 3},
    "shielding": {"name": "Storm procedures", "description": "Environmental damage falls by another 30%.", "requiredScience": 40, "cost": 14, "energy": 3},
}

EVENT_DEFINITIONS = {
    "dust": {
        "id": "dust", "title": "Dust on the horizon",
        "description": "A dust front threatens solar generation. Protect the arrays or accept the storm.",
        "choices": [
            {"id": "protect", "label": "Protect the arrays", "description": "Spend 4 materials. Solar output stays at 80% for two Sols.", "cost": {"materials": 4}},
            {"id": "weather", "label": "Weather the storm", "description": "No cost. Solar output falls to 50% and an array is damaged.", "cost": {}},
        ],
    },
    "seal": {
        "id": "seal", "title": "A leak in the habitat",
        "description": "A habitat seal is venting air. Repair, isolate, or improvise.",
        "choices": [
            {"id": "repair", "label": "Replace the seal", "description": "Spend 8 materials; avoid losses.", "cost": {"materials": 8}},
            {"id": "isolate", "label": "Isolate the section", "description": "Spend 6 energy and 6 oxygen.", "cost": {"energy": 6, "oxygen": 6}},
            {"id": "patch", "label": "Improvise a patch", "description": "Lose 10 oxygen and up to 8 health.", "cost": {}},
        ],
    },
    "samples": {
        "id": "samples", "title": "A rare sampling window",
        "description": "A geological exposure is visible. Survey it in detail or conserve power.",
        "choices": [
            {"id": "detailed", "label": "Run the full survey", "description": "Spend 8 energy, gain 12 science.", "cost": {"energy": 8}},
            {"id": "routine", "label": "Take a routine scan", "description": "Gain 4 science at no energy cost.", "cost": {}},
        ],
    },
    "radiation": {
        "id": "radiation", "title": "Solar particle alert",
        "description": "Radiation is incoming. Shelter the crew or risk observations.",
        "choices": [
            {"id": "shelter", "label": "Shelter the crew", "description": "Protect health; pause passive laboratory science this Sol.", "cost": {}},
            {"id": "continue", "label": "Continue observations", "description": "Gain 8 science, but risk 18 crew health.", "cost": {}},
        ],
    },
}

EVENTS_BY_SOL = {3: "dust", 5: "seal", 7: "samples", 9: "radiation"}

# ---------------------------------------------------------------------------
# Fault Protection Lab (example slice). Fictional, simplified balance values
# for a Mars orbiter; not NASA spacecraft specifications.
# ---------------------------------------------------------------------------

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
}

FAULT_RESPONSES = {
    "safe_mode": {"name": "Enter safe mode", "target": False, "help": "All instruments off this turn. Protects against radiation; no new science."},
    "instrument_off": {"name": "Turn instrument off", "target": True, "help": "Saves its power; it collects no data this turn."},
    "instrument_on": {"name": "Keep instrument on", "target": True, "help": "Claims the instrument so a lower-priority rule cannot switch it off."},
    "downlink_boost": {"name": "High-power downlink", "target": False, "help": "During a contact window, send 110 data units instead of 70 for 10 power instead of 4."},
    "compress": {"name": "Compress data", "target": False, "help": "New data takes half the storage but keeps 80% of its science."},
    "stow_arrays": {"name": "Stow solar arrays", "target": False, "help": "Protects arrays from dust damage but cuts solar power to 30%."},
    "switch_backup": {"name": "Switch to backup camera", "target": False, "help": "One use: replaces a damaged camera with a healthy spare."},
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
        "description": "From turn 3 the camera's cooler degrades: every turn the camera runs, it loses 20% health. The mapping objective needs 100 camera science.",
        "cameraFaultFrom": 3, "instrumentTarget": ["camera", 100],
        "contactEvery": 2, "target": 300,
    },
    "eclipse": {
        "name": "Long eclipse season",
        "description": "Turns 2-11 spend long stretches in Mars' shadow (55% solar power), and contact windows come only every 3 turns.",
        "solarFactor": [1, .55, .55, .55, .55, .55, .55, .55, .55, .55, .55, 1],
        "contactEvery": 3, "target": 250,
    },
}

FAULT_EXAMPLE_RULES = [
    {"when": [{"sensor": "radiation", "op": ">", "value": 60}], "for": 1, "then": "safe_mode"},
    {"when": [{"sensor": "battery", "op": "<", "value": 40}], "for": 1, "then": "instrument_off", "target": "radar"},
    {"when": [{"sensor": "storage", "op": ">", "value": 60}, {"sensor": "contact", "op": "is", "value": True}], "for": 1, "then": "downlink_boost"},
]

# ---------------------------------------------------------------------------
# Orbiter launch (prelude to the colony). Launch-vehicle capacity, launch
# dates, C3, declination and arrival v-infinity come from NASA GMAT data via
# ares/data/mars_launch_windows.json. The orbiter's mass and engine are
# simplified game assumptions.
# ---------------------------------------------------------------------------

LAUNCH_ORBITER = {
    "dryMassKg": 1100,          # bus + camera, radar, spectrometer (game assumption)
    "ispSeconds": 320,          # bipropellant main engine (typical class, game assumption)
    "propellantMinKg": 300, "propellantMaxKg": 1600, "propellantStepKg": 10,
    "propellantDefaultKg": 900,
    "orbitPeriapsisKm": 400, "orbitApoapsisKm": 400,  # circular science/relay orbit
}
MARS_GM = 42828.37      # km^3/s^2
MARS_RADIUS_KM = 3389.5
G0 = 9.80665
