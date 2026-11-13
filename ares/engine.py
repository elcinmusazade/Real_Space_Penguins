"""Deterministic, browser-independent Python rules for Ares: First Light.

The JSON state shape matches the original browser edition so the existing
isometric interface can display Python-computed missions. No game action is
calculated by the JavaScript interface in this edition.
"""

from __future__ import annotations

from copy import deepcopy
import json
import math

from .rules import (
    BUILDINGS, CARGO, CROPS, DEFAULT_LOADOUT, EVENT_DEFINITIONS,
    EVENTS_BY_SOL, FLOW_KEYS, GRID_SIZE, RESEARCH, RESOURCE_KEYS, TERRAINS,
)


def empty_flow() -> dict[str, float]:
    return {key: 0 for key in FLOW_KEYS}


def round1(value: float) -> float:
    """Match JavaScript Math.round to one decimal place."""
    return math.floor(value * 10 + 0.5) / 10


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def clear_weather() -> dict:
    return {"name": "Clear skies", "description": "Good visibility. Solar generation is operating normally.", "solarMultiplier": 1, "untilSol": None}


def valid_id(tile_id: object) -> bool:
    return type(tile_id) is int and 0 <= tile_id < GRID_SIZE * GRID_SIZE


def coordinate(tile_id: int) -> str:
    return f"{chr(65 + tile_id % GRID_SIZE)}{tile_id // GRID_SIZE + 1}" if valid_id(tile_id) else "—"


def neighbors(tile_id: int) -> list[int]:
    if not valid_id(tile_id):
        return []
    x, y = tile_id % GRID_SIZE, tile_id // GRID_SIZE
    return [b * GRID_SIZE + a for a, b in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)) if 0 <= a < GRID_SIZE and 0 <= b < GRID_SIZE]


def _seed_hash(seed: str) -> int:
    # 32-bit FNV-1a over JS UTF-16 code units, matching the browser original.
    h = 2166136261
    data = seed.encode("utf-16-le", "surrogatepass")
    for i in range(0, len(data), 2):
        unit = data[i] | (data[i + 1] << 8)
        h = ((h ^ unit) * 16777619) & 0xFFFFFFFF
    return h


def _rolls(seed: str, count: int):
    # Mulberry32: seeded maps are byte-for-byte compatible with the JS version.
    value = _seed_hash(seed)
    mask = 0xFFFFFFFF
    for _ in range(count):
        value = (value + 0x6D2B79F5) & mask
        t = value
        t = ((t ^ (t >> 15)) * (t | 1)) & mask
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & mask)) & mask
        yield ((t ^ (t >> 14)) & mask) / 4294967296


def validate_loadout(loadout: object = None) -> dict:
    if loadout is None:
        loadout = []
    if not isinstance(loadout, list):
        return {"ok": False, "cost": 0, "mass": 0, "errors": ["Cargo must be a list of equipment IDs."]}
    errors = []
    if any(not isinstance(item, str) for item in loadout):
        errors.append("Unknown cargo item.")
    if len({item for item in loadout if isinstance(item, str)}) != len(loadout):
        errors.append("Each cargo item can be packed only once.")
    cost = mass = 0
    for item in loadout:
        if not isinstance(item, str) or item not in CARGO:
            if "Unknown cargo item." not in errors:
                errors.append("Unknown cargo item.")
            continue
        cost += CARGO[item]["cost"]
        mass += CARGO[item]["mass"]
    if cost > 70:
        errors.append("The launch budget is 70 credits.")
    if mass > 8:
        errors.append("The cargo capacity is 8 tonnes.")
    return {"ok": not errors, "cost": cost, "mass": mass, "errors": errors}


def make_building(kind: str, online_from: int = 1) -> dict:
    b = {"type": kind, "level": 1, "onlineFrom": online_from, "active": True, "damage": 0}
    if kind == "greenhouse":
        b["crop"] = "greens"
    return b


def snapshot(state: dict, sol: int | None = None) -> dict:
    return {"sol": state["sol"] if sol is None else sol, "resources": dict(state["resources"]), "health": state["health"], "science": state["science"]}


def add_log(state: dict, message: str, kind: str = "info") -> None:
    state["log"].append({"sol": state["sol"], "text": message, "type": kind})
    state["log"] = state["log"][-120:]


