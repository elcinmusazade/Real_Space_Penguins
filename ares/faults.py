"""Fault Protection Lab: player-designed onboard rules tested against scripted faults.

This is an example slice of the mission-design game. The player picks a flight
computer (which sets how many rules fit) and writes WHEN/THEN rules. Python
validates the design and simulates a Mars orbiter through each fault scenario.
Everything is deterministic; values are simplified game numbers.
"""

from __future__ import annotations

from .fault_data import (
    FAULT_COMPUTERS, FAULT_EXAMPLE_RULES, FAULT_INSTRUMENTS, FAULT_RESPONSES,
    FAULT_SCENARIOS, FAULT_SENSORS, FAULT_SPACECRAFT, FAULT_TURNS,
)

MAX_CONDITIONS = 2
MAX_FOR = 3


def catalog() -> dict:
    """Everything the editor needs to build menus."""
    return {
        "turns": FAULT_TURNS,
        "spacecraft": FAULT_SPACECRAFT,
        "computers": FAULT_COMPUTERS,
        "instruments": FAULT_INSTRUMENTS,
        "sensors": FAULT_SENSORS,
        "responses": FAULT_RESPONSES,
        "scenarios": {key: {"name": s["name"], "description": s["description"], "target": s["target"], "instrumentTarget": s.get("instrumentTarget")} for key, s in FAULT_SCENARIOS.items()},
        "limits": {"conditions": MAX_CONDITIONS, "for": MAX_FOR},
        "example": {"computer": "standard", "rules": FAULT_EXAMPLE_RULES},
    }


def _is_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value == value


def _check_condition(cond: object, where: str) -> tuple[dict | None, str | None]:
    if not isinstance(cond, dict):
        return None, f"{where}: condition must be an object."
    sensor = cond.get("sensor")
    if sensor not in FAULT_SENSORS:
        return None, f"{where}: unknown sensor."
    spec = FAULT_SENSORS[sensor]
    op, value = cond.get("op"), cond.get("value")
    if spec["kind"] == "bool":
        if op != "is" or not isinstance(value, bool):
            return None, f"{where}: {spec['name']} must be compared with 'is' true/false."
        return {"sensor": sensor, "op": "is", "value": value}, None
    if op not in ("<", ">"):
        return None, f"{where}: use < or > for {spec['name']}."
    if not _is_number(value) or not spec["min"] <= value <= spec["max"]:
        return None, f"{where}: {spec['name']} threshold must be {spec['min']}-{spec['max']}."
    return {"sensor": sensor, "op": op, "value": round(value)}, None


def validate_design(data: object) -> dict:
    """Check a player design and return a normalized copy or a readable error."""
    if not isinstance(data, dict):
        return {"ok": False, "error": "Design must be an object."}
    computer = data.get("computer")
    if computer not in FAULT_COMPUTERS:
        return {"ok": False, "error": "Choose a flight computer."}
    rules = data.get("rules", [])
    if not isinstance(rules, list):
        return {"ok": False, "error": "Rules must be a list."}
    slots = FAULT_COMPUTERS[computer]["slots"]
    if len(rules) > slots:
        return {"ok": False, "error": f"The {FAULT_COMPUTERS[computer]['name'].lower()} holds only {slots} rules."}
    clean = []
    for index, rule in enumerate(rules, start=1):
        where = f"Rule {index}"
        if not isinstance(rule, dict):
            return {"ok": False, "error": f"{where}: must be an object."}
        conditions = rule.get("when")
        if not isinstance(conditions, list) or not 1 <= len(conditions) <= MAX_CONDITIONS:
            return {"ok": False, "error": f"{where}: needs 1-{MAX_CONDITIONS} conditions."}
        checked = []
        for cond in conditions:
            normal, error = _check_condition(cond, where)
            if error:
                return {"ok": False, "error": error}
            checked.append(normal)
        hold = rule.get("for", 1)
        if not isinstance(hold, int) or isinstance(hold, bool) or not 1 <= hold <= MAX_FOR:
            return {"ok": False, "error": f"{where}: 'for' must be 1-{MAX_FOR} turns."}
        response = rule.get("then")
        if response not in FAULT_RESPONSES:
            return {"ok": False, "error": f"{where}: unknown response."}
        item = {"when": checked, "for": hold, "then": response}
        if FAULT_RESPONSES[response]["target"]:
            if rule.get("target") not in FAULT_INSTRUMENTS:
                return {"ok": False, "error": f"{where}: choose which instrument."}
            item["target"] = rule["target"]
        clean.append(item)
    return {"ok": True, "design": {"computer": computer, "rules": clean}}


