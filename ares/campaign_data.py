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
    # mass/capacity in kg. dryKg is the structure, avionics, tanks and power.
    "scout": {"name": "Pathfinder", "description": "Light science and orbital missions.", "dryKg": 400, "capacity": 900, "materials": 20, "credits": 20, "fuelFactor": 0.75},
    "lander": {"name": "Horizon Lander", "description": "Robotic deployment and new surface outposts.", "dryKg": 700, "capacity": 1500, "materials": 32, "credits": 32, "fuelFactor": 1},
    "freighter": {"name": "Atlas Freighter", "description": "Heavy spacecraft and cargo deployment.", "dryKg": 1200, "capacity": 2700, "materials": 52, "credits": 46, "fuelFactor": 1.5},
}

ENGINES = {
    "chemical": {"name": "Bipropellant Engine", "description": "Reliable, quick capture burns. Isp 320 s.", "mass": 200, "isp": 320, "captureFactor": 1.0, "materials": 7, "fuelFactor": 1, "timeDelta": 0},
    "ion": {"name": "Solar Electric Propulsion", "description": "Isp 3,000 s, but weak thrust: spiralling into orbit needs 50% more delta-v and two extra turns. Solar power fades far from the Sun.", "mass": 300, "isp": 3000, "captureFactor": 1.5, "materials": 12, "fuelFactor": 0.66, "timeDelta": 2},
    "high_thrust": {"name": "Cryogenic Engine", "description": "Isp 450 s, heavier, and its propellant slowly boils off on long trips.", "mass": 400, "isp": 450, "captureFactor": 1.0, "materials": 16, "fuelFactor": 1.5, "timeDelta": 0},
}

PAYLOADS = {
    "rover": {"name": "Exploration Rover", "mass": 300, "materials": 9, "description": "Enables planetary expeditions."},
    "lab": {"name": "Science Instruments", "mass": 300, "materials": 10, "description": "Improves research rewards."},
    "habitat": {"name": "Crew Habitat", "mass": 500, "materials": 16, "description": "Supports a crewed Mars settlement."},
    "shield": {"name": "Environmental Shield", "mass": 300, "materials": 10, "description": "Protects probes in harsh destinations."},
    "relay": {"name": "Communications Relay", "mass": 200, "materials": 7, "description": "Required for orbital hub deployment."},
    "cargo": {"name": "Supply Container", "mass": 500, "materials": 9, "description": "Provides additional starting resources."},
}

TRAJECTORIES = {
    "efficient": {"name": "Lowest energy", "description": "The transfer this turn with the lowest total delta-v (GMAT/DE421 data). May leave Earth at a declination your rocket cannot reach.", "riskDelta": 0.02, "fuelFactor": 0.76, "timeDelta": 2},
    "balanced": {"name": "Launch-site friendly", "description": "Lowest delta-v transfer whose departure declination fits an Atlas V from Cape Canaveral (within 28.5 deg).", "riskDelta": 0, "fuelFactor": 1, "timeDelta": 0},
    "fast": {"name": "Fast transfer", "description": "Shortest flight within 1.5 km/s of the lowest-energy option. Arrives faster, needs a bigger capture burn.", "riskDelta": 0.035, "fuelFactor": 1.48, "timeDelta": -1},
    "assist": {"name": "Gravity assists", "description": "Mercury and Europa only. Leave on this turn's Venus transfer, then use planetary flybys to reach the target slowly but cheaply. Flyby sequence is a game estimate.", "riskDelta": 0.02, "fuelFactor": 0.6, "timeDelta": 3},
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
    "autonomy": {"name": "Autonomous Operations", "science": 26, "credits": 26, "turns": 2, "requires": ["robotics"], "description": "Two more standing-order slots for every base."},
}

RESOURCE_KEYS = ("energy", "materials", "fuel", "water", "food", "oxygen", "heat")
MAX_RESOURCE = 400
MAP_SIZE = 32  # Large, independent explorable surface for every planetary hub.


