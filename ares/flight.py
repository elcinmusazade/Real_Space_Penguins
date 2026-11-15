"""Campaign V3 flight planning: launch windows, rockets, delta-v and launch checks.

Earth departures to Mars, Venus, Mercury and Europa read
ares/data/campaign_windows.json, which
tools/build_campaign_windows.py computes offline from NASA GMAT's bundled DE421
ephemeris and Atlas V 401 performance data. All outer-planet routes,
floating platforms, departures from other hubs, the
gravity-assist route, the larger rocket classes, capture orbits and landing
delta-v are labelled game estimates.
"""

from __future__ import annotations

import json
import math
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path

from .campaign_data import (
    ASSIST, ATMOSPHERIC_WORLDS, BOILOFF_PER_TURN, CAMPAIGN_START, ENGINES, ESTIMATED_ARRIVAL_VINF, FUEL_UNIT_KG,
    ESTIMATED_EARTH_C3, ESTIMATED_LIGHT_MINUTES,
    G0, HULLS, LAUNCH_VEHICLES, PAYLOADS, PHYSICS, ROUTES, TCM_DV_KMS, TRAJECTORIES, TURN_DAYS,
)
from .fault_data import FAULT_COMPUTERS
from . import ship

TABLE_PATH = Path(__file__).resolve().parent / "data" / "campaign_windows.json"
PROPELLANT_MAX_KG = 9000


@lru_cache(maxsize=1)
def table() -> dict:
    return json.loads(TABLE_PATH.read_text())


def turn_date(turn: int) -> str:
    return (date.fromisoformat(CAMPAIGN_START) + timedelta(days=TURN_DAYS * (turn - 1))).isoformat()


def _turn_row(world: str, turn: int) -> dict:
    rows = table()["destinations"][world]
    # The table covers 80 turns (20 years); later turns reuse it cyclically.
    return rows[(turn - 1) % len(rows)]


def light_minutes(world: str, turn: int) -> float:
    if world == "earth":
        return 0.0
    if world in ESTIMATED_LIGHT_MINUTES:
        return ESTIMATED_LIGHT_MINUTES[world]
    return _turn_row(world, turn)["lightMinutes"]


def capacity_kg(vehicle_id: str, c3: float) -> float:
    spec = LAUNCH_VEHICLES[vehicle_id]
    if c3 > spec["c3Max"] or c3 < 0:
        return 0.0
    if spec["source"] == "gmat":
        lv = table()["atlasV401"]
        return max(0.0, sum(k * c3 ** i for i, k in enumerate(lv["coefficients"])) - lv["adapterMassKg"])
    return spec["kgAtZero"] * math.exp(-c3 / spec["c3Scale"])


def capture_dv(world: str, vinf: float) -> float:
    """Impulsive capture, or an explicit outer-platform game allowance."""
    p = PHYSICS[world]
    if "captureEstimateKms" in p:
        return p["captureEstimateKms"] * vinf / ESTIMATED_ARRIVAL_VINF[world]
    rp = p["radiusKm"] + p["periapsisKm"]
    ra = p["radiusKm"] + p["apoapsisKm"]
    a = (rp + ra) / 2
    return math.sqrt(vinf ** 2 + 2 * p["gm"] / rp) - math.sqrt(p["gm"] * (2 / rp - 1 / a)) + p["extraDvKms"]


def transfer(source_world: str, world: str, trajectory: str, turn: int) -> dict | None:
    """The transfer available this turn, or None when the option does not exist."""
    if source_world == world == "earth":
        return None
    if source_world == "earth" and world in table()["destinations"]:
        row = _turn_row(world, turn)
        if trajectory == "assist":
            if world not in ASSIST:
                return None
            venus = _turn_row("venus", turn)["options"].get("balanced") or _turn_row("venus", turn)["options"]["efficient"]
            spec = ASSIST[world]
            launch = date.fromisoformat(venus["launch"])
            arrival = launch + timedelta(days=spec["turns"] * TURN_DAYS)
            return {"source": "assist", "launch": venus["launch"], "arrival": arrival.isoformat(),
                    "transferDays": spec["turns"] * TURN_DAYS, "c3": venus["c3"], "dlaDeg": venus["dlaDeg"],
                    "arrivalVinf": spec["arrivalVinf"], "arc": venus["arc"], "venusDv": venus["totalDvKms"],
                    "goodWindow": venus["totalDvKms"] <= spec["maxVenusDv"], "label": spec["label"]}
        option = row["options"].get(trajectory)
        if option is None:
            return None
        return {"source": "gmat", **option, "goodWindow": True}
    if trajectory == "assist":
        return None
    base = ROUTES.get((source_world, world), ROUTES.get((world, source_world), 5)) if source_world != world else 1
    days = max(1, base + TRAJECTORIES[trajectory]["timeDelta"]) * TURN_DAYS
    vinf = ESTIMATED_ARRIVAL_VINF[world] * {"efficient": 0.85, "balanced": 1.0, "fast": 1.3}[trajectory]
    c3 = ESTIMATED_EARTH_C3[world] * {"efficient": .85, "balanced": 1.0, "fast": 1.1}[trajectory] if source_world == "earth" else None
    return {"source": "estimate", "transferDays": days, "arrivalVinf": round(vinf, 2), "c3": c3, "dlaDeg": 0.0 if source_world == "earth" else None,
            "launch": turn_date(turn), "arrival": (date.fromisoformat(turn_date(turn)) + timedelta(days=days)).isoformat(),
            "arc": None, "goodWindow": True}


