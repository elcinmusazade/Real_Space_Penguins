"""Python-authoritative interplanetary campaign (version 2).

The campaign is a separate, AP-free strategy mode. There is no server-side
session: actions accept JSON state, validate their preconditions and return a
deep-copied state. Numbers are playable approximations pending GMAT inputs.
"""

from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
from math import ceil
from typing import Any

from .campaign_data import (
    BUILDINGS, ENGINES, HULLS, MAX_RESOURCE, PAYLOADS, RESEARCH,
    RESOURCE_KEYS, ROUTES, TRAJECTORIES, WORLDS,
)


def _roll(*parts: Any) -> float:
    raw = "|".join(str(p) for p in parts).encode("utf-8")
    return int.from_bytes(sha256(raw).digest()[:8], "big") / 2**64


def _stocks(**overrides: int) -> dict:
    base = {resource: 0 for resource in RESOURCE_KEYS}
    base.update(overrides)
    return base


def _building(kind: str, online_from: int = 1) -> dict:
    return {"type": kind, "level": 1, "onlineFrom": online_from, "active": True}


def _tiles(world: str) -> list[dict]:
    result = [{"id": index, "revealed": False, "terrain": None, "building": None} for index in range(25)]
    for index in (11, 12):
        result[index]["revealed"] = True
        result[index]["terrain"] = "plain"
    result[12]["building"] = _building("command" if world != "mars" else "habitat")
    result[11]["building"] = _building("solar")
    return result


def _crew() -> list[dict]:
    return [
        {"name": "Elena Kim", "specialty": "Engineering", "assigned": "engineering"},
        {"name": "Jonah Lee", "specialty": "Biology", "assigned": "survival"},
        {"name": "Amira Malik", "specialty": "Research", "assigned": "science"},
    ]


def _hub(identifier: str, world: str, kind: str, site: str, *, payload: list[str] | None = None, starter: bool = False) -> dict:
    payload = payload or []
    is_earth = world == "earth"
    is_orbit = kind == "orbital"
    staffed = world == "mars" and kind == "surface" and (starter or "habitat" in payload)
    inv = (
        _stocks(energy=130, materials=260, fuel=260, water=110, food=110, oxygen=110, heat=90)
        if is_earth else
        _stocks(energy=55, materials=85, fuel=28, water=48, food=51, oxygen=52, heat=42)
        if starter else
        _stocks(energy=28, materials=24, fuel=15, water=18, food=24, oxygen=24, heat=19)
    )
    if is_orbit:
        inv = _stocks(energy=35, materials=22, fuel=22, water=12, food=12, oxygen=12, heat=12)
    if "cargo" in payload:
        inv["materials"] += 30
        inv["fuel"] += 14
        inv["food"] += 12
    tiles = [] if is_earth or is_orbit else _tiles(world)
    if tiles and "lab" in payload:
        tiles[7]["revealed"] = True
        tiles[7]["terrain"] = "science"
        tiles[7]["building"] = _building("laboratory")
    if tiles and "shield" in payload:
        tiles[13]["revealed"] = True
        tiles[13]["terrain"] = "plain"
        tiles[13]["building"] = _building("shield")
    return {
        "id": identifier, "name": "Earth Mission Control" if is_earth else f"{WORLDS[world]['name']} {'Orbital Hub' if is_orbit else site}",
        "world": world, "kind": kind, "site": site,
        "stocks": inv, "tiles": tiles, "rovers": (1 if starter else int("rover" in payload)),
        "roverBusyUntil": 0, "crew": _crew() if staffed else [],
        "health": 100, "discovered": 0, "construction": 0,
    }


def create_campaign(seed: str = "HORIZON-01") -> dict:
    if not isinstance(seed, str):
        raise ValueError("Mission seed must be text.")
    seed = seed.strip()[:60] or "HORIZON-01"
    state = {
        "version": 2, "mode": "campaign", "seed": seed, "turn": 1,
        "credits": 390, "science": 32, "scienceTotal": 32,
        "hubs": [_hub("H1", "earth", "control", "Earth HQ"), _hub("H2", "mars", "surface", "Arcadia Planitia", starter=True)],
        "missions": [], "shipments": [], "expeditions": [], "routes": [],
        "tech": [], "research": None, "event": None,
        "visitedWorlds": ["mars"], "milestone": False,
        "nextId": 3, "log": [],
    }
    _log(state, "Earth Mission Control online. Mars outpost Arcadia is established.")
    _log(state, "Design spacecraft, dispatch missions, and link hubs with scheduled cargo shipments.")
    return state


