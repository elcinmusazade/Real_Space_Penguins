"""Editable catalog for the interplanetary strategy campaign.

Distances, costs, hazards, and flight durations are deliberately game-balancing
values pending the team's GMAT inputs; they are NOT NASA trajectory solutions.
"""

WORLDS = {
    "earth": {"name": "Earth", "kind": "planet", "role": "Mission Control", "color": "#7eb5b5", "description": "Design spacecraft, plan trajectories, and finance discoveries.", "hazard": "Launch weather", "environment": "Home world", "baseRisk": 0.02, "sites": []},
    "mars": {"name": "Mars", "kind": "planet", "role": "Colony survival", "color": "#d37b58", "description": "Build habitats, explore buried ice, and keep your crew alive.", "hazard": "Dust storms", "environment": "Cold, thin atmosphere", "baseRisk": 0.06, "sites": ["Arcadia Planitia", "Jezero Rim", "Utopia Planitia"]},
    "venus": {"name": "Venus", "kind": "planet", "role": "Robotic exploration", "color": "#d5af73", "description": "Operate hardened robotic stations under extreme atmospheric conditions.", "hazard": "Heat and pressure", "environment": "Extremely harsh surface", "baseRisk": 0.17, "sites": ["Ishtar Terra", "Aphrodite Terra", "Atla Regio"]},
    "mercury": {"name": "Mercury", "kind": "planet", "role": "Thermal engineering", "color": "#a9a4a0", "description": "Manage powerful sunlight and major thermal contrasts.", "hazard": "Thermal stress", "environment": "Airless, extreme temperatures", "baseRisk": 0.14, "sites": ["Caloris Basin", "Borealis Planitia", "South Polar Region"]},
    "europa": {"name": "Europa", "kind": "Jupiter moon", "role": "Ice-world science", "color": "#9bc5cf", "description": "Send robotic instruments to study an icy moon of Jupiter.", "hazard": "Radiation", "environment": "Icy, low-sunlight moon", "baseRisk": 0.19, "sites": ["Conamara Chaos", "Pwyll Region", "Tara Regio"]},
}

ROUTES = {
    ("earth", "mars"): 3,
    ("earth", "venus"): 2,
    ("earth", "mercury"): 4,
    ("earth", "europa"): 6,
    ("mars", "venus"): 4,
    ("mars", "mercury"): 5,
    ("mars", "europa"): 5,
    ("venus", "mercury"): 3,
    ("venus", "europa"): 7,
    ("mercury", "europa"): 8,
}

HULLS = {
    "scout": {"name": "Pathfinder", "description": "Light science and orbital missions.", "capacity": 9, "materials": 20, "credits": 20, "fuelFactor": 0.75},
    "lander": {"name": "Horizon Lander", "description": "Robotic deployment and new surface outposts.", "capacity": 15, "materials": 32, "credits": 32, "fuelFactor": 1},
    "freighter": {"name": "Atlas Freighter", "description": "Heavy spacecraft and cargo deployment.", "capacity": 27, "materials": 52, "credits": 46, "fuelFactor": 1.5},
}

ENGINES = {
    "chemical": {"name": "Chemical Rocket", "description": "Reliable balanced propulsion.", "mass": 2, "materials": 7, "fuelFactor": 1, "timeDelta": 0},
    "ion": {"name": "Electric Propulsion", "description": "Fuel efficient, slower transfers.", "mass": 3, "materials": 12, "fuelFactor": 0.66, "timeDelta": 2},
    "high_thrust": {"name": "High-Thrust Rocket", "description": "Shorter trips, higher fuel needs.", "mass": 4, "materials": 16, "fuelFactor": 1.5, "timeDelta": -1},
}

PAYLOADS = {
    "rover": {"name": "Exploration Rover", "mass": 3, "materials": 9, "description": "Enables planetary expeditions."},
    "lab": {"name": "Science Instruments", "mass": 3, "materials": 10, "description": "Improves research rewards."},
    "habitat": {"name": "Crew Habitat", "mass": 5, "materials": 16, "description": "Supports a crewed Mars settlement."},
    "shield": {"name": "Environmental Shield", "mass": 3, "materials": 10, "description": "Protects probes in harsh destinations."},
    "relay": {"name": "Communications Relay", "mass": 2, "materials": 7, "description": "Required for orbital hub deployment."},
    "cargo": {"name": "Supply Container", "mass": 5, "materials": 9, "description": "Provides additional starting resources."},
}

TRAJECTORIES = {
    "efficient": {"name": "Fuel Efficient", "fuelFactor": 0.76, "timeDelta": 2, "riskDelta": 0.02, "description": "Conserves propellant, increases travel duration."},
    "balanced": {"name": "Balanced Transfer", "fuelFactor": 1, "timeDelta": 0, "riskDelta": 0, "description": "Balanced time and fuel use."},
    "fast": {"name": "Fast Transfer", "fuelFactor": 1.48, "timeDelta": -1, "riskDelta": 0.035, "description": "Earlier arrival at a higher fuel cost."},
}

BUILDINGS = {
    "solar": {"name": "Solar Array", "materials": 15, "energy": 0, "turns": 1, "description": "Generates energy; sunlight varies by destination."},
    "extractor": {"name": "Ice Extractor", "materials": 16, "energy": 3, "turns": 1, "description": "Produces water on discovered ice deposits."},
    "greenhouse": {"name": "Greenhouse", "materials": 18, "energy": 4, "turns": 2, "description": "Produces food on Mars; consumes water and power."},
    "laboratory": {"name": "Research Lab", "materials": 20, "energy": 4, "turns": 2, "description": "Produces science and processes surface samples."},
    "heater": {"name": "Thermal Control", "materials": 14, "energy": 3, "turns": 1, "description": "Maintains heat in inhabited outposts."},
    "drill": {"name": "Materials Drill", "materials": 18, "energy": 4, "turns": 2, "description": "Produces materials from local geology."},
    "shield": {"name": "Radiation Shield", "materials": 20, "energy": 2, "turns": 2, "description": "Reduces hazard impact on a hub."},
}

RESEARCH = {
    "robotics": {"name": "Autonomous Rovers", "science": 18, "credits": 18, "turns": 2, "requires": [], "description": "Reduces rover expedition time by one turn."},
    "propulsion": {"name": "Precision Navigation", "science": 24, "credits": 24, "turns": 3, "requires": [], "description": "Reduces planned mission fuel use by 15%."},
    "logistics": {"name": "Orbital Logistics", "science": 24, "credits": 24, "turns": 3, "requires": ["propulsion"], "description": "Reduces freight fuel use and establishes better routes."},
    "thermal": {"name": "Extreme-World Protection", "science": 20, "credits": 20, "turns": 2, "requires": [], "description": "Reduces hazard risk at Venus, Mercury, and Europa."},
    "closed_loop": {"name": "Closed-Loop Life Support", "science": 32, "credits": 34, "turns": 3, "requires": ["robotics"], "description": "Reduces crew consumption of water and oxygen."},
}

RESOURCE_KEYS = ("energy", "materials", "fuel", "water", "food", "oxygen", "heat")
MAX_RESOURCE = 400


def catalog() -> dict:
    """Public configuration for browser forms. The UI does not change these rules."""
    return {
        "worlds": WORLDS, "hulls": HULLS, "engines": ENGINES,
        "payloads": PAYLOADS, "trajectories": TRAJECTORIES,
        "buildings": BUILDINGS, "research": RESEARCH,
        "resources": list(RESOURCE_KEYS),
        "notice": "All fuel, time, risk, heat, and resource coefficients are gameplay estimates pending GMAT inputs, not validated NASA calculations.",
    }