def upcoming(world: str, turn: int, count: int = 12) -> list[dict]:
    """Best Earth departure in each of the next turns, for the window planner."""
    if world not in table()["destinations"]:
        return []
    out = []
    for t in range(turn, turn + count):
        row = _turn_row(world, t)
        best = row["options"]["efficient"]
        safe = row["options"].get("balanced")
        out.append({"turn": t, "date": turn_date(t), "totalDvKms": best["totalDvKms"], "c3": best["c3"],
                    "safeDvKms": safe["totalDvKms"] if safe else None, "transferDays": best["transferDays"]})
    return out


def masses(design: dict, computer: str) -> dict:
    hull, engine = HULLS[design["hull"]], ENGINES[design["engine"]]
    carried = engine["mass"] + sum(PAYLOADS[p]["mass"] for p in design["payload"])
    parts = 0 if ship.legacy(design) else ship.totals(design["parts"])["mass"]
    dry = hull["dryKg"] + carried + parts + FAULT_COMPUTERS[computer]["mass"] * 10
    return {"carried": carried, "capacity": hull["capacity"], "dry": dry, "parts": parts}


def assess(state: dict, design: dict, source_world: str, computer: str) -> dict:
    """Launch, mass and delta-v checks for a validated design. Pure and deterministic."""
    world, objective, engine = design["destination"], design["objective"], ENGINES[design["engine"]]
    trajectory = design["trajectory"]
    leg = transfer(source_world, world, trajectory, state["turn"])
    if leg is None:
        return {"ok": False, "error": "Gravity assists are only available from Earth to Mercury or Europa." if trajectory == "assist" else "No transfer of that type exists this turn. Try another trajectory option."}
    m = masses(design, computer)
    prop = design["propellantKg"]
    wet = m["dry"] + prop
    turns = max(1, math.ceil(leg["transferDays"] / TURN_DAYS) + engine["timeDelta"])
    boil = 0.0
    if design["engine"] == "high_thrust" and turns > 4:
        boil = min(0.5, BOILOFF_PER_TURN * (turns - 4))
    usable = prop * (1 - boil)
    dv_have = engine["isp"] * G0 * math.log((m["dry"] + usable) / m["dry"]) / 1000

    vinf = leg["arrivalVinf"]
    capture = capture_dv(world, vinf) * engine["captureFactor"]
    landing = PHYSICS[world]["landingDvKms"]
    if objective == "orbital":
        need = TCM_DV_KMS + capture
    elif objective == "surface":
        # Earth, Mars and Venus landers enter the atmosphere straight from the approach
        # hyperbola; airless Mercury and Europa need a capture burn first.
        need = TCM_DV_KMS + landing + (0.0 if PHYSICS[world]["directEntry"] else capture)
    else:
        need = TCM_DV_KMS
    if design["engine"] == "ion" and world in ("europa", *ATMOSPHERIC_WORLDS):
        need *= 1.3  # weak outer-system sunlight: the electric engine runs at reduced power (game estimate)

    checks = []
    vehicle = None
    if source_world == "earth":
        vehicle = LAUNCH_VEHICLES[design["vehicle"]]
        limit = vehicle["dlaLimitDeg"]
        cap = capacity_kg(design["vehicle"], leg["c3"])
        checks.append({"id": "dla", "label": "Launch direction", "ok": abs(leg["dlaDeg"]) <= limit,
                       "detail": f"Departure declination {leg['dlaDeg']:+.1f}° vs the {vehicle['name']} limit of ±{limit:g}°"})
        checks.append({"id": "mass", "label": "Launch mass", "ok": wet <= cap,
                       "detail": f"{wet:,.0f} kg on the pad vs {cap:,.0f} kg the {vehicle['name']} can send at C3 {leg['c3']:.1f} km²/s²"})
    label = {"surface": "Entry and landing" if PHYSICS[world]["directEntry"] else "Capture and landing", "orbital": "Orbit capture", "survey": "Course corrections"}[objective]
    if world in ATMOSPHERIC_WORLDS and objective == "surface":
        label = "Atmospheric platform deployment"
    checks.append({"id": "dv", "label": label, "ok": dv_have >= need,
                   "detail": f"Needs {need:.2f} km/s (arrival {vinf:.2f} km/s); propellant gives {dv_have:.2f} km/s" + (f" after {boil:.0%} boil-off" if boil else "")})
    failed = next((c for c in checks if not c["ok"]), None)
    outcome = "go" if not failed else {"dla": "scrub", "mass": "stranded", "dv": "flyby" if objective != "survey" else "drift"}[failed["id"]]
    margin = (dv_have - need) / need if need > 0 else 1.0
    return {
        "ok": True, "outcome": outcome, "checks": checks, "turns": turns,
        "transfer": {k: leg[k] for k in ("source", "launch", "arrival", "transferDays", "c3", "dlaDeg", "arrivalVinf", "goodWindow") if k in leg}
                    | ({"label": leg["label"], "venusDv": leg["venusDv"]} if leg["source"] == "assist" else {}),
        "arc": leg["arc"],
        "numbers": {
            "dryKg": round(m["dry"]), "propellantKg": prop, "launchKg": round(wet), "carriedKg": m["carried"],
            "capacityKg": m["capacity"], "dvNeedKms": round(need, 3), "dvHaveKms": round(dv_have, 3),
            "dvMargin": round(margin, 3), "boiloff": round(boil, 3),
            "vehicleCapacityKg": round(capacity_kg(design["vehicle"], leg["c3"])) if vehicle else None,
            "fuelUnits": math.ceil(prop / FUEL_UNIT_KG),
        },
        "vehicle": vehicle["name"] if vehicle else None,
    }