def create_game(seed: str = "ARES-01", loadout: list[str] | None = None) -> dict:
    if loadout is None:
        loadout = list(DEFAULT_LOADOUT)
    check = validate_loadout(loadout)
    if not check["ok"]:
        raise ValueError(" ".join(check["errors"]))
    seed = str(seed).strip()[:64] or "ARES-01"
    tiles = []
    for tile_id, roll in enumerate(_rolls(seed, 36)):
        x, y = tile_id % GRID_SIZE, tile_id // GRID_SIZE
        terrain = "plain" if roll < .4 else "ridge" if roll < .57 else "ice" if roll < .70 else "science" if roll < .81 else "salvage" if roll < .93 else "hazard"
        revealed = 1 <= x <= 3 and 1 <= y <= 3
        tiles.append({"id": tile_id, "x": x, "y": y, "terrain": "plain" if revealed else terrain, "revealed": revealed, "collected": False, "building": None})
    tiles[14]["building"] = make_building("habitat")
    tiles[8]["building"] = make_building("solar")
    tiles[13]["building"] = make_building("oxygen")
    for tile_id, terrain in ((12, "ice"), (2, "science"), (15, "ridge"), (1, "salvage"), (7, "plain")):
        tiles[tile_id]["terrain"] = terrain
    state = {
        "version": 1, "seed": seed, "sol": 1, "maxSols": 10, "ap": 2,
        "resources": {"energy": 32, "oxygen": 42, "water": 32, "food": 32, "materials": 40},
        "health": 100, "science": 0, "goal": 70, "tiles": tiles, "tech": {},
        "event": None, "weather": clear_weather(), "log": [], "history": [], "status": "playing",
        "loadout": list(loadout), "effects": {"labsPausedUntil": 0},
        "stats": {"explored": 0, "constructed": 0, "repaired": 0, "upgraded": 0, "studies": 0, "eventsResolved": 0},
    }
    for item in loadout:
        if item == "supplies":
            state["resources"]["food"] += 15
            state["resources"]["water"] += 10
            state["resources"]["oxygen"] += 8
        elif item == "materials":
            state["resources"]["materials"] += 24
        elif item == "battery":
            state["resources"]["energy"] += 20
        elif item == "instruments":
            state["science"] += 8
    state["history"].append(snapshot(state, 0))
    add_log(state, "Touchdown confirmed. Three astronauts, ten Sols, one chance to build a foothold.", "success")
    add_log(state, "Scout A3 for ice or C1 for a geological site. Every Sol gives you two actions.")
    return state


def running(state: dict) -> dict:
    return {"ok": True, "reason": ""} if state.get("status") == "playing" else {"ok": False, "reason": "This mission has ended. Prepare a new mission to continue."}


def has_action(state: dict, costs: dict | None = None, points: int = 1) -> dict:
    check = running(state)
    if not check["ok"]:
        return check
    if state["ap"] < points:
        return {"ok": False, "reason": "No action points remain. End the Sol to continue."}
    for resource, amount in (costs or {}).items():
        if state["resources"].get(resource, 0) < amount:
            return {"ok": False, "reason": f"Requires {amount} {resource}."}
    return {"ok": True, "reason": ""}


def fail(state: dict, reason: str) -> dict:
    return {"ok": False, "state": state, "message": reason}


def done(state: dict, message: str, kind: str = "success") -> dict:
    add_log(state, message, kind)
    return {"ok": True, "state": state, "message": message}


def spend(state: dict, costs: dict | None = None, points: int = 1) -> None:
    state["ap"] -= points
    for resource, amount in (costs or {}).items():
        state["resources"][resource] = round1(state["resources"][resource] - amount)


def online(tile: dict, state: dict) -> bool:
    b = tile.get("building")
    return bool(b and b["active"] and b["onlineFrom"] <= state["sol"] and b["damage"] < 2)


def capacity(state: dict) -> dict:
    energy = 80 + (20 if "battery" in state["loadout"] else 0)
    for tile in state["tiles"]:
        b = tile["building"]
        if b and b["type"] == "battery" and online(tile, state):
            energy += 30 * b["level"]
    return {"energy": energy, "oxygen": 120, "water": 120, "food": 120, "materials": 250, "science": 1000}


def cap_resources(state: dict) -> None:
    caps = capacity(state)
    for key in RESOURCE_KEYS:
        state["resources"][key] = round1(clamp(state["resources"][key], 0, caps[key]))
    state["health"] = round1(clamp(state["health"], 0, 100))
    state["science"] = round1(clamp(state["science"], 0, 1000))


