"""Run with: python -m unittest discover -s tests -v"""

from copy import deepcopy
import json
from pathlib import Path
import shutil
import subprocess
import unittest

from ares import engine as e


PROJECT = Path(__file__).resolve().parents[1]


MISSION = [
    ("explore", [12]), ("build", ["water", 12]), ("advanceSol", []),
    ("explore", [2]), ("build", ["lab", 2]), ("advanceSol", []),
    ("chooseEvent", ["protect"]), ("build", ["greenhouse", 15]),
    ("explore", [1]), ("advanceSol", []),
    ("build", ["solar", 9]), ("study", []), ("advanceSol", []),
    ("chooseEvent", ["isolate"]), ("study", []), ("study", []),
    ("advanceSol", []), ("advanceSol", []),
    ("chooseEvent", ["detailed"]), ("advanceSol", []),
    ("advanceSol", []), ("chooseEvent", ["shelter"]),
    ("advanceSol", []), ("advanceSol", []),
]


def play_mission(seed="ARES-01"):
    state = e.create_game(seed)
    for name, args in MISSION:
        result = e.execute_action(name, state, args)
        if not result["ok"]:
            raise AssertionError(f"{name} {args}: {result['message']}")
        state = result["state"]
    return state


class EngineTests(unittest.TestCase):
    def test_seeded_map_and_guaranteed_starter(self):
        a, b = e.create_game("SAME"), e.create_game("SAME")
        self.assertEqual(a, b)
        self.assertEqual((a["tiles"][12]["terrain"], a["tiles"][2]["terrain"]), ("ice", "science"))
        self.assertEqual(sum(t["revealed"] for t in a["tiles"]), 9)
        self.assertEqual(a["ap"], 2)

    def test_map_is_fair_for_100_seeds(self):
        for i in range(100):
            state = e.create_game(str(i))
            self.assertTrue(e.can_explore(state, 12)["ok"])
            self.assertTrue(e.can_explore(state, 2)["ok"])
            self.assertEqual(sum(t["building"] is not None for t in state["tiles"]), 3)

    def test_cargo_budget_and_mass(self):
        self.assertTrue(e.validate_loadout(list(e.DEFAULT_LOADOUT))["ok"])
        self.assertFalse(e.validate_loadout(["supplies", "materials", "battery", "instruments"])["ok"])
        self.assertFalse(e.validate_loadout(["supplies", "supplies"])["ok"])
        self.assertFalse(e.validate_loadout(["unknown"])["ok"])

    def test_orthogonal_neighbors_and_no_wrapping(self):
        self.assertEqual(set(e.neighbors(14)), {8, 13, 15, 20})
        self.assertNotIn(6, e.neighbors(5))
        self.assertEqual(e.coordinate(12), "A3")

    def test_exploration_is_instant_and_immutable(self):
        state = e.create_game()
        result = e.explore(state, 12)
        self.assertTrue(result["ok"])
        self.assertFalse(state["tiles"][12]["revealed"])
        self.assertTrue(result["state"]["tiles"][12]["revealed"])
        self.assertEqual(result["state"]["ap"], 1)
        self.assertEqual(result["state"]["resources"]["energy"], state["resources"]["energy"] - 2)

    def test_hidden_terrain_never_leaks_and_distant_scans_fail(self):
        state = e.create_game()
        self.assertFalse(e.can_build(state, "water", 12)["ok"])
        self.assertIn("Scan", e.can_build(state, "water", 12)["reason"])
        self.assertFalse(e.can_explore(state, 35)["ok"])

    def test_discovery_rewards_are_once_only(self):
        state = e.create_game()
        result = e.explore(state, 1)
        self.assertTrue(result["ok"])
        self.assertEqual(result["state"]["resources"]["materials"], state["resources"]["materials"] + 18)
        self.assertFalse(e.explore(result["state"], 1)["ok"])

    def test_buildings_connect_and_start_next_sol(self):
        state = e.explore(e.create_game(), 12)["state"]
        state = e.build(state, "water", 12)["state"]
        self.assertEqual(state["tiles"][12]["building"]["onlineFrom"], 2)
        self.assertFalse(e.get_tile_output(state, 12)["online"])
        state = e.advance_sol(state)["state"]
        self.assertTrue(e.get_tile_output(state, 12)["online"])

    def test_forecast_matches_turn_delta(self):
        state = e.create_game()
        expected = e.forecast(state)["delta"]
        next_state = e.advance_sol(state)["state"]
        for key in e.RESOURCE_KEYS:
            self.assertAlmostEqual(next_state["resources"][key], state["resources"][key] + expected[key])
        self.assertAlmostEqual(next_state["science"], state["science"] + expected["science"])

    def test_zero_energy_does_not_create_free_resources(self):
        state = e.create_game()
        state["resources"]["energy"] = 0
        state["tiles"][8]["building"]["active"] = False
        self.assertTrue(e.get_tile_output(state, 13)["starved"])
        self.assertEqual(e.get_tile_output(state, 13)["production"]["oxygen"], 0)
        self.assertLess(e.forecast(state)["delta"]["oxygen"], 0)

    def test_zero_water_idles_oxygen_recycler(self):
        state = e.create_game()
        state["resources"]["water"] = 0
        self.assertTrue(e.get_tile_output(state, 13)["starved"])
        self.assertEqual(e.get_tile_output(state, 13)["consumption"]["energy"], 0)

    def test_events_require_a_choice_and_cost_no_ap(self):
        state = e.create_game()
        state = e.advance_sol(state)["state"]
        state = e.advance_sol(state)["state"]
        self.assertEqual(state["event"]["id"], "dust")
        self.assertFalse(e.advance_sol(state)["ok"])
        before_ap = state["ap"]
        result = e.choose_event(state, "protect")
        self.assertTrue(result["ok"])
        self.assertEqual(result["state"]["ap"], before_ap)
        self.assertEqual(result["state"]["weather"]["solarMultiplier"], .8)

    def test_research_and_greenhouse_interactions(self):
        state = e.create_game()
        self.assertFalse(e.study(state)["ok"])
        state = e.explore(state, 2)["state"]
        state = e.build(state, "lab", 2)["state"]
        state = e.advance_sol(state)["state"]
        self.assertTrue(e.study(state)["ok"])

    def test_save_round_trip_and_corruption(self):
        state = e.create_game()
        result = e.validate_save(json.dumps(state))
        self.assertTrue(result["ok"])
        self.assertEqual(result["state"], state)
        bad = deepcopy(state)
        bad["tiles"][0]["id"] = 3
        self.assertFalse(e.validate_save(bad)["ok"])
        self.assertFalse(e.validate_save("not json")["ok"])

    def test_full_mission_victory(self):
        state = play_mission()
        self.assertEqual(state["status"], "success")
        self.assertEqual(state["sol"], 10)
        self.assertGreaterEqual(state["science"], 70)
        self.assertEqual(state["health"], 100)
        self.assertEqual(len(state["history"]), 11)

    def test_partial_success_and_failure(self):
        state = e.create_game()
        for sol in range(1, 11):
            if state["event"]:
                free = next(c["id"] for c in state["event"]["choices"] if not c["cost"])
                state = e.choose_event(state, free)["state"]
            state = e.advance_sol(state)["state"]
            if state["status"] != "playing":
                break
        self.assertIn(state["status"], ("partial", "failed"))
        doomed = e.create_game()
        doomed["health"] = 1
        doomed["resources"]["food"] = 0
        doomed["tiles"][8]["building"]["active"] = False
        self.assertEqual(e.advance_sol(doomed)["state"]["status"], "failed")


@unittest.skipUnless(shutil.which("node"), "Optional parity check requires Node")
class JavaScriptParityTests(unittest.TestCase):
    def test_seed_and_full_mission_match_original_engine(self):
        script = """
          import * as E from './web/engine-view.js';
          const sequence = JSON.parse(process.argv[1]);
          let state = E.createGame({seed:'ARES-01'});
          for (const [name,args] of sequence) {
            const result = E[name](state,...args);
            if (!result.ok) throw Error(`${name}: ${result.message}`);
            state = result.state;
          }
          console.log(JSON.stringify(state));
        """
        proc = subprocess.run(["node", "--input-type=module", "-e", script, json.dumps(MISSION)], cwd=PROJECT, text=True, capture_output=True, check=True)
        original = json.loads(proc.stdout)
        python = play_mission()
        self.assertEqual(python, original)


if __name__ == "__main__":
    unittest.main()