def catalog() -> dict:
    """Public configuration for browser forms. The UI does not change these rules."""
    return {
        "worlds": WORLDS, "hulls": HULLS, "engines": ENGINES,
        "payloads": PAYLOADS, "trajectories": TRAJECTORIES,
        "buildings": BUILDINGS, "research": RESEARCH,
        "resources": list(RESOURCE_KEYS),
        "mapSize": MAP_SIZE,
        "notice": "All fuel, time, risk, heat, and resource coefficients are gameplay estimates pending GMAT inputs, not validated NASA calculations.",
    }


# ---------------------------------------------------------------------------
# Campaign V3 flight physics.
#
# Gravitational parameters and radii are standard planetary constants. Capture
# orbits, landing delta-v and the gravity-assist option are GAME ASSUMPTIONS,
# chosen to resemble real mission classes; they are labelled as such in the UI.
# Earth-departure windows come from tools/build_campaign_windows.py, which
# reads NASA GMAT's bundled DE421 ephemeris and Atlas V 401 performance data.
# ---------------------------------------------------------------------------

G0 = 9.80665
TURN_DAYS = 90                 # one game turn = one quarter year
CAMPAIGN_START = "2028-07-01"  # date at the start of turn 1
FUEL_UNIT_KG = 25              # one "fuel" stock unit = 25 kg of propellant

# Body that the interplanetary transfer targets for each destination world.
FLIGHT_TARGET = {"mars": "mars", "venus": "venus", "mercury": "mercury", "europa": "jupiter"}

PHYSICS = {
    "mars": {"gm": 42828.37, "radiusKm": 3389.5, "periapsisKm": 400, "apoapsisKm": 33000,
             "landingDvKms": 0.6, "extraDvKms": 0.0, "directEntry": True,
             "orbitNote": "400 x 33,000 km capture orbit, then aerobraking, like MRO (game assumption)",
             "landingNote": "aeroshell, parachute and powered descent (game estimate)"},
    "venus": {"gm": 324858.59, "radiusKm": 6051.8, "periapsisKm": 300, "apoapsisKm": 66000,
              "landingDvKms": 0.1, "extraDvKms": 0.0, "directEntry": True,
              "orbitNote": "300 x 66,000 km polar orbit, like Venus Express (game assumption)",
              "landingNote": "atmospheric entry and parachute (game estimate)"},
    "mercury": {"gm": 22031.87, "radiusKm": 2439.4, "periapsisKm": 200, "apoapsisKm": 10000,
                "landingDvKms": 3.4, "extraDvKms": 0.0, "directEntry": False,
                "orbitNote": "200 x 10,000 km orbit, like MESSENGER (game assumption)",
                "landingNote": "fully propulsive descent, no atmosphere (game estimate)"},
    "europa": {"gm": 126686534.0, "radiusKm": 71492.0, "periapsisKm": 14300, "apoapsisKm": 10700000,
               "landingDvKms": 2.1, "extraDvKms": 0.9, "directEntry": False,
               "orbitNote": "Jupiter orbit insertion at 1.2 Jupiter radii, then a moon tour to Europa (+0.9 km/s, game estimate)",
               "landingNote": "fully propulsive descent onto Europa's ice (game estimate)"},
}

# Launch vehicles. Atlas V 401 uses NASA GMAT's EMTG performance polynomial
# (loaded from ares/data/campaign_windows.json). The two larger classes are
# GAME ESTIMATES (an exponential fit, not a published performance curve).
LAUNCH_VEHICLES = {
    "atlas_v_401": {"name": "Atlas V 401", "credits": 45, "dlaLimitDeg": 28.5, "c3Max": 60,
                    "source": "gmat", "note": "Performance from NASA GMAT's EMTG launch-vehicle library."},
    "heavy": {"name": "Heavy-lift class", "credits": 90, "dlaLimitDeg": 35, "c3Max": 100,
              "source": "estimate", "kgAtZero": 9500, "c3Scale": 38,
              "note": "Game estimate: about 3x an Atlas V 401 at low C3."},
    "super_heavy": {"name": "Super-heavy class", "credits": 160, "dlaLimitDeg": 40, "c3Max": 130,
                    "source": "estimate", "kgAtZero": 50000, "c3Scale": 30,
                    "note": "Game estimate for the largest rockets; still struggles with direct Jupiter launches."},
}

