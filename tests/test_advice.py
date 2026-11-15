"""AURA advice: read-only, prioritised, and grounded in the real rules."""

import json
import unittest
from copy import deepcopy

from ares import advice, campaign
from ares.campaign_data import MAP_SIZE

CORE = MAP_SIZE * (MAP_SIZE // 2) + MAP_SIZE // 2


def cond(sensor, op, value):
    return {"sensor": sensor, "op": op, "value": value}


GOOD_SOFTWARE = {"computer": "standard", "rules": [
    {"when": [cond("radiation", ">", 60)], "for": 1, "then": "safe_mode"},
    {"when": [cond("camera_health", "<", 70)], "for": 1, "then": "switch_backup"},
    {"when": [cond("battery", "<", 30)], "for": 1, "then": "safe_mode"},
]}


def titles(result, level=None):
    return [i["title"] for i in result["items"] if level is None or i["level"] == level]


class AdviceTests(unittest.TestCase):
    def setUp(self):
        self.state = campaign.create_campaign("ADVICE-TEST")

    def crewed(self, **stocks):
        s = deepcopy(self.state)
        base = campaign._hub("H9", "mars", "surface", "Jezero Rim", payload=["habitat"], seed=s["seed"])
        base["stocks"].update(stocks)
        s["hubs"].append(base)
        return s

    def test_read_only_sorted_and_json_safe(self):
        before = json.dumps(self.state, sort_keys=True)
        result = advice.advise(self.state)
        self.assertEqual(json.dumps(self.state, sort_keys=True), before)
        self.assertTrue(result["ok"])
        json.dumps(result, allow_nan=False)
        order = [advice.LEVELS.index(i["level"]) for i in result["items"]]
        self.assertEqual(order, sorted(order))
        self.assertEqual(sum(result["counts"].values()), len(result["items"]))

    def test_fresh_campaign_points_to_first_steps(self):
        result = advice.advise(self.state)
        self.assertTrue(any("first mission" in t for t in titles(result, "opportunity")))
        self.assertTrue(any(i["action"] and i["action"]["type"] == "plan" for i in result["items"]))

    def test_flight_software_advice_follows_the_lab_test(self):
        self.assertTrue(any("Flight software fails" in t for t in titles(advice.advise(self.state))))
        good = deepcopy(self.state)
        good["software"] = GOOD_SOFTWARE
        self.assertFalse([t for t in titles(advice.advise(good)) if "Flight software fails" in t])

    def test_projected_supply_shortage_is_urgent(self):
        result = advice.advise(self.crewed(oxygen=2, water=40, food=40))
        urgent = titles(result, "critical")
        self.assertTrue(any("oxygen runs out" in t for t in urgent), urgent)
        item = next(i for i in result["items"] if "oxygen runs out" in i["title"])
        self.assertEqual(item["action"], {"type": "hub", "hub": "H9", "label": "Show base"})
        self.assertIn("Oxygen Plant", item["detail"])

    def test_hazards_prepare_window_and_orders(self):
        s = self.crewed()
        s["forecasts"] = [
            {"id": "FH9-2", "hub": "H9", "turn": 2, "severity": 60, "prepared": False, "kind": "Dust storm"},
            {"id": "FH9-1", "hub": "H9", "turn": 1, "severity": 80, "prepared": False, "kind": "Dust storm"},
        ]
        s["orders"] = []
        result = advice.advise(s)
        last = next(i for i in result["items"] if "last chance" in i["title"])
        self.assertEqual(last["action"]["type"], "prepare")
        self.assertEqual(last["action"]["forecast"], "FH9-2")
        now = next(i for i in result["items"] if i["title"].endswith("this turn"))
        self.assertEqual(now["level"], "critical")
        self.assertIn("No standing order reacts to hazards", titles(result))

    def test_worn_buildings_point_at_the_worst_one(self):
        s = deepcopy(self.state)
        hq = s["hubs"][0]
        worn = [t for t in hq["tiles"] if t["building"]][0]
        worn["building"]["condition"] = 20
        item = next(i for i in advice.advise(s)["items"] if i["category"] == "Upkeep")
        self.assertEqual(item["action"], {"type": "tile", "hub": hq["id"], "tile": worn["id"], "label": "Show worst building"})

    def test_earth_launch_windows_from_gmat_table(self):
        s = deepcopy(self.state)
        s["hubs"].append(campaign._hub("H8", "earth", "surface", "Cape Canaveral", payload=["survey"], seed=s["seed"]))
        s["turn"] = 2  # the real 2028 Mars window
        windows = [i for i in advice.advise(s)["items"] if i["category"] == "Launch windows"]
        self.assertTrue(any("Mars window now open" in i["title"] for i in windows), windows)
        self.assertFalse([i for i in advice.advise(self.state)["items"] if i["category"] == "Launch windows"])

    def test_goal_deadline_reminder(self):
        s = deepcopy(self.state)
        s["turn"] = 11
        self.assertTrue(any(t.startswith("Goal due in") for t in titles(advice.advise(s))))


if __name__ == "__main__":
    unittest.main()
