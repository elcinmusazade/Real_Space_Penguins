"""Spacecraft subsystems, destination environments, and the planet fit check.

Six part slots (power, heat control, radiation shield, landing system, hull
strength, antenna) give each design properties that matter at some worlds and
are dead weight at others. The fit check compares a design with a world and
explains every warning. It never blocks a launch: a poor fit makes the mission
arrive damaged (see campaign._arrive_mission).

Environment figures are rounded from NASA planetary fact sheets (distance,
temperature, pressure, gravity). Radiation index, part ratings and pass limits
are game values. Solar power falls with the square of distance from the Sun.
"""

from __future__ import annotations

SLOTS = ("power", "thermal", "shielding", "entry", "structure", "comms")
SLOT_NAMES = {"power": "Power", "thermal": "Heat control", "shielding": "Radiation shield",
              "entry": "Landing system", "structure": "Hull strength", "comms": "Antenna"}

# mass kg, materials, credits; the remaining keys are the part's properties.
PARTS = {
    "power": {
        "solar_s": {"name": "Solar panels (small)", "mass": 40, "materials": 3, "credits": 2, "solarW": 300},
        "solar_m": {"name": "Solar panels (medium)", "mass": 80, "materials": 5, "credits": 4, "solarW": 600},
        "solar_l": {"name": "Solar panels (large)", "mass": 150, "materials": 8, "credits": 6, "solarW": 1100},
        "rtg": {"name": "Nuclear battery (RTG)", "mass": 60, "materials": 8, "credits": 30, "steadyW": 250},
        "battery": {"name": "Battery pack", "mass": 90, "materials": 4, "credits": 3, "storedW": 160},
    },
    "thermal": {
        "basic": {"name": "Basic insulation", "mass": 20, "materials": 1, "credits": 1, "range": [-130, 120]},
        "radiators": {"name": "Radiators + sun shade", "mass": 90, "materials": 5, "credits": 5, "range": [-190, 480]},
        "insulated": {"name": "Insulation + heaters", "mass": 70, "materials": 4, "credits": 4, "range": [-240, 60], "heaterW": 40},
    },
    "shielding": {
        "none": {"name": "No shielding", "mass": 0, "materials": 0, "credits": 0, "rating": 30, "reduction": 0.0},
        "light": {"name": "Light shielding", "mass": 100, "materials": 5, "credits": 4, "rating": 70, "reduction": 0.1},
        "heavy": {"name": "Radiation vault", "mass": 250, "materials": 10, "credits": 10, "rating": 100, "reduction": 0.2},
    },
    "entry": {
        "none": {"name": "No landing system", "mass": 0, "materials": 0, "credits": 0},
        "parachute": {"name": "Aeroshell + parachute", "mass": 120, "materials": 5, "credits": 5, "needsAtmosphere": True},
        "rockets": {"name": "Heat shield + landing rockets", "mass": 300, "materials": 9, "credits": 9},
        "floats": {"name": "Floats (cloud platform)", "mass": 150, "materials": 6, "credits": 6, "floats": True},
    },
    "structure": {
        "standard": {"name": "Standard hull", "mass": 0, "materials": 0, "credits": 0, "pressureBar": 1.5},
        "pressure": {"name": "Pressure-proof hull", "mass": 300, "materials": 12, "credits": 10, "pressureBar": 100},
    },
    "comms": {
        "small": {"name": "Small antenna", "mass": 10, "materials": 1, "credits": 1, "rate": 1},
        "dish": {"name": "Large dish", "mass": 60, "materials": 4, "credits": 4, "rate": 3},
        "relay": {"name": "Relay link", "mass": 30, "materials": 2, "credits": 3, "rate": 4, "needsRelay": True},
    },
}
DEFAULT_PARTS = {"power": "solar_m", "thermal": "basic", "shielding": "none", "entry": "parachute", "structure": "standard", "comms": "small"}

