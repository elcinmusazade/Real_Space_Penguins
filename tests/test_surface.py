"""Surface geography, save compatibility and terrain-driven economic decisions."""
from copy import deepcopy
import json
from pathlib import Path
import shutil
import subprocess
import unittest

from ares import campaign, surface
from campaign_fixtures import earth_campaign
from ares.campaign_data import campaign_catalog, MAP_SIZE, PAYLOADS, RESEARCH

CORE = campaign.MAP_CORE


class SurfaceTests(unittest.TestCase):
    def setUp(self):
        self.state = earth_campaign("LIVING-MAPS")

    def act(self, action, **args):
        result = campaign.execute(self.state, action, args)
        self.assertTrue(result["ok"], result["message"])
        self.state = result["state"]
        return self.state

    def test_geography_is_seeded_diverse_and_has_safe_starts(self):
        for world in ("earth", "mars", "venus", "mercury", "europa"):
            grid = surface.landscape("A", world, "site")
            self.assertEqual(grid, surface.landscape("A", world, "site"))
            self.assertNotEqual(grid, surface.landscape("B", world, "site"))
            self.assertGreaterEqual(len(set(b for b, _ in grid)), 4)
            self.assertEqual(grid[CORE], ("settlement", 1))
            if world != "earth":
                self.assertFalse(any(b in surface.WATER for b, _ in grid))
        earth = surface.landscape("A", "earth", "site")
        self.assertTrue({"ocean", "water", "forest", "beach", "grassland"} <= {b for b, _ in earth})
        self.assertNotEqual(surface.landscape("A", "earth", "site"), surface.landscape("A", "earth", "other"))

    def test_legacy_saves_keep_buildings_stocks_and_pending_survey(self):
        self.act("explore", hub="H1", tile=0)
        self.act("construct", hub="H1", tile=CORE+1, building="drill")
        legacy = deepcopy(self.state)
        legacy["expeditions"] = legacy.pop("surveys")
        legacy["tech"] = ["robotics"]
        for h in legacy["hubs"]:
            h["roverBusyUntil"] = h.pop("surveyUntil")
            h["rovers"] = 1
            for t in h["tiles"]:
                t.pop("biome")
                t.pop("elevation")
        before = deepcopy(legacy)
        result = campaign.validate(legacy)
        self.assertTrue(result["ok"])
        upgraded = result["state"]
        self.assertEqual(legacy, before)
        self.assertEqual(upgraded["surveys"], self.state["surveys"])
        self.assertEqual(upgraded["hubs"][0]["stocks"], self.state["hubs"][0]["stocks"])
        self.assertEqual(upgraded["hubs"][0]["tiles"][CORE+1]["building"], self.state["hubs"][0]["tiles"][CORE+1]["building"])
        self.assertEqual(upgraded["tech"], ["surveying"])
        self.assertNotIn("rovers", upgraded["hubs"][0])
        self.assertEqual(campaign.validate(upgraded)["state"], upgraded)
        legacy["tech"] = []
        legacy["research"] = {"id": "robotics", "completesAt": 3}
        self.assertEqual(campaign.validate(legacy)["state"]["research"], {"id": "surveying", "completesAt": 3})

    def test_existing_building_on_new_water_is_preserved_on_land(self):
        h = self.state["hubs"][0]
        water = next(t for t in h["tiles"] if t["biome"] == "ocean")
        water.update(revealed=True, terrain="plain", building=campaign._building("drill"))
        for tile in h["tiles"]:
            tile.pop("biome")
            tile.pop("elevation")
        upgraded = campaign.validate(self.state)["state"]
        t = upgraded["hubs"][0]["tiles"][water["id"]]
        self.assertEqual(t["biome"], "settlement")
        self.assertEqual(t["building"]["type"], "drill")

    def test_survey_preview_matches_actual_cost_and_reveals_only_on_completion(self):
        plan = campaign.inspect_surface(self.state, "H1", 0)["survey"]
        before = deepcopy(self.state)
        self.act("explore", hub="H1", tile=0)
        self.assertEqual(self.state["hubs"][0]["stocks"]["energy"], before["hubs"][0]["stocks"]["energy"]-plan["energy"])
        self.assertEqual(self.state["hubs"][0]["stocks"]["fuel"], before["hubs"][0]["stocks"]["fuel"])
        self.assertFalse(self.state["hubs"][0]["tiles"][0]["revealed"])
        self.assertEqual(self.state["surveys"][0]["arrivesAt"], before["turn"]+plan["turns"])
        for _ in range(plan["turns"]):
            self.act("advance")
        self.assertTrue(all(self.state["hubs"][0]["tiles"][i]["revealed"] for i in (0,1,MAP_SIZE,MAP_SIZE+1)))
        self.assertEqual(self.state["surveys"][0]["status"], "returned")

    def test_remote_sensing_research_and_local_scan_while_regional_survey_busy(self):
        normal = campaign.inspect_surface(self.state, "H1", 0)["survey"]["turns"]
        self.state["tech"].append("surveying")
        self.assertEqual(campaign.inspect_surface(self.state, "H1", 0)["survey"]["turns"], normal-1)
        self.act("explore", hub="H1", tile=0)
        before = self.state["hubs"][0]["stocks"]["energy"]
        self.act("explore", hub="H1", tile=CORE-2)
        self.assertEqual(self.state["hubs"][0]["stocks"]["energy"], before)

    def test_rover_removed_from_public_catalog_and_legacy_mission_normalizes(self):
        self.assertNotIn("rover", PAYLOADS)
        self.assertNotIn("robotics", RESEARCH)
        legacy = deepcopy(self.state)
        legacy["missions"].append({"id":"M9", "destination":"mars", "status":"complete", "arrivesAt":2, "objective":"surface", "launchOutcome":"go", "report":[], "design":{"payload":["rover", "lab"]}})
        self.assertEqual(campaign.validate(legacy)["state"]["missions"][0]["design"]["payload"], ["survey", "lab"])
        self.assertEqual(legacy["missions"][0]["design"]["payload"], ["rover", "lab"])

    def test_water_blocked_and_coastal_plant_cost_and_output_match(self):
        h = self.state["hubs"][0]
        h["tiles"][CORE+2].update(biome="water", elevation=0, revealed=True, terrain="plain")
        h["tiles"][CORE+1].update(biome="beach", terrain="plain")
        plan = campaign.inspect_surface(self.state, "H1", CORE+1)["buildings"]["extractor"]
        self.assertTrue(plan["ok"])
        self.assertEqual(plan["outputs"], {"water":12})
        self.assertEqual(plan["inputs"], {"energy":6})
        self.act("construct", hub="H1", tile=CORE+1, building="extractor")
        bad = campaign.execute(self.state, "construct", {"hub":"H1", "tile":CORE+2, "building":"solar"})
        self.assertFalse(bad["ok"])
        self.act("advance")
        before = deepcopy(self.state["hubs"][0]["stocks"])
        self.act("advance")
        self.assertEqual(self.state["hubs"][0]["stocks"]["water"]-before["water"], 12)
        self.assertEqual(self.state["hubs"][0]["stocks"]["energy"]-before["energy"], 12-6)

    def test_high_ground_has_preparation_cost_and_production_bonus(self):
        self.state["hubs"][0]["tiles"][CORE+1].update(biome="mountain", elevation=3)
        plan = campaign.inspect_surface(self.state,"H1",CORE+1)["buildings"]["solar"]
        self.assertEqual(plan["materials"], 21)
        self.assertEqual(plan["outputs"], {"energy":15})
        before = self.state["hubs"][0]["stocks"]["materials"]
        self.act("construct", hub="H1", tile=CORE+1, building="solar")
        self.assertEqual(self.state["hubs"][0]["stocks"]["materials"], before-21)

    def test_fertile_soil_and_ore_are_meaningful_site_choices(self):
        h = self.state["hubs"][0]
        tile = h["tiles"][CORE+1]
        tile["biome"] = "grassland"
        self.assertEqual(surface.production(h,tile,"greenhouse")["outputs"]["food"], 11)
        tile["biome"] = "mesa"
        self.assertEqual(surface.production(h,tile,"drill")["outputs"]["materials"], 9)
        tile["biome"] = "shadow"
        self.assertEqual(surface.production(h,tile,"solar")["outputs"]["energy"], 3)

    def test_supply_chain_works_even_when_water_plant_is_later_in_tile_order(self):
        h = self.state["hubs"][0]
        h["stocks"].update(water=0, food=0, oxygen=0, energy=40)
        h["tiles"][CORE+1]["building"] = campaign._building("extractor")
        h["tiles"][CORE+1]["terrain"] = "ice"
        h["tiles"][CORE-1]["building"] = campaign._building("recycler")
        h["tiles"][CORE-MAP_SIZE]["building"] = campaign._building("greenhouse")
        campaign._operate_surface(self.state,h)
        self.assertEqual(h["stocks"]["water"], 4)
        self.assertEqual(h["stocks"]["oxygen"], 6)
        self.assertEqual(h["stocks"]["food"], 8)
        self.assertEqual(h["stocks"]["energy"], 29)

    def test_missing_inputs_make_oxygen_plant_idle_without_partial_spending(self):
        h = self.state["hubs"][0]
        h["tiles"][CORE-1]["building"] = campaign._building("recycler")
        h["stocks"].update(water=1, oxygen=0, energy=30)
        notes = campaign._operate_surface(self.state,h)
        self.assertEqual(h["stocks"]["energy"], 30)
        self.assertEqual(h["stocks"]["water"], 1)
        self.assertEqual(h["stocks"]["oxygen"], 0)
        self.assertTrue(any("idle" in n for n in notes))

    def test_bad_geography_and_inspection_targets_are_rejected(self):
        for value in ([], "alien"):
            s = deepcopy(self.state)
            s["hubs"][0]["tiles"][0]["biome"] = value
            self.assertFalse(campaign.validate(s)["ok"])
        for index in (-1, True, MAP_SIZE * MAP_SIZE, [], None):
            self.assertFalse(campaign.inspect_surface(self.state,"H1",index)["ok"])
        self.assertFalse(campaign.inspect_surface(self.state,"missing",0)["ok"])
        legacy = deepcopy(self.state)
        legacy["hubs"][0].update(tiles=[], site=[])
        self.assertFalse(campaign.validate(legacy)["ok"])
        legacy = deepcopy(self.state)
        legacy["hubs"][0].update(tiles=legacy["hubs"][0]["tiles"][:25], site=[])
        self.assertFalse(campaign.validate(legacy)["ok"])

    @unittest.skipUnless(shutil.which("node"), "Optional canvas/controller check requires Node")
    def test_map_renderer_and_inspector(self):
        fixture = {"state":self.state, "catalog":campaign_catalog(), "inspection":campaign.inspect_surface(self.state,"H1",CORE+1)}
        result = subprocess.run(["node","tests/surface_map_check.mjs"], cwd=Path(__file__).resolve().parents[1], input=json.dumps(fixture), text=True, capture_output=True, timeout=30)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
