"""Build ares/data/campaign_windows.json from NASA GMAT's bundled data.

Run from the repository root (needs the local GMAT clone, which git ignores):

    python3 tools/build_campaign_windows.py

Inputs (from GMAT R2026a):
  * DE421 planetary ephemeris: GMAT/application/data/planetary_ephem/spk/de421.bsp
  * Atlas V 401 C3 performance polynomial:
    GMAT/application/data/emtg/NLSII_August2018_Augmented.emtg_launchvehicleopt

For every game turn (90 days, starting 2028-07-01) and every destination
(Mercury, Venus, Mars, and Jupiter for Europa) this searches Earth departure
dates inside that turn against a time-of-flight grid, solving a Sun-only
Lambert transfer for each pair (a "porkchop" search). It keeps three options:

  efficient - lowest total delta-v (Earth departure from a 200 km orbit + capture)
  balanced  - lowest total delta-v whose departure declination fits the
              Atlas V 401 limit from Cape Canaveral (+/-28.5 deg), if any
  fast      - shortest flight whose total delta-v is within 1.5 km/s of efficient

This is patched-conic two-body analysis: a simplification of what GMAT itself
would refine (no planetary perturbations, no flybys, no launch-day targeting).
"""

from __future__ import annotations

import json
import math
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(ROOT))
from gmat_spk import SPK, et_from_utc  # noqa: E402
from ares.campaign_data import CAMPAIGN_START, FLIGHT_TARGET, PHYSICS, TURN_DAYS  # noqa: E402

GMAT_DATA = ROOT / "GMAT" / "application" / "data"
SPK_PATH = GMAT_DATA / "planetary_ephem" / "spk" / "de421.bsp"
LV_PATH = GMAT_DATA / "emtg" / "NLSII_August2018_Augmented.emtg_launchvehicleopt"
OUT = ROOT / "ares" / "data" / "campaign_windows.json"

MU_SUN = 1.32712440018e11
MU_EARTH = 398600.4418
R_LEO = 6378.137 + 200
AU = 1.495978707e8
C_KMS = 299792.458
OBLIQUITY = math.radians(23.4392911)
DAY = 86400.0
TURNS = 80
LAUNCH_STEP_DAYS = 6
DLA_LIMIT = 28.5
TOF_GRID = {
    "mercury": range(70, 261, 10),
    "venus": range(80, 331, 10),
    "mars": range(120, 421, 10),
    "jupiter": range(500, 1301, 50),
}
PERIOD_DAYS = {"mercury": 88, "venus": 225, "earth": 365, "mars": 687, "jupiter": 4333}


def stumpff(z: float) -> tuple[float, float]:
    if z > 1e-8:
        s = math.sqrt(z)
        return (1 - math.cos(s)) / z, (s - math.sin(s)) / s ** 3
    if z < -1e-8:
        s = math.sqrt(-z)
        return (math.cosh(s) - 1) / -z, (math.sinh(s) - s) / s ** 3
    return 0.5, 1 / 6


def lambert(r1, r2, tof, mu=MU_SUN):
    """Prograde single-revolution Lambert solution (universal variables, bisection)."""
    n1, n2 = math.hypot(*r1), math.hypot(*r2)
    cos_d = sum(a * b for a, b in zip(r1, r2)) / (n1 * n2)
    cross_z = r1[0] * r2[1] - r1[1] * r2[0]
    dtheta = math.acos(max(-1.0, min(1.0, cos_d)))
    if cross_z < 0:
        dtheta = 2 * math.pi - dtheta
    a_const = math.sin(dtheta) * math.sqrt(n1 * n2 / (1 - math.cos(dtheta)))

    def y(z):
        c, s = stumpff(z)
        return n1 + n2 + a_const * (z * s - 1) / math.sqrt(c)

    def f(z):
        c, s = stumpff(z)
        yz = y(z)
        return (yz / c) ** 1.5 * s + a_const * math.sqrt(yz) - math.sqrt(mu) * tof

    low = -4 * math.pi ** 2
    while y(low) < 0:
        low += 0.1
    high = 4 * math.pi ** 2 - 1e-6
    if f(low) > 0 or f(high) < 0:
        return None
    for _ in range(70):
        mid = (low + high) / 2
        if f(mid) > 0:
            high = mid
        else:
            low = mid
    z = (low + high) / 2
    yz = y(z)
    fl = 1 - yz / n1
    g = a_const * math.sqrt(yz / mu)
    gdot = 1 - yz / n2
    v1 = [(b - fl * a) / g for a, b in zip(r1, r2)]
    v2 = [(gdot * b - a) / g for a, b in zip(r1, r2)]
    return v1, v2