# sunlight = 1 / distance^2 (AU); surfaceSunlight where clouds block light.
# temp = [min, max] in deg C at the surface / cloud level; orbitTemp for orbit and flyby.
ENVIRONMENT = {
    "mercury": {"au": 0.387, "sunlight": 6.68, "temp": [-180, 430], "orbitTemp": [-150, 350], "pressureBar": 0, "atmosphere": False, "solid": True, "radiation": 25, "gravity": 3.7},
    "venus": {"au": 0.723, "sunlight": 1.91, "surfaceSunlight": 0.05, "temp": [440, 470], "orbitTemp": [-40, 120], "pressureBar": 92, "atmosphere": True, "solid": True, "radiation": 10, "gravity": 8.9},
    "earth": {"au": 1.0, "sunlight": 1.0, "temp": [-40, 45], "orbitTemp": [-100, 120], "pressureBar": 1, "atmosphere": True, "solid": True, "radiation": 5, "gravity": 9.8},
    "mars": {"au": 1.524, "sunlight": 0.43, "temp": [-110, 20], "orbitTemp": [-120, 80], "pressureBar": 0.006, "atmosphere": True, "solid": True, "radiation": 15, "gravity": 3.7},
    "europa": {"au": 5.2, "sunlight": 0.037, "temp": [-220, -140], "orbitTemp": [-200, -100], "pressureBar": 0, "atmosphere": False, "solid": True, "radiation": 95, "gravity": 1.3},
    "jupiter": {"au": 5.2, "sunlight": 0.037, "temp": [-145, -100], "orbitTemp": [-200, -100], "pressureBar": None, "atmosphere": True, "solid": False, "radiation": 85, "gravity": 24.8},
    "saturn": {"au": 9.54, "sunlight": 0.011, "temp": [-180, -130], "orbitTemp": [-200, -150], "pressureBar": None, "atmosphere": True, "solid": False, "radiation": 30, "gravity": 10.4},
    "uranus": {"au": 19.2, "sunlight": 0.0027, "temp": [-220, -190], "orbitTemp": [-230, -200], "pressureBar": None, "atmosphere": True, "solid": False, "radiation": 20, "gravity": 8.7},
    "neptune": {"au": 30.07, "sunlight": 0.0011, "temp": [-220, -200], "orbitTemp": [-235, -210], "pressureBar": None, "atmosphere": True, "solid": False, "radiation": 25, "gravity": 11.2},
}
BASE_POWER_W = 120
PAYLOAD_POWER_W = 40


def legacy(design: dict) -> bool:
    """Designs saved before part slots existed carry no 'parts'; they keep the old behaviour."""
    return not isinstance(design.get("parts"), dict)


def validate_parts(parts: object) -> tuple[dict | None, str | None]:
    if not isinstance(parts, dict):
        return None, "Choose the spacecraft parts."
    clean = {}
    for slot in SLOTS:
        choice = parts.get(slot, DEFAULT_PARTS[slot])
        if choice not in PARTS[slot]:
            return None, f"Choose a valid {SLOT_NAMES[slot].lower()}."
        clean[slot] = choice
    if set(parts) - set(SLOTS):
        return None, "Unknown spacecraft part slot."
    return clean, None


def parts_of(design: dict) -> dict:
    return design["parts"] if not legacy(design) else dict(DEFAULT_PARTS)


def totals(parts: dict) -> dict:
    chosen = [PARTS[slot][parts[slot]] for slot in SLOTS]
    return {key: sum(p[key] for p in chosen) for key in ("mass", "materials", "credits")}


def power_budget(parts: dict, payload: list[str], world: str, objective: str) -> dict:
    env = ENVIRONMENT[world]
    power, thermal = PARTS["power"][parts["power"]], PARTS["thermal"][parts["thermal"]]
    light = env.get("surfaceSunlight", env["sunlight"]) if objective == "surface" else env["sunlight"]
    supply = power.get("solarW", 0) * min(light, 2.0) + power.get("steadyW", 0) + power.get("storedW", 0)
    temps = env["temp"] if objective == "surface" else env["orbitTemp"]
    heaters = thermal.get("heaterW", 0) if temps[0] < thermal["range"][0] + 120 else 0
    need = BASE_POWER_W + PAYLOAD_POWER_W * len(payload) + heaters
    return {"supplyW": round(supply), "needW": need, "sunlight": light}


def _band(value: float, ok: float, warn: float) -> str:
    return "ok" if value >= ok else "warn" if value >= warn else "fail"