def can_explore(state: dict, tile_id: int) -> dict:
    check = running(state)
    if not check["ok"]:
        return check
    if not valid_id(tile_id):
        return {"ok": False, "reason": "Select a tile within the mission sector."}
    if state["tiles"][tile_id]["revealed"]:
        return {"ok": False, "reason": "This sector has already been scanned."}
    if not any(state["tiles"][n]["revealed"] for n in neighbors(tile_id)):
        return {"ok": False, "reason": "Explore a tile bordering revealed territory first."}
    return has_action(state, {"energy": 1 if "rover" in state["loadout"] or state["tech"].get("rover") else 2})


def explore(original: dict, tile_id: int) -> dict:
    check = can_explore(original, tile_id)
    if not check["ok"]:
        return fail(original, check["reason"])
    state = deepcopy(original)
    tile = state["tiles"][tile_id]
    spend(state, {"energy": 1 if "rover" in state["loadout"] or state["tech"].get("rover") else 2})
    tile["revealed"] = True
    state["stats"]["explored"] += 1
    reward = ""
    if tile["terrain"] == "salvage" and not tile["collected"]:
        tile["collected"] = True
        state["resources"]["materials"] += 18
        reward = " Recovered 18 materials."
    if tile["terrain"] == "science" and not tile["collected"]:
        tile["collected"] = True
        amount = 8 + (3 if "rover" in state["loadout"] or state["tech"].get("rover") else 0)
        state["science"] += amount
        reward = f" Survey collected {amount} science."
    cap_resources(state)
    return done(state, f"Sector {coordinate(tile_id)}: {TERRAINS[tile['terrain']]['name']} discovered.{reward}", "explore")


def can_build(state: dict, kind: str, tile_id: int) -> dict:
    check = running(state)
    if not check["ok"]:
        return check
    if kind not in BUILDINGS or kind == "habitat":
        return {"ok": False, "reason": "Choose an available module from the construction bay."}
    if not valid_id(tile_id):
        return {"ok": False, "reason": "Choose a tile within the mission sector."}
    tile = state["tiles"][tile_id]
    if not tile["revealed"]:
        return {"ok": False, "reason": "Scan this sector before construction."}
    if tile["building"]:
        return {"ok": False, "reason": "A module already occupies this tile."}
    if tile["terrain"] == "hazard":
        return {"ok": False, "reason": "Unstable ground is unsafe for construction."}
    if kind == "water" and tile["terrain"] != "ice":
        return {"ok": False, "reason": "Water extractors must be placed on an ice deposit."}
    if not any(state["tiles"][n]["building"] for n in neighbors(tile_id)):
        return {"ok": False, "reason": "Build beside an existing colony module (not diagonally)."}
    return has_action(state, {"materials": BUILDINGS[kind]["cost"]})


def build(original: dict, kind: str, tile_id: int) -> dict:
    check = can_build(original, kind, tile_id)
    if not check["ok"]:
        return fail(original, check["reason"])
    state = deepcopy(original)
    spend(state, {"materials": BUILDINGS[kind]["cost"]})
    state["tiles"][tile_id]["building"] = make_building(kind, state["sol"] + 1)
    state["stats"]["constructed"] += 1
    return done(state, f"{BUILDINGS[kind]['name']} installed in {coordinate(tile_id)}. Online on Sol {state['sol'] + 1}.", "build")


def check_building(state: dict, tile_id: int) -> dict:
    if not valid_id(tile_id) or not state["tiles"][tile_id]["revealed"] or not state["tiles"][tile_id]["building"]:
        return {"ok": False, "reason": "Select an existing colony module."}
    return running(state)


def repair(original: dict, tile_id: int) -> dict:
    check = check_building(original, tile_id)
    if not check["ok"]:
        return fail(original, check["reason"])
    if original["tiles"][tile_id]["building"]["damage"] == 0:
        return fail(original, "This module is in good condition.")
    check = has_action(original, {"materials": 5})
    if not check["ok"]:
        return fail(original, check["reason"])
    state = deepcopy(original)
    spend(state, {"materials": 5})
    state["tiles"][tile_id]["building"]["damage"] = 0
    state["stats"]["repaired"] += 1
    return done(state, f"{BUILDINGS[state['tiles'][tile_id]['building']['type']]['name']} repaired in {coordinate(tile_id)}.", "build")