def validate(state: Any) -> dict:
    """Reject malformed client-owned saves before simulating any command."""
    if not isinstance(state, dict) or state.get("version") != 2 or state.get("mode") != "campaign":
        return {"ok": False, "error": "Not a valid campaign save."}
    if not isinstance(state.get("seed"), str) or not 1 <= len(state["seed"]) <= 60:
        return {"ok": False, "error": "Invalid campaign seed."}
    if not isinstance(state.get("hubs"), list) or not state["hubs"] or len(state["hubs"]) > 70:
        return {"ok": False, "error": "Invalid hub list."}
    for key in ("missions", "shipments", "expeditions", "routes", "tech", "visitedWorlds", "log"):
        if not isinstance(state.get(key), list):
            return {"ok": False, "error": f"Invalid {key} list."}
    for key in ("turn", "nextId", "credits", "science", "scienceTotal"):
        if type(state.get(key)) is not int or not 0 <= state[key] <= 1_000_000_000:
            return {"ok": False, "error": f"Invalid {key}."}
    if type(state.get("milestone")) is not bool:
        return {"ok": False, "error": "Invalid campaign milestone."}
    if any(type(w) is not str or w not in WORLDS for w in state["visitedWorlds"]):
        return {"ok": False, "error": "Invalid visited worlds."}
    if any(type(t) is not str or t not in RESEARCH for t in state["tech"]):
        return {"ok": False, "error": "Invalid research records."}
    if any(type(r) is not str for r in state["routes"]):
        return {"ok": False, "error": "Invalid route records."}
    if len(state["missions"]) > 1000 or len(state["shipments"]) > 1000 or len(state["expeditions"]) > 1000 or len(state["log"]) > 90:
        return {"ok": False, "error": "Campaign history exceeds allowed size."}
    hub_ids = set()
    for hub in state["hubs"]:
        if not isinstance(hub, dict) or hub.get("world") not in WORLDS or hub.get("kind") not in ("control", "orbital", "surface"):
            return {"ok": False, "error": "Invalid hub metadata."}
        if any(not isinstance(hub.get(key), str) for key in ("id", "name", "site")) or hub["id"] in hub_ids:
            return {"ok": False, "error": "Invalid hub identity."}
        hub_ids.add(hub["id"])
        if not isinstance(hub.get("stocks"), dict) or any(type(hub["stocks"].get(k)) is not int or not 0 <= hub["stocks"][k] <= MAX_RESOURCE for k in RESOURCE_KEYS):
            return {"ok": False, "error": "Invalid hub resources."}
        if any(type(hub.get(key)) is not int or not 0 <= hub[key] <= 1_000_000 for key in ("rovers", "roverBusyUntil", "discovered", "construction")):
            return {"ok": False, "error": "Invalid hub operations."}
        if type(hub.get("health")) is not int or not 0 <= hub["health"] <= 100:
            return {"ok": False, "error": "Invalid crew health."}
        if not isinstance(hub.get("crew"), list) or len(hub["crew"]) > 12 or any(not isinstance(c, dict) or not isinstance(c.get("name"), str) or not isinstance(c.get("specialty"), str) or c.get("assigned") not in ("engineering", "science", "survival") for c in hub["crew"]):
            return {"ok": False, "error": "Invalid crew roster."}
        tiles = hub.get("tiles")
        if not isinstance(tiles, list) or len(tiles) != (25 if hub["kind"] == "surface" else 0):
            return {"ok": False, "error": "Invalid hub terrain."}
        for idx, tile in enumerate(tiles):
            if not isinstance(tile, dict) or type(tile.get("id")) is not int or tile["id"] != idx or type(tile.get("revealed")) is not bool:
                return {"ok": False, "error": "Invalid terrain sector."}
            if tile.get("terrain") not in (None, "plain", "ice", "ridge", "science", "salvage", "hazard"):
                return {"ok": False, "error": "Invalid terrain feature."}
            building = tile.get("building")
            if building is not None and (not isinstance(building, dict) or building.get("type") not in (*BUILDINGS, "command", "habitat") or type(building.get("onlineFrom")) is not int or type(building.get("active")) is not bool):
                return {"ok": False, "error": "Invalid constructed module."}
    for mission in state["missions"]:
        if not isinstance(mission, dict) or mission.get("destination") not in WORLDS or mission.get("status") not in ("in_flight", "complete") or type(mission.get("arrivesAt")) is not int or mission.get("objective") not in ("surface", "orbital", "survey") or not isinstance(mission.get("design"), dict) or not isinstance(mission["design"].get("payload"), list):
            return {"ok": False, "error": "Invalid mission history."}
    for shipment in state["shipments"]:
        if not isinstance(shipment, dict) or shipment.get("status") not in ("in_flight", "delivered") or type(shipment.get("arrivesAt")) is not int or type(shipment.get("amount")) is not int or shipment.get("resource") not in RESOURCE_KEYS or shipment.get("target") not in hub_ids or not isinstance(shipment.get("route"), str):
            return {"ok": False, "error": "Invalid cargo history."}
    for expedition in state["expeditions"]:
        if not isinstance(expedition, dict) or expedition.get("status") not in ("en_route", "returned") or type(expedition.get("arrivesAt")) is not int or type(expedition.get("tile")) is not int or not 0 <= expedition["tile"] < 25 or expedition.get("hub") not in hub_ids:
            return {"ok": False, "error": "Invalid rover history."}
    research = state.get("research")
    if research is not None and (not isinstance(research, dict) or research.get("id") not in RESEARCH or type(research.get("completesAt")) is not int):
        return {"ok": False, "error": "Invalid active research."}
    event = state.get("event")
    if event is not None and (not isinstance(event, dict) or event.get("hub") not in hub_ids or not isinstance(event.get("title"), str) or not isinstance(event.get("description"), str) or not isinstance(event.get("choices"), list)):
        return {"ok": False, "error": "Invalid event state."}
    if any(not isinstance(item, dict) or type(item.get("turn")) is not int or not isinstance(item.get("message"), str) for item in state["log"]):
        return {"ok": False, "error": "Invalid mission log."}
    return {"ok": True, "state": state}


