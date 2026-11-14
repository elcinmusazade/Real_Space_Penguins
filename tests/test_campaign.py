"""Deterministic campaign regression tests (no external libraries)."""

from copy import deepcopy
import unittest

from ares import campaign
from ares.campaign_data import WORLDS, MAP_SIZE

CORE = MAP_SIZE * (MAP_SIZE // 2) + MAP_SIZE // 2


def design(destination="venus", site="Ishtar Terra", objective="surface", payload=None, source="H1", trajectory="balanced"):
    return {
        "source": source, "destination": destination, "site": site,
        "objective": objective, "hull": "lander", "engine": "chemical",
        "trajectory": trajectory, "payload": payload if payload is not None else ["rover", "shield", "lab"],
    }


def act(state, command, **args):
    result = campaign.execute(state, command, args)
    if not result["ok"]:
        raise AssertionError(result["message"])
    return result["state"]


def advance(state, turns):
    for _ in range(turns):
        if state["event"]:
            state = act(state, "eventChoice", choice="endure")
        state = act(state, "advance")
    return state


class CampaignTests(unittest.TestCase):
    def setUp(self):
        self.state = campaign.create_campaign("TEST-DEEP-SPACE")

    def test_initial_hubs_and_free_orders(self):
        self.assertEqual(len(self.state["hubs"]), 2)
        self.assertEqual(self.state["hubs"][0]["world"], "earth")
        self.assertEqual(self.state["hubs"][1]["world"], "mars")
        self.assertNotIn("ap", self.state)
        s = act(self.state, "explore", hub="H2", tile=CORE - 2)
        s = act(s, "explore", hub="H2", tile=CORE + 2)
        self.assertEqual(s["turn"], 1)
        self.assertEqual(s["hubs"][1]["discovered"], 2)
        self.assertFalse(self.state["hubs"][1]["tiles"][CORE - 2]["revealed"])

    def test_rovers_take_time_and_reveal_when_arriving(self):
        distant = CORE + MAP_SIZE * 4 + 4
        s = act(self.state, "explore", hub="H2", tile=distant)
        self.assertFalse(s["hubs"][1]["tiles"][distant]["revealed"])
        self.assertEqual(s["expeditions"][0]["status"], "en_route")
        denied = campaign.execute(s, "explore", {"hub": "H2", "tile": distant + 1})
        self.assertFalse(denied["ok"])
        s = advance(s, s["expeditions"][0]["arrivesAt"]-s["turn"])
        self.assertTrue(s["hubs"][1]["tiles"][distant]["revealed"])
        self.assertGreaterEqual(sum(t["revealed"] for t in s["hubs"][1]["tiles"]), 18)
        self.assertGreater(s["scienceTotal"], self.state["scienceTotal"])

    def test_build_uses_resources_without_action_cap(self):
        s = act(self.state, "explore", hub="H2", tile=CORE - 2)
        s = act(s, "explore", hub="H2", tile=CORE + 2)
        s = act(s, "construct", hub="H2", tile=CORE - 2, building="extractor")
        s = act(s, "construct", hub="H2", tile=CORE + MAP_SIZE, building="heater")
        self.assertEqual(s["turn"], 1)
        self.assertEqual(s["hubs"][1]["construction"], 2)
        self.assertGreater(s["hubs"][1]["tiles"][CORE + MAP_SIZE]["building"]["onlineFrom"], s["turn"])

    def test_mission_quote_capacity_conditions_and_costs(self):
        quote = campaign.mission_quote(self.state, design())
        self.assertTrue(quote["ok"])
        self.assertTrue(quote["affordable"])
        self.assertGreater(quote["fuel"], 0)
        self.assertGreater(quote["turns"], 0)
        bad = campaign.mission_quote(self.state, design(payload=["rover"]))
        self.assertFalse(bad["ok"])
        heavy = campaign.mission_quote(self.state, {**design(), "hull": "scout", "payload": ["rover", "shield", "lab", "cargo"]})
        self.assertFalse(heavy["ok"])

    def test_all_three_destinations_playable_and_first_visit_milestone(self):
        s = self.state
        configs = [
            design("venus", "Ishtar Terra"),
            design("mercury", "Caloris Basin"),
            design("europa", "Conamara Chaos"),
        ]
        for config in configs:
            quote = campaign.mission_quote(s, config)
            self.assertTrue(quote["ok"], config["destination"])
            self.assertTrue(quote["affordable"], config["destination"])
            s = act(s, "launch", design=config)
        s = advance(s, 7)
        self.assertTrue(s["milestone"])
        destinations = {h["world"] for h in s["hubs"]}
        for target in ("venus", "mercury", "europa"):
            self.assertIn(target, destinations)
            self.assertIn(target, s["visitedWorlds"])
        self.assertGreater(s["scienceTotal"], self.state["scienceTotal"])

    def test_multiple_surface_hubs_and_orbital_hub(self):
        s = act(self.state, "launch", design=design("mars", "Jezero Rim", payload=["rover", "cargo"]))
        orbital = design("mars", "", "orbital", payload=["relay", "lab"])
        s = act(s, "launch", design=orbital)
        s = advance(s, 4)
        mars = [hub for hub in s["hubs"] if hub["world"] == "mars"]
        self.assertEqual(len(mars), 3)
        self.assertEqual({h["kind"] for h in mars}, {"surface", "orbital"})

    def test_shipment_does_not_teleport_resources_and_establishes_route(self):
        s = act(self.state, "shipment", source="H1", target="H2", resource="materials", amount=22)
        self.assertEqual(s["hubs"][1]["stocks"]["materials"], self.state["hubs"][1]["stocks"]["materials"])
        self.assertEqual(s["hubs"][0]["stocks"]["materials"], self.state["hubs"][0]["stocks"]["materials"] - 22)
        eta = s["shipments"][0]["arrivesAt"] - s["turn"]
        s = advance(s, eta)
        self.assertEqual(s["shipments"][0]["status"], "delivered")
        self.assertEqual(s["hubs"][1]["stocks"]["materials"], self.state["hubs"][1]["stocks"]["materials"] + 22)
        self.assertTrue(s["routes"])

    def test_research_tree_and_crew_assignment(self):
        s = act(self.state, "research", tech="robotics")
        self.assertIsNotNone(s["research"])
        self.assertFalse(campaign.execute(s, "research", {"tech": "propulsion"})["ok"])
        s = act(s, "assignCrew", hub="H2", index=0, assignment="science")
        self.assertEqual(s["hubs"][1]["crew"][0]["assigned"], "science")
        s = advance(s, 2)
        self.assertIn("robotics", s["tech"])
        self.assertIsNone(s["research"])

    def test_event_requires_resolution(self):
        s = advance(self.state, 3)
        self.assertIsNotNone(s["event"])
        self.assertFalse(campaign.execute(s, "advance", {})["ok"])
        s = act(s, "eventChoice", choice="endure")
        self.assertIsNone(s["event"])
        self.assertEqual(act(s, "advance")["turn"], 5)

    def test_shielded_outpost_takes_less_event_damage(self):
        state = advance(self.state, 3)
        unshielded = act(state, "eventChoice", choice="endure")
        protected = deepcopy(state)
        protected["hubs"][1]["tiles"][CORE + 1]["revealed"] = True
        protected["hubs"][1]["tiles"][CORE + 1]["terrain"] = "plain"
        protected["hubs"][1]["tiles"][CORE + 1]["building"] = {"type": "shield", "level": 1, "onlineFrom": 3, "active": True}
        defended = act(protected, "eventChoice", choice="endure")
        self.assertGreater(defended["hubs"][1]["stocks"]["energy"], unshielded["hubs"][1]["stocks"]["energy"])
        self.assertGreater(defended["hubs"][1]["health"], unshielded["hubs"][1]["health"])

    def test_rejects_corrupted_nested_campaign_saves(self):
        bad = deepcopy(self.state)
        bad["hubs"][1]["tiles"] = [{}]
        self.assertFalse(campaign.validate(bad)["ok"])
        bad = deepcopy(self.state)
        bad["hubs"][0]["stocks"]["fuel"] = 1.5
        self.assertFalse(campaign.validate(bad)["ok"])
        bad = deepcopy(self.state)
        bad["missions"] = [{"status": "in_flight"}]
        self.assertFalse(campaign.validate(bad)["ok"])

    def test_bounds_replay_and_validation(self):
        self.assertEqual(campaign.create_campaign("SAME"), campaign.create_campaign("SAME"))
        self.assertTrue(campaign.validate(self.state)["ok"])
        self.assertFalse(campaign.validate({"version": 1})["ok"])
        self.assertFalse(campaign.execute(self.state, "unknown", {})["ok"])
        s = advance(self.state, 12)
        for hub in s["hubs"]:
            self.assertTrue(all(0 <= v <= 400 for v in hub["stocks"].values()))
        self.assertEqual(set(WORLDS), {"earth", "mars", "venus", "mercury", "europa"})

    def test_large_independent_planet_maps(self):
        self.assertEqual(len(self.state["hubs"][1]["tiles"]), 1024)
        self.assertTrue(self.state["hubs"][1]["tiles"][CORE]["revealed"])
        self.assertFalse(self.state["hubs"][1]["tiles"][0]["revealed"])
        s = self.state
        for d in (design("venus", "Ishtar Terra"),design("mercury", "Caloris Basin"),design("europa", "Conamara Chaos")):
            s = act(s,"launch",design=d)
        s = advance(s,7)
        for world in ("mars","venus","mercury","europa"):
            outpost = next(h for h in s["hubs"] if h["world"] == world and h["kind"] == "surface")
            self.assertEqual(len(outpost["tiles"]), 1024)
            self.assertEqual(outpost["tiles"][CORE]["building"]["type"], "habitat" if world=="mars" else "command")

    def test_legacy_five_by_five_saves_expand_without_losing_buildings(self):
        legacy=deepcopy(self.state)
        large=legacy["hubs"][1]["tiles"]
        legacy["hubs"][1]["tiles"]=[{**large[(y-2+MAP_SIZE//2)*MAP_SIZE+(x-2+MAP_SIZE//2)],"id":y*5+x} for y in range(5) for x in range(5)]
        result=campaign.validate(legacy)
        self.assertTrue(result["ok"])
        restored=result["state"]["hubs"][1]["tiles"]
        self.assertEqual(len(restored),1024)
        self.assertEqual(restored[CORE]["building"]["type"],"habitat")
        self.assertEqual(len(legacy["hubs"][1]["tiles"]),25)
        corrupt=deepcopy(legacy)
        corrupt["hubs"][1]["tiles"][0]=None
        self.assertFalse(campaign.validate(corrupt)["ok"])


if __name__ == "__main__":
    unittest.main()
