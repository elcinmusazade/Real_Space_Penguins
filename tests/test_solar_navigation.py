"""Optional Node checks for the view-only solar navigator, without a browser dependency."""
import json
from pathlib import Path
import shutil
import subprocess
import unittest
import xml.etree.ElementTree as ET

from ares.campaign import create_campaign
from ares.campaign_data import campaign_catalog


PROJECT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(shutil.which("node"), "Optional solar UI check requires Node")
class SolarNavigationTests(unittest.TestCase):
    def test_planets_orbit_and_controls_preserve_motion(self):
        fixture = {"catalog": campaign_catalog(), "state": create_campaign("SOLAR-ORBITS")}
        result = subprocess.run(
            ["node", "tests/solar_navigation_check.mjs"], cwd=PROJECT,
            input=json.dumps(fixture), text=True, capture_output=True, timeout=20,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        # Also catch malformed generated SVG rather than accepting string-only checks.
        ET.fromstring(json.loads(result.stdout)["svg"])