def _hub_by_id(state: dict, identifier: str) -> dict | None:
    return next((h for h in state["hubs"] if h["id"] == identifier), None)


def _log(state: dict, message: str, tag: str = "info") -> None:
    state["log"].append({"turn": state["turn"], "message": message, "tag": tag})
    state["log"] = state["log"][-90:]


def _next_id(state: dict, prefix: str) -> str:
    identifier = f"{prefix}{state['nextId']}"
    state["nextId"] += 1
    return identifier


def _success(state: dict, message: str) -> dict:
    _log(state, message, "success")
    return {"ok": True, "state": state, "message": message}


def _fail(state: dict, message: str) -> dict:
    return {"ok": False, "state": state, "message": message}


def _travel(source: str, destination: str) -> int:
    if source == destination:
        return 1
    return ROUTES.get((source, destination), ROUTES.get((destination, source), 5))


def _has_orbital(state: dict, world: str) -> bool:
    return any(h["world"] == world and h["kind"] == "orbital" for h in state["hubs"])


def mission_quote(state: dict, design: Any) -> dict:
    """Validate a modular spacecraft and return illustrative mission tradeoffs."""
    if not isinstance(design, dict):
        return {"ok": False, "error": "Choose a spacecraft design."}
    source = _hub_by_id(state, design.get("source"))
    world = design.get("destination")
    kind = design.get("objective")
    if any(not isinstance(design.get(key), str) for key in ("source", "destination", "objective", "hull", "engine", "trajectory", "site")):
        return {"ok": False, "error": "Mission design fields must be text."}
    hull = HULLS.get(design.get("hull"))
    engine = ENGINES.get(design.get("engine"))
    traj = TRAJECTORIES.get(design.get("trajectory"))
    payload = design.get("payload", [])
    site = design.get("site", "")
    if not source or world not in WORLDS or world == "earth" or kind not in ("surface", "orbital", "survey"):
        return {"ok": False, "error": "Choose a valid origin, destination, and mission objective."}
    if not hull or not engine or not traj:
        return {"ok": False, "error": "Choose a valid hull, engine, and trajectory."}
    if not isinstance(payload, list) or any(not isinstance(p, str) for p in payload) or len(payload) != len(set(payload)) or any(p not in PAYLOADS for p in payload):
        return {"ok": False, "error": "Choose each valid payload module at most once."}
    mass = engine["mass"] + sum(PAYLOADS[p]["mass"] for p in payload)
    if mass > hull["capacity"]:
        return {"ok": False, "error": f"Payload exceeds hull capacity ({mass}/{hull['capacity']} tonnes).", "mass": mass}
    if kind == "surface":
        if site not in WORLDS[world]["sites"]:
            return {"ok": False, "error": "Select a valid landing site."}
        if design.get("hull") == "scout":
            return {"ok": False, "error": "Surface outposts require a lander or freighter hull."}
        if "rover" not in payload and "habitat" not in payload:
            return {"ok": False, "error": "A new outpost needs a rover or habitat payload."}
        if world in ("venus", "mercury", "europa") and "shield" not in payload:
            return {"ok": False, "error": "Harsh-world robotic outposts need an environmental shield."}
        if any(h["world"] == world and h["kind"] == "surface" and h["site"] == site for h in state["hubs"]):
            return {"ok": False, "error": "That site already has an outpost. Select another site."}
        if any(m["destination"] == world and m["objective"] == "surface" and m["site"] == site and m["status"] == "in_flight" for m in state["missions"]):
            return {"ok": False, "error": "Another mission is already deploying to that site."}
    if kind == "orbital":
        if "relay" not in payload:
            return {"ok": False, "error": "Orbital hubs require a communications relay payload."}
        if _has_orbital(state, world):
            return {"ok": False, "error": "This world already has an orbital hub."}
        if any(m["destination"] == world and m["objective"] == "orbital" and m["status"] == "in_flight" for m in state["missions"]):
            return {"ok": False, "error": "An orbital hub is already being deployed there."}
        site = "Orbital Station"
    if kind == "survey":
        if "lab" not in payload and "rover" not in payload:
            return {"ok": False, "error": "Science missions need instruments or a rover."}
        site = "Remote Survey"
    base = _travel(source["world"], world)
    orbital_bonus = 0.82 if _has_orbital(state, source["world"]) or _has_orbital(state, world) else 1
    fuel = max(2, ceil((base * 8 + 3) * hull["fuelFactor"] * engine["fuelFactor"] * traj["fuelFactor"] * orbital_bonus * (0.85 if "propulsion" in state["tech"] else 1)))
    days = max(1, base + engine["timeDelta"] + traj["timeDelta"] - (1 if orbital_bonus < 1 else 0))
    materials = hull["materials"] + engine["materials"] + sum(PAYLOADS[p]["materials"] for p in payload)
    credits = hull["credits"] + base * 9 + (12 if kind == "surface" else 5)
    risk = max(0.02, min(0.38, WORLDS[world]["baseRisk"] + traj["riskDelta"] - (0.05 if "shield" in payload else 0) - (0.06 if "thermal" in state["tech"] else 0)))
    return {
        "ok": True, "source": source["id"], "destination": world,
        "objective": kind, "site": site, "mass": mass, "capacity": hull["capacity"],
        "materials": materials, "credits": credits, "fuel": fuel,
        "turns": days, "riskPercent": round(risk * 100),
        "affordable": source["stocks"]["materials"] >= materials and source["stocks"]["fuel"] >= fuel and state["credits"] >= credits,
        "notice": "Illustrative flight planning, not a GMAT-calculated trajectory.",
    }