def propagate(r, v, seconds, steps, mu=MU_SUN):
    """RK4 two-body propagation; returns the position at each step."""
    def acc(p):
        d = math.hypot(*p) ** 3
        return [-mu * c / d for c in p]
    sub = 8
    h = seconds / (steps * sub)
    out = [list(r)]
    for _ in range(steps):
        for _ in range(sub):
            k1v, k1r = acc(r), v
            r2 = [a + h / 2 * b for a, b in zip(r, k1r)]; v2 = [a + h / 2 * b for a, b in zip(v, k1v)]
            k2v, k2r = acc(r2), v2
            r3 = [a + h / 2 * b for a, b in zip(r, k2r)]; v3 = [a + h / 2 * b for a, b in zip(v, k2v)]
            k3v, k3r = acc(r3), v3
            r4 = [a + h * b for a, b in zip(r, k3r)]; v4 = [a + h * b for a, b in zip(v, k3v)]
            k4v, k4r = acc(r4), v4
            r = [a + h / 6 * (b + 2 * c + 2 * d + e) for a, b, c, d, e in zip(r, k1r, k2r, k3r, k4r)]
            v = [a + h / 6 * (b + 2 * c + 2 * d + e) for a, b, c, d, e in zip(v, k1v, k2v, k3v, k4v)]
        out.append(r)
    return out


def ecliptic_au(p):
    """J2000 equatorial km -> ecliptic x, y in AU (for the 2-D animation)."""
    x, y, z = p
    return [round(x / AU, 3), round((y * math.cos(OBLIQUITY) + z * math.sin(OBLIQUITY)) / AU, 3)]


def read_atlas():
    for line in LV_PATH.read_text().splitlines():
        if line.startswith("Atlas_V_401"):
            parts = line.split()
            return {
                "name": "Atlas V 401",
                "source": "NASA GMAT R2026a, data/emtg/NLSII_August2018_Augmented.emtg_launchvehicleopt",
                "dlaLimitDeg": [float(parts[2]), float(parts[3])],
                "c3Range": [float(parts[4]), float(parts[5])],
                # EMTG rows carry an adapter mass before the polynomial. Sanity
                # check: MRO (2,180 kg) flew on an Atlas V 401 at C3 = 16.4;
                # this curve gives ~2,069 kg there.
                "adapterMassKg": float(parts[6]),
                "coefficients": [float(c) for c in parts[7:]],
            }
    raise SystemExit("Atlas_V_401 not found in GMAT launch-vehicle file.")


def capture_dv(world: str, vinf: float) -> float:
    p = PHYSICS[world]
    rp = p["radiusKm"] + p["periapsisKm"]
    ra = p["radiusKm"] + p["apoapsisKm"]
    a = (rp + ra) / 2
    return math.sqrt(vinf ** 2 + 2 * p["gm"] / rp) - math.sqrt(p["gm"] * (2 / rp - 1 / a)) + p["extraDvKms"]


def departure_dv(c3: float) -> float:
    return math.sqrt(c3 + 2 * MU_EARTH / R_LEO) - math.sqrt(MU_EARTH / R_LEO)


