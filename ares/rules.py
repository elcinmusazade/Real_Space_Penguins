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
