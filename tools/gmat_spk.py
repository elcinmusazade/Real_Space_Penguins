"""Minimal pure-Python reader for JPL SPK (DAF) Type 2 Chebyshev segments.

Used offline to read the DE421 planetary ephemeris that ships with NASA GMAT
(GMAT/application/data/planetary_ephem/spk/de421.bsp). Standard library only.
"""

from __future__ import annotations

import struct
from datetime import datetime, timezone

J2000 = datetime(2000, 1, 1, 12, tzinfo=timezone.utc)


def et_from_utc(moment: datetime) -> float:
    """Seconds past J2000 (TDB approximated by UTC + 69.184 s; ample for this use)."""
    return (moment - J2000).total_seconds() + 69.184


class SPK:
    def __init__(self, path: str):
        self.data = open(path, "rb").read()
        record = self.data[:1024]
        if record[:8] != b"DAF/SPK " or record[88:96] != b"LTL-IEEE":
            raise ValueError("Expected a little-endian DAF/SPK file.")
        nd, ni = struct.unpack("<ii", record[8:16])
        fward = struct.unpack("<i", record[76:80])[0]
        self.segments = {}
        summary_doubles = nd + (ni + 1) // 2
        rec = fward
        while rec:
            base = (rec - 1) * 1024
            nxt, _prev, nsum = struct.unpack("<ddd", self.data[base:base + 24])
            for i in range(int(nsum)):
                start = base + 24 + i * summary_doubles * 8
                start_et, end_et = struct.unpack("<dd", self.data[start:start + 16])
                ints = struct.unpack(f"<{ni}i", self.data[start + 16:start + 16 + ni * 4])
                target, center, _frame, kind, first, last = ints
                if kind == 2:
                    self.segments[(target, center)] = (start_et, end_et, first, last)
            rec = int(nxt)

    def _doubles(self, first: int, count: int) -> tuple:
        offset = (first - 1) * 8
        return struct.unpack(f"<{count}d", self.data[offset:offset + count * 8])

    def state(self, target: int, center: int, et: float) -> tuple[list[float], list[float]]:
        """Position (km) and velocity (km/s) of target relative to center, J2000 frame."""
        start_et, end_et, first, last = self.segments[(target, center)]
        if not start_et <= et <= end_et:
            raise ValueError("Epoch outside ephemeris coverage.")
        init, intlen, rsize, n = self._doubles(last - 3, 4)
        index = min(int((et - init) // intlen), int(n) - 1)
        record = self._doubles(first + index * int(rsize), int(rsize))
        mid, radius = record[0], record[1]
        degree = (int(rsize) - 2) // 3
        tau = (et - mid) / radius
        pos, vel = [], []
        for axis in range(3):
            coeffs = record[2 + axis * degree: 2 + (axis + 1) * degree]
            t = [1.0, tau]
            dt = [0.0, 1.0]
            for k in range(2, degree):
                t.append(2 * tau * t[-1] - t[-2])
                dt.append(2 * t[-2] + 2 * tau * dt[-1] - dt[-2])
            pos.append(sum(c * v for c, v in zip(coeffs, t)))
            vel.append(sum(c * v for c, v in zip(coeffs, dt)) / radius)
        return pos, vel

    def heliocentric(self, body: str, et: float) -> tuple[list[float], list[float]]:
        """Earth (399) or a planet's system barycenter relative to the Sun (10)."""
        sun_p, sun_v = self.state(10, 0, et)
        barycenters = {"mercury": 1, "venus": 2, "mars": 4, "jupiter": 5}
        if body == "earth":
            emb_p, emb_v = self.state(3, 0, et)
            e_p, e_v = self.state(399, 3, et)
            p = [a + b for a, b in zip(emb_p, e_p)]
            v = [a + b for a, b in zip(emb_v, e_v)]
        elif body in barycenters:
            p, v = self.state(barycenters[body], 0, et)
        else:
            raise ValueError(body)
        return [a - b for a, b in zip(p, sun_p)], [a - b for a, b in zip(v, sun_v)]
