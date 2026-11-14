"""Deterministic campaign regression tests (no external libraries)."""

from copy import deepcopy
import unittest

from ares import campaign
from campaign_fixtures import established_campaign
from ares.campaign_data import GOALS, MAP_SIZE, WORLDS

CORE = MAP_SIZE * (MAP_SIZE // 2) + MAP_SIZE // 2


def cond(sensor, op, value):
    return {"sensor": sensor, "op": op, "value": value}


# Passes all four arrival scenarios at the lab's nominal intensity.
GOOD_SOFTWARE = {"computer": "standard", "rules": [
    {"when": [cond("radiation", ">", 60)], "for": 1, "then": "safe_mode"},
    {"when": [cond("camera_health", "<", 70)], "for": 1, "then": "switch_backup"},
    {"when": [cond("battery", "<", 30)], "for": 1, "then": "safe_mode"},
]}


def design(destination="mars", site="Jezero Rim", objective="surface", payload=None, source="H1",
           trajectory="balanced", vehicle="atlas_v_401", propellant=500, hull="lander", engine="chemical"):
    return {
        "source": source, "destination": destination, "site": site,
        "objective": objective, "hull": hull, "engine": engine,
        "trajectory": trajectory, "payload": payload if payload is not None else ["survey", "lab"],
        "vehicle": vehicle, "propellantKg": propellant,
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


def at_turn(state, turn):
    """Jump the calendar for launch-window tests without simulating the turns in between."""
    state = deepcopy(state)
    state["turn"] = turn
    return state


class CampaignTests(unittest.TestCase):
    def setUp(self):
        self.state = established_campaign("TEST-DEEP-SPACE")

    def test_initial_mars_headquarters_and_free_orders(self):
        state = campaign.create_campaign("MARS-START")
        self.assertEqual(state["version"], 3)
        self.assertEqual(len(state["hubs"]), 1)
        self.assertEqual(state["hubs"][0]["world"], "mars")
        self.assertEqual(state["hubs"][0]["kind"], "control")
        self.assertEqual(state["hubs"][0]["tiles"][CORE]["building"]["type"], "command")
        self.assertEqual(state["visitedWorlds"], [])
        self.assertEqual(state["nextId"], 2)
        self.assertEqual(state["missions"], [])
        self.assertNotIn("ap", state)
        self.assertTrue(campaign.validate(state)["ok"])
        s = act(state, "explore", hub="H1", tile=CORE - 2)
        s = act(s, "explore", hub="H1", tile=CORE + 2)
        self.assertEqual(s["turn"], 1)
        self.assertEqual(s["hubs"][0]["discovered"], 2)
        self.assertFalse(state["hubs"][0]["tiles"][CORE - 2]["revealed"])
        self.assertFalse(campaign.execute(state,"explore",{"hub":"H2","tile":CORE-2})["ok"])
        self.assertFalse(campaign.execute(state,"shipment",{"source":"H1","target":"H2","resource":"materials","amount":20})["ok"])

    def test_earth_is_established_only_after_the_first_lander_arrives(self):
        state = campaign.create_campaign("MARS-TO-EARTH")
        state = advance(state, 1)
        state = act(state, "setSoftware", **GOOD_SOFTWARE)
        mission = design(destination="earth", site="Cape Canaveral", payload=["survey","lab"])
        quote = campaign.mission_quote(state, mission)
        self.assertTrue(quote["ok"])
        self.assertTrue(quote["affordable"])
        self.assertEqual(quote["outcome"], "go")
        state = act(state,"launch",design=mission)
        self.assertEqual(len(state["hubs"]),1)
        self.assertNotIn("earth",state["visitedWorlds"])
        state = advance(state, quote["turns"]-1)
        self.assertEqual(len(state["hubs"]),1)
        state = advance(state,1)
        self.assertEqual(state["missions"][0]["status"], "complete")
        earth = next(h for h in state["hubs"] if h["world"] == "earth")
        self.assertEqual(earth["site"],"Cape Canaveral")
        self.assertEqual(earth["kind"],"surface")
        self.assertIn("earth",state["visitedWorlds"])
        state = act(state,"explore",hub=earth["id"],tile=CORE-2)
        self.assertTrue(next(h for h in state["hubs"] if h["id"] == earth["id"])["tiles"][CORE-2]["revealed"])

    def test_existing_mars_save_retains_earned_progress(self):
        state = advance(self.state,2)
        before = deepcopy(state)
        result = campaign.validate(state)
        self.assertTrue(result["ok"])
        self.assertEqual(result["state"],before)
        self.assertEqual(state,before)

    def test_surveys_take_time_and_reveal_when_arriving(self):
        distant = CORE + MAP_SIZE * 4 + 4
        s = act(self.state, "explore", hub="H2", tile=distant)
        self.assertFalse(s["hubs"][1]["tiles"][distant]["revealed"])
        self.assertEqual(s["surveys"][0]["status"], "en_route")
        self.assertFalse(campaign.execute(s, "explore", {"hub": "H2", "tile": distant + 1})["ok"])
        s = advance(s, s["surveys"][0]["arrivesAt"] - s["turn"])
        self.assertTrue(s["hubs"][1]["tiles"][distant]["revealed"])
        self.assertGreaterEqual(sum(t["revealed"] for t in s["hubs"][1]["tiles"]), 18)
        self.assertGreater(s["scienceTotal"], self.state["scienceTotal"])

    def test_earth_has_independent_playable_map_and_connected_construction(self):
        earth = self.state["hubs"][0]
        self.assertEqual(len(earth["tiles"]), MAP_SIZE ** 2)
        self.assertEqual(earth["tiles"][CORE]["building"]["type"], "command")
        self.assertNotIn("rovers", earth)
        s = act(self.state, "explore", hub="H1", tile=CORE - 2)
        self.assertEqual(s["turn"], self.state["turn"])
        self.assertEqual(s["hubs"][0]["stocks"]["energy"], earth["stocks"]["energy"])
        self.assertFalse(campaign.execute(s, "construct", {"hub": "H1", "tile": 0, "building": "solar"})["ok"])
        self.assertFalse(campaign.execute(s, "construct", {"hub": "H1", "tile": CORE + MAP_SIZE + 1, "building": "solar"})["ok"])
        s = act(s, "construct", hub="H1", tile=CORE - 2, building="extractor")
        self.assertEqual(s["hubs"][0]["stocks"]["materials"], earth["stocks"]["materials"] - 16)
        self.assertEqual(s["hubs"][0]["stocks"]["energy"], earth["stocks"]["energy"] - 3)
        self.assertEqual(s["hubs"][0]["tiles"][CORE - 2]["building"]["onlineFrom"], 2)
        self.assertEqual(s["hubs"][1], self.state["hubs"][1])
        self.assertFalse(earth["tiles"][CORE - 2]["revealed"])

    def test_earth_survey_pays_energy_and_reveals_area_on_return(self):
        distant = CORE + MAP_SIZE * 4 + 4
        s = act(self.state, "explore", hub="H1", tile=distant)
        earth = s["hubs"][0]
        self.assertFalse(earth["tiles"][distant]["revealed"])
        self.assertEqual(earth["stocks"]["fuel"], self.state["hubs"][0]["stocks"]["fuel"])
        self.assertLess(earth["stocks"]["energy"], self.state["hubs"][0]["stocks"]["energy"])
        self.assertFalse(campaign.execute(s, "explore", {"hub": "H1", "tile": distant + 1})["ok"])
        s = advance(s, s["surveys"][0]["arrivesAt"] - s["turn"])
        self.assertEqual(s["surveys"][0]["status"], "returned")
        self.assertTrue(all(s["hubs"][0]["tiles"][distant + dy * MAP_SIZE + dx]["revealed"] for dy in (-1, 0, 1) for dx in (-1, 0, 1)))

    def test_earth_buildings_produce_after_construction_and_keep_command_income(self):
        s = act(self.state, "construct", hub="H1", tile=CORE + 1, building="greenhouse")
        s = act(s, "construct", hub="H1", tile=CORE - MAP_SIZE, building="laboratory")
        stock = deepcopy(s["hubs"][0]["stocks"])
        s = advance(s, 2)
        self.assertEqual(s["hubs"][0]["stocks"]["food"], stock["food"])
        self.assertEqual(s["science"], self.state["science"])
        s = advance(s, 1)
        self.assertEqual(s["hubs"][0]["stocks"]["food"], stock["food"] + 8)
        self.assertEqual(s["hubs"][0]["stocks"]["water"], stock["water"] - 3)
        self.assertEqual(s["science"], self.state["science"] + 6)
        self.assertEqual(s["credits"], self.state["credits"] + 3 * self.state["budget"])
        self.assertEqual(s["hubs"][0]["stocks"]["fuel"], stock["fuel"] + 36)
        self.assertEqual(s["hubs"][0]["stocks"]["materials"], stock["materials"] + 14)

    def test_earth_repairs_and_command_remains_available_without_solar_power(self):
        s = deepcopy(self.state)
        earth = s["hubs"][0]
        earth["tiles"][CORE]["building"]["condition"] = 30
        repaired = act(s, "repair", hub="H1", tile=CORE)
        self.assertEqual(repaired["hubs"][0]["tiles"][CORE]["building"]["condition"], 100)
        self.assertEqual(repaired["hubs"][0]["stocks"]["materials"], earth["stocks"]["materials"] - 10)
        earth["tiles"][CORE - 1]["building"]["active"] = False
        earth["stocks"]["energy"] = 0
        s = advance(s, 4)
        self.assertEqual(s["hubs"][0]["status"], "active")
        self.assertGreater(s["credits"], self.state["credits"])
        self.assertFalse(any(f["hub"] == "H1" for f in s["forecasts"]))

    def test_existing_earth_saves_upgrade_without_resetting_progress(self):
        progressed = act(self.state, "shipment", source="H1", target="H2", resource="materials", amount=20)
        for version in (2, 3):
            with self.subTest(version=version):
                legacy = deepcopy(progressed)
                legacy["version"] = version
                legacy["hubs"][0]["tiles"] = []
                legacy["hubs"][0]["rovers"] = 0
                original = deepcopy(legacy)
                checked = campaign.validate(legacy)
                self.assertTrue(checked["ok"], checked.get("error"))
                upgraded = checked["state"]
                self.assertEqual(upgraded, progressed)
                self.assertEqual(campaign.validate(upgraded)["state"], upgraded)
                self.assertEqual(legacy, original)
                scanned = act(legacy, "explore", hub="H1", tile=CORE - 2)
                self.assertTrue(scanned["hubs"][0]["tiles"][CORE - 2]["revealed"])
                self.assertEqual(legacy, original)
        broken = deepcopy(self.state)
        broken["hubs"][0]["tiles"] = broken["hubs"][0]["tiles"][:1]
        self.assertFalse(campaign.validate(broken)["ok"])
        orbital = campaign._hub("H3", "mars", "orbital", "High orbit")
        self.assertEqual(orbital["tiles"], [])
        s = deepcopy(self.state)
        s["hubs"].append(orbital)
        self.assertFalse(campaign.execute(s, "explore", {"hub": "H3", "tile": CORE - 2})["ok"])

    def test_build_uses_resources_without_action_cap(self):
        s = act(self.state, "explore", hub="H2", tile=CORE - 2)
        s = act(s, "explore", hub="H2", tile=CORE + 2)
        s = act(s, "construct", hub="H2", tile=CORE - 2, building="extractor")
        s = act(s, "construct", hub="H2", tile=CORE + MAP_SIZE, building="heater")
        self.assertEqual(s["turn"], 1)
        self.assertEqual(s["hubs"][1]["construction"], 2)
        self.assertGreater(s["hubs"][1]["tiles"][CORE + MAP_SIZE]["building"]["onlineFrom"], s["turn"])
        self.assertEqual(s["hubs"][1]["tiles"][CORE + MAP_SIZE]["building"]["condition"], 100)

    def test_quote_validates_design_rules(self):
        quote = campaign.mission_quote(at_turn(self.state, 2), design())
        self.assertTrue(quote["ok"])
        self.assertTrue(quote["affordable"])
        self.assertEqual(quote["outcome"], "go")
        self.assertEqual(quote["transfer"]["source"], "gmat")
        self.assertEqual({c["id"] for c in quote["checks"]}, {"dla", "mass", "dv"})
        self.assertGreater(quote["fuel"], 0)
        self.assertFalse(campaign.mission_quote(self.state, design(payload=["lab"]))["ok"])
        heavy = campaign.mission_quote(self.state, {**design(), "hull": "scout", "payload": ["survey", "shield", "lab", "cargo"]})
        self.assertFalse(heavy["ok"])
        self.assertFalse(campaign.mission_quote(self.state, design(trajectory="assist"))["ok"])
        self.assertFalse(campaign.mission_quote(self.state, design(propellant=-5))["ok"])

    def test_launch_windows_change_with_the_calendar(self):
        # Turn 1 (July 2028) is far from the Mars window: the Atlas V cannot lift this mass.
        early = campaign.mission_quote(self.state, design(propellant=1500))
        self.assertEqual(early["outcome"], "stranded")
        # Turn 2 (Oct-Dec 2028) is the real 2028 Mars window.
        window = campaign.mission_quote(at_turn(self.state, 2), design(propellant=500))
        self.assertEqual(window["outcome"], "go")
        self.assertLess(window["transfer"]["c3"], 12)
        self.assertEqual(len(window["windows"]), 12)

    def test_failed_checks_need_confirmation_and_have_consequences(self):
        refused = campaign.execute(self.state, "launch", {"design": design(propellant=1500)})
        self.assertFalse(refused["ok"])
        result = campaign.execute(self.state, "launch", {"design": design(propellant=1500), "confirm": True})
        self.assertTrue(result["ok"])
        s = result["state"]
        self.assertEqual(s["missions"][0]["outcome"], "stranded")
        self.assertEqual(s["missions"][0]["status"], "failed")
        self.assertLess(s["hubs"][0]["stocks"]["fuel"], self.state["hubs"][0]["stocks"]["fuel"])
        self.assertEqual(s["stats"]["missionsFailed"], 1)

    def test_scrub_returns_spacecraft_but_spends_credits(self):
        # Turn 2's lowest-energy Mars option leaves Earth at a declination of +27.7 degrees; on
        # turn 20 the lowest-energy option (-54.7 degrees) is out of reach for every rocket.
        state = at_turn(self.state, 20)
        quote = campaign.mission_quote(state, design(trajectory="efficient", vehicle="heavy"))
        self.assertEqual(quote["outcome"], "scrub")
        s = act(state, "launch", design=design(trajectory="efficient", vehicle="heavy"), confirm=True)
        self.assertEqual(s["missions"][0]["outcome"], "scrubbed")
        self.assertEqual(s["hubs"][0]["stocks"]["fuel"], state["hubs"][0]["stocks"]["fuel"])
        self.assertLess(s["credits"], state["credits"])

    def test_flight_software_decides_arrival(self):
        good = act(at_turn(self.state, 2), "setSoftware", **GOOD_SOFTWARE)
        good = act(good, "launch", design=design())
        good = advance(good, good["missions"][0]["arrivesAt"] - good["turn"])
        self.assertEqual(good["missions"][0]["outcome"], "nominal")
        self.assertEqual(sum(h["world"] == "mars" for h in good["hubs"]), 2)
        self.assertTrue(any(r["phase"] == "cruise" for r in good["missions"][0]["report"]))

        bad = act(at_turn(self.state, 2), "setSoftware", computer="standard", rules=[])
        bad = act(bad, "launch", design=design())
        bad = advance(bad, bad["missions"][0]["arrivesAt"] - bad["turn"])
        self.assertIn(bad["missions"][0]["outcome"], ("lost", "degraded"))
        self.assertLess(sum(h["world"] == "mars" and h["kind"] == "surface" and h["status"] == "active" and h["id"] != "H2" for h in bad["hubs"]) + (bad["missions"][0]["outcome"] == "degraded"), 3)

    def test_short_propellant_means_flyby(self):
        s = act(at_turn(self.state, 2), "setSoftware", **GOOD_SOFTWARE)
        plan = design(objective="orbital", site="", payload=["relay", "lab"], hull="scout", propellant=50)
        self.assertEqual(campaign.mission_quote(s, plan)["outcome"], "flyby")
        s = act(s, "launch", design=plan, confirm=True)
        s = advance(s, s["missions"][0]["arrivesAt"] - s["turn"])
        self.assertEqual(s["missions"][0]["outcome"], "flyby")
        self.assertFalse(any(h["kind"] == "orbital" for h in s["hubs"]))

    def test_multiple_surface_hubs_and_orbital_hub(self):
        s = act(at_turn(self.state, 2), "setSoftware", **GOOD_SOFTWARE)
        s = act(s, "launch", design=design("mars", "Jezero Rim", payload=["survey", "cargo"]))
        s = act(s, "launch", design=design("mars", "", "orbital", payload=["relay", "lab"], hull="scout", propellant=600))
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
        self.assertTrue(s["routes"])
        self.assertTrue(any("delivered 22 materials" in e["message"] for e in s["log"]))

    def test_research_tree_and_crew_assignment(self):
        s = act(self.state, "research", tech="surveying")
        self.assertIsNotNone(s["research"])
        self.assertFalse(campaign.execute(s, "research", {"tech": "propulsion"})["ok"])
        s = act(s, "assignCrew", hub="H2", index=0, assignment="science")
        self.assertEqual(s["hubs"][1]["crew"][0]["assigned"], "science")
        s = advance(s, 2)
        self.assertIn("surveying", s["tech"])
        self.assertIsNone(s["research"])

    def _with_forecast(self, severity=80):
        s = deepcopy(self.state)
        s["forecasts"] = [{"id": "FH2-3", "hub": "H2", "turn": 3, "severity": severity, "prepared": False, "kind": "Dust storm"}]
        s["orders"] = []
        return s

    def test_forecasts_are_issued_ahead_of_hazards(self):
        s = advance(self.state, 12)
        self.assertTrue(any("FORECAST" in e["message"] for e in s["log"]))
        for forecast in s["forecasts"]:
            self.assertGreaterEqual(forecast["turn"], s["turn"])

    def test_preparing_halves_hazard_damage_but_must_be_early(self):
        s = self._with_forecast()
        # The forecast hazard strikes while turn 3 is resolved (the third advance).
        unprepared = advance(s, 3)
        prepared = act(s, "prepare", forecast="FH2-3")
        prepared = advance(prepared, 3)
        self.assertGreater(prepared["hubs"][1]["health"], unprepared["hubs"][1]["health"])
        worst = lambda st: min(t["building"]["condition"] for t in st["hubs"][1]["tiles"] if t["building"])
        self.assertGreater(worst(prepared), worst(unprepared))
        self.assertFalse(campaign.execute(at_turn(self._with_forecast(), 3), "prepare", {"forecast": "FH2-3"})["ok"])

    def test_standing_orders_react_inside_the_turn(self):
        s = self._with_forecast()
        exposed = advance(s, 3)
        guarded = act(s, "setOrders", rules=[
            {"when": [cond("hazard", ">", 50)], "then": "shelter_crew"},
            {"when": [cond("hazard", ">", 50)], "then": "stow_arrays"},
        ])
        guarded = advance(guarded, 3)
        self.assertGreater(guarded["hubs"][1]["health"], exposed["hubs"][1]["health"])
        self.assertTrue(any("Standing order 1 fired" in e["message"] for e in guarded["log"]))
        self.assertFalse(campaign.execute(s, "setOrders", {"rules": [{"when": [cond("hazard", ">", 50)], "then": "stow_arrays"}] * 5})["ok"])
        self.assertFalse(campaign.execute(s, "setOrders", {"rules": [{"when": [cond("gravity", ">", 5)], "then": "stow_arrays"}]})["ok"])

    def test_wear_upkeep_and_repair(self):
        s = deepcopy(self.state)
        s["hubs"][1]["stocks"]["materials"] = 0
        s = advance(s, 3)
        solar = s["hubs"][1]["tiles"][CORE - 1]["building"]
        self.assertLess(solar["condition"], 100)
        self.assertFalse(campaign.execute(s, "repair", {"hub": "H2", "tile": CORE - 1})["ok"])
        s["hubs"][1]["stocks"]["materials"] = 50
        s = act(s, "repair", hub="H2", tile=CORE - 1)
        self.assertEqual(s["hubs"][1]["tiles"][CORE - 1]["building"]["condition"], 100)

    def test_crewed_base_can_be_lost_and_reopened(self):
        s = deepcopy(self.state)
        s["hubs"][1]["health"] = 5
        for key in ("oxygen", "water", "food"):
            s["hubs"][1]["stocks"][key] = 0
        s = advance(s, 1)
        self.assertEqual(s["hubs"][1]["status"], "lost")
        self.assertEqual(s["hubs"][1]["crew"], [])
        self.assertEqual(s["stats"]["hubsLost"], 1)
        self.assertFalse(campaign.execute(s, "explore", {"hub": "H2", "tile": CORE + 2})["ok"])
        s = act(at_turn(s, 2), "setSoftware", **GOOD_SOFTWARE)
        quote = campaign.mission_quote(s, design(site="Arcadia Planitia", payload=["habitat", "survey"]))
        self.assertEqual(quote["rescue"], "H2")
        s = act(s, "launch", design=design(site="Arcadia Planitia", payload=["habitat", "survey"]))
        s = advance(s, s["missions"][0]["arrivesAt"] - s["turn"])
        self.assertEqual(s["hubs"][1]["status"], "active")
        self.assertEqual(len(s["hubs"][1]["crew"]), 3)

    def test_uncrewed_station_goes_dark_and_revives(self):
        s = deepcopy(self.state)
        robot = campaign._hub("H9", "venus", "surface", "Ishtar Terra", payload=["survey", "shield"])
        robot["stocks"]["energy"] = 0
        robot["tiles"][CORE - 1]["building"] = None  # no solar array
        s["hubs"].append(robot)
        s = advance(s, 3)
        venus = next(h for h in s["hubs"] if h["id"] == "H9")
        self.assertEqual(venus["status"], "dark")
        s = act(s, "shipment", source="H1", target="H9", resource="energy", amount=40)
        s = advance(s, s["shipments"][0]["arrivesAt"] - s["turn"])
        self.assertEqual(next(h for h in s["hubs"] if h["id"] == "H9")["status"], "active")

    def test_reviews_move_the_budget_and_goals_resolve(self):
        idle = advance(self.state, 24)
        self.assertGreaterEqual(len(idle["reviews"]), 5)
        self.assertLess(idle["budget"], self.state["budget"])
        statuses = {g["id"]: g["status"] for g in idle["goals"]}
        self.assertEqual(statuses["science_400"], "missed")
        self.assertEqual(len(idle["goals"]), len(GOALS))
        rich = deepcopy(self.state)
        rich["scienceTotal"] = 600
        rich = advance(rich, 4)
        self.assertEqual({g["id"]: g["status"] for g in rich["goals"]}["science_400"], "done")
        self.assertGreater(rich["budget"], self.state["budget"])

    def test_version_two_saves_migrate(self):
        legacy = deepcopy(self.state)
        legacy["version"] = 2
        for key in ("budget", "software", "orders", "forecasts", "goals", "reviews", "stats", "reviewBase"):
            del legacy[key]
        for hub in legacy["hubs"]:
            del hub["status"], hub["darkTurns"]
            for tile in hub["tiles"]:
                if tile["building"]:
                    del tile["building"]["condition"]
        legacy["event"] = {"title": "Dust front", "description": "x", "hub": "H2", "choices": []}
        checked = campaign.validate(legacy)
        self.assertTrue(checked["ok"], checked.get("error"))
        self.assertEqual(checked["state"]["version"], 3)
        self.assertEqual(legacy["version"], 2)
        s = act(legacy, "eventChoice", choice="endure")
        self.assertIsNone(s["event"])
        self.assertEqual(s["version"], 3)

    def test_rejects_corrupted_nested_campaign_saves(self):
        cases = [
            lambda b: b["hubs"][1].__setitem__("tiles", [{}]),
            lambda b: b["hubs"][0]["stocks"].__setitem__("fuel", 1.5),
            lambda b: b.__setitem__("missions", [{"status": "in_flight"}]),
            lambda b: b.__setitem__("budget", 999),
            lambda b: b.__setitem__("software", {"computer": "quantum", "rules": []}),
            lambda b: b["hubs"][1].__setitem__("status", "exploded"),
            lambda b: b.__setitem__("forecasts", [{"id": "x", "hub": "H404", "turn": 1, "severity": 5, "prepared": False}]),
            lambda b: b.__setitem__("goals", [{"id": "win_everything", "status": "open"}]),
        ]
        for corrupt in cases:
            bad = deepcopy(self.state)
            corrupt(bad)
            self.assertFalse(campaign.validate(bad)["ok"])

    def test_bounds_replay_and_validation(self):
        self.assertEqual(campaign.create_campaign("SAME"), campaign.create_campaign("SAME"))
        self.assertTrue(campaign.validate(self.state)["ok"])
        self.assertFalse(campaign.validate({"version": 1})["ok"])
        self.assertFalse(campaign.execute(self.state, "unknown", {})["ok"])
        s = advance(self.state, 12)
        for hub in s["hubs"]:
            self.assertTrue(all(0 <= v <= 400 for v in hub["stocks"].values()))
        self.assertEqual(set(WORLDS), {"earth", "mars", "venus", "mercury", "europa", "jupiter", "saturn", "uranus", "neptune"})

    def test_large_independent_planet_maps(self):
        self.assertEqual(len(self.state["hubs"][1]["tiles"]), MAP_SIZE * MAP_SIZE)
        self.assertTrue(self.state["hubs"][1]["tiles"][CORE]["revealed"])
        self.assertFalse(self.state["hubs"][1]["tiles"][0]["revealed"])
        for world in ("mars", "venus", "mercury", "europa"):
            outpost = campaign._hub("HX", world, "surface", WORLDS[world]["sites"][0], payload=["survey"])
            self.assertEqual(len(outpost["tiles"]), MAP_SIZE * MAP_SIZE)
            self.assertEqual(outpost["tiles"][CORE]["building"]["type"], "habitat" if world == "mars" else "command")

    def test_legacy_five_by_five_saves_expand_without_losing_buildings(self):
        legacy = deepcopy(self.state)
        large = legacy["hubs"][1]["tiles"]
        legacy["hubs"][1]["tiles"] = [{**large[(y - 2 + MAP_SIZE // 2) * MAP_SIZE + (x - 2 + MAP_SIZE // 2)], "id": y * 5 + x} for y in range(5) for x in range(5)]
        result = campaign.validate(legacy)
        self.assertTrue(result["ok"])
        restored = result["state"]["hubs"][1]["tiles"]
        self.assertEqual(len(restored), MAP_SIZE * MAP_SIZE)
        self.assertEqual(restored[CORE]["building"]["type"], "habitat")
        self.assertEqual(len(legacy["hubs"][1]["tiles"]), 25)
        corrupt = deepcopy(legacy)
        corrupt["hubs"][1]["tiles"][0] = None
        self.assertFalse(campaign.validate(corrupt)["ok"])


if __name__ == "__main__":
    unittest.main()
