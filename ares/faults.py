"""Fault Protection Lab: player-designed onboard rules tested against scripted faults.

This is an example slice of the mission-design game. The player picks a flight
computer (which sets how many rules fit) and writes WHEN/THEN rules. Python
validates the design and simulates a Mars orbiter through each fault scenario.
Everything is deterministic; values are simplified game numbers.
"""

from __future__ import annotations

from .rules import (
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


def _env(scenario: dict, turn: int) -> dict:
    i = turn - 1
    return {
        "dust": scenario.get("dust", [0] * FAULT_TURNS)[i],
        "radiation": scenario.get("radiation", [10] * FAULT_TURNS)[i],
        "solarFactor": scenario.get("solarFactor", [1] * FAULT_TURNS)[i],
        "contact": turn % scenario["contactEvery"] == 0,
    }


def _holds(cond: dict, sensors: dict) -> bool:
    reading = sensors[cond["sensor"]]
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


def simulate(design: dict, scenario_id: str) -> dict:
    """Run one validated design through one scenario. Pure and deterministic."""
    scenario = FAULT_SCENARIOS[scenario_id]
    sc, computer, rules = FAULT_SPACECRAFT, FAULT_COMPUTERS[design["computer"]], design["rules"]
    battery, storage = float(sc["batteryStart"]), 0.0
    stored = {key: 0.0 for key in FAULT_INSTRUMENTS}
    returned = {key: 0.0 for key in FAULT_INSTRUMENTS}
    data_lost, arrays = 0.0, 100.0
    health = {key: 100.0 for key in FAULT_INSTRUMENTS}
    brownouts, backup_used, lost = 0, False, False
    camera_fault = "cameraFaultFrom" in scenario
    streaks, fire_counts = [0] * len(rules), [0] * len(rules)
    timeline = []

    for turn in range(1, FAULT_TURNS + 1):
        env = _env(scenario, turn)
        sensors = {
            "battery": round(battery), "storage": round(storage / sc["storageMax"] * 100),
            "radiation": env["radiation"], "dust": env["dust"], "contact": env["contact"],
            **{f"{key}_health": round(value) for key, value in health.items()},
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
                keys = [{"downlink_boost": "downlink", "compress": "compress", "stow_arrays": "arrays", "switch_backup": "backup"}[response]]
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
            owner = claimed.get(f"inst:{key}")
            if owner is not None and rules[owner]["then"] in ("safe_mode", "instrument_off"):
                return False
            return health[key] > 0

        safe = "mode" in claimed
        stowed = "arrays" in claimed
        compress = "compress" in claimed
        boost = "downlink" in claimed
        on = [key for key in FAULT_INSTRUMENTS if instrument_on(key)]

        solar = sc["solar"] * env["solarFactor"] * (1 - env["dust"] / 100 * 0.8) * arrays / 100 * (0.3 if stowed else 1)
        base_load = sc["busLoad"] + computer["power"]
        link_power = (sc["boostPower"] if boost else sc["downlinkPower"]) if env["contact"] else 0
        if boost and not env["contact"]:
            events.append("High-power downlink requested, but no ground station was in view.")
        load = base_load + link_power + sum(FAULT_INSTRUMENTS[k]["power"] for k in on)
        new_battery = battery + solar - load

        brownout = new_battery < 0
        if brownout:
            brownouts += 1
            battery = max(0.0, battery + solar - base_load)
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
            room = sc["storageMax"] - storage
            if data > room:
                kept = room / data if data else 0
                data_lost += data - room
                science, data = science * kept, room
            storage += data
            stored[key] += science
        if data_lost and storage >= sc["storageMax"] - 1e-9 and on:
            events.append("Storage full: new data was discarded.")

        for key in on:
            if env["radiation"] > 60:
                health[key] = max(0.0, health[key] - (env["radiation"] - 60) * 1.2)
            if key == "camera" and camera_fault and turn >= scenario["cameraFaultFrom"]:
                health[key] = max(0.0, health[key] - 20)
        if env["radiation"] > 60 and on:
            events.append(f"Radiation damaged: {', '.join(FAULT_INSTRUMENTS[k]['name'] for k in on)}.")
        if env["radiation"] > 80 and not safe and not brownout:
            storage = storage / 2
            stored = {key: value / 2 for key, value in stored.items()}
            events.append("Computer upset: half the stored data was corrupted.")

        if env["contact"] and not brownout and storage > 0:
            rate = sc["boostDownlink"] if boost else sc["downlink"]
            sent = min(rate, storage)
            share = sent / storage
            for key in stored:
                returned[key] += stored[key] * share
                stored[key] -= stored[key] * share
            storage -= sent

        if env["dust"] > 60 and not stowed:
            arrays = max(20.0, arrays - 4)
            events.append("Dust scoured the exposed solar arrays.")
        battery = min(float(sc["batteryMax"]), battery)

        timeline.append({
            "turn": turn, "battery": round(battery), "storage": round(storage / sc["storageMax"] * 100),
            "science": round(sum(returned.values())), "contact": env["contact"], "safe": safe,
            "instruments": on, "fired": fired, "events": events,
        })
        if lost:
            break

    total = sum(returned.values())
    by_instrument = {key: round(value) for key, value in returned.items()}
    focus = scenario.get("instrumentTarget")
    focus_ok = focus is None or returned[focus[0]] >= focus[1]
    return {
        "scenario": scenario_id, "name": scenario["name"], "description": scenario["description"],
        "target": scenario["target"], "science": round(total), "byInstrument": by_instrument,
        "instrumentTarget": {"instrument": focus[0], "science": focus[1]} if focus else None, "dataLost": round(data_lost),
        "brownouts": brownouts, "lost": lost, "arrays": round(arrays),
        "health": {key: round(value) for key, value in health.items()},
        "passed": not lost and total >= scenario["target"] and focus_ok,
        "fireCounts": fire_counts, "timeline": timeline,
    }


def run_tests(data: object) -> dict:
    """Validate a design, then run it and a no-rules baseline through every scenario."""
    checked = validate_design(data)
    if not checked["ok"]:
        return checked
    design = checked["design"]
    baseline = {"computer": design["computer"], "rules": []}
    results = []
    for scenario_id in FAULT_SCENARIOS:
        result = simulate(design, scenario_id)
        result["baseline"] = {key: simulate(baseline, scenario_id)[key] for key in ("science", "byInstrument", "lost", "passed")}
        results.append(result)
    return {
        "ok": True, "design": design,
        "rules": [describe_rule(rule) for rule in design["rules"]],
        "passed": sum(r["passed"] for r in results), "results": results,
    }
