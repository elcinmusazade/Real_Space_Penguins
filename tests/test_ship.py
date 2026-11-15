"""Ship parts, planet fit check, per-planet rules and planet-specific dangers."""

import unittest
from copy import deepcopy

from ares import campaign, faults, ship
from ares.campaign_data import PLANET_DANGERS, WORLDS


def cond(sensor, op, value):
    return {"sensor": sensor, "op": op, "value": value}


SAFE = {"when": [cond("battery", "<", 30)], "for": 1, "then": "safe_mode"}
SUITED = {
    "venus": {"thermal": "radiators", "structure": "pressure", "power": "rtg"},
    "europa": {"thermal": "insulated", "entry": "rockets", "power": "rtg", "shielding": "heavy", "comms": "dish"},
    "neptune": {"thermal": "insulated", "entry": "floats", "power": "rtg", "comms": "dish"},
}


def lander(world="mars", parts=None, payload=None, objective="surface", propellant=600):
    return {"source": "H1", "destination": world, "objective": objective,
            "site": WORLDS[world]["sites"][0] if objective == "surface" else "",
            "hull": "lander", "engine": "chemical", "trajectory": "balanced",
            "payload": payload or ["survey", "lab"], "vehicle": "atlas_v_401", "propellantKg": propellant,
            "parts": {**ship.DEFAULT_PARTS, **(parts or {})}}


class PartsAndFitTests(unittest.TestCase):
    def test_every_slot_has_choices_and_validation(self):
        self.assertEqual(len(ship.SLOTS), 6)
        for slot in ship.SLOTS:
            self.assertIn(ship.DEFAULT_PARTS[slot], ship.PARTS[slot])
        self.assertEqual(ship.validate_parts({})[0], ship.DEFAULT_PARTS)
        self.assertIsNotNone(ship.validate_parts({"power": "warp_core"})[1])
        self.assertIsNotNone(ship.validate_parts({"tractor": "beam"})[1])

    def test_default_lander_fits_mars_and_earth_only(self):
        design = {"parts": dict(ship.DEFAULT_PARTS), "payload": ["survey", "lab"]}
        row = {r["world"]: r["status"] for r in ship.fit_all(design, "surface")}
        self.assertEqual(row["mars"], "ok")
        self.assertEqual(row["earth"], "ok")
        for world in ("venus", "mercury", "europa", "jupiter", "neptune"):
            self.assertEqual(row[world], "fail", world)

    def test_failures_name_the_real_reason(self):
        design = {"parts": dict(ship.DEFAULT_PARTS), "payload": ["survey"]}
        venus = {c["id"]: c for c in ship.fit(design, "venus", "surface")["checks"]}
        self.assertEqual(venus["structure"]["status"], "fail")
        self.assertIn("92", venus["structure"]["detail"])
        neptune = {c["id"]: c for c in ship.fit(design, "neptune", "surface")["checks"]}
        self.assertEqual(neptune["power"]["status"], "fail")
        self.assertIn("nuclear", neptune["power"]["detail"])
        self.assertEqual(neptune["entry"]["status"], "fail")
        mercury = {c["id"]: c for c in ship.fit(design, "mercury", "surface")["checks"]}
        self.assertIn("parachute", mercury["entry"]["detail"])

    def test_suited_ships_pass(self):
        for world, parts in SUITED.items():
            design = {"parts": {**ship.DEFAULT_PARTS, **parts}, "payload": ["survey", "shield"]}
            report = ship.fit(design, world, "surface", has_relay=False)
            self.assertNotEqual(report["status"], "fail", (world, report))

    def test_parts_add_mass_and_cost_to_the_quote(self):
        state = campaign.create_campaign("SHIP-MASS")
        light = campaign.mission_quote(state, lander())
        heavy = campaign.mission_quote(state, lander(parts={"power": "rtg", "shielding": "heavy", "structure": "pressure"}))
        self.assertTrue(light["ok"] and heavy["ok"])
        self.assertGreater(heavy["numbers"]["dryKg"], light["numbers"]["dryKg"])
        self.assertGreater(heavy["credits"], light["credits"])
        self.assertEqual(len(light["fitAll"]), len(WORLDS))
        self.assertEqual(light["fit"]["world"], "mars")
        self.assertFalse(campaign.mission_quote(state, lander(parts={"power": "warp_core"}))["ok"])

    def test_poor_fit_warns_but_launches_and_arrives_damaged(self):
        state = campaign.create_campaign("SHIP-FIT")
        bad = lander("earth", parts={"entry": "none"})
        quote = campaign.mission_quote(state, bad)
        self.assertEqual(quote["fit"]["status"], "fail")
        result = campaign.execute(state, "launch", {"design": bad, "confirm": True})
        self.assertTrue(result["ok"], result.get("message"))
        s = result["state"]
        mission = s["missions"][-1]
        if mission["status"] == "in_flight":
            while s["turn"] < mission["arrivesAt"]:
                s = campaign.execute(s, "advance", {})["state"]
            mission = s["missions"][-1]
            self.assertIn(mission["outcome"], ("degraded", "lost"))
            self.assertTrue(any(r["phase"] == "fit" for r in mission["report"]))