def _env(scenario: dict, turn: int, intensity: float = 1.0) -> dict:
    """Environment for a turn. intensity scales how far conditions depart from calm."""
    i = turn - 1
    dust = scenario.get("dust", [0] * FAULT_TURNS)[i]
    radiation = scenario.get("radiation", [10] * FAULT_TURNS)[i]
    solar = scenario.get("solarFactor", [1] * FAULT_TURNS)[i]
    temperature = scenario["temperature"][i] if "temperature" in scenario else None
    impacts = scenario.get("impacts", [0] * FAULT_TURNS)[i]
    wind = scenario.get("wind", [0] * FAULT_TURNS)[i]
    blackout = turn in scenario.get("blackout", [])
    return {
        "dust": max(0, min(100, round(dust * intensity))),
        "radiation": max(0, min(100, round(10 + (radiation - 10) * intensity))),
        "solarFactor": max(0.02, min(1.0, 1 - (1 - solar) * intensity)),
        "temperature": None if temperature is None else round(20 + (temperature - 20) * intensity),
        "impacts": max(0, min(100, round(impacts * intensity))),
        "wind": max(0, min(100, round(wind * intensity))),
        "contact": turn % scenario["contactEvery"] == 0 and not blackout,
        "blackout": blackout,
    }


def _holds(cond: dict, sensors: dict) -> bool:
    reading = sensors.get(cond["sensor"])
    if reading is None:  # this spacecraft has no such sensor (e.g. no radar fitted)
        return False
    if cond["op"] == "is":
        return reading is cond["value"]
    return reading < cond["value"] if cond["op"] == "<" else reading > cond["value"]


def describe_rule(rule: dict) -> str:
    parts = []
    for cond in rule["when"]:
        spec = FAULT_SENSORS[cond["sensor"]]
        if cond["op"] == "is":
            parts.append(f"{spec['name']} is {'yes' if cond['value'] else 'no'}")
        else:
            parts.append(f"{spec['name']} {cond['op']} {cond['value']}{spec['unit']}")
    action = FAULT_RESPONSES[rule["then"]]["name"]
    if "target" in rule:
        action += f" ({FAULT_INSTRUMENTS[rule['target']]['name']})"
    hold = f" for {rule['for']} turns" if rule["for"] > 1 else ""
    return f"WHEN {' AND '.join(parts)}{hold} THEN {action}"


# The old generic test probe: every instrument, no heat/cold limits, no shielding.
GENERIC_SHIP = {"solar": None, "steady": 0, "batteryBonus": 0, "radReduction": 0.0,
                "thermal": [-300, 600], "downlink": 1.0, "instruments": list(FAULT_INSTRUMENTS)}

HEAT_MARGIN, COLD_MARGIN = 60, 40

CLAIM_KEYS = {"downlink_boost": "downlink", "compress": "compress", "stow_arrays": "arrays", "switch_backup": "backup",
              "thermal_protect": "thermal", "heaters_on": "heaters", "shield_attitude": "attitude", "descend": "altitude"}


