"""Automated playthroughs: a careful programme should thrive where a careless one fails.

The scenario starts with an established Mars colony to exercise survival.
Earth-only startup and first landing are tested separately.
These are balance guards, not exact-number tests. If a rule change breaks one,
re-check that good play is still rewarded and careless play still costs.
"""

import unittest

from ares import campaign, ship
from campaign_fixtures import established_campaign
from ares.campaign_data import INCIDENTS, MAP_SIZE

CORE = MAP_SIZE * (MAP_SIZE // 2) + MAP_SIZE // 2
TURNS = 24


def cond(sensor, op, value):
    return {"sensor": sensor, "op": op, "value": value}


GOOD_SOFTWARE = {"computer": "standard", "rules": [
    {"when": [cond("radiation", ">", 60)], "for": 1, "then": "safe_mode"},
    {"when": [cond("camera_health", "<", 70)], "for": 1, "then": "switch_backup"},
    {"when": [cond("battery", "<", 30)], "for": 1, "then": "safe_mode"},
]}
GOOD_ORDERS = [
    {"when": [cond("hazard", ">", 40)], "then": "shelter_crew"},
    {"when": [cond("hazard", ">", 40)], "then": "stow_arrays"},
    {"when": [cond("condition", "<", 60), cond("materials", ">", 30)], "then": "auto_repair"},
]


def plan(destination, objective, site, payload, hull, propellant, vehicle="atlas_v_401", trajectory="balanced", parts=None):
    design = {"source": "H1", "destination": destination, "objective": objective, "site": site,
              "hull": hull, "engine": "chemical", "trajectory": trajectory, "payload": payload,
              "vehicle": vehicle, "propellantKg": propellant}
    if parts is not None:
        design["parts"] = {**ship.DEFAULT_PARTS, **parts}
    return design


def try_act(state, action, **args):
    result = campaign.execute(state, action, args)
    return result["state"] if result["ok"] else state


def careful(seed):
    s = established_campaign(seed)
    s = try_act(s, "setSoftware", **GOOD_SOFTWARE)
    s = try_act(s, "setOrders", rules=GOOD_ORDERS)
    # A careful player writes Venus its own rules for the heat (planet tabs on the Software screen).
    s = try_act(s, "setSoftware", world="venus", computer="standard", rules=GOOD_SOFTWARE["rules"] + [
        {"when": [cond("temperature", ">", 60)], "for": 1, "then": "thermal_protect"}])
    for tile in (CORE - 2, CORE + 2, CORE - 2 * MAP_SIZE, CORE + 2 * MAP_SIZE, CORE + MAP_SIZE + 2):
        s = try_act(s, "explore", hub="H2", tile=tile)
    s = try_act(s, "construct", hub="H2", tile=CORE - 2, building="extractor")
    s = try_act(s, "construct", hub="H2", tile=CORE + MAP_SIZE, building="heater")
    s = try_act(s, "construct", hub="H2", tile=CORE - MAP_SIZE, building="greenhouse")
    s = try_act(s, "construct", hub="H2", tile=CORE + 1, building="solar")
    s = try_act(s, "construct", hub="H2", tile=CORE - MAP_SIZE - 1, building="solar")
    s = try_act(s, "assignCrew", hub="H2", index=1, assignment="survival")
    wanted = [
        (2, plan("mars", "orbital", "", ["relay", "lab"], "scout", 600, parts={"entry": "none"})),
        (2, plan("mars", "surface", "Jezero Rim", ["rover", "lab"], "lander", 500, parts={})),
        (5, plan("venus", "survey", "", ["lab"], "scout", 100, parts={"entry": "none"})),
    ]
    for _ in range(TURNS):
        if s["event"]:
            options = INCIDENTS[s["event"]["incident"]]["choices"]
            stock = next(h["stocks"] for h in s["hubs"] if h["id"] == s["event"]["hub"])
            choice = next(o for o in options if all(stock[k] >= n for k, n in o.get("cost", {}).items()))
            s = try_act(s, "eventChoice", choice=choice["id"])
        for forecast in s["forecasts"]:
            if not forecast["prepared"] and forecast["turn"] > s["turn"]:
                s = try_act(s, "prepare", forecast=forecast["id"])
        mars = s["hubs"][1]
        for resource in ("oxygen", "water", "food", "materials", "energy"):
            in_flight = any(x["status"] == "in_flight" and x["resource"] == resource and x["target"] == "H2" for x in s["shipments"])
            if mars["stocks"][resource] < 30 and not in_flight:
                s = try_act(s, "shipment", source="H1", target="H2", resource=resource, amount=40)
        for turn, mission in list(wanted):
            if s["turn"] >= turn and campaign.mission_quote(s, mission).get("outcome") == "go":
                before = len(s["missions"])
                s = try_act(s, "launch", design=mission)
                if len(s["missions"]) > before:
                    wanted.remove((turn, mission))
        if not s["research"]:
            for tech in ("surveying", "autonomy", "closed_loop"):
                if tech not in s["tech"]:
                    s = try_act(s, "research", tech=tech)
                    break
        s = try_act(s, "advance")
    return s


def careless(seed):
    s = established_campaign(seed)
    s = try_act(s, "launch", design=plan("mars", "surface", "Jezero Rim", ["rover", "lab"], "lander", 1500), confirm=True)
    s = try_act(s, "setOrders", rules=[])
    for _ in range(TURNS):
        if s["event"]:
            s = try_act(s, "eventChoice", choice="endure")
        if s["turn"] == 2:
            s = try_act(s, "setSoftware", computer="standard", rules=[])
            s = try_act(s, "launch", design=plan("mars", "orbital", "", ["relay", "lab"], "scout", 600))
        s = try_act(s, "advance")
    return s


class BalanceTests(unittest.TestCase):
    SEEDS = ("BALANCE-A", "BALANCE-B", "BALANCE-C")

    def test_careful_programme_thrives(self):
        for seed in self.SEEDS:
            with self.subTest(seed=seed):
                s = careful(seed)
                self.assertEqual(s["stats"]["hubsLost"], 0)
                self.assertGreaterEqual(s["stats"]["missionsOk"], 3)
                self.assertEqual(s["stats"]["missionsFailed"], 0)
                self.assertGreaterEqual(s["budget"], 12)
                self.assertGreater(s["hubs"][1]["health"], 40)
                self.assertGreaterEqual(sum(g["status"] == "done" for g in s["goals"]), 3)

    def test_careless_programme_pays(self):
        for seed in self.SEEDS:
            with self.subTest(seed=seed):
                s = careless(seed)
                self.assertGreaterEqual(s["stats"]["missionsFailed"], 1)
                self.assertGreaterEqual(s["stats"]["hubsLost"], 1)
                self.assertLess(s["budget"], 12)

    def test_careful_beats_careless(self):
        for seed in self.SEEDS:
            with self.subTest(seed=seed):
                good, bad = careful(seed), careless(seed)
                self.assertGreater(good["scienceTotal"], bad["scienceTotal"])
                self.assertGreater(good["budget"], bad["budget"])


if __name__ == "__main__":
    unittest.main()