def upgrade(original: dict, tile_id: int) -> dict:
    check = check_building(original, tile_id)
    if not check["ok"]:
        return fail(original, check["reason"])
    b = original["tiles"][tile_id]["building"]
    if b["type"] == "habitat":
        return fail(original, "The crew habitat is already mission-ready.")
    if b["level"] >= 2:
        return fail(original, "This module is already at its maximum level.")
    if b["onlineFrom"] > original["sol"]:
        return fail(original, "Wait until this module is online before upgrading.")
    if b["damage"] > 0:
        return fail(original, "Repair this module before upgrading it.")
    check = has_action(original, {"materials": 10, "energy": 3})
    if not check["ok"]:
        return fail(original, check["reason"])
    state = deepcopy(original)
    spend(state, {"materials": 10, "energy": 3})
    state["tiles"][tile_id]["building"]["level"] = 2
    state["stats"]["upgraded"] += 1
    benefit = "Energy storage increased from 30 to 60." if b["type"] == "battery" else "Environmental damage protection improved; operating energy +25%." if b["type"] == "shield" else "Output +50%; operating inputs +25%."
    return done(state, f"{BUILDINGS[b['type']]['name']} upgraded to level 2. {benefit}", "research")


def toggle_building(original: dict, tile_id: int) -> dict:
    check = check_building(original, tile_id)
    if not check["ok"]:
        return fail(original, check["reason"])
    if original["tiles"][tile_id]["building"]["type"] == "habitat":
        return fail(original, "The crew habitat cannot be shut down.")
    state = deepcopy(original)
    b = state["tiles"][tile_id]["building"]
    b["active"] = not b["active"]
    cap_resources(state)
    return done(state, f"{BUILDINGS[b['type']]['name']} {'activated' if b['active'] else 'powered down'}.", "info")


def set_crop(original: dict, tile_id: int, crop_id: str) -> dict:
    check = check_building(original, tile_id)
    if not check["ok"]:
        return fail(original, check["reason"])
    b = original["tiles"][tile_id]["building"]
    if b["type"] != "greenhouse":
        return fail(original, "Select a greenhouse to change its crop strategy.")
    if crop_id not in CROPS:
        return fail(original, "Choose a valid crop strategy.")
    if b["crop"] == crop_id:
        return fail(original, "This crop strategy is already selected.")
    check = has_action(original)
    if not check["ok"]:
        return fail(original, check["reason"])
    state = deepcopy(original)
    spend(state)
    state["tiles"][tile_id]["building"]["crop"] = crop_id
    return done(state, f"Greenhouse in {coordinate(tile_id)} switched to {CROPS[crop_id]['name'].lower()}.", "build")


def available_lab(state: dict) -> bool:
    return any(tile["building"] and tile["building"]["type"] == "lab" and online(tile, state) for tile in state["tiles"])


def study(original: dict) -> dict:
    if not available_lab(original):
        return fail(original, "Build and activate a research laboratory first.")
    if original["effects"]["labsPausedUntil"] >= original["sol"]:
        return fail(original, "The crew is sheltering. Research resumes next Sol.")
    check = has_action(original, {"energy": 6})
    if not check["ok"]:
        return fail(original, check["reason"])
    state = deepcopy(original)
    spend(state, {"energy": 6})
    state["science"] += 12
    state["stats"]["studies"] += 1
    cap_resources(state)
    return done(state, "The crew completed an experiment. +12 science.", "research")


def research_tech(original: dict, tech_id: str) -> dict:
    if tech_id not in RESEARCH:
        return fail(original, "Choose a valid research project.")
    if original["tech"].get(tech_id):
        return fail(original, "This technology has already been unlocked.")
    if not available_lab(original):
        return fail(original, "An online research laboratory is required.")
    if original["effects"]["labsPausedUntil"] >= original["sol"]:
        return fail(original, "The crew is sheltering. Research resumes next Sol.")
    tech = RESEARCH[tech_id]
    if original["science"] < tech["requiredScience"]:
        return fail(original, f"Requires {tech['requiredScience']} accumulated science. Science is not spent.")
    check = has_action(original, {"materials": tech["cost"], "energy": tech["energy"]})
    if not check["ok"]:
        return fail(original, check["reason"])
    state = deepcopy(original)
    spend(state, {"materials": tech["cost"], "energy": tech["energy"]})
    state["tech"][tech_id] = True
    return done(state, f"{tech['name']} unlocked. {tech['description']}", "research")