def simulate(design: dict, scenario_id: str, intensity: float = 1.0, ship: dict | None = None) -> dict:
    """Run one validated design through one scenario, flying `ship` (see ship.sim_profile). Pure and deterministic."""
    scenario = FAULT_SCENARIOS[scenario_id]
    sc, computer, rules = FAULT_SPACECRAFT, FAULT_COMPUTERS[design["computer"]], design["rules"]
    craft = {**GENERIC_SHIP, **(ship or {})}
    fitted = [k for k in FAULT_INSTRUMENTS if k in craft["instruments"]]
    solar_full = sc["solar"] if craft["solar"] is None else craft["solar"]
    battery_max = float(sc["batteryMax"] + craft["batteryBonus"])
    battery, storage = min(battery_max, float(sc["batteryStart"] + craft["batteryBonus"])), 0.0
    stored = {key: 0.0 for key in FAULT_INSTRUMENTS}
    returned = {key: 0.0 for key in FAULT_INSTRUMENTS}
    data_lost, arrays = 0.0, 100.0
    health = {key: 100.0 for key in FAULT_INSTRUMENTS}
    brownouts, backup_used, lost = 0, False, False
    camera_fault = "cameraFaultFrom" in scenario
    streaks, fire_counts = [0] * len(rules), [0] * len(rules)
    damage = {"radiation": 0.0, "heat": 0.0, "cold": 0.0, "impacts": 0.0, "wind": 0.0}
    timeline = []
    lo, hi = craft["thermal"]

    for turn in range(1, FAULT_TURNS + 1):
        env = _env(scenario, turn, intensity)
        radiation = round(10 + (env["radiation"] - 10) * (1 - craft["radReduction"]))
        sensors = {
            "battery": round(battery / battery_max * 100), "storage": round(storage / sc["storageMax"] * 100),
            "radiation": radiation, "dust": env["dust"], "contact": env["contact"],
            "temperature": env["temperature"], "impacts": env["impacts"], "wind": env["wind"],
            **{f"{key}_health": (round(health[key]) if key in fitted else None) for key in FAULT_INSTRUMENTS},
        }
        fired, events, claimed = [], [], {}
        for index, rule in enumerate(rules):
            streaks[index] = streaks[index] + 1 if all(_holds(c, sensors) for c in rule["when"]) else 0
            if streaks[index] < rule["for"]:
                continue
            response = rule["then"]
            if response == "safe_mode":
                keys = ["mode"] + [f"inst:{k}" for k in FAULT_INSTRUMENTS if f"inst:{k}" not in claimed]
            elif response in ("instrument_off", "instrument_on"):
                keys = [f"inst:{rule['target']}"]
            else:
                keys = [CLAIM_KEYS[response]]
            if keys[0] in claimed:
                fired.append({"rule": index, "status": "blocked", "by": claimed[keys[0]]})
                continue
            for key in keys:
                claimed[key] = index
            fire_counts[index] += 1
            note = None
            if response == "switch_backup":
                if backup_used:
                    note = "No spare camera left."
                else:
                    backup_used, camera_fault, health["camera"] = True, False, 100.0
                    note = "Spare camera online."
            fired.append({"rule": index, "status": "applied", **({"note": note} if note else {})})

        def instrument_on(key: str) -> bool:
            if key not in fitted:
                return False
            owner = claimed.get(f"inst:{key}")
            if owner is not None and rules[owner]["then"] in ("safe_mode", "instrument_off"):
                return False
            return health[key] > 0

        safe = "mode" in claimed
        stowed, compress, boost = "arrays" in claimed, "compress" in claimed, "downlink" in claimed
        protect, heaters = "thermal" in claimed, "heaters" in claimed
        attitude, deeper = "attitude" in claimed, "altitude" in claimed
        on = [key for key in FAULT_INSTRUMENTS if instrument_on(key)]

        solar = solar_full * env["solarFactor"] * (1 - env["dust"] / 100 * 0.8) * arrays / 100
        solar *= (0.3 if stowed else 1) * (0.5 if protect else 1) * (0.6 if deeper else 1)
        base_load = sc["busLoad"] + computer["power"] + (6 if heaters else 0)
        contact = env["contact"] and not attitude
        link_power = (sc["boostPower"] if boost else sc["downlinkPower"]) if contact else 0
        if boost and not contact:
            events.append("High-power downlink requested, but no ground station was in view.")
        load = base_load + link_power + sum(FAULT_INSTRUMENTS[k]["power"] for k in on)
        supply = solar + craft["steady"]
        new_battery = battery + supply - load

        brownout = new_battery < 0
        if brownout:
            brownouts += 1
            battery = max(0.0, battery + supply - base_load)
            events.append("Brownout: battery empty, all instruments and the radio shut down.")
            on = []
            if brownouts >= sc["brownoutsToLose"]:
                lost = True
                events.append("Spacecraft lost after repeated brownouts.")
        else:
            battery = new_battery

        for key in on:
            spec = FAULT_INSTRUMENTS[key]
            data = spec["data"] * health[key] / 100
            science = data * spec["science"]
            if compress:
                data, science = data * 0.5, science * 0.8
            if protect:
                data, science = data * 0.75, science * 0.75
            room = sc["storageMax"] - storage
            if data > room:
                kept = room / data if data else 0
                data_lost += data - room
                science, data = science * kept, room
            storage += data
            stored[key] += science
        if data_lost and storage >= sc["storageMax"] - 1e-9 and on:
            events.append("Storage full: new data was discarded.")

        def harm(kind: str, amount: float, why: str) -> None:
            if amount <= 0 or not on:
                return
            for key in on:
                health[key] = max(0.0, health[key] - amount)
            damage[kind] += amount
            events.append(f"{why}: {', '.join(FAULT_INSTRUMENTS[k]['name'] for k in on)} damaged.")

        if radiation > 60:
            harm("radiation", (radiation - 60) * 1.2, "Radiation")
        if "camera" in on and camera_fault and turn >= scenario["cameraFaultFrom"]:
            health["camera"] = max(0.0, health["camera"] - 20 * intensity)
        if radiation > 80 and not safe and not brownout:
            storage = storage / 2
            stored = {key: value / 2 for key, value in stored.items()}
            events.append("Computer upset: half the stored data was corrupted.")
        # Instruments sit outside the ship's heat control, so they suffer near its limits too.
        temp = env["temperature"]
        if temp is not None and temp > hi - HEAT_MARGIN and not protect:
            harm("heat", min(45.0, 25 + max(0, temp - hi) * 0.3), "Overheating")
        if temp is not None and temp < lo + COLD_MARGIN and not heaters:
            harm("cold", 20.0 + (8 if temp < lo else 0), "Frozen")
            battery = max(0.0, battery - (12 if temp < lo else 4))
        if env["impacts"] > 40 and not attitude:
            arrays = max(20.0, arrays - (env["impacts"] - 40) * 0.4)
            harm("impacts", (env["impacts"] - 40) * 0.8, "Particle impacts")
        if env["wind"] > 55 and not deeper:
            arrays = max(20.0, arrays - 6)
            harm("wind", (env["wind"] - 55) * 0.8, "Wind buffeting")
        if env["blackout"]:
            events.append("Radio blackout: no contact with Earth.")

        if contact and not brownout and storage > 0:
            rate = (sc["boostDownlink"] if boost else sc["downlink"]) * craft["downlink"]
            sent = min(rate, storage)
            share = sent / storage
            for key in stored:
                returned[key] += stored[key] * share
                stored[key] -= stored[key] * share
            storage -= sent

        if env["dust"] > 60 and not stowed:
            arrays = max(20.0, arrays - 4)
            events.append("Dust scoured the exposed solar arrays.")
        battery = min(battery_max, battery)

        hazard_key = scenario.get("hazard", "dust" if "dust" in scenario else "radiation" if "radiation" in scenario else None)
        hazard = {"temperature": min(100, abs((temp if temp is not None else 20) - 20) / 4.5), "radiation": radiation, "dust": env["dust"],
                  "impacts": env["impacts"], "wind": env["wind"], "blackout": 100 if env["blackout"] else 0}.get(hazard_key, 0)
        timeline.append({
            "turn": turn, "battery": round(battery / battery_max * 100), "storage": round(storage / sc["storageMax"] * 100),
            "science": round(sum(returned.values())), "contact": contact, "safe": safe, "hazard": round(hazard),
            "temperature": env["temperature"], "instruments": on, "fired": fired, "events": events,
        })
        if lost:
            break

    # A spacecraft without every instrument is judged against what it can collect.
    capacity = sum(FAULT_INSTRUMENTS[k]["data"] * FAULT_INSTRUMENTS[k]["science"] for k in fitted)
    full = sum(v["data"] * v["science"] for v in FAULT_INSTRUMENTS.values())
    target = round(scenario["target"] * capacity / full)
    total = sum(returned.values())
    by_instrument = {key: round(value) for key, value in returned.items()}
    focus = scenario.get("instrumentTarget")
    focus_ok = focus is None or focus[0] not in fitted or returned[focus[0]] >= focus[1]
    passed = not lost and total >= target and focus_ok
    result = {
        "scenario": scenario_id, "name": scenario["name"], "description": scenario["description"],
        "target": target, "science": round(total), "byInstrument": by_instrument,
        "instrumentTarget": {"instrument": focus[0], "science": focus[1]} if focus and focus[0] in fitted else None, "dataLost": round(data_lost),
        "brownouts": brownouts, "lost": lost, "arrays": round(arrays),
        "health": {key: round(value) for key, value in health.items() if key in fitted},
        "passed": passed, "fireCounts": fire_counts, "timeline": timeline,
    }
    result["hint"] = None if passed else _hint(result, damage, rules)
    return result


