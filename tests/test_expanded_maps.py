"""Large-world migration, continued exploration and multi-hub persistence."""
from copy import deepcopy
import json
from pathlib import Path
import shutil
import subprocess
import unittest

from ares import campaign, surface
from campaign_fixtures import established_campaign
from ares.campaign_data import MAP_SIZE


class ExpandedMapTests(unittest.TestCase):
    def setUp(self):
        self.state = established_campaign("EXPANDED")

    def legacy(self):
        state = deepcopy(self.state)
        offset = MAP_SIZE // 2 - 16
        for hub in state["hubs"]:
            large = hub["tiles"]
            hub["tiles"] = [{**large[(y+offset)*MAP_SIZE+x+offset], "id": y*32+x}
                            for y in range(32) for x in range(32)]
        return state

    def test_old_maps_expand_centered_preserving_progress_and_survey_destinations(self):
        old = self.legacy()
        old["hubs"][0]["tiles"][0].update(revealed=True, terrain="science")
        old["hubs"][1]["tiles"][529].update(building=campaign._building("recycler"))
        old["hubs"][1]["tiles"][529]["building"]["condition"] = 63
        old["surveys"] = [dict(id="S8", hub="H1", tile=1023, departed=1, arrivesAt=4, status="en_route"),
                          dict(id="S9", hub="H2", tile=0, departed=1, arrivesAt=1, status="returned")]
        old["hubs"][0]["surveyUntil"] = 4
        before = deepcopy(old)
        result = campaign.validate(old)
        self.assertTrue(result["ok"], result)
        expanded = result["state"]
        self.assertEqual(old, before)
        self.assertEqual(campaign.validate(expanded)["state"], expanded)
        offset = MAP_SIZE // 2 - 16
        mapped = lambda i: (i//32+offset)*MAP_SIZE+i%32+offset
        for original, hub in zip(old["hubs"], expanded["hubs"]):
            self.assertEqual({k:v for k,v in hub.items() if k != "tiles"}, {k:v for k,v in original.items() if k != "tiles"})
            self.assertEqual(len(hub["tiles"]), 9216)
            for tile in original["tiles"]:
                index = mapped(tile["id"])
                self.assertEqual(hub["tiles"][index], {**tile, "id": index})
            self.assertFalse(hub["tiles"][0]["revealed"])
        self.assertEqual([s["tile"] for s in expanded["surveys"]], [mapped(1023), mapped(0)])
        for _ in range(3):
            expanded = campaign.execute(expanded,"advance",{})["state"]
        self.assertTrue(expanded["hubs"][0]["tiles"][mapped(1023)]["revealed"])
        self.assertEqual(expanded["surveys"][0]["status"], "returned")

    def test_bad_legacy_coordinates_are_rejected(self):
        old = self.legacy()
        old["hubs"][0]["tiles"][0]["id"] = 99
        self.assertFalse(campaign.validate(old)["ok"])
        old = self.legacy()
        old["surveys"] = [dict(hub="H1",tile=1024,status="en_route",arrivesAt=4)]
        self.assertFalse(campaign.validate(old)["ok"])

    def test_geography_keeps_the_original_central_region(self):
        # Generate with the old dimensions to ensure that extension keeps coasts,
        # starter ground and biome boundaries at precisely their old positions.
        from unittest.mock import patch
        with patch.object(surface,"MAP_SIZE",32):
            old = surface.landscape.__wrapped__("CONTINUITY","earth","HQ")
        large = surface.landscape("CONTINUITY","earth","HQ")
        offset = MAP_SIZE//2-16
        self.assertEqual(old, tuple(large[(y+offset)*MAP_SIZE+x+offset] for y in range(32) for x in range(32)))

    def test_survey_history_does_not_block_exploring_a_large_world(self):
        self.state["surveys"] = [dict(id=f"S{i}",hub="H1",tile=0,arrivesAt=1,status="returned") for i in range(1000)]
        self.state["nextId"] = 1001
        result = campaign.execute(self.state,"explore",{"hub":"H1","tile":MAP_SIZE*MAP_SIZE-1})
        self.assertTrue(result["ok"],result)
        self.assertTrue(campaign.validate(result["state"])["ok"])
        self.assertEqual(len(result["state"]["surveys"]),1000)
        self.assertEqual(result["state"]["surveys"][-1]["tile"],9215)

    @unittest.skipUnless(shutil.which("node"), "Optional persistence check requires Node")
    def test_browser_save_adapter(self):
        result = subprocess.run(["node","tests/campaign_save_check.mjs"], cwd=Path(__file__).resolve().parents[1], input=json.dumps(self.state), text=True, capture_output=True, timeout=30)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