class PlanetSoftwareTests(unittest.TestCase):
    def setUp(self):
        self.state = campaign.create_campaign("PLANET-RULES")

    def test_each_planet_has_two_of_its_own_dangers(self):
        self.assertEqual(set(PLANET_DANGERS), set(WORLDS))
        seen = set()
        for world, dangers in PLANET_DANGERS.items():
            self.assertEqual(len(dangers), 2, world)
            seen.update(dangers)
        self.assertEqual(len(seen), 18)  # no danger is shared between planets
        self.assertIn("flare", PLANET_DANGERS["mars"])
        self.assertIn("hexagon", PLANET_DANGERS["saturn"])

    def test_planet_rules_override_the_default(self):
        rules = {"computer": "standard", "rules": [SAFE]}
        s = campaign.execute(self.state, "setSoftware", {"world": "venus", **rules})["state"]
        self.assertEqual(campaign.software_for(s, "venus")["rules"], [SAFE])
        self.assertEqual(campaign.software_for(s, "mars"), s["software"])
        cleared = campaign.execute(s, "setSoftware", {"world": "venus", "clear": True})["state"]
        self.assertEqual(campaign.software_for(cleared, "venus"), cleared["software"])
        self.assertFalse(campaign.execute(s, "setSoftware", {"world": "pluto", **rules})["ok"])
        bad = deepcopy(s)
        bad["softwareProfiles"]["venus"] = {"computer": "quantum", "rules": []}
        self.assertFalse(campaign.validate(bad)["ok"])

    def test_launch_carries_the_destination_rules(self):
        s = deepcopy(self.state)
        s["turn"] = 2
        s = campaign.execute(s, "setSoftware", {"world": "earth", "computer": "basic", "rules": [SAFE]})["state"]
        s = campaign.execute(s, "launch", {"design": lander("earth"), "confirm": True})["state"]
        self.assertEqual(s["missions"][-1]["software"]["computer"], "basic")

    def test_quote_tests_both_dangers(self):
        quote = campaign.mission_quote(self.state, lander("earth"))
        self.assertEqual([d["scenario"] for d in quote["software"]["dangers"]], PLANET_DANGERS["earth"])

    def test_right_rule_beats_no_rules_on_every_new_danger(self):
        hazard_rule = {
            "radiation": {"when": [cond("radiation", ">", 75)], "for": 1, "then": "safe_mode"},
            "wind": {"when": [cond("wind", ">", 55)], "for": 1, "then": "descend"},
            "impacts": {"when": [cond("impacts", ">", 40)], "for": 1, "then": "shield_attitude"},
            "blackout": {"when": [cond("storage", ">", 60)], "for": 1, "then": "compress"},
        }
        from ares.fault_data import FAULT_SCENARIOS
        for world, dangers in PLANET_DANGERS.items():
            parts = SUITED.get(world, {"thermal": "insulated", "entry": "floats", "power": "rtg", "comms": "dish", "shielding": "heavy"} if world in ("jupiter", "saturn", "uranus") else {"thermal": "radiators", "entry": "rockets"} if world == "mercury" else {})
            payload = ["survey", "lab"] if world in ("earth", "mars") else ["survey", "shield"]
            profile = ship.sim_profile({"parts": {**ship.DEFAULT_PARTS, **parts}, "payload": payload}, world, "surface")
            for danger in dangers:
                kind = FAULT_SCENARIOS[danger].get("hazard")
                if kind not in hazard_rule:
                    continue
                none = faults.simulate({"computer": "standard", "rules": []}, danger, 1.0, profile)
                good = faults.simulate({"computer": "standard", "rules": [hazard_rule[kind], SAFE]}, danger, 1.0, profile)
                with self.subTest(world=world, danger=danger):
                    self.assertFalse(none["passed"])
                    self.assertGreater(good["science"], none["science"])
                    self.assertTrue(none["hint"])

    def test_ship_parts_change_the_lab_result(self):
        weak = ship.sim_profile({"parts": dict(ship.DEFAULT_PARTS), "payload": ["survey", "shield"]}, "neptune", "surface")
        strong = ship.sim_profile({"parts": {**ship.DEFAULT_PARTS, **SUITED["neptune"]}, "payload": ["survey", "shield"]}, "neptune", "surface")
        rules = {"computer": "standard", "rules": [{"when": [cond("wind", ">", 55)], "for": 1, "then": "descend"}, SAFE]}
        self.assertTrue(faults.simulate(rules, "wind", 1.0, weak)["lost"])
        self.assertFalse(faults.simulate(rules, "wind", 1.0, strong)["lost"])

    def test_missing_instruments_have_no_sensors(self):
        profile = ship.sim_profile({"parts": dict(ship.DEFAULT_PARTS), "payload": ["lab"]}, "mars", "surface")
        result = faults.simulate({"computer": "standard", "rules": [{"when": [cond("radar_health", "<", 101)], "for": 1, "then": "safe_mode"}]}, "dust", 1.0, profile)
        self.assertEqual(sum(result["fireCounts"]), 0)
        self.assertNotIn("radar", result["health"])


if __name__ == "__main__":
    unittest.main()
