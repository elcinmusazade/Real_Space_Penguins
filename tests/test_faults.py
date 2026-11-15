"""Fault Protection Lab: validation, determinism, rule priority, and balance."""

import json
import unittest

from ares import faults
from ares.fault_data import FAULT_COMPUTERS, FAULT_EXAMPLE_RULES, FAULT_SCENARIOS
from ares.faults import ORIGINAL_SCENARIOS


def cond(sensor, op, value):
    return {"sensor": sensor, "op": op, "value": value}


RADIATION_SAFE = {"when": [cond("radiation", ">", 60)], "for": 1, "then": "safe_mode"}
CAMERA_SPARE = {"when": [cond("camera_health", "<", 70)], "for": 1, "then": "switch_backup"}
LOW_POWER_SAFE = {"when": [cond("battery", "<", 30)], "for": 1, "then": "safe_mode"}


class ValidationTests(unittest.TestCase):
    def test_example_design_is_valid(self):
        self.assertTrue(faults.validate_design({"computer": "standard", "rules": FAULT_EXAMPLE_RULES})["ok"])

    def test_rule_slots_limited_by_computer(self):
        rules = [LOW_POWER_SAFE] * (FAULT_COMPUTERS["basic"]["slots"] + 1)
        self.assertFalse(faults.validate_design({"computer": "basic", "rules": rules})["ok"])
        self.assertTrue(faults.validate_design({"computer": "advanced", "rules": rules})["ok"])

    def test_rejects_bad_rules(self):
        bad = [
            {"when": [cond("gravity", ">", 5)], "then": "safe_mode"},
            {"when": [cond("battery", ">", 150)], "then": "safe_mode"},
            {"when": [cond("battery", "is", True)], "then": "safe_mode"},
            {"when": [cond("contact", ">", 1)], "then": "safe_mode"},
            {"when": [], "then": "safe_mode"},
            {"when": [cond("battery", "<", 5)] * 3, "then": "safe_mode"},
            {"when": [cond("battery", "<", 5)], "for": 9, "then": "safe_mode"},
            {"when": [cond("battery", "<", 5)], "then": "self_destruct"},
            {"when": [cond("battery", "<", 5)], "then": "instrument_off"},
            {"when": [cond("battery", "<", 5)], "then": "instrument_off", "target": "laser"},
        ]
        for rule in bad:
            with self.subTest(rule=rule):
                self.assertFalse(faults.validate_design({"computer": "advanced", "rules": [rule]})["ok"])
        self.assertFalse(faults.validate_design({"computer": "quantum", "rules": []})["ok"])
        self.assertFalse(faults.validate_design("nope")["ok"])


class SimulationTests(unittest.TestCase):
    def test_deterministic_and_json_safe(self):
        design = {"computer": "standard", "rules": FAULT_EXAMPLE_RULES}
        first, second = faults.run_tests(design), faults.run_tests(design)
        self.assertEqual(first, second)
        json.dumps(first, allow_nan=False)

    def test_no_rules_fail_every_scenario(self):
        result = faults.run_tests({"computer": "standard", "rules": []})
        self.assertEqual(result["passed"], 0)

    def test_good_rules_beat_baseline_and_pass_all(self):
        result = faults.run_tests({"computer": "standard", "rules": [RADIATION_SAFE, CAMERA_SPARE, LOW_POWER_SAFE]})
        self.assertEqual(result["passed"], len(ORIGINAL_SCENARIOS))
        for scenario in result["results"]:
            self.assertGreaterEqual(scenario["science"], scenario["baseline"]["science"])

    def test_safe_mode_prevents_radiation_damage(self):
        unprotected = faults.simulate({"computer": "standard", "rules": []}, "radiation")
        protected = faults.simulate({"computer": "standard", "rules": [RADIATION_SAFE]}, "radiation")
        self.assertLess(unprotected["health"]["radar"], 50)
        self.assertEqual(protected["health"]["radar"], 100)

    def test_spare_camera_is_single_use(self):
        result = faults.simulate({"computer": "standard", "rules": [CAMERA_SPARE]}, "camera")
        notes = [f.get("note") for t in result["timeline"] for f in t["fired"] if f.get("note")]
        self.assertEqual(notes[0], "Spare camera online.")
        self.assertTrue(all(n == "No spare camera left." for n in notes[1:]))

    def test_higher_priority_rule_wins_conflict(self):
        keep_radar = {"when": [cond("battery", "<", 101)], "for": 1, "then": "instrument_on", "target": "radar"}
        drop_radar = {"when": [cond("battery", "<", 101)], "for": 1, "then": "instrument_off", "target": "radar"}
        first = faults.simulate({"computer": "standard", "rules": [keep_radar, drop_radar]}, "camera")
        self.assertIn("radar", first["timeline"][0]["instruments"])
        self.assertEqual(first["timeline"][0]["fired"][1]["status"], "blocked")
        second = faults.simulate({"computer": "standard", "rules": [drop_radar, keep_radar]}, "camera")
        self.assertNotIn("radar", second["timeline"][0]["instruments"])

    def test_for_turns_delays_firing(self):
        always = {"when": [cond("battery", "<", 101)], "for": 3, "then": "compress"}
        timeline = faults.simulate({"computer": "standard", "rules": [always]}, "camera")["timeline"]
        self.assertEqual([bool(t["fired"]) for t in timeline[:4]], [False, False, True, True])

    def test_intensity_scales_conditions(self):
        design = {"computer": "standard", "rules": [RADIATION_SAFE, CAMERA_SPARE, LOW_POWER_SAFE]}
        calm = faults.simulate(design, "eclipse", 0.85)
        harsh = faults.simulate(design, "eclipse", 1.25)
        self.assertGreaterEqual(calm["science"], harsh["science"])
        self.assertEqual(faults.simulate(design, "eclipse"), faults.simulate(design, "eclipse", 1.0))


if __name__ == "__main__":
    unittest.main()
