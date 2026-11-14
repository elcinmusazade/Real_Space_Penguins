"""Orbiter launch prelude: does the player's design reach Mars orbit?

All astrodynamics inputs come from NASA GMAT data, precomputed offline by
tools/build_mars_launch_table.py into ares/data/mars_launch_windows.json:
launch dates, C3, departure declination (DLA), arrival v-infinity, the Atlas V
401 performance curve, and trajectory points for the animation.

Python decides pass/fail; the browser only animates the returned outcome.
"""

from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

from . import faults
from .rules import FAULT_COMPUTERS, G0, LAUNCH_ORBITER, MARS_GM, MARS_RADIUS_KM

TABLE_PATH = Path(__file__).resolve().parent / "data" / "mars_launch_windows.json"


@lru_cache(maxsize=1)
def table() -> dict:
    return json.loads(TABLE_PATH.read_text())


def windows() -> dict:
    return {w["id"]: w for w in table()["windows"]}


def capacity_kg(c3: float) -> float:
    """Atlas V 401 deliverable mass at a given C3 (GMAT/EMTG polynomial)."""
    lv = table()["launchVehicle"]
    return sum(k * c3 ** i for i, k in enumerate(lv["coefficients"])) - lv["adapterMassKg"]


def capture_dv_kms(vinf: float) -> float:
    """Single impulsive burn at periapsis from a hyperbola into the target orbit."""
    rp = MARS_RADIUS_KM + LAUNCH_ORBITER["orbitPeriapsisKm"]
    ra = MARS_RADIUS_KM + LAUNCH_ORBITER["orbitApoapsisKm"]
    a = (rp + ra) / 2
    v_hyperbola = math.sqrt(vinf ** 2 + 2 * MARS_GM / rp)
    v_orbit = math.sqrt(MARS_GM * (2 / rp - 1 / a))
    return v_hyperbola - v_orbit


def catalog() -> dict:
    t = table()
    lv = t["launchVehicle"]
    return {
        "vehicle": {"name": lv["name"], "dlaLimitDeg": lv["dlaLimitDeg"], "c3Range": lv["c3Range"], "source": lv["source"]},
        "orbiter": LAUNCH_ORBITER,
        "computers": FAULT_COMPUTERS,
        "sources": t["sources"], "method": t["method"],
        "windows": [{**w, "capacityKg": round(capacity_kg(w["c3"])), "captureDvKms": round(capture_dv_kms(w["arrivalVinf"]), 3)} for w in t["windows"]],
        "orbitTracks": t["orbitTracks"],
    }


def _number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def assess(window_id: object, propellant: object, design: object) -> dict:
    """Validate the launch plan and decide the outcome. Pure and deterministic."""
    win = windows().get(window_id) if isinstance(window_id, str) else None
    if not win:
        return {"ok": False, "error": "Choose a launch date."}
    lo, hi = LAUNCH_ORBITER["propellantMinKg"], LAUNCH_ORBITER["propellantMaxKg"]
    if not _number(propellant) or not lo <= propellant <= hi:
        return {"ok": False, "error": f"Propellant load must be {lo}-{hi} kg."}
    checked = faults.validate_design(design)
    if not checked["ok"]:
        return {"ok": False, "error": f"Fault protection: {checked['error']}"}
    computer = FAULT_COMPUTERS[checked["design"]["computer"]]
    lv = table()["launchVehicle"]

    dry = LAUNCH_ORBITER["dryMassKg"] + computer["mass"]
    wet = dry + propellant
    cap = capacity_kg(win["c3"])
    dv_need = capture_dv_kms(win["arrivalVinf"])
    dv_have = LAUNCH_ORBITER["ispSeconds"] * G0 * math.log(wet / dry) / 1000
    dla_ok = lv["dlaLimitDeg"][0] <= win["dlaDeg"] <= lv["dlaLimitDeg"][1]
    c3_ok = lv["c3Range"][0] <= win["c3"] <= lv["c3Range"][1]

    checks = [
        {"id": "dla", "label": "Launch direction", "ok": dla_ok,
         "detail": f"Departure declination {win['dlaDeg']:+.1f}° (Atlas V from Cape Canaveral: {lv['dlaLimitDeg'][0]:+.1f}° to {lv['dlaLimitDeg'][1]:+.1f}°)"},
        {"id": "mass", "label": "Launch mass", "ok": c3_ok and wet <= cap,
         "detail": f"{wet:,.0f} kg on the pad vs {cap:,.0f} kg the Atlas V 401 can send at C3 {win['c3']:.1f} km²/s²"},
        {"id": "capture", "label": "Mars orbit capture", "ok": dv_have >= dv_need,
         "detail": f"Burn needs {dv_need:.2f} km/s to capture from {win['arrivalVinf']:.2f} km/s; propellant gives {dv_have:.2f} km/s"},
    ]
    failed = next((c for c in checks if not c["ok"]), None)
    outcome = "success" if not failed else {"dla": "scrub", "mass": "stranded", "capture": "flyby"}[failed["id"]]
    explain = {
        "success": "The orbiter reached Mars and captured into a 400 km orbit. It will relay for the crew and map the landing site.",
        "scrub": "The trajectory for this date leaves Earth too far north for the Atlas V's allowed launch directions from Cape Canaveral, so the launch was scrubbed. The lowest-energy dates are not always reachable.",
        "stranded": "The rocket could not give this much mass enough energy to escape Earth. The orbiter was left in an Earth parking orbit. Lighten the spacecraft or pick a date with a lower C3.",
        "flyby": "The orbiter arrived, but its capture burn ran out of propellant before slowing enough. It flew past Mars into orbit around the Sun. Carry more propellant, or pick a date with a slower arrival.",
    }[outcome]
    return {
        "ok": True, "passed": not failed, "outcome": outcome, "explanation": explain,
        "window": win["id"], "checks": checks,
        "numbers": {
            "launchMassKg": round(wet), "dryMassKg": dry, "propellantKg": propellant, "capacityKg": round(cap),
            "massMarginKg": round(cap - wet), "c3": win["c3"], "dlaDeg": win["dlaDeg"],
            "arrivalVinf": win["arrivalVinf"], "dvNeededKms": round(dv_need, 3), "dvAvailableKms": round(dv_have, 3),
            "transferDays": win["transferDays"], "launch": win["launch"], "arrival": win["arrival"],
        },
    }
