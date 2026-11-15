"""Local supply incidents through the normal campaign commands."""
import json
import unittest

from ares import campaign
from ares.campaign_data import INCIDENTS, MAX_RESOURCE


class LocalIncidentTests(unittest.TestCase):
    def test_calendar_and_reload_from_mars_hq(self):
        state = campaign.create_campaign("SUPPLY-DRILL")
        turns, kinds = [], []
        for turn in range(2, 16):
            result = campaign.execute(state, "advance", {})
            self.assertTrue(result["ok"], result["message"])
            state = result["state"]
            if not state["event"]:
                continue
            turns.append(turn)
            pending = state["event"]
            kinds.append(pending["incident"])
            self.assertEqual(pending["hub"], "H1")
            loaded = campaign.validate(json.loads(json.dumps(state)))["state"]
            self.assertEqual(loaded["event"], pending)
            self.assertFalse(campaign.execute(loaded, "advance", {})["ok"])
            result = campaign.execute(loaded, "eventChoice", {"choice": "endure"})
            self.assertTrue(result["ok"])
            state = result["state"]
            self.assertIsNone(state["event"])
            self.assertFalse(campaign.execute(state, "eventChoice", {"choice": "endure"})["ok"])
        self.assertEqual(turns, [4, 7, 11, 14])
        self.assertCountEqual(kinds, INCIDENTS)

    def test_seeded_order_and_eligible_sites(self):
        state = campaign.create_campaign("ORDER")
        state["hubs"].extend([
            campaign._hub("H2", "earth", "surface", "Pacific Coast"),
            campaign._hub("H3", "mars", "orbital", "Orbit"),
            campaign._hub("H4", "venus", "surface", "Ishtar Terra"),
        ])
        state["hubs"][-1]["status"] = "dark"
        def sample(seed):
            state["seed"] = seed
            result = []
            for turn in (4, 7, 11, 14, 18, 21, 25, 28):
                state["turn"] = turn
                campaign._issue_incident(state)
                result.append(tuple(state["event"][k] for k in ("incident", "hub")))
            return result
        sequence = sample("ORDER")
        self.assertEqual(sample("ORDER"), sequence)
        self.assertNotEqual(sample("OTHER"), sequence)
        self.assertEqual({hub for _, hub in sequence}, {"H1", "H2"})
        self.assertCountEqual((kind for kind, _ in sequence[4:]), INCIDENTS)

    def test_only_local_stocks_pay_and_shortfalls_are_atomic(self):
        state = campaign.create_campaign("DEPOT")
        outpost = campaign._hub("H2", "earth", "surface", "Pacific Coast")
        state["hubs"].append(outpost)
        state = campaign.validate(state)["state"]
        state["event"] = {"incident": "water_leak", "hub": "H2"}
        outpost["stocks"].update(materials=8, energy=3, water=20)
        for choice in ("fabricate", "replace", "invented"):
            result = campaign.execute(state, "eventChoice", {"choice": choice})
            self.assertFalse(result["ok"])
            self.assertEqual(result["state"], state)
        outpost["stocks"]["energy"] = 4
        fixed = campaign.execute(state, "eventChoice", {"choice": "fabricate"})
        self.assertTrue(fixed["ok"])
        self.assertEqual(fixed["state"]["hubs"][0]["stocks"], state["hubs"][0]["stocks"])
        stock = fixed["state"]["hubs"][1]["stocks"]
        self.assertEqual((stock["materials"], stock["energy"], stock["water"]), (0, 0, 20))
        self.assertIn("-8 materials", fixed["message"])
        outpost["stocks"]["water"] = 3
        drained = campaign.execute(state, "eventChoice", {"choice": "endure"})
        self.assertEqual(drained["state"]["hubs"][1]["stocks"]["water"], 0)
        self.assertIn("-3 water", drained["message"])

    def test_recovery_and_empty_stock_fallback(self):
        state = campaign.create_campaign("POD")
        site = state["hubs"][0]
        state["event"] = {"hub": "H1", "incident": "cargo_pod"}
        site["stocks"].update(fuel=7, energy=4, spares=MAX_RESOURCE - 1)
        result = campaign.execute(state, "eventChoice", {"choice": "tow"})
        stock = result["state"]["hubs"][0]["stocks"]
        self.assertEqual((stock["fuel"], stock["energy"], stock["spares"]), (0, 0, MAX_RESOURCE))
        self.assertIn("+1 spares", result["message"])
        site["stocks"] = dict.fromkeys(site["stocks"], 0)
        for kind in INCIDENTS:
            state["event"]["incident"] = kind
            result = campaign.execute(state, "eventChoice", {"choice": "endure"})
            self.assertTrue(result["ok"])
            self.assertIsNone(result["state"]["event"])
        state["event"]["incident"] = "unknown"
        self.assertFalse(campaign.validate(state)["ok"])