def _launch(state: dict, design: Any) -> dict:
    quote = mission_quote(state, design)
    if not quote["ok"]:
        return _fail(state, quote["error"])
    if not quote["affordable"]:
        return _fail(state, "Insufficient materials, fuel, or mission credits at the selected departure hub.")
    source = _hub_by_id(state, quote["source"])
    source["stocks"]["materials"] -= quote["materials"]
    source["stocks"]["fuel"] -= quote["fuel"]
    state["credits"] -= quote["credits"]
    mission_id = _next_id(state, "M")
    state["missions"].append({
        "id": mission_id, "source": source["id"], "destination": quote["destination"],
        "objective": quote["objective"], "site": quote["site"],
        "design": deepcopy(design), "departed": state["turn"],
        "arrivesAt": state["turn"] + quote["turns"], "status": "in_flight",
        "riskPercent": quote["riskPercent"], "result": None,
    })
    return _success(state, f"{mission_id} launched toward {WORLDS[quote['destination']]['name']}. ETA: {quote['turns']} turns. Fuel {quote['fuel']}; credits {quote['credits']}.")


def _shipment(state: dict, args: Any) -> dict:
    if not isinstance(args, dict):
        return _fail(state, "Choose a cargo shipment.")
    source, target = _hub_by_id(state, args.get("source")), _hub_by_id(state, args.get("target"))
    resource, amount = args.get("resource"), args.get("amount")
    if not source or not target or source["id"] == target["id"]:
        return _fail(state, "Choose two different established hubs.")
    if resource not in RESOURCE_KEYS or type(amount) is not int or not 1 <= amount <= 80:
        return _fail(state, "Choose a resource and cargo amount between 1 and 80.")
    route_key = ":".join(sorted((source["id"], target["id"])))
    existing = route_key in state["routes"]
    interplanetary = source["world"] != target["world"]
    base = _travel(source["world"], target["world"])
    turns = max(1, base - (1 if existing and interplanetary else 0))
    fuel_cost = max(1, ceil((2 + base * (2 if interplanetary else 1)) * (0.75 if existing else 1) * (0.8 if "logistics" in state["tech"] else 1)))
    if source["kind"] == "orbital" or target["kind"] == "orbital":
        fuel_cost = max(1, fuel_cost - 1)
    if source["stocks"][resource] < amount + (fuel_cost if resource == "fuel" else 0) or source["stocks"]["fuel"] < fuel_cost:
        return _fail(state, "The departure hub lacks that cargo or the fuel needed to ship it.")
    if state["credits"] < 3:
        return _fail(state, "Cargo dispatch requires 3 mission credits.")
    source["stocks"][resource] -= amount
    source["stocks"]["fuel"] -= fuel_cost
    state["credits"] -= 3
    shipment_id = _next_id(state, "C")
    state["shipments"].append({
        "id": shipment_id, "source": source["id"], "target": target["id"],
        "resource": resource, "amount": amount, "departed": state["turn"],
        "arrivesAt": state["turn"] + turns, "status": "in_flight",
        "vehicle": "cargo spacecraft" if interplanetary or source["kind"] == "orbital" or target["kind"] == "orbital" else "surface convoy",
        "route": route_key,
    })
    return _success(state, f"{shipment_id} dispatched: {amount} {resource} via {state['shipments'][-1]['vehicle']}, arriving in {turns} turns.")


