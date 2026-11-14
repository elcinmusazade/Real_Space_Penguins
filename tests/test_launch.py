"""Orbiter launch prelude: GMAT-derived table, pass/fail physics, and API."""

import json
import math
import sys
import unittest
from pathlib import Path

from ares import launch
from ares.rules import FAULT_EXAMPLE_RULES

ROOT = Path(__file__).resolve().parent.parent
GMAT_SPK = ROOT / "GMAT" / "application" / "data" / "planetary_ephem" / "spk" / "de421.bsp"
DESIGN = {"computer": "standard", "rules": FAULT_EXAMPLE_RULES}


class TableTests(unittest.TestCase):
    def test_table_shape_and_sources(self):
        table = launch.table()
        self.assertEqual(len(table["windows"]), 7)
        self.assertIn("GMAT", " ".join(table["sources"]))
        for window in table["windows"]:
            self.assertEqual(len(window["arc"]), len(window["earth"]))
            self.assertLess(math.dist(window["arc"][-1], window["mars"][-1]), 0.01)
            self.assertLess(math.dist(window["arc"][0], window["earth"][0]), 0.01)

    def test_atlas_curve_matches_flown_mission(self):
        # MRO (2,180 kg) flew on an Atlas V 401 at C3 = 16.4 km^2/s^2.
        self.assertAlmostEqual(launch.capacity_kg(16.4), 2069, delta=5)
        self.assertGreater(launch.capacity_kg(9), launch.capacity_kg(19))

    def test_capture_burn_grows_with_arrival_speed(self):
        self.assertGreater(launch.capture_dv_kms(3.7), launch.capture_dv_kms(3.0))
        self.assertAlmostEqual(launch.capture_dv_kms(2.967), 2.24, delta=0.02)


class AssessTests(unittest.TestCase):
    def test_each_outcome(self):
        cases = [
            ("2028-11-24", 1250, "scrub"),     # lowest C3, but declination beyond Atlas V limit
            ("2028-10-16", 1250, "stranded"),  # too heavy for C3 19.3
            ("2028-11-18", 500, "flyby"),      # too little propellant to capture
            ("2028-11-18", 1250, "success"),
        ]
        for window, propellant, outcome in cases:
            with self.subTest(window=window, propellant=propellant):
                result = launch.assess(window, propellant, DESIGN)
                self.assertTrue(result["ok"])
                self.assertEqual(result["outcome"], outcome)
                self.assertEqual(result["passed"], outcome == "success")

    def test_bigger_computer_adds_mass(self):
        light = launch.assess("2028-11-18", 1250, {"computer": "basic", "rules": []})
        heavy = launch.assess("2028-11-18", 1250, {"computer": "advanced", "rules": []})
        self.assertEqual(heavy["numbers"]["launchMassKg"] - light["numbers"]["launchMassKg"], 5)

    def test_rejects_bad_input(self):
        self.assertFalse(launch.assess("2030-01-01", 1000, DESIGN)["ok"])
        self.assertFalse(launch.assess("2028-11-18", 99999, DESIGN)["ok"])
        self.assertFalse(launch.assess("2028-11-18", True, DESIGN)["ok"])
        self.assertFalse(launch.assess("2028-11-18", 1000, None)["ok"])

    def test_deterministic_json(self):
        a, b = launch.assess("2028-11-12", 1200, DESIGN), launch.assess("2028-11-12", 1200, DESIGN)
        self.assertEqual(a, b)
        json.dumps(launch.catalog(), allow_nan=False)


@unittest.skipUnless(GMAT_SPK.exists(), "local GMAT clone not present")
class GmatRecomputeTests(unittest.TestCase):
    def test_table_matches_fresh_gmat_ephemeris_calculation(self):
        sys.path.insert(0, str(ROOT / "tools"))
        from datetime import datetime, timezone
        from build_mars_launch_table import lambert, DAY
        from gmat_spk import SPK, et_from_utc
        spk = SPK(str(GMAT_SPK))
        window = launch.windows()["2028-11-18"]
        et0 = et_from_utc(datetime(2028, 11, 18, tzinfo=timezone.utc))
        re, ve = spk.heliocentric("earth", et0)
        rm, vm = spk.heliocentric("mars", et0 + window["transferDays"] * DAY)
        v1, v2 = lambert(re, rm, window["transferDays"] * DAY)
        c3 = sum((a - b) ** 2 for a, b in zip(v1, ve))
        self.assertAlmostEqual(c3, window["c3"], places=1)
        self.assertAlmostEqual(math.dist(v2, vm), window["arrivalVinf"], places=2)


if __name__ == "__main__":
    unittest.main()