def potential_tile_output(state: dict, tile_id: int) -> dict:
    tile = state["tiles"][tile_id]
    production, consumption = empty_flow(), empty_flow()
    if not tile["building"]:
        return {"production": production, "consumption": consumption, "delta": empty_flow(), "online": False, "terrainBonus": ""}
    b = tile["building"]
    running_now = online(tile, state)
    terrain_bonus = ""
    if running_now:
        data = CROPS[b.get("crop", "greens")] if b["type"] == "greenhouse" else BUILDINGS[b["type"]]
        output_factor = (1.5 if b["level"] == 2 else 1) * (.5 if b["damage"] > 0 else 1)
        input_factor = 1.25 if b["level"] == 2 else 1
        for key, value in data["production"].items():
            production[key] = value * output_factor
        for key, value in data["consumption"].items():
            consumption[key] = value * input_factor
        if b["type"] == "solar":
            if tile["terrain"] == "ridge":
                production["energy"] *= 1.25
                terrain_bonus = "Sunlit ridge: solar output +25%"
            production["energy"] *= state["weather"]["solarMultiplier"] * (1.25 if state["tech"].get("solar") else 1)
        if b["type"] == "lab":
            if tile["terrain"] == "science" or any(state["tiles"][n]["revealed"] and state["tiles"][n]["terrain"] == "science" for n in neighbors(tile_id)):
                production["science"] += 3 * output_factor
                terrain_bonus = "Geological site: +3 science per Sol"
            if state["effects"]["labsPausedUntil"] >= state["sol"]:
                production["science"] = 0
                consumption["energy"] = 0
        if b["type"] == "habitat" and state["tech"].get("recycling"):
            production["water"] += 2
    for key in FLOW_KEYS:
        production[key] = round1(production[key])
        consumption[key] = round1(consumption[key])
    delta = {key: round1(production[key] - consumption[key]) for key in FLOW_KEYS}
    return {"production": production, "consumption": consumption, "delta": delta, "online": running_now, "terrainBonus": terrain_bonus}


def operation_plan(state: dict) -> list[dict]:
    outputs = [{**potential_tile_output(state, tile["id"]), "starved": False, "reason": ""} for tile in state["tiles"]]
    available = {**state["resources"], "science": state["science"]}

    def commit(output: dict) -> None:
        for key in FLOW_KEYS:
            available[key] = round1(available[key] + output["production"][key] - output["consumption"][key])

    def recalculate(output: dict) -> None:
        output["delta"] = {key: round1(output["production"][key] - output["consumption"][key]) for key in FLOW_KEYS}

    for tile in state["tiles"]:
        if tile["building"] and tile["building"]["type"] == "solar":
            commit(outputs[tile["id"]])
    for tile in state["tiles"]:
        if not tile["building"] or tile["building"]["type"] != "habitat":
            continue
        output = outputs[tile["id"]]
        if available["energy"] < output["consumption"]["energy"]:
            output["production"] = empty_flow()
            output["starved"] = True
            output["reason"] = "Insufficient energy for habitat water recovery; crew consumption still applies."
            output["online"] = False
            recalculate(output)
        commit(output)
    for kind in ("water", "oxygen", "greenhouse", "lab", "shield", "battery"):
        for tile in state["tiles"]:
            if not tile["building"] or tile["building"]["type"] != kind:
                continue
            output = outputs[tile["id"]]
            if not output["online"]:
                continue
            missing = [(key, amount) for key, amount in output["consumption"].items() if amount > 0 and available[key] < amount]
            if missing:
                output["starved"] = True
                output["reason"] = "Insufficient " + " and ".join(f"{key} (needs {amount:g}, available {max(0, round1(available[key])):g})" for key, amount in missing) + "."
                output["production"] = empty_flow()
                output["consumption"] = empty_flow()
                output["delta"] = empty_flow()
                output["online"] = False
            else:
                commit(output)
    return outputs


def get_tile_output(state: dict, tile_id: int) -> dict:
    return operation_plan(state)[tile_id] if valid_id(tile_id) else {"production": empty_flow(), "consumption": empty_flow(), "delta": empty_flow(), "online": False, "terrainBonus": "", "starved": False, "reason": ""}


def forecast(state: dict) -> dict:
    production, consumption, warnings = empty_flow(), empty_flow(), []
    outputs = operation_plan(state)
    for tile in state["tiles"]:
        output = outputs[tile["id"]]
        for key in FLOW_KEYS:
            production[key] += output["production"][key]
            consumption[key] += output["consumption"][key]
        if output["starved"]:
            warnings.append(f"{BUILDINGS[tile['building']['type']]['name']} in {coordinate(tile['id'])} is idle. {output['reason']}")
    delta = empty_flow()
    for key in FLOW_KEYS:
        production[key] = round1(production[key])
        consumption[key] = round1(consumption[key])
        delta[key] = round1(production[key] - consumption[key])
        if key != "science" and state["resources"][key] + delta[key] < 0:
            warnings.append(f"{key.capitalize()} will run out this Sol.")
    if state["resources"]["energy"] + delta["energy"] > capacity(state)["energy"]:
        warnings.append("Surplus energy exceeds storage capacity. A battery can save it.")
    if state["event"]:
        warnings.append("Resolve the mission event before ending this Sol.")
    return {"delta": delta, "production": production, "consumption": consumption, "warnings": warnings}