def _terrain(seed: str, hub: dict, tile_id: int) -> str:
    specials = {6: "ice", 8: "science", 16: "science", 18: "salvage", 22: "ridge"}
    if tile_id in specials:
        return specials[tile_id]
    roll = _roll(seed, hub["world"], hub["site"], tile_id)
    if hub["world"] == "europa":
        return "ice" if roll < 0.52 else "science" if roll < 0.67 else "hazard" if roll < 0.83 else "plain"
    if hub["world"] == "mercury":
        return "ridge" if roll < 0.45 else "science" if roll < 0.58 else "hazard" if roll < 0.75 else "plain"
    if hub["world"] == "venus":
        return "hazard" if roll < 0.30 else "science" if roll < 0.48 else "ridge" if roll < 0.65 else "plain"
    return "plain" if roll < 0.37 else "ridge" if roll < 0.53 else "ice" if roll < 0.7 else "science" if roll < 0.86 else "salvage"


def _reveal(state: dict, hub: dict, tile_id: int) -> str:
    tile = hub["tiles"][tile_id]
    if tile["revealed"]:
        return "Already surveyed"
    tile["revealed"] = True
    tile["terrain"] = _terrain(state["seed"], hub, tile_id)
    hub["discovered"] += 1
    terrain = tile["terrain"]
    reward = 3
    if terrain == "science":
        reward = 13
    elif terrain == "ice":
        reward = 5
        hub["stocks"]["water"] = min(MAX_RESOURCE, hub["stocks"]["water"] + 4)
    elif terrain == "salvage":
        reward = 6
        hub["stocks"]["materials"] = min(MAX_RESOURCE, hub["stocks"]["materials"] + 14)
    elif terrain == "hazard":
        reward = 7
        hub["stocks"]["energy"] = max(0, hub["stocks"]["energy"] - 3)
    state["science"] += reward
    state["scienceTotal"] += reward
    return f"{hub['name']}: sector {tile_id + 1} revealed ({terrain}); +{reward} science."


def _explore(state: dict, hub_id: str, tile_id: Any) -> dict:
    hub = _hub_by_id(state, hub_id)
    if not hub or hub["kind"] != "surface" or type(tile_id) is not int or not 0 <= tile_id < 25:
        return _fail(state, "Choose a valid surface sector to survey.")
    tile = hub["tiles"][tile_id]
    if tile["revealed"]:
        return _fail(state, "This sector has already been revealed.")
    if any(e["hub"] == hub_id and e["tile"] == tile_id and e["status"] == "en_route" for e in state["expeditions"]):
        return _fail(state, "A rover expedition is already surveying that sector.")
    distance = abs(tile_id % 5 - 2) + abs(tile_id // 5 - 2)
    if distance <= 1:
        return _success(state, "Free local scan. " + _reveal(state, hub, tile_id))
    if hub["rovers"] < 1:
        return _fail(state, "No exploration rover at this hub. Deliver one by spacecraft.")
    if hub["roverBusyUntil"] > state["turn"]:
        return _fail(state, f"Rover is on expedition until turn {hub['roverBusyUntil']}.")
    energy_cost = 3 + distance
    fuel_cost = 1 + distance // 2
    if hub["stocks"]["energy"] < energy_cost or hub["stocks"]["fuel"] < fuel_cost:
        return _fail(state, f"Expedition requires {energy_cost} energy and {fuel_cost} fuel.")
    turns = max(1, ceil(distance / 2) - (1 if "robotics" in state["tech"] else 0))
    hub["stocks"]["energy"] -= energy_cost
    hub["stocks"]["fuel"] -= fuel_cost
    hub["roverBusyUntil"] = state["turn"] + turns
    expedition_id = _next_id(state, "R")
    state["expeditions"].append({"id": expedition_id, "hub": hub_id, "tile": tile_id, "departed": state["turn"], "arrivesAt": state["turn"] + turns, "status": "en_route"})
    return _success(state, f"{expedition_id} departed {hub['name']}; the sector will be revealed in {turns} turns.")


def _neighbors(tile_id: int) -> list[int]:
    x, y = tile_id % 5, tile_id // 5
    return [ny * 5 + nx for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)) if 0 <= nx < 5 and 0 <= ny < 5]