# Gravity-assist route (game estimate): the spacecraft leaves Earth on this
# turn's Venus transfer, then uses flybys (as MESSENGER and Galileo did).
ASSIST = {
    "mercury": {"turns": 26, "arrivalVinf": 2.5, "maxVenusDv": 6.0, "label": "Venus-Venus-Mercury flybys (like MESSENGER, ~6.5 years)"},
    "europa": {"turns": 24, "arrivalVinf": 5.6, "maxVenusDv": 6.0, "label": "Venus-Earth-Earth flybys (like Galileo, ~6 years)"},
}

# Departures from a hub that is not on Earth have no GMAT data yet: these are
# game estimates of the arrival speed at the destination.
ESTIMATED_ARRIVAL_VINF = {"mars": 3.0, "venus": 3.5, "mercury": 5.0, "europa": 6.0}
TCM_DV_KMS = 0.05  # trajectory-correction allowance for every mission (game estimate)
BOILOFF_PER_TURN = 0.02  # cryogenic propellant lost per turn of flight beyond 4 turns (game estimate)

# Fault scenario that the cruise/arrival phase plays out at each destination.
ARRIVAL_SCENARIO = {"mars": "dust", "venus": "camera", "mercury": "eclipse", "europa": "radiation"}
SCENARIO_INTENSITY = (0.85, 1.25)  # actual conditions vary per mission around the lab test

# Surface hazards (game values). chance = per-turn chance a forecast is issued
# for a hub on that world; growth = severity added per elapsed turn.
HAZARDS = {
    "mars": {"name": "Dust storm", "chance": 0.24, "growth": 0.4, "solarCut": 0.7, "building": 10, "crew": 6, "heat": 4, "electronics": 0},
    "venus": {"name": "Pressure and heat spike", "chance": 0.30, "growth": 0.3, "solarCut": 0.3, "building": 16, "crew": 8, "heat": 0, "electronics": 4},
    "mercury": {"name": "Thermal shock", "chance": 0.28, "growth": 0.3, "solarCut": 0.2, "building": 12, "crew": 8, "heat": 10, "electronics": 4},
    "europa": {"name": "Radiation surge", "chance": 0.30, "growth": 0.3, "solarCut": 0.0, "building": 4, "crew": 10, "heat": 0, "electronics": 16},
}
FORECAST_LEAD = 2       # turns of warning before a hazard strikes
PREPARE_COST = 8        # materials to prepare a hub manually (must be ordered a turn ahead)

# Building wear per turn (condition points) by world; shields halve it.
WEAR = {"mars": 2, "venus": 5, "mercury": 4, "europa": 3}
REPAIR_COST = 10
DARK_TURNS_TO_LOSE = 3