def event_choice_status(state: dict, choice_id: str) -> dict:
    check = running(state)
    if not check["ok"]:
        return check
    event = state["event"]
    if not event or event["id"] not in EVENT_DEFINITIONS:
        return {"ok": False, "reason": "There is no pending mission event."}
    choice = next((item for item in EVENT_DEFINITIONS[event["id"]]["choices"] if item["id"] == choice_id), None)
    if not choice:
        return {"ok": False, "reason": "Choose an available event response."}
    return has_action(state, choice["cost"], 0)


def environmental_damage(state: dict, damage: int) -> int:
    factor = .6 if "shielding" in state["loadout"] else 1
    if state["tech"].get("shielding"):
        factor *= .7
    outputs = operation_plan(state)
    shelters = [tile for tile in state["tiles"] if tile["building"] and tile["building"]["type"] == "shield" and outputs[tile["id"]]["online"]]
    if shelters:
        factor *= .4 if any(tile["building"]["level"] == 2 for tile in shelters) else .6
    actual = math.floor(damage * factor + .5)
    state["health"] -= actual
    return actual


def choose_event(original: dict, choice_id: str) -> dict:
    check = event_choice_status(original, choice_id)
    if not check["ok"]:
        return fail(original, check["reason"])
    state = deepcopy(original)
    event_id = state["event"]["id"]
    choice = next(item for item in EVENT_DEFINITIONS[event_id]["choices"] if item["id"] == choice_id)
    spend(state, choice["cost"], 0)
    effect = ""
    if event_id == "dust":
        multiplier = .8 if choice_id == "protect" else .5
        state["weather"] = {"name": "Dust front", "description": f"Solar arrays generate {multiplier * 100:g}% of normal output through Sol {state['sol'] + 1}.", "solarMultiplier": multiplier, "untilSol": state["sol"] + 1}
        effect = f"Solar output {multiplier * 100:g}% through Sol {state['sol'] + 1}."
        if choice_id == "weather":
            array = next((tile for tile in state["tiles"] if tile["building"] and tile["building"]["type"] == "solar" and online(tile, state)), None)
            if array:
                array["building"]["damage"] = min(2, array["building"]["damage"] + 1)
                effect += f" The array in {coordinate(array['id'])} is damaged; repair it to restore full output."
    elif event_id == "seal":
        if choice_id == "patch":
            state["resources"]["oxygen"] -= 10
            damage = environmental_damage(state, 8)
            effect = f"Lost 10 oxygen and {damage} crew health."
        else:
            effect = "The habitat is sealed with no supply loss." if choice_id == "repair" else "Spent 6 energy and 6 oxygen to isolate the section."
    elif event_id == "samples":
        points = 12 if choice_id == "detailed" else 4
        state["science"] += points
        effect = f"Collected {points} science."
    elif event_id == "radiation":
        if choice_id == "shelter":
            state["effects"]["labsPausedUntil"] = state["sol"]
            effect = "Crew protected. Laboratory science pauses this Sol."
        else:
            state["science"] += 8
            damage = environmental_damage(state, 18)
            effect = f"Collected 8 science. Crew health −{damage}."
    state["event"] = None
    state["stats"]["eventsResolved"] += 1
    cap_resources(state)
    if state["health"] <= 0:
        state["status"] = "failed"
        state["ap"] = 0
    return done(state, f"{choice['label']}. {effect}", "event")