def _construct(state: dict, hub_id: str, tile_id: Any, kind: str) -> dict:
    hub = _hub_by_id(state, hub_id)
    if not hub or hub["kind"] != "surface" or type(tile_id) is not int or not 0 <= tile_id < 25 or kind not in BUILDINGS:
        return _fail(state, "Choose a valid construction module and sector.")
    tile, specs = hub["tiles"][tile_id], BUILDINGS[kind]
    if not tile["revealed"] or tile["building"]:
        return _fail(state, "Construction requires an empty surveyed sector.")
    if tile["terrain"] == "hazard":
        return _fail(state, "This sector is too unstable for construction.")
    if not any(hub["tiles"][n]["building"] for n in _neighbors(tile_id)):
        return _fail(state, "Connect this module to an existing facility along an edge.")
    if kind == "extractor" and tile["terrain"] != "ice":
        return _fail(state, "An ice extractor must be built on an ice deposit.")
    if kind == "greenhouse" and hub["world"] != "mars":
        return _fail(state, "The current greenhouse simulation is limited to crewed Mars habitats.")
    if hub["stocks"]["materials"] < specs["materials"] or hub["stocks"]["energy"] < specs["energy"]:
        return _fail(state, "Insufficient local materials or energy for construction.")
    hub["stocks"]["materials"] -= specs["materials"]
    hub["stocks"]["energy"] -= specs["energy"]
    tile["building"] = _building(kind, state["turn"] + specs["turns"])
    hub["construction"] += 1
    return _success(state, f"{specs['name']} ordered at {hub['name']} sector {tile_id + 1}; online in {specs['turns']} turns.")


def _assign_crew(state: dict, hub_id: str, crew_index: Any, assignment: str) -> dict:
    hub = _hub_by_id(state, hub_id)
    if not hub or type(crew_index) is not int or not 0 <= crew_index < len(hub["crew"]) or assignment not in ("engineering", "science", "survival"):
        return _fail(state, "Choose an astronaut and a valid task assignment.")
    member = hub["crew"][crew_index]
    member["assigned"] = assignment
    return _success(state, f"{member['name']} assigned to {assignment} at {hub['name']}.")


def _research(state: dict, tech: str) -> dict:
    if tech not in RESEARCH:
        return _fail(state, "Unknown technology.")
    if state["research"]:
        return _fail(state, "Another research programme is already running.")
    specs = RESEARCH[tech]
    if tech in state["tech"] or any(req not in state["tech"] for req in specs["requires"]):
        return _fail(state, "This technology is researched already or has unmet prerequisites.")
    if state["science"] < specs["science"] or state["credits"] < specs["credits"]:
        return _fail(state, "Insufficient science data or mission credits.")
    state["science"] -= specs["science"]
    state["credits"] -= specs["credits"]
    state["research"] = {"id": tech, "started": state["turn"], "completesAt": state["turn"] + specs["turns"]}
    return _success(state, f"Research started: {specs['name']} ({specs['turns']} turns).")