def main() -> None:
    if not SPK_PATH.exists():
        raise SystemExit(f"GMAT data not found at {SPK_PATH}. Clone NASA GMAT into ./GMAT first.")
    spk = SPK(str(SPK_PATH))
    start = datetime.fromisoformat(CAMPAIGN_START).replace(tzinfo=timezone.utc)
    clock = time.time()
    destinations = {}
    for world, body in FLIGHT_TARGET.items():
        turns = []
        for turn in range(1, TURNS + 1):
            turn_start = start + timedelta(days=TURN_DAYS * (turn - 1))
            candidates = []
            for offset in range(0, TURN_DAYS, LAUNCH_STEP_DAYS):
                dep = turn_start + timedelta(days=offset)
                et0 = et_from_utc(dep)
                re, ve = spk.heliocentric("earth", et0)
                for tof in TOF_GRID[body]:
                    rt, vt = spk.heliocentric(body, et0 + tof * DAY)
                    sol = lambert(re, rt, tof * DAY)
                    if not sol:
                        continue
                    v1, v2 = sol
                    vinf_dep = [a - b for a, b in zip(v1, ve)]
                    c3 = sum(c * c for c in vinf_dep)
                    vinf_arr = math.dist(v2, vt)
                    dla = math.degrees(math.asin(max(-1.0, min(1.0, vinf_dep[2] / math.sqrt(c3)))))
                    total = departure_dv(c3) + capture_dv(world, vinf_arr)
                    candidates.append({"dep": dep, "tof": tof, "c3": c3, "dla": dla, "vinf": vinf_arr,
                                       "total": total, "re": re, "v1": v1})
            efficient = min(candidates, key=lambda c: c["total"])
            in_dla = [c for c in candidates if abs(c["dla"]) <= DLA_LIMIT]
            balanced = min(in_dla, key=lambda c: c["total"]) if in_dla else None
            fast = min((c for c in candidates if c["total"] <= efficient["total"] + 1.5), key=lambda c: (c["tof"], c["total"]))
            options = {}
            for key, pick in (("efficient", efficient), ("balanced", balanced), ("fast", fast)):
                if pick is None:
                    continue
                arc = propagate(pick["re"], pick["v1"], pick["tof"] * DAY, 16)
                options[key] = {
                    "launch": pick["dep"].strftime("%Y-%m-%d"),
                    "arrival": (pick["dep"] + timedelta(days=pick["tof"])).strftime("%Y-%m-%d"),
                    "transferDays": pick["tof"], "c3": round(pick["c3"], 2), "dlaDeg": round(pick["dla"], 1),
                    "arrivalVinf": round(pick["vinf"], 3), "totalDvKms": round(pick["total"], 2),
                    "arc": [ecliptic_au(p) for p in arc],
                }
            et_turn = et_from_utc(turn_start)
            distance = math.dist(spk.heliocentric("earth", et_turn)[0], spk.heliocentric(body, et_turn)[0])
            turns.append({"turn": turn, "date": turn_start.strftime("%Y-%m-%d"),
                          "lightMinutes": round(distance / C_KMS / 60, 1), "options": options})
        destinations[world] = turns
        best = min(turns, key=lambda t: t["options"]["efficient"]["totalDvKms"])
        print(f"{world:8s} best turn {best['turn']:2d} {best['options']['efficient']}"[:200], f"[{time.time() - clock:.0f}s]")

    tracks = {}
    et0 = et_from_utc(start)
    for body, period in PERIOD_DAYS.items():
        tracks[body] = [ecliptic_au(spk.heliocentric(body, et0 + period * DAY * k / 48)[0]) for k in range(49)]

    table = {
        "generatedBy": "tools/build_campaign_windows.py",
        "sources": [
            "NASA GMAT R2026a bundled JPL DE421 ephemeris (data/planetary_ephem/spk/de421.bsp)",
            "NASA GMAT R2026a bundled EMTG launch-vehicle library (Atlas_V_401 entry)",
        ],
        "method": "Sun-only two-body Lambert transfers; Earth departure every 6 days within each 90-day turn against a time-of-flight grid. Total delta-v = departure from a 200 km Earth orbit + capture into the destination orbit.",
        "campaignStart": CAMPAIGN_START, "turnDays": TURN_DAYS, "dlaLimitDeg": DLA_LIMIT,
        "atlasV401": read_atlas(),
        "destinations": destinations,
        "orbitTracks": tracks,
    }
    OUT.write_text(json.dumps(table, separators=(",", ":")))
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB) in {time.time() - clock:.0f}s")


if __name__ == "__main__":
    main()