def advance_sol(original: dict) -> dict:
    check = running(original)
    if not check["ok"]:
        return fail(original, check["reason"])
    if original["event"]:
        return fail(original, "Resolve the pending mission event before ending the Sol.")
    state = deepcopy(original)
    report, shortage = forecast(state), []
    for key in RESOURCE_KEYS:
        raw = state["resources"][key] + report["delta"][key]
        if raw < 0 and key in ("energy", "oxygen", "water", "food"):
            shortage.append(key)
        state["resources"][key] = raw
    state["science"] += report["delta"]["science"]
    penalties = {"energy": 10, "oxygen": 22, "water": 18, "food": 12}
    damage = sum(penalties[key] for key in shortage)
    if damage:
        state["health"] -= damage
        add_log(state, f"Supply shortage: {', '.join(shortage)}. Crew health −{damage}.", "danger")
    elif state["health"] < 100:
        state["health"] += 2
    cap_resources(state)
    state["history"].append(snapshot(state))
    add_log(state, f"Sol {state['sol']} complete. Science {state['science']:g}/{state['goal']}; crew health {state['health']:g}%.", "warning" if damage else "info")
    if state["health"] <= 0:
        state["status"] = "failed"
        state["ap"] = 0
        return done(state, "Critical life-support failure. The mission has ended.", "danger")
    if state["sol"] >= state["maxSols"]:
        state["status"] = "success" if state["science"] >= state["goal"] else "partial"
        state["ap"] = 0
        return done(state, "Mission complete. The crew survived and achieved the science objective." if state["status"] == "success" else "Crew recovered safely. The science objective remains incomplete.", "success" if state["status"] == "success" else "warning")
    state["sol"] += 1
    state["ap"] = 2
    if state["weather"]["untilSol"] is not None and state["sol"] > state["weather"]["untilSol"]:
        state["weather"] = clear_weather()
    event_id = EVENTS_BY_SOL.get(state["sol"])
    if event_id:
        state["event"] = deepcopy(EVENT_DEFINITIONS[event_id])
        add_log(state, f"Mission event: {state['event']['title']}.", "event")
    return {"ok": True, "state": state, "message": f"Sol {state['sol']}. Two actions available."}


def summarize(state: dict) -> dict:
    discovered = sum(tile["revealed"] for tile in state["tiles"])
    buildings = sum(bool(tile["building"]) for tile in state["tiles"])
    sols_completed = max(0, len(state["history"]) - 1)
    science_score = min(400, math.floor(state["science"] / state["goal"] * 400 + .5))
    health_score = math.floor(state["health"] * 3 + .5)
    exploration_score = math.floor((discovered - 9) / 27 * 150 + .5)
    infrastructure_score = min(150, (buildings - 3) * 25)
    score = max(0, science_score + health_score + exploration_score + infrastructure_score)
    titles = {"success": "A foothold on Mars", "partial": "The crew comes home", "failed": "Signal lost", "playing": "Mission in progress"}
    return {"score": score, "title": titles[state["status"]], "grade": "S" if score >= 850 else "A" if score >= 700 else "B" if score >= 550 else "C" if score >= 400 else "D", "science": state["science"], "goal": state["goal"], "health": state["health"], "discovered": discovered, "buildings": buildings, "solsCompleted": sols_completed, "totalTiles": 36, "objectiveProgress": min(1, state["science"] / state["goal"]), "stats": dict(state["stats"])}


def _number(value: object, low: float = 0, high: float = 1000) -> bool:
    return type(value) in (int, float) and math.isfinite(value) and low <= value <= high