def _operate_hub(state: dict, hub: dict) -> None:
    stock = hub["stocks"]
    if hub["kind"] == "control":
        stock["materials"] = min(MAX_RESOURCE, stock["materials"] + 6)
        stock["fuel"] = min(MAX_RESOURCE, stock["fuel"] + 5)
        state["credits"] += 9
        return
    if hub["kind"] == "orbital":
        stock["fuel"] = min(MAX_RESOURCE, stock["fuel"] + 3)
        stock["energy"] = min(MAX_RESOURCE, stock["energy"] + 4)
        state["science"] += 1
        state["scienceTotal"] += 1
        return
    solar_factors = {"mars": 1, "venus": 0.45, "mercury": 1.6, "europa": 0.27}
    modules = [(t["id"], t["building"]) for t in hub["tiles"] if t["building"] and t["building"]["active"] and t["building"]["onlineFrom"] <= state["turn"]]
    for _, module in modules:
        if module["type"] == "solar":
            stock["energy"] = min(MAX_RESOURCE, stock["energy"] + ceil(12 * solar_factors.get(hub["world"], 1)))
    science_gain = 0
    for tile_id, module in modules:
        kind = module["type"]
        need_energy = {"extractor": 4, "greenhouse": 3, "laboratory": 4, "heater": 3, "drill": 4, "shield": 2, "habitat": 2}.get(kind, 0)
        if need_energy and stock["energy"] < need_energy:
            continue
        if kind == "greenhouse" and stock["water"] < 3:
            continue
        if kind in ("habitat", "extractor", "greenhouse", "laboratory", "heater", "drill", "shield"):
            stock["energy"] -= need_energy
        if kind == "extractor":
            stock["water"] += 9
        elif kind == "greenhouse":
            stock["water"] -= 3
            stock["food"] += 8
        elif kind == "laboratory":
            science_gain += 6 + (2 if any(c["assigned"] == "science" for c in hub["crew"]) else 0)
            if hub["tiles"][tile_id]["terrain"] == "science":
                science_gain += 2
        elif kind == "heater":
            stock["heat"] += 9
        elif kind == "drill":
            stock["materials"] += 6 + (2 if any(c["assigned"] == "engineering" for c in hub["crew"]) else 0)
    if hub["crew"]:
        crew_reduction = 1 if "closed_loop" in state["tech"] else 0
        comfort = 1 if any(c["assigned"] == "survival" for c in hub["crew"]) else 0
        requirements = {"oxygen": max(1, 3 - crew_reduction), "water": max(1, 3 - crew_reduction), "food": max(1, 3 - comfort), "heat": 3, "energy": 2}
        short = 0
        for resource, amount in requirements.items():
            available = min(amount, stock[resource])
            stock[resource] -= available
            short += amount - available
        if short:
            hub["health"] = max(0, hub["health"] - short * 7)
            _log(state, f"{hub['name']} has crew shortages. Health {hub['health']}%.", "warning")
        else:
            hub["health"] = min(100, hub["health"] + 1)
    else:
        stock["energy"] = max(0, stock["energy"] - 1)
    for resource in RESOURCE_KEYS:
        stock[resource] = min(MAX_RESOURCE, max(0, stock[resource]))
    if science_gain:
        state["science"] += science_gain
        state["scienceTotal"] += science_gain


def _arrive_mission(state: dict, mission: dict) -> None:
    mission["status"] = "complete"
    world, objective, payload = mission["destination"], mission["objective"], mission["design"]["payload"]
    failure_roll = _roll(state["seed"], mission["id"], "hazard")
    rough = failure_roll < mission["riskPercent"] / 100
    bonus = 17 if objective == "survey" else 11 if objective == "surface" else 9
    if "lab" in payload:
        bonus += 11
    if objective in ("surface", "orbital"):
        hub_id = _next_id(state, "H")
        hub = _hub(hub_id, world, objective, mission["site"], payload=payload)
        if rough:
            hub["stocks"]["energy"] = max(0, hub["stocks"]["energy"] - 10)
            hub["stocks"]["materials"] = max(0, hub["stocks"]["materials"] - 8)
        state["hubs"].append(hub)
        mission["result"] = hub_id
    else:
        mission["result"] = "science recovered"
        if rough:
            bonus = max(6, bonus - 9)
    state["science"] += bonus
    state["scienceTotal"] += bonus
    state["credits"] += 19 if objective == "survey" else 13
    if world not in state["visitedWorlds"]:
        state["visitedWorlds"].append(world)
        state["credits"] += 34
        state["science"] += 12
        state["scienceTotal"] += 12
    outcome = " (difficult arrival reduced supplies)" if rough else ""
    _log(state, f"{mission['id']} reached {WORLDS[world]['name']} — {objective} completed, +{bonus} science{outcome}.", "mission")


def _arrive_shipment(state: dict, shipment: dict) -> None:
    target = _hub_by_id(state, shipment["target"])
    if target:
        target["stocks"][shipment["resource"]] = min(MAX_RESOURCE, target["stocks"][shipment["resource"]] + shipment["amount"])
        if shipment["route"] not in state["routes"]:
            state["routes"].append(shipment["route"])
        _log(state, f"{shipment['id']} delivered {shipment['amount']} {shipment['resource']} to {target['name']}; logistics route established.", "cargo")
    shipment["status"] = "delivered"


