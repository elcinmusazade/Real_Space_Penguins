"""Build ares/data/mars_launch_windows.json from NASA GMAT's bundled data.

Run from the repository root (needs the local GMAT clone, which git ignores):

    python3 tools/build_mars_launch_table.py

Inputs (from GMAT R2026a):
  * DE421 planetary ephemeris: GMAT/application/data/planetary_ephem/spk/de421.bsp
  * Atlas V 401 C3 performance polynomial:
    GMAT/application/data/emtg/NLSII_August2018_Augmented.emtg_launchvehicleopt

Method: heliocentric two-body Lambert transfers (Sun only, patched conics),
with a departure-date x time-of-flight grid. This is the classic "porkchop"
analysis. It is a simplification of what GMAT itself would refine.
"""

from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gmat_spk import SPK, et_from_utc  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
GMAT_DATA = ROOT / "GMAT" / "application" / "data"
SPK_PATH = GMAT_DATA / "planetary_ephem" / "spk" / "de421.bsp"
LV_PATH = GMAT_DATA / "emtg" / "NLSII_August2018_Augmented.emtg_launchvehicleopt"
OUT = ROOT / "ares" / "data" / "mars_launch_windows.json"

MU_SUN = 1.32712440018e11  # km^3/s^2
AU = 1.495978707e8
OBLIQUITY = math.radians(23.4392911)
DAY = 86400.0


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
    for _ in range(200):
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
    h = seconds / steps
    out = [list(r)]
    for _ in range(steps):
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
    return [round(x / AU, 4), round((y * math.cos(OBLIQUITY) + z * math.sin(OBLIQUITY)) / AU, 4)]


def read_atlas():
    for line in LV_PATH.read_text().splitlines():
        if line.startswith("Atlas_V_401"):
            parts = line.split()
            return {
                "name": "Atlas V 401",
                "source": "NASA GMAT R2026a, data/emtg/NLSII_August2018_Augmented.emtg_launchvehicleopt",
                "dlaLimitDeg": [float(parts[2]), float(parts[3])],
                "c3Range": [float(parts[4]), float(parts[5])],
                # EMTG rows carry an adapter mass before the polynomial: the
                # header comment omits it, but reading parts[6] as C3^0 would
                # give ~0 kg at C3=0. Sanity check: MRO (2,180 kg) flew on an
                # Atlas V 401 at C3 = 16.4; this curve gives ~2,069 kg there.
                "adapterMassKg": float(parts[6]),
                "coefficients": [float(c) for c in parts[7:]],
                "note": "Delivered mass (kg) = sum(coefficients[i] * C3^i), C3 in km^2/s^2.",
            }
    raise SystemExit("Atlas_V_401 not found in GMAT launch-vehicle file.")


def utc(day: datetime) -> str:
    return day.strftime("%Y-%m-%d")


def main() -> None:
    if not SPK_PATH.exists():
        raise SystemExit(f"GMAT data not found at {SPK_PATH}. Clone NASA GMAT into ./GMAT first.")
    spk = SPK(str(SPK_PATH))
    atlas = read_atlas()

    start = datetime(2028, 9, 1, tzinfo=timezone.utc)
    grid = []
    for dep_i in range(0, 181, 3):
        dep = start + timedelta(days=dep_i)
        et0 = et_from_utc(dep)
        re, ve = spk.heliocentric("earth", et0)
        best = None
        for tof_days in range(140, 361, 4):
            et1 = et0 + tof_days * DAY
            rm, vm = spk.heliocentric("mars", et1)
            sol = lambert(re, rm, tof_days * DAY)
            if not sol:
                continue
            v1, v2 = sol
            vinf_dep = [a - b for a, b in zip(v1, ve)]
            vinf_arr = math.dist(v2, vm)
            c3 = sum(c * c for c in vinf_dep)
            dla = math.degrees(math.asin(vinf_dep[2] / math.sqrt(c3)))
            score = c3 + vinf_arr ** 2
            if best is None or score < best["score"]:
                best = {"score": score, "dep": dep, "tof": tof_days, "c3": c3, "vinfArr": vinf_arr, "dla": dla,
                        "re": re, "v1": v1, "rm": rm}
        if best:
            grid.append(best)

    optimum = min(grid, key=lambda b: b["score"])
    print("Optimum:", utc(optimum["dep"]), f"C3={optimum['c3']:.2f}", f"vinf={optimum['vinfArr']:.2f}", f"tof={optimum['tof']}", f"DLA={optimum['dla']:.1f}")
    for g in grid:
        print(utc(g["dep"]), f"C3={g['c3']:6.2f} vinf={g['vinfArr']:.2f} tof={g['tof']} DLA={g['dla']:6.1f}")

    # Game options: departure dates around the optimum, spaced to show the trade-off.
    # Chosen to show the trade-offs: early/expensive, the feasible sweet spot,
    # the lowest-C3 dates that break the Atlas V declination limit, and a fast
    # transfer that arrives with a higher v-infinity.
    wanted = ["2028-10-16", "2028-10-31", "2028-11-12", "2028-11-18", "2028-11-24", "2028-12-09", "2029-01-05"]
    by_date = {utc(g["dep"]): g for g in grid}
    picks = [by_date[d] for d in wanted]

    windows = []
    for g in picks:
        et0 = et_from_utc(g["dep"])
        arc = propagate(g["re"], g["v1"], g["tof"] * DAY, 48)
        earth_track, mars_track = [], []
        for k in range(49):
            t = et0 + g["tof"] * DAY * k / 48
            earth_track.append(ecliptic_au(spk.heliocentric("earth", t)[0]))
            mars_track.append(ecliptic_au(spk.heliocentric("mars", t)[0]))
        windows.append({
            "id": utc(g["dep"]),
            "launch": utc(g["dep"]),
            "arrival": utc(g["dep"] + timedelta(days=g["tof"])),
            "transferDays": g["tof"],
            "c3": round(g["c3"], 2),
            "dlaDeg": round(g["dla"], 1),
            "arrivalVinf": round(g["vinfArr"], 3),
            "arc": [ecliptic_au(p) for p in arc],
            "earth": earth_track,
            "mars": mars_track,
        })

    orbits = []
    for k in range(73):
        t = et_from_utc(start) + k * 10 * DAY
        orbits.append({"earth": ecliptic_au(spk.heliocentric("earth", t)[0]), "mars": ecliptic_au(spk.heliocentric("mars", t)[0])})

    table = {
        "generatedBy": "tools/build_mars_launch_table.py",
        "sources": [
            "NASA GMAT R2026a bundled JPL DE421 ephemeris (data/planetary_ephem/spk/de421.bsp)",
            "NASA GMAT R2026a bundled EMTG launch-vehicle library (Atlas_V_401 entry)",
        ],
        "method": "Sun-only two-body Lambert transfers on a 3-day x 4-day porkchop grid; best (C3 + arrival v-infinity^2) time of flight per launch date.",
        "launchVehicle": atlas,
        "windows": windows,
        "orbitTracks": {"earth": [o["earth"] for o in orbits], "mars": [o["mars"] for o in orbits]},
    }
    OUT.write_text(json.dumps(table, separators=(",", ":")))
    print(f"Wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB, {len(windows)} windows)")


if __name__ == "__main__":
    main()