def validate_save(data: object) -> dict:
    """Validate browser-provided JSON before any Python-side game action."""
    try:
        value = json.loads(data) if isinstance(data, str) else data
        if not isinstance(value, dict) or value.get("version") != 1:
            raise ValueError("This save uses an unsupported version.")
        if not isinstance(value.get("seed"), str) or len(value["seed"]) > 64:
            raise ValueError("The save has an invalid mission seed.")
        if type(value.get("sol")) is not int or not 1 <= value["sol"] <= 10 or value.get("maxSols") != 10:
            raise ValueError("The save has an invalid Sol.")
        if type(value.get("ap")) is not int or not 0 <= value["ap"] <= 2:
            raise ValueError("The save has invalid action points.")
        if value.get("status") not in ("playing", "success", "partial", "failed"):
            raise ValueError("The save has an invalid mission status.")
        if not _number(value.get("health"), 0, 100) or not _number(value.get("science")) or value.get("goal") != 70:
            raise ValueError("The save has invalid crew or science values.")
        if not validate_loadout(value.get("loadout"))["ok"]:
            raise ValueError("The save has an invalid cargo configuration.")
        if not isinstance(value.get("resources"), dict) or any(not _number(value["resources"].get(key)) for key in RESOURCE_KEYS):
            raise ValueError("The save contains invalid resource values.")
        if not isinstance(value.get("tiles"), list) or len(value["tiles"]) != 36:
            raise ValueError("The save has an invalid map.")
        for tile_id, tile in enumerate(value["tiles"]):
            if not isinstance(tile, dict) or tile.get("id") != tile_id or tile.get("x") != tile_id % 6 or tile.get("y") != tile_id // 6 or tile.get("terrain") not in TERRAINS or type(tile.get("revealed")) is not bool or type(tile.get("collected")) is not bool:
                raise ValueError("The save contains a malformed tile.")
            b = tile.get("building")
            if b is not None and (not isinstance(b, dict) or b.get("type") not in BUILDINGS or b.get("level") not in (1, 2) or type(b.get("onlineFrom")) is not int or not 1 <= b["onlineFrom"] <= 11 or type(b.get("active")) is not bool or b.get("damage") not in (0, 1, 2) or (b["type"] == "greenhouse" and b.get("crop") not in CROPS)):
                raise ValueError("The save contains a malformed building.")
        if sum(tile["building"] is not None and tile["building"]["type"] == "habitat" for tile in value["tiles"]) != 1:
            raise ValueError("The save must contain one crew habitat.")
        weather = value.get("weather")
        if not isinstance(weather, dict) or not isinstance(weather.get("name"), str) or not isinstance(weather.get("description"), str) or not _number(weather.get("solarMultiplier"), 0, 1) or (weather.get("untilSol") is not None and (type(weather["untilSol"]) is not int or not 1 <= weather["untilSol"] <= 11)):
            raise ValueError("The save has invalid weather.")
        if value.get("event") is not None and (not isinstance(value["event"], dict) or value["event"].get("id") not in EVENT_DEFINITIONS):
            raise ValueError("The save has an invalid event.")
        if not isinstance(value.get("tech"), dict) or any(key not in RESEARCH or type(enabled) is not bool for key, enabled in value["tech"].items()):
            raise ValueError("The save has invalid technology.")
        if not isinstance(value.get("log"), list) or not isinstance(value.get("history"), list) or len(value["log"]) > 120 or len(value["history"]) > 11:
            raise ValueError("The save has an invalid mission history.")
        state = deepcopy(value)
        effects = state.get("effects")
        paused = effects.get("labsPausedUntil", 0) if isinstance(effects, dict) else 0
        state["effects"] = {"labsPausedUntil": clamp(paused, 0, 10) if type(paused) is int else 0}
        stats = state.get("stats")
        if not isinstance(stats, dict):
            stats = {}
        stat_keys = ("explored", "constructed", "repaired", "upgraded", "studies", "eventsResolved")
        state["stats"] = {key: int(clamp(stats[key], 0, 1000)) if type(stats.get(key)) is int else 0 for key in stat_keys}
        state["log"] = [{"sol": e["sol"], "text": e["text"][:500], "type": e["type"]} for e in state["log"] if isinstance(e, dict) and type(e.get("sol")) is int and isinstance(e.get("text"), str) and isinstance(e.get("type"), str)]
        state["history"] = [e for e in state["history"] if isinstance(e, dict) and type(e.get("sol")) is int and _number(e.get("health")) and _number(e.get("science")) and isinstance(e.get("resources"), dict) and all(_number(e["resources"].get(key)) for key in RESOURCE_KEYS)]
        if state["event"]:
            state["event"] = deepcopy(EVENT_DEFINITIONS[state["event"]["id"]])
        cap_resources(state)
        return {"ok": True, "state": state, "error": None}
    except (ValueError, TypeError, KeyError, IndexError, OverflowError) as exc:
        return {"ok": False, "state": None, "error": str(exc) or "This save could not be loaded."}


ACTIONS = {
    "explore": explore,
    "build": build,
    "repair": repair,
    "upgrade": upgrade,
    "toggleBuilding": toggle_building,
    "setCrop": set_crop,
    "study": study,
    "researchTech": research_tech,
    "chooseEvent": choose_event,
    "advanceSol": advance_sol,
}


def execute_action(action: str, state: dict, args: list) -> dict:
    """Only named, public game actions may run from HTTP requests."""
    if action not in ACTIONS or not isinstance(args, list):
        return fail(state, "Unknown game action.")
    expected = {"explore": 1, "build": 2, "repair": 1, "upgrade": 1, "toggleBuilding": 1, "setCrop": 2, "study": 0, "researchTech": 1, "chooseEvent": 1, "advanceSol": 0}
    if len(args) != expected[action]:
        return fail(state, "Invalid action arguments.")
    if action in ("explore", "build", "repair", "upgrade", "toggleBuilding", "setCrop"):
        index = 1 if action == "build" else 0
        if not valid_id(args[index]):
            return fail(state, "Choose a valid map tile.")
    if action in ("build", "researchTech", "chooseEvent") and not isinstance(args[0], str):
        return fail(state, "Choose a valid action.")
    if action == "setCrop" and not isinstance(args[1], str):
        return fail(state, "Choose a valid crop strategy.")
    return ACTIONS[action](state, *args)