def _new_event(state: dict) -> None:
    if state["turn"] % 4 != 0 or state["event"]:
        return
    targets = [h for h in state["hubs"] if h["kind"] == "surface"]
    if not targets:
        return
    hub = targets[(state["turn"] // 4 - 1) % len(targets)]
    titles = {"mars": ("Dust front approaching", "Dust reduces solar output and threatens your habitat."), "venus": ("Pressure spike detected", "Your robotic shelter requires extra protection."), "mercury": ("Thermal stress warning", "A sharp temperature shift threatens station power systems."), "europa": ("Radiation surge", "A dangerous radiation period approaches the surface instruments.")}
    title, description = titles.get(hub["world"], ("Environmental warning", "Your crew reports difficult conditions."))
    state["event"] = {"title": title, "description": description, "hub": hub["id"], "choices": [
        {"id": "prepare", "label": "Prepare defenses", "description": "Spend 8 materials to prevent most damage."},
        {"id": "endure", "label": "Endure the hazard", "description": "Save materials, lose energy and heat; staffed hubs may lose health."},
    ]}
    _log(state, f"Incoming event at {hub['name']}: {title}.", "warning")


def _choose_event(state: dict, choice: str) -> dict:
    event = state["event"]
    if not event or choice not in ("prepare", "endure"):
        return _fail(state, "There is no matching mission event to resolve.")
    hub = _hub_by_id(state, event["hub"])
    shielding = any(tile["building"] and tile["building"]["type"] == "shield" and tile["building"]["onlineFrom"] <= state["turn"] for tile in hub["tiles"])
    if choice == "prepare":
        if hub["stocks"]["materials"] < 8:
            return _fail(state, "Defensive preparation requires 8 materials at this hub.")
        hub["stocks"]["materials"] -= 8
        message = f"Prepared {hub['name']}; environmental damage avoided."
    else:
        hub["stocks"]["energy"] = max(0, hub["stocks"]["energy"] - (4 if shielding else 10))
        hub["stocks"]["heat"] = max(0, hub["stocks"]["heat"] - (3 if shielding else 7))
        if hub["crew"]:
            hub["health"] = max(0, hub["health"] - (2 if shielding else 4 if "thermal" in state["tech"] else 9))
        message = f"{hub['name']} weathered the hazard; equipment reserves were reduced."
    state["event"] = None
    return _success(state, message)


def _advance(state: dict) -> dict:
    if state["event"]:
        return _fail(state, "Resolve the active environmental event first.")
    for hub in state["hubs"]:
        _operate_hub(state, hub)
    state["turn"] += 1
    for mission in state["missions"]:
        if mission["status"] == "in_flight" and mission["arrivesAt"] <= state["turn"]:
            _arrive_mission(state, mission)
    for shipment in state["shipments"]:
        if shipment["status"] == "in_flight" and shipment["arrivesAt"] <= state["turn"]:
            _arrive_shipment(state, shipment)
    for expedition in state["expeditions"]:
        if expedition["status"] == "en_route" and expedition["arrivesAt"] <= state["turn"]:
            hub = _hub_by_id(state, expedition["hub"])
            if hub:
                _log(state, _reveal(state, hub, expedition["tile"]), "science")
            expedition["status"] = "returned"
    if state["research"] and state["research"]["completesAt"] <= state["turn"]:
        tech = state["research"]["id"]
        state["tech"].append(tech)
        state["research"] = None
        _log(state, f"Research completed: {RESEARCH[tech]['name']}.", "science")
    if not state["milestone"] and all(w in state["visitedWorlds"] for w in ("venus", "mercury", "europa")):
        state["milestone"] = True
        state["credits"] += 100
        _log(state, "SYSTEM PATHFINDER MILESTONE — missions have reached Venus, Mercury, and Europa! +100 credits.", "success")
    _new_event(state)
    return _success(state, f"Turn {state['turn']}: new production, arrivals, and research progress have resolved.")


def execute(state: dict, action: str, args: Any) -> dict:
    checked = validate(state)
    if not checked["ok"]:
        return {"ok": False, "state": state, "message": checked["error"]}
    if action not in {"launch", "shipment", "explore", "construct", "assignCrew", "research", "eventChoice", "advance"}:
        return _fail(state, "Unknown campaign command.")
    new = deepcopy(state)
    if not isinstance(args, dict):
        return _fail(state, "Campaign command arguments must be an object.")
    try:
        if action == "launch":
            return _launch(new, args.get("design"))
        if action == "shipment":
            return _shipment(new, args)
        if action == "explore":
            return _explore(new, args.get("hub"), args.get("tile"))
        if action == "construct":
            return _construct(new, args.get("hub"), args.get("tile"), args.get("building"))
        if action == "assignCrew":
            return _assign_crew(new, args.get("hub"), args.get("index"), args.get("assignment"))
        if action == "research":
            return _research(new, args.get("tech"))
        if action == "eventChoice":
            return _choose_event(new, args.get("choice"))
        return _advance(new)
    except (KeyError, IndexError, TypeError, ValueError):
        return _fail(state, "Invalid command details. No game state was changed.")
