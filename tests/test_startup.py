"""Exercise actual startup/reset controller and onboarding with one hub."""
import json
from pathlib import Path
import shutil
import subprocess
import unittest

from ares import campaign
from ares.campaign_data import campaign_catalog, ATMOSPHERIC_WORLDS, WORLDS
from campaign_fixtures import established_campaign, earth_campaign


class StartupTests(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node"), "Optional soundtrack controller check requires Node")
    def test_planet_music_playback_and_settings(self):
        result = subprocess.run(["node", "tests/music_check.mjs"], cwd=Path(__file__).resolve().parents[1],
                                text=True, capture_output=True, timeout=10)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    @unittest.skipUnless(shutil.which("node"), "Optional startup/controller check requires Node")
    def test_mars_home_earth_travel_and_explicit_mission_navigation(self):
        fresh = campaign.create_campaign("STARTUP")
        arrival = campaign.execute(fresh, "launch", {"design":{
            "source":"H1", "destination":"earth", "site":"Cape Canaveral", "objective":"surface",
            "hull":"lander", "engine":"chemical", "trajectory":"balanced", "payload":["survey","lab"],
            "vehicle":"atlas_v_401", "propellantKg":600}})["state"]
        for _ in range(3):
            arrival = campaign.execute(arrival, "advance", {})["state"]
        fixture = {"fresh":fresh,"existing":established_campaign("EXISTING"),"earthOnly":earth_campaign("EARTH-ONLY"),"catalog":campaign_catalog(),
                   "arrived":arrival,
                   "platforms":[campaign._hub(f"P{i}",w,"surface",WORLDS[w]["sites"][0],payload=["survey","shield"]) for i,w in enumerate(sorted(ATMOSPHERIC_WORLDS))],
                   "inspection":campaign.inspect_surface(fresh,"H1",campaign.MAP_CORE)}
        result = subprocess.run(["node","tests/mars_start_check.mjs"],cwd=Path(__file__).resolve().parents[1],
                                input=json.dumps(fixture),text=True,capture_output=True,timeout=30)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
