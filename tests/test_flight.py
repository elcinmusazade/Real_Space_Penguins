"""GMAT-derived launch table, rocket performance and delta-v checks."""

import math
import sys
import unittest
from pathlib import Path

from ares import flight
from ares.campaign_data import FLIGHT_TARGET

ROOT = Path(__file__).resolve().parent.parent
SPK_PATH = ROOT / "GMAT" / "application" / "data" / "planetary_ephem" / "spk" / "de421.bsp"


class TableTests(unittest.TestCase):
    def test_table_covers_every_destination_and_turn(self):
        table = flight.table()
        self.assertEqual(set(table["destinations"]), set(FLIGHT_TARGET))
        for world, rows in table["destinations"].items():
            self.assertEqual(len(rows), 80, world)
            for row in rows:
                self.assertIn("efficient", row["options"])
                self.assertIn("fast", row["options"])
                self.assertGreater(row["lightMinutes"], 0)

    def test_known_2028_mars_window(self):
        # The 2028-29 Mars opportunity: launch energy near 9 km^2/s^2, as in published mission design curves.
        best = flight.table()["destinations"]["mars"][1]["options"]["efficient"]
        self.assertLess(best["c3"], 11)
        self.assertGreater(best["c3"], 7)
        self.assertTrue(best["launch"].startswith("2028-1"))
        far = flight.table()["destinations"]["mars"][6]["options"]["efficient"]
        self.assertGreater(far["c3"], 100)  # mid-2030: no good Mars transfer

    def test_light_time_is_physical(self):
        for row in flight.table()["destinations"]["mars"]:
            self.assertTrue(3 <= row["lightMinutes"] <= 23)
        for row in flight.table()["destinations"]["europa"]:
            self.assertTrue(32 <= row["lightMinutes"] <= 55)

    def test_atlas_curve_matches_mro(self):
        # MRO (2,180 kg) launched on an Atlas V 401 at C3 = 16.4 km^2/s^2.
        self.assertAlmostEqual(flight.capacity_kg("atlas_v_401", 16.4), 2069, delta=30)
        self.assertEqual(flight.capacity_kg("atlas_v_401", 80), 0)
        self.assertGreater(flight.capacity_kg("heavy", 20), flight.capacity_kg("atlas_v_401", 20))

    def test_capture_grows_with_arrival_speed(self):
        for world in ("mars", "venus", "mercury", "europa"):
            self.assertLess(flight.capture_dv(world, 2.0), flight.capture_dv(world, 6.0))

    def test_assist_route_uses_venus_departure(self):
        leg = flight.transfer("earth", "europa", "assist", 6)
        venus = flight.table()["destinations"]["venus"][5]["options"]
        self.assertEqual(leg["c3"], (venus.get("balanced") or venus["efficient"])["c3"])
        self.assertIsNone(flight.transfer("earth", "mars", "assist", 6))
        self.assertEqual(flight.transfer("mars", "venus", "balanced", 6)["source"], "estimate")

    def test_turn_dates(self):
        self.assertEqual(flight.turn_date(1), "2028-07-01")
        self.assertEqual(flight.turn_date(5), "2029-06-26")


@unittest.skipUnless(SPK_PATH.exists(), "GMAT clone not present")
class GmatRecomputeTests(unittest.TestCase):
    def test_lambert_reproduces_a_table_entry(self):
        sys.path.insert(0, str(ROOT / "tools"))
        from datetime import datetime, timezone
        import build_campaign_windows as builder
        from gmat_spk import SPK, et_from_utc
        spk = SPK(str(SPK_PATH))
        option = flight.table()["destinations"]["mars"][1]["options"]["efficient"]
        dep = datetime.fromisoformat(option["launch"]).replace(tzinfo=timezone.utc)
        et0 = et_from_utc(dep)
        re, ve = spk.heliocentric("earth", et0)
        rm, _ = spk.heliocentric("mars", et0 + option["transferDays"] * 86400)
        v1, _ = builder.lambert(re, rm, option["transferDays"] * 86400)
        c3 = sum((a - b) ** 2 for a, b in zip(v1, ve))
        self.assertTrue(math.isclose(c3, option["c3"], abs_tol=0.05))


if __name__ == "__main__":
    unittest.main()
