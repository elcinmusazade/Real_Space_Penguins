"""Research progression, real economic effects, compatibility and tree UI checks."""
from copy import deepcopy
from math import ceil
import json
from pathlib import Path
import shutil
import subprocess
import unittest

from ares import campaign, research, surface
from ares.campaign_data import BUILDINGS, ENGINES, HULLS, LAUNCH_VEHICLES, RESEARCH, RESEARCH_BRANCHES, TECH_UNLOCKS, WORLDS, campaign_catalog
from campaign_fixtures import earth_campaign
from test_campaign import act, advance, design

CORE = campaign.MAP_CORE


class ResearchTests(unittest.TestCase):
    def setUp(self):
        self.state = campaign.create_campaign("TECH-TREE")

    def lab(self, offset=1, **fields):
        tile = self.state["hubs"][0]["tiles"][CORE+offset]
        tile.update(revealed=True, terrain="plain", biome="settlement", elevation=1,
                    building=campaign._building("laboratory"))
        tile["building"].update(fields)
        return tile["building"]

    def test_catalog_is_a_reachable_dag_with_valid_equipment_unlocks(self):
        self.assertEqual(len(RESEARCH), 16)
        self.assertEqual(len(RESEARCH_BRANCHES), 4)
        reached = set()
        for tier in range(4):
            level = {k for k, v in RESEARCH.items() if v["tier"] == tier}
            self.assertEqual(len(level), 4)
            self.assertEqual({RESEARCH[k]["branch"] for k in level}, set(RESEARCH_BRANCHES))
            for k in level:
                self.assertTrue(set(RESEARCH[k]["requires"]) <= reached)
                self.assertTrue(RESEARCH[k]["effects"])
            reached |= level
        catalogs = {"engine": ENGINES, "hull": HULLS, "vehicle": LAUNCH_VEHICLES, "building": BUILDINGS, "surface": WORLDS}
        for category, items in TECH_UNLOCKS.items():
            self.assertTrue(set(items) <= set(catalogs[category]))
            self.assertTrue(set(items.values()) <= reached)

    def test_requirements_funding_lab_condition_and_read_only_inspection(self):
        s = self.state
        before = deepcopy(s)
        self.assertEqual(sum(p["ok"] for p in research.inspect(s)["plans"].values()), 4)
        self.assertEqual(s, before)
        self.assertFalse(research.plan(s, [])['ok'])
        self.assertFalse(campaign.execute(s, "research", {"tech": []})["ok"])
        s["science"] = s["credits"] = 999
        s["tech"] = ["surveying", "autonomy"]
        s["hubs"][0]["discovered"] = 11
        lab = self.lab(onlineFrom=2)
        self.assertEqual(research.laboratories(s), 0)
        self.assertIn("12 new sectors", research.plan(s, "wideband")["reason"])
        lab["onlineFrom"] = 1
        lab["condition"] = 0
        self.assertEqual(research.laboratories(s), 0)
        lab["condition"] = 100
        lab["active"] = False
        self.assertEqual(research.laboratories(s), 0)
        lab["active"] = True
        s["hubs"][0]["status"] = "dark"
        self.assertEqual(research.laboratories(s), 0)
        s["hubs"][0]["status"] = "active"
        s["hubs"][0]["discovered"] = 12
        self.assertTrue(research.plan(s, "wideband")["ok"])
        s["science"] = 1
        self.assertEqual(research.plan(s, "wideband")["status"], "funding")
        s["research"] = {"id": "solar_cells", "completesAt": 3}
        self.assertEqual(research.plan(s, "wideband")["status"], "waiting")
        self.assertEqual(research.plan(s, "solar_cells")["status"], "active")
        self.assertEqual(research.plan(s, "surveying")["status"], "complete")
        s["research"] = None
        s["tech"] = ["ion_drive", "thermal"]
        self.lab(2)
        s["science"] = 999
        self.assertIn("Mars", research.plan(s, "deep_space")["reason"])
        s["visitedWorlds"] = ["mars"]
        self.assertFalse(research.plan(s, "deep_space")["ok"], "Home-world presence is not a completed mission")
        s["missions"] = [{"destination":"mars", "status":"complete"}]
        self.assertTrue(research.plan(s, "deep_space")["ok"])

    def test_research_spends_once_and_benefits_activate_after_completion(self):
        before = deepcopy(self.state)
        s = act(self.state, "research", tech="solar_cells")
        self.assertEqual(self.state, before)
        self.assertEqual(s["science"], before["science"]-20)
        self.assertEqual(s["credits"], before["credits"]-18)
        repeated = campaign.execute(s, "research", {"tech": "solar_cells"})
        self.assertFalse(repeated["ok"])
        self.assertEqual(repeated["state"], s)
        h = s["hubs"][0]
        solar = next(t for t in h["tiles"] if t["building"] and t["building"]["type"] == "solar")
        base = surface.production(h, solar, "solar", s["tech"])["outputs"]["energy"]
        s = advance(s, 1)
        self.assertNotIn("solar_cells", s["tech"])
        s = advance(s, 1)
        self.assertIn("solar_cells", s["tech"])
        self.assertIsNone(s["research"])
        self.assertEqual(surface.production(h, solar, "solar", s["tech"])["outputs"]["energy"], base*1.35)
        self.assertFalse(campaign.execute(s, "research", {"tech": "solar_cells"})["ok"])

    def test_old_research_and_paid_projects_are_preserved(self):
        s = self.state
        s["tech"] = ["robotics", "autonomy", "propulsion", "logistics", "thermal"]
        # A paid project from an older save finishes even without new prerequisites/labs.
        s["research"] = {"id": "closed_loop", "completesAt": 2}
        migrated = campaign.validate(s)["state"]
        self.assertIn("surveying", migrated["tech"])
        self.assertEqual(migrated["research"], s["research"])
        finished = advance(migrated, 1)
        self.assertIn("closed_loop", finished["tech"])
        self.assertEqual(campaign.validate(finished)["state"], finished)

    def test_wide_surveys_snapshot_radius_and_legacy_surveys_stay_small(self):
        s = self.state
        target = 10*campaign.MAP_SIZE+10
        small = campaign.inspect_surface(s, "H1", target)["survey"]
        self.assertEqual(small["area"], 9)
        old = act(s, "explore", hub="H1", tile=target)
        old["surveys"][0].pop("radius")  # old save with no field
        old["tech"] = ["surveying", "autonomy", "wideband"]
        old = advance(old, small["turns"])
        self.assertEqual(old["hubs"][0]["discovered"], 9)
        s["tech"] = ["surveying", "autonomy", "wideband"]
        wide = campaign.inspect_surface(s, "H1", target)["survey"]
        self.assertEqual(wide["area"], 25)
        self.assertEqual(wide["energy"], small["energy"]+8)
        local = campaign.inspect_surface(s, "H1", CORE+2)["survey"]
        self.assertEqual((local["energy"], local["area"]), (0, 1))
        s = act(s, "explore", hub="H1", tile=target)
        self.assertEqual(s["surveys"][0]["radius"], 2)
        s = advance(s, wide["turns"])
        self.assertEqual(s["hubs"][0]["discovered"], 25)
        invalid = deepcopy(s)
        invalid["surveys"][0]["radius"] = 99
        self.assertFalse(campaign.validate(invalid)["ok"])
        s = act(s, "explore", hub="H1", tile=0)
        s = advance(s, 2)
        self.assertEqual(s["hubs"][0]["discovered"], 34, "corner survey clips to 3×3")

    def test_modular_quote_and_execution_include_discounted_site_preparation(self):
        s = self.state
        tile = s["hubs"][0]["tiles"][CORE+1]
        tile.update(revealed=True, terrain="plain", biome="mountain", elevation=3, building=None)
        old = campaign.inspect_surface(s, "H1", CORE+1)["buildings"]["laboratory"]
        s["tech"] = ["modular"]
        plan = campaign.inspect_surface(s, "H1", CORE+1)["buildings"]["laboratory"]
        self.assertEqual(plan["materials"], ceil(old["materials"]*.8))
        self.assertEqual(plan["siteCost"], plan["materials"]-ceil(BUILDINGS["laboratory"]["materials"]*.8))
        self.assertEqual(plan["turns"], 1)
        built = act(s, "construct", hub="H1", tile=CORE+1, building="laboratory")
        self.assertEqual(built["hubs"][0]["stocks"]["materials"], s["hubs"][0]["stocks"]["materials"]-plan["materials"])
        self.assertEqual(built["hubs"][0]["tiles"][CORE+1]["building"]["onlineFrom"], 2)

    def test_all_production_bonuses_match_inspector_and_turn_output(self):
        for kind, tech, resource, expected, energy in (
            ("solar", "solar_cells", "energy", 17, 0),
            ("drill", "refining", "materials", 8, 3),
            ("laboratory", "analysis", "science", 10, 4),
            ("greenhouse", "agriculture", "food", 12, 3),
            ("extractor", "biosphere", "water", 14, 4),
            ("recycler", "biosphere", "oxygen", 9, 4),
        ):
            with self.subTest(kind=kind):
                s = deepcopy(self.state)
                h = s["hubs"][0]
                for t in h["tiles"]:
                    t["building"] = None
                tile = h["tiles"][CORE]
                tile.update(terrain="ice" if kind == "extractor" else "plain", biome="settlement", elevation=1, building=campaign._building(kind))
                s["tech"] = [tech]
                h["stocks"] = {k: 50 for k in h["stocks"]}
                before = deepcopy(h["stocks"])
                science = s["science"]
                preview = campaign.inspect_surface(s, "H1", CORE)["facility"]
                self.assertEqual(preview["inputs"].get("energy", 0), energy)
                self.assertTrue(preview["bonuses"])
                campaign._operate_surface(s, h)
                actual = s["science"]-science if resource == "science" else h["stocks"][resource]-before[resource]
                self.assertEqual(actual, expected-(1 if resource == "materials" else 0))  # upkeep
                if kind == "greenhouse":
                    self.assertEqual(h["stocks"]["water"], 48)

    def test_reactor_unlock_atomic_inputs_and_generation_before_consumers(self):
        s = self.state
        locked = campaign.inspect_surface(s, "H1", CORE+1)["buildings"]["reactor"]
        self.assertFalse(locked["ok"])
        self.assertEqual(locked["requiredTech"], "fission")
        self.assertFalse(campaign.execute(s, "construct", {"hub":"H1", "tile":CORE+1, "building":"reactor"})["ok"])
        s["tech"] = ["fission", "modular"]
        built = act(s, "construct", hub="H1", tile=CORE+1, building="reactor")
        self.assertTrue(campaign.validate(built)["ok"])
        for t in s["hubs"][0]["tiles"]:
            t["building"] = None
        h = s["hubs"][0]
        h["world"] = "europa"  # low sunlight cannot reduce reactor generation
        h["stocks"].update(energy=0, water=10, materials=50)
        h["tiles"][CORE]["building"] = campaign._building("laboratory")
        h["tiles"][CORE+1]["building"] = campaign._building("reactor")
        science = s["science"]
        campaign._operate_surface(s, h)
        self.assertEqual(h["stocks"]["energy"], 24)
        self.assertEqual(h["stocks"]["water"], 8)
        self.assertEqual(s["science"]-science, 6)
        h["stocks"].update(energy=0, water=1, materials=50)
        notes = campaign._operate_surface(s, h)
        self.assertEqual(h["stocks"]["water"], 1)
        self.assertEqual(h["stocks"]["materials"], 49, "only upkeep is spent when reactor lacks water")
        self.assertEqual(h["stocks"]["energy"], 0)
        self.assertTrue(any("Reactor idle" in n for n in notes))

    def test_thermal_reduces_forecast_damage_and_stacks_with_preparation(self):
        damaged = []
        for tech, prepared in (([],False), (["thermal"],False), (["thermal"],True)):
            s = deepcopy(self.state)
            h = s["hubs"][0]
            h["world"] = "mercury"
            s["tech"] = tech
            s["forecasts"] = [{"hub":"H1", "turn":1, "severity":100, "prepared":prepared}]
            notes = campaign._operate_surface(s, h)
            damaged.append(100-h["tiles"][CORE]["building"]["condition"])
            if tech:
                self.assertTrue(any("extreme-world protection" in n for n in notes))
        self.assertGreater(damaged[0], damaged[1])
        self.assertGreater(damaged[1], damaged[2])

    def test_biosphere_and_closed_loop_reduce_actual_crew_consumption(self):
        results = []
        for tech in ([], ["biosphere", "closed_loop"]):
            s = deepcopy(self.state)
            h = s["hubs"][0]
            h["crew"] = campaign._crew()
            for c in h["crew"]:
                c["assigned"] = "engineering"
            s["tech"] = tech
            campaign._operate_surface(s, h)
            results.append(h["stocks"])
        for resource in ("food", "water", "oxygen"):
            self.assertEqual(results[1][resource]-results[0][resource], 1)

    def test_equipment_gates_enforce_actions_but_keep_first_mars_and_flybys_open(self):
        s = earth_campaign("RESEARCH-EARTH-LAUNCHERS")
        base = design()
        self.assertTrue(campaign.mission_quote(s, base)["ok"])
        for field, value, required in (("engine","ion","ion_drive"), ("engine","high_thrust","deep_space"), ("hull","freighter","deep_space"), ("vehicle","super_heavy","deep_space")):
            d = {**base, field:value}
            q = campaign.mission_quote(s, d)
            self.assertEqual(q["requiredTech"], required)
            self.assertFalse(campaign.execute(s,"launch",{"design":d,"confirm":True})["ok"])
            unlocked = deepcopy(s)
            unlocked["tech"] = [required]
            self.assertTrue(campaign.mission_quote(unlocked, d)["ok"])
        europa = {**base,"destination":"europa","site":"Conamara Chaos"}
        self.assertEqual(campaign.mission_quote(s, europa)["requiredTech"], "deep_space")
        self.assertTrue(campaign.mission_quote(s, {**europa,"objective":"survey"})["ok"])
        self.assertTrue(campaign.mission_quote(s, {**europa,"objective":"orbital","payload":["relay"]})["ok"])
        # A saved, already-paid advanced flight must still arrive after loading.
        s["tech"] = ["ion_drive"]
        s["turn"] = 2
        s = act(s,"launch",design={**base,"engine":"ion"},confirm=True)
        s["tech"] = []
        s = advance(s, s["missions"][0]["arrivesAt"]-s["turn"])
        self.assertNotEqual(s["missions"][0]["status"], "in_flight")

    def test_mars_home_playthrough_builds_labs_and_unlocks_industry_without_free_science(self):
        s = self.state
        s = act(s,"construct",hub="H1",tile=CORE+1,building="laboratory")
        s = act(s,"construct",hub="H1",tile=CORE-campaign.MAP_SIZE,building="laboratory")
        for tech in ("solar_cells","refining","modular","thermal","fission"):
            for _ in range(12):
                if research.plan(s, tech)["ok"]:
                    break
                s = advance(s, 1)
            self.assertTrue(research.plan(s, tech)["ok"], research.plan(s, tech))
            s = act(s, "research", tech=tech)
            s = advance(s, RESEARCH[tech]["turns"])
        self.assertEqual(research.laboratories(s), 2)
        self.assertLessEqual(s["turn"], 22)
        self.assertTrue(campaign.inspect_surface(s, "H1", CORE+campaign.MAP_SIZE)["buildings"]["reactor"]["ok"])
        self.assertEqual(len(s["hubs"]), 1)

    @unittest.skipUnless(shutil.which("node"), "Optional tree/controller check requires Node")
    def test_tree_rendering_navigation_and_authoritative_controller(self):
        s = self.state
        active = act(s, "research", tech="surveying")
        fixture = {"fresh":s,"catalog":campaign_catalog(),"inspection":campaign.inspect_surface(s,"H1",CORE),
                   "plans":research.inspect(s),"active":active,"activePlans":research.inspect(active)}
        result = subprocess.run(["node","tests/tech_tree_check.mjs"], cwd=Path(__file__).resolve().parents[1],
                                input=json.dumps(fixture),text=True,capture_output=True,timeout=30)
        self.assertEqual(result.returncode, 0, result.stdout+result.stderr)