def _hint(result: dict, damage: dict, rules: list[dict]) -> str:
    """One sentence on what went wrong and which kind of rule would help."""
    first = lambda text: next((row["turn"] for row in result["timeline"] for e in row["events"] if text in e), None)
    if result["brownouts"]:
        return f"The battery ran flat on turn {first('Brownout')}. A rule like WHEN Battery charge below 30 THEN Enter safe mode saves power."
    worst = max(damage, key=damage.get)
    if damage[worst] > 0:
        advice = {
            "radiation": "WHEN Radiation level above 60 THEN Enter safe mode",
            "heat": "WHEN Outside temperature above (your ship's limit) THEN Thermal protection mode",
            "cold": "WHEN Outside temperature below (your ship's limit) THEN Heaters on",
            "impacts": "WHEN Particle impacts above 50 THEN Shield attitude",
            "wind": "WHEN Wind speed above 60 THEN Descend to calmer layer",
        }[worst]
        label = {"radiation": "Radiation", "heat": "Overheating", "cold": "Frozen", "impacts": "Particle impacts", "wind": "Wind buffeting"}[worst]
        return f"{label} damaged the instruments from turn {first(label)}. Try {advice}."
    if result["dataLost"]:
        return "Data storage filled up and new data was thrown away. Try WHEN Data storage used above 60 THEN Compress data."
    if result["instrumentTarget"] and result["byInstrument"]["camera"] < result["instrumentTarget"]["science"]:
        return "The camera failed before finishing its mapping. Try WHEN Camera health below 70 THEN Switch to backup camera."
    return f"Only {result['science']} of {result['target']} science came home. Keep instruments running longer, or fit a bigger antenna."


ORIGINAL_SCENARIOS = ("dust", "radiation", "camera", "eclipse")


def run_tests(data: object, scenarios: tuple | list | None = None, ship: dict | None = None) -> dict:
    """Validate a design, then run it and a no-rules baseline through each scenario."""
    checked = validate_design(data)
    if not checked["ok"]:
        return checked
    design = checked["design"]
    baseline = {"computer": design["computer"], "rules": []}
    results = []
    for scenario_id in scenarios or ORIGINAL_SCENARIOS:
        result = simulate(design, scenario_id, 1.0, ship)
        result["harsh"] = simulate(design, scenario_id, 1.25, ship)["passed"]
        result["baseline"] = {key: simulate(baseline, scenario_id, 1.0, ship)[key] for key in ("science", "byInstrument", "lost", "passed")}
        results.append(result)
    return {
        "ok": True, "design": design,
        "rules": [describe_rule(rule) for rule in design["rules"]],
        "passed": sum(r["passed"] for r in results), "results": results,
    }
