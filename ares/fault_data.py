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
        "description": "Heat soak degrades the camera's cooler from turn 3: every turn the camera runs, it loses 20% health. The mapping objective needs 100 camera science.",
        "cameraFaultFrom": 3, "instrumentTarget": ["camera", 100],
        "contactEvery": 2, "target": 300,
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