def fit(design: dict, world: str, objective: str, has_relay: bool = False) -> dict:
    """Compare a design with one world. Returns checks with ok / warn / fail and a reason each."""
    parts, payload, env = parts_of(design), design.get("payload", []), ENVIRONMENT[world]
    checks = []

    budget = power_budget(parts, payload, world, objective)
    ratio = budget["supplyW"] / budget["needW"]
    status = _band(ratio, 1.0, 0.5)
    checks.append({"id": "power", "label": "Power", "status": status,
                   "detail": f"{budget['supplyW']} W available vs {budget['needW']} W needed (sunlight {budget['sunlight']:.3g}× Earth's)."
                   + (" Solar panels are too weak this far from the Sun: use a nuclear battery." if status != "ok" and "solarW" in PARTS["power"][parts["power"]] and budget["sunlight"] < 0.2 else "")})

    temps = env["temp"] if objective == "surface" else env["orbitTemp"]
    lo, hi = PARTS["thermal"][parts["thermal"]]["range"]
    over = max(temps[1] - hi, lo - temps[0], 0)
    status = "ok" if over == 0 else "warn" if over <= 40 else "fail"
    side = "hot" if temps[1] > hi else "cold"
    checks.append({"id": "thermal", "label": "Heat control", "status": status,
                   "detail": f"{'Surface' if objective == 'surface' else 'Orbit'} ranges {temps[0]} to {temps[1]} °C; this ship handles {lo} to {hi} °C."
                   + ("" if status == "ok" else " Too hot: fit radiators and a sun shade." if side == "hot" else " Too cold: fit insulation and heaters.")})

    shield = PARTS["shielding"][parts["shielding"]]
    status = "ok" if shield["rating"] >= env["radiation"] else "warn" if shield["rating"] + 20 >= env["radiation"] else "fail"
    checks.append({"id": "shielding", "label": "Radiation", "status": status,
                   "detail": f"Radiation level {env['radiation']}/100; shielding rated {shield['rating']}." + ("" if status == "ok" else " Add heavier shielding.")})

    entry = PARTS["entry"][parts["entry"]]
    if objective == "surface":
        if not env["solid"]:
            status, text = ("ok", "Floats keep the platform up in the cloud layer.") if entry.get("floats") else ("fail", "No solid surface: a cloud platform needs floats.")
        elif entry.get("floats"):
            status, text = "fail", "Floats are useless on a solid world."
        elif parts["entry"] == "none":
            status, text = "fail", "A landing needs a landing system."
        elif entry.get("needsAtmosphere") and not env["atmosphere"]:
            status, text = "fail", "No atmosphere for a parachute: use a heat shield with landing rockets."
        else:
            status, text = "ok", f"{entry['name']} suits this world."
    else:
        status, text = ("ok", "Not landing, so no landing system is needed.") if parts["entry"] == "none" else ("warn", f"{entry['name']} is dead weight on a mission that does not land.")
    checks.append({"id": "entry", "label": "Landing system", "status": status, "detail": text})

    rating = PARTS["structure"][parts["structure"]]["pressureBar"]
    pressure = env["pressureBar"] if objective == "surface" and env["solid"] else None
    if pressure is None or pressure <= rating:
        status, text = ("warn", "Pressure-proof hull is dead weight here.") if parts["structure"] == "pressure" and (pressure or 0) < 5 else ("ok", "Pressure is within the hull's rating.")
    else:
        status, text = "fail", f"Surface pressure is {pressure:g}× Earth's; this hull handles {rating:g}×. Use a pressure-proof hull."
    checks.append({"id": "structure", "label": "Hull strength", "status": status, "detail": text})

    comm = PARTS["comms"][parts["comms"]]
    rate = comm["rate"] if not comm.get("needsRelay") or has_relay else 1
    need = 1 if env["au"] <= 1.6 else 2 if env["au"] <= 6 else 3 if env["au"] <= 10 else 4
    status = "ok" if rate >= need else "warn" if rate == need - 1 else "fail"
    checks.append({"id": "comms", "label": "Antenna", "status": status,
                   "detail": f"Needs data rate {need} at {env['au']:g} AU; this antenna gives {rate}." + (" The relay link only works with an orbital hub there." if comm.get("needsRelay") and not has_relay else "") + ("" if status == "ok" else " Less science will reach Earth.")})

    worst = "fail" if any(c["status"] == "fail" for c in checks) else "warn" if any(c["status"] == "warn" for c in checks) else "ok"
    return {"world": world, "status": worst, "checks": checks}


def fit_all(design: dict, objective: str, relays: set[str] | None = None) -> list[dict]:
    relays = relays or set()
    return [{"world": w, **{k: v for k, v in fit(design, w, objective, w in relays).items() if k != "world"}} for w in ENVIRONMENT]


def sim_profile(design: dict | None, world: str, objective: str) -> dict | None:
    """Ship values the fault simulator uses. None for legacy designs (old generic probe)."""
    if design is None or legacy(design):
        return None
    parts, payload = design["parts"], design.get("payload", [])
    budget = power_budget(parts, payload, world, objective)
    shield, comm = PARTS["shielding"][parts["shielding"]], PARTS["comms"][parts["comms"]]
    power = PARTS["power"][parts["power"]]
    # Scale watts to the simulator's power units (34 units = the old Mars orbiter's arrays).
    supply = (power.get("solarW", 0) * min(budget["sunlight"], 2.0)) / 7.5
    instruments = ["camera"] + (["spectrometer"] if "lab" in payload else []) + (["radar"] if "survey" in payload else [])
    return {
        "solar": supply, "steady": power.get("steadyW", 0) / 7.5, "batteryBonus": power.get("storedW", 0) / 4,
        "radReduction": shield["reduction"], "thermal": PARTS["thermal"][parts["thermal"]]["range"],
        "downlink": {1: 1.0, 3: 1.5, 4: 1.8}[comm["rate"]], "instruments": instruments,
    }


def catalog() -> dict:
    return {"slots": list(SLOTS), "slotNames": SLOT_NAMES, "parts": PARTS, "defaults": DEFAULT_PARTS, "environment": ENVIRONMENT}