# Base standing orders (player-written). Sensors are read at the start of each turn.
ORDER_SENSORS = {
    "hazard": {"name": "Hazard severity this turn", "unit": "", "min": 0, "max": 100},
    "hazard_next": {"name": "Hazard forecast next turn", "unit": "", "min": 0, "max": 100},
    "energy": {"name": "Energy stock", "unit": "", "min": 0, "max": 400},
    "heat": {"name": "Heat stock", "unit": "", "min": 0, "max": 400},
    "materials": {"name": "Materials stock", "unit": "", "min": 0, "max": 400},
    "food": {"name": "Food stock", "unit": "", "min": 0, "max": 400},
    "water": {"name": "Water stock", "unit": "", "min": 0, "max": 400},
    "health": {"name": "Crew health", "unit": "%", "min": 0, "max": 100},
    "condition": {"name": "Worst building condition", "unit": "%", "min": 0, "max": 100},
}
ORDER_RESPONSES = {
    "stow_arrays": {"name": "Stow solar arrays", "help": "Arrays take no hazard damage, but produce only 30% this turn."},
    "shelter_crew": {"name": "Shelter crew / safe mode", "help": "Crew and electronics are protected from the hazard; labs and drills stop this turn."},
    "power_save": {"name": "Power-saving mode", "help": "Labs, drills and extractors switch off this turn to save energy."},
    "reinforce": {"name": "Reinforce structures", "help": "Spend 6 materials: hazard damage to buildings is halved this turn."},
    "ration": {"name": "Ration supplies", "help": "Crew uses 1 less food and water this turn, but health drops by 1."},
    "auto_repair": {"name": "Repair worst building", "help": "Spend 10 materials to restore the most worn building to 100%."},
}
ORDER_SLOTS = 4
ORDER_SLOTS_AUTONOMY = 2
EXAMPLE_ORDERS = [
    {"when": [{"sensor": "hazard", "op": ">", "value": 50}], "then": "shelter_crew"},
]

# Programme goals (deadline = last turn to complete). Deterministic for every campaign.
GOALS = [
    {"id": "venus_reached", "title": "Reach Venus with any mission", "deadline": 12, "reward": 35, "kind": "visit", "world": "venus"},
    {"id": "mars_relay", "title": "Deploy a Mars orbital relay", "deadline": 14, "reward": 40, "kind": "orbital", "world": "mars"},
    {"id": "mars_crew", "title": "Keep Mars crew health at 70% or more on turn 12", "deadline": 12, "reward": 30, "kind": "health", "world": "mars", "value": 70},
    {"id": "science_400", "title": "Collect 400 total science", "deadline": 16, "reward": 35, "kind": "science", "value": 400},
    {"id": "second_mars_base", "title": "Run two active Mars surface bases", "deadline": 22, "reward": 45, "kind": "surface_count", "world": "mars", "value": 2},
    {"id": "mercury_orbit", "title": "Put a station in orbit around Mercury", "deadline": 40, "reward": 70, "kind": "orbital", "world": "mercury"},
    {"id": "europa_reached", "title": "Deliver a mission to Europa", "deadline": 40, "reward": 80, "kind": "visit", "world": "europa"},
]

REVIEW_EVERY = 4                     # turns between programme reviews (one year)
BUDGET_START, BUDGET_MIN, BUDGET_MAX = 12, 4, 30


def campaign_catalog() -> dict:
    """Catalog plus the V3 flight, fault and programme tables."""
    from .fault_data import FAULT_COMPUTERS, FAULT_INSTRUMENTS, FAULT_RESPONSES, FAULT_SENSORS, FAULT_SCENARIOS
    base = catalog()
    base.update({
        "physics": PHYSICS, "turnDays": TURN_DAYS, "campaignStart": CAMPAIGN_START, "fuelUnitKg": FUEL_UNIT_KG,
        "vehicles": LAUNCH_VEHICLES, "assist": ASSIST,
        "computers": FAULT_COMPUTERS,
        "faults": {
            "sensors": FAULT_SENSORS, "responses": FAULT_RESPONSES, "instruments": FAULT_INSTRUMENTS,
            "scenarios": {k: {"name": v["name"], "description": v["description"]} for k, v in FAULT_SCENARIOS.items()},
            "arrivalScenario": ARRIVAL_SCENARIO, "limits": {"conditions": 2, "for": 3},
        },
        "orders": {"sensors": ORDER_SENSORS, "responses": ORDER_RESPONSES, "slots": ORDER_SLOTS, "autonomySlots": ORDER_SLOTS_AUTONOMY, "example": EXAMPLE_ORDERS},
        "hazards": HAZARDS, "goals": GOALS, "reviewEvery": REVIEW_EVERY,
        "repairCost": REPAIR_COST, "prepareCost": PREPARE_COST,
        "notice": "Earth departures use NASA GMAT data (DE421 ephemeris, Atlas V 401 curve). Other coefficients are labelled game estimates.",
    })
    return base
