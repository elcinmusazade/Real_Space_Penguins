"""Python-authoritative interplanetary campaign (rules version 3).

The campaign is a separate, AP-free strategy mode. There is no server-side
session: actions accept JSON state, validate their preconditions and return a
deep-copied state. Version 3 raises the stakes: Earth launches are checked
against NASA GMAT-derived launch windows and rocket performance (ares/flight.py),
missions can fail or arrive damaged depending on the player's flight software
(ares/faults.py), bases face forecast hazards handled by player-written standing
orders (ares/orders.py), buildings wear out, bases can be lost, and annual
programme reviews raise or cut the budget. Version 2 saves migrate on load.
"""

from __future__ import annotations

from copy import deepcopy
from hashlib import sha256
from math import ceil
from typing import Any

from . import faults, flight, industry, orders, ship, surface
from . import research as research_rules
from .campaign_data import (
    ARRIVAL_SCENARIO, LEGACY_ARRIVAL_SCENARIO, PLANET_DANGERS, BUDGET_MAX, BUDGET_MIN, BUDGET_START, BUILDINGS, DARK_TURNS_TO_LOSE,
    ENGINES, EXAMPLE_ORDERS, FORECAST_LEAD, GOALS, HAZARDS, HULLS, LAUNCH_VEHICLES, MAX_RESOURCE,
    ATMOSPHERIC_WORLDS, PAYLOADS, PREPARE_COST, REPAIR_COST, RESEARCH, RESOURCE_KEYS, REVIEW_EVERY, ROUTES,
    SCENARIO_INTENSITY, TRAJECTORIES, intensity_range, WEAR, WORLDS, MAP_SIZE,
)
from .fault_data import FAULT_COMPUTERS, FAULT_EXAMPLE_RULES

VERSION = 3
STAT_KEYS = ("missionsOk", "missionsFailed", "goalsDone", "goalsMissed", "hubsLost")

MAP_CENTER = MAP_SIZE // 2
MAP_CORE = MAP_CENTER * MAP_SIZE + MAP_CENTER
MAP_TILES = MAP_SIZE * MAP_SIZE


def _roll(*parts: Any) -> float:
    raw = "|".join(str(p) for p in parts).encode("utf-8")
    return int.from_bytes(sha256(raw).digest()[:8], "big") / 2**64


def _stocks(**overrides: int) -> dict:
    base = {resource: 0 for resource in RESOURCE_KEYS}
    base.update(overrides)
    return base


def _building(kind: str, online_from: int = 1) -> dict:
    return {"type": kind, "level": 1, "onlineFrom": online_from, "active": True, "condition": 100}


def _tiles(world: str, seed: str = "HORIZON-01", site: str = "") -> list[dict]:
    result = [{"id": index, "revealed": False, "terrain": None, "building": None} for index in range(MAP_TILES)]
    for y in range(MAP_CENTER - 1, MAP_CENTER + 2):
        for x in range(MAP_CENTER - 1, MAP_CENTER + 2):
            index = y * MAP_SIZE + x
            result[index]["revealed"] = True
            result[index]["terrain"] = "plain"
    result[MAP_CORE]["building"] = _building("command" if world != "mars" else "habitat")
    result[MAP_CORE - 1]["building"] = _building("solar")
    surface.enrich(result, seed, world, site)
    return result


def _crew() -> list[dict]:
    return [
        {"name": "Elena Kim", "specialty": "Engineering", "assigned": "engineering"},
        {"name": "Jonah Lee", "specialty": "Biology", "assigned": "survival"},
        {"name": "Amira Malik", "specialty": "Research", "assigned": "science"},
    ]


def _has_surface(hub: dict) -> bool:
    return hub.get("kind") in ("surface", "control")


def _hub(identifier: str, world: str, kind: str, site: str, *, payload: list[str] | None = None, starter: bool = False, seed: str = "HORIZON-01") -> dict:
    payload = payload or []
    is_control = kind == "control"
    is_orbit = kind == "orbital"
    staffed = world == "mars" and kind == "surface" and (starter or "habitat" in payload)
    inv = (
        _stocks(energy=130, materials=260, fuel=260, water=110, food=110, oxygen=110, heat=90)
        if is_control else
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
    tiles = _tiles(world, seed, site) if _has_surface({"kind": kind, "world": world}) else []
    if tiles and is_control:
        tiles[MAP_CORE]["building"] = _building("command")
    if tiles and "lab" in payload:
        tiles[MAP_CORE - MAP_SIZE]["terrain"] = "science"
        tiles[MAP_CORE - MAP_SIZE]["building"] = _building("laboratory")
    if tiles and "shield" in payload:
        tiles[MAP_CORE + 1]["building"] = _building("shield")
    return {
        "id": identifier, "name": f"{WORLDS[world]['name']} Mission Control" if is_control else f"{WORLDS[world]['name']} {'Orbital Hub' if is_orbit else site}",
        "world": world, "kind": kind, "site": site,
        "stocks": inv, "tiles": tiles,
        "surveyUntil": 0, "crew": _crew() if staffed else [],
        "health": 100, "discovered": 0, "construction": 0,
        "status": "active", "darkTurns": 0,
    }


def create_campaign(seed: str = "HORIZON-01") -> dict:
    if not isinstance(seed, str):
        raise ValueError("Mission seed must be text.")
    seed = seed.strip()[:60] or "HORIZON-01"
    state = {
        "version": VERSION, "mode": "campaign", "seed": seed, "turn": 1,
        "credits": 390, "science": 32, "scienceTotal": 32,
        "hubs": [_hub("H1", "mars", "control", "Mars HQ", seed=seed)],
        "missions": [], "shipments": [], "surveys": [], "routes": [],
        "tech": [], "research": None, "event": None,
        "visitedWorlds": [], "milestone": False,
        "nextId": 2, "log": [],
    }
    _upgrade_v3(state)
    _log(state, "Mars Mission Control online. Explore your home base. Earth has no hub until your lander arrives.")
    _log(state, "Departures from Mars use game-estimate transfers. Check your flight software and propellant before every launch.")
    return state


def _default_stats() -> dict:
    return {key: 0 for key in STAT_KEYS}


def _upgrade_v3(state: dict) -> None:
    """Add every Campaign V3 field to a V2 (or new) state, in place and idempotently."""
    state["version"] = VERSION
    state.setdefault("budget", BUDGET_START)
    state.setdefault("software", {"computer": "standard", "rules": deepcopy(FAULT_EXAMPLE_RULES)})
    state.setdefault("softwareProfiles", {})
    state.setdefault("orders", deepcopy(EXAMPLE_ORDERS))
    state.setdefault("forecasts", [])
    state.setdefault("goals", [{"id": g["id"], "status": "open"} for g in GOALS])
    state.setdefault("reviews", [])
    state.setdefault("stats", _default_stats())
    state.setdefault("reviewBase", {"science": state["scienceTotal"], **_default_stats()})
    for hub in state["hubs"]:
        if isinstance(hub, dict):
            hub.setdefault("status", "active")
            hub.setdefault("darkTurns", 0)
            for tile in hub.get("tiles") or []:
                if isinstance(tile, dict) and isinstance(tile.get("building"), dict):
                    tile["building"].setdefault("condition", 100)
    for mission in state["missions"]:
        if isinstance(mission, dict):
            mission.setdefault("launchOutcome", "go")
            mission.setdefault("report", [])
            mission.setdefault("outcome", None)


def validate(state: Any) -> dict:
    """Reject malformed client-owned saves before simulating any command."""
    if not isinstance(state, dict) or state.get("version") not in (2, VERSION) or state.get("mode") != "campaign":
        return {"ok": False, "error": "Not a valid campaign save."}
    if "surveys" not in state and isinstance(state.get("expeditions"), list):
        state = deepcopy(state)
        state["surveys"] = state.pop("expeditions")
    if isinstance(state.get("hubs"), list) and any(isinstance(h, dict) and ("surveyUntil" not in h or "rovers" in h or "roverBusyUntil" in h) for h in state["hubs"]):
        state = deepcopy(state)
        for h in state["hubs"]:
            if isinstance(h, dict):
                h.setdefault("surveyUntil", h.get("roverBusyUntil", 0))
                h.pop("roverBusyUntil", None)
                h.pop("rovers", None)
    if isinstance(state.get("tech"), list) and ("robotics" in state["tech"] or isinstance(state.get("research"), dict) and state["research"].get("id") == "robotics"):
        state = deepcopy(state)
        state["tech"] = ["surveying" if t == "robotics" else t for t in state["tech"]]
        if isinstance(state.get("research"), dict) and state["research"].get("id") == "robotics":
            state["research"]["id"] = "surveying"
    if isinstance(state.get("missions"), list):
        legacy = [m for m in state["missions"] if isinstance(m, dict) and isinstance(m.get("design"), dict) and isinstance(m["design"].get("payload"), list) and "rover" in m["design"]["payload"]]
        if legacy:
            state = deepcopy(state)
            for m in state["missions"]:
                if isinstance(m, dict) and isinstance(m.get("design"), dict) and isinstance(m["design"].get("payload"), list):
                    m["design"]["payload"] = ["survey" if p == "rover" else p for p in m["design"]["payload"]]
    if state["version"] == 2 or any(key not in state for key in ("budget", "software", "orders", "forecasts", "goals", "reviews", "stats", "reviewBase")):
        if not isinstance(state.get("hubs"), list) or not isinstance(state.get("missions"), list) or type(state.get("scienceTotal")) is not int:
            return {"ok": False, "error": "Not a valid campaign save."}
        state = deepcopy(state)
        _upgrade_v3(state)
    if not isinstance(state.get("seed"), str) or not 1 <= len(state["seed"]) <= 60:
        return {"ok": False, "error": "Invalid campaign seed."}
    if not isinstance(state.get("hubs"), list) or not state["hubs"] or len(state["hubs"]) > 70:
        return {"ok": False, "error": "Invalid hub list."}
    for key in ("missions", "shipments", "surveys", "routes", "tech", "visitedWorlds", "log"):
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
    if len(state["missions"]) > 1000 or len(state["shipments"]) > 1000 or len(state["surveys"]) > 1000 or len(state["log"]) > 90:
        return {"ok": False, "error": "Campaign history exceeds allowed size."}
    # Center older 5×5/32×32 maps inside the larger world on a deep copy.
    # Earth keeps its control-hub identity; every existing tile and survey moves
    # by the same offset, preserving buildings, discoveries and pending orders.
    legacy_hubs = {h["id"]: {25: 5, 1024: 32}[len(h["tiles"])] for h in state["hubs"]
                   if isinstance(h, dict) and isinstance(h.get("id"), str) and _has_surface(h)
                   and isinstance(h.get("tiles"), list) and len(h["tiles"]) in (25, 1024)}
    if legacy_hubs:
        state = deepcopy(state)
        def expanded_id(index, size):
            offset = MAP_CENTER - size // 2
            return (index // size + offset) * MAP_SIZE + index % size + offset
        for old_hub in state["hubs"]:
            if not isinstance(old_hub, dict) or old_hub.get("id") not in legacy_hubs:
                continue
            if old_hub.get("world") not in WORLDS:
                return {"ok": False, "error": "Invalid legacy hub world."}
            if not isinstance(old_hub.get("site"), str):
                return {"ok": False, "error": "Invalid legacy hub site."}
            if any(not isinstance(tile, dict) or type(tile.get("id")) is not int or tile["id"] != i
                   for i, tile in enumerate(old_hub["tiles"])):
                return {"ok": False, "error": "Invalid legacy terrain sector."}
            size = legacy_hubs[old_hub["id"]]
            expanded = _tiles(old_hub["world"], state["seed"], old_hub["site"])
            for old_idx, tile in enumerate(old_hub["tiles"]):
                index = expanded_id(old_idx, size)
                expanded[index] = {**tile, "id": index}
            old_hub["tiles"] = expanded
        for survey in state["surveys"]:
            if isinstance(survey, dict) and survey.get("hub") in legacy_hubs:
                size = legacy_hubs[survey["hub"]]
                if type(survey.get("tile")) is not int or not 0 <= survey["tile"] < size * size:
                    return {"ok": False, "error": "Invalid legacy survey sector."}
                survey["tile"] = expanded_id(survey["tile"], size)
    # Existing Earth HQ saves had no terrain. Add a playable map once, preserving
    # the control hub's identity, stockpile, and mission/shipment references.
    if any(isinstance(h, dict) and h.get("world") == "earth" and h.get("kind") == "control" and h.get("tiles") == [] for h in state["hubs"]):
        state = deepcopy(state)
        for h in state["hubs"]:
            if isinstance(h, dict) and h.get("world") == "earth" and h.get("kind") == "control" and h.get("tiles") == []:
                if not isinstance(h.get("site"), str):
                    return {"ok": False, "error": "Invalid hub site."}
                h["tiles"] = _tiles("earth", state["seed"], h["site"])
    # Only the new local stock is absent from pre-industry saves. Leave the caller's save untouched.
    if any(isinstance(h, dict) and isinstance(h.get("stocks"), dict) and "spares" not in h["stocks"] for h in state["hubs"]):
        state = deepcopy(state)
        for h in state["hubs"]:
            if isinstance(h, dict) and isinstance(h.get("stocks"), dict):
                h["stocks"].setdefault("spares", 0)
    hub_ids = set()
    for hub in state["hubs"]:
        if not isinstance(hub, dict) or hub.get("world") not in WORLDS or hub.get("kind") not in ("control", "orbital", "surface"):
            return {"ok": False, "error": "Invalid hub metadata."}
        if any(not isinstance(hub.get(key), str) for key in ("id", "name", "site")) or hub["id"] in hub_ids:
            return {"ok": False, "error": "Invalid hub identity."}
        hub_ids.add(hub["id"])
        if not isinstance(hub.get("stocks"), dict) or any(type(hub["stocks"].get(k)) is not int or not 0 <= hub["stocks"][k] <= MAX_RESOURCE for k in RESOURCE_KEYS):
            return {"ok": False, "error": "Invalid hub resources."}
        balance = hub.get("lastBalance", {})
        if not isinstance(balance, dict) or any(k not in RESOURCE_KEYS or type(v) is not int or abs(v) > MAX_RESOURCE for k, v in balance.items()):
            return {"ok": False, "error": "Invalid local production balance."}
        if any(type(hub.get(key)) is not int or not 0 <= hub[key] <= 1_000_000 for key in ("surveyUntil", "discovered", "construction")):
            return {"ok": False, "error": "Invalid hub operations."}
        if type(hub.get("health")) is not int or not 0 <= hub["health"] <= 100:
            return {"ok": False, "error": "Invalid crew health."}
        if not isinstance(hub.get("crew"), list) or len(hub["crew"]) > 12 or any(not isinstance(c, dict) or not isinstance(c.get("name"), str) or not isinstance(c.get("specialty"), str) or c.get("assigned") not in ("engineering", "science", "survival") for c in hub["crew"]):
            return {"ok": False, "error": "Invalid crew roster."}
        tiles = hub.get("tiles")
        if not isinstance(tiles, list) or len(tiles) != (MAP_TILES if _has_surface(hub) else 0):
            return {"ok": False, "error": "Invalid hub terrain."}
        for idx, tile in enumerate(tiles):
            if not isinstance(tile, dict) or type(tile.get("id")) is not int or tile["id"] != idx or type(tile.get("revealed")) is not bool:
                return {"ok": False, "error": "Invalid terrain sector."}
            if tile.get("terrain") not in (None, "plain", "ice", "ridge", "science", "salvage", "hazard"):
                return {"ok": False, "error": "Invalid terrain feature."}
            building = tile.get("building")
            if building is not None and (not isinstance(building, dict) or building.get("type") not in (*BUILDINGS, "command", "habitat") or type(building.get("onlineFrom")) is not int or type(building.get("active")) is not bool):
                return {"ok": False, "error": "Invalid constructed module."}
            if building and building["type"] in industry.RECIPES:
                if building.get("mode", "reserve") not in industry.MODES or ("lastBatch" in building and
                        (not isinstance(building["lastBatch"], str) or building["lastBatch"] not in industry.RESULTS)):
                    return {"ok": False, "error": "Invalid factory settings."}
    if any("biome" not in t or "elevation" not in t for h in state["hubs"] for t in h["tiles"]):
        state = deepcopy(state)
        for h in state["hubs"]:
            if any("biome" not in t or "elevation" not in t for t in h["tiles"]):
                surface.enrich(h["tiles"], state["seed"], h["world"], h["site"])
    if any(not isinstance(t.get("biome"), str) or t["biome"] not in surface.BIOMES or type(t.get("elevation")) is not int or not 0 <= t["elevation"] <= 3 for h in state["hubs"] for t in h["tiles"]):
        return {"ok": False, "error": "Invalid surface geography."}
    for mission in state["missions"]:
        if not isinstance(mission, dict) or mission.get("destination") not in WORLDS or mission.get("status") not in ("in_flight", "complete", "failed") or type(mission.get("arrivesAt")) is not int or mission.get("objective") not in ("surface", "orbital", "survey") or not isinstance(mission.get("design"), dict) or not isinstance(mission["design"].get("payload"), list):
            return {"ok": False, "error": "Invalid mission history."}
    for shipment in state["shipments"]:
        if not isinstance(shipment, dict) or shipment.get("status") not in ("in_flight", "delivered") or type(shipment.get("arrivesAt")) is not int or type(shipment.get("amount")) is not int or shipment.get("resource") not in RESOURCE_KEYS or shipment.get("target") not in hub_ids or not isinstance(shipment.get("route"), str):
            return {"ok": False, "error": "Invalid cargo history."}
    for expedition in state["surveys"]:
        if not isinstance(expedition, dict) or expedition.get("status") not in ("en_route", "returned") or type(expedition.get("arrivesAt")) is not int or type(expedition.get("tile")) is not int or not 0 <= expedition["tile"] < MAP_TILES or expedition.get("hub") not in hub_ids:
            return {"ok": False, "error": "Invalid survey history."}
        if type(expedition.get("radius", 1)) is not int or expedition.get("radius", 1) not in (1, 2):
            return {"ok": False, "error": "Invalid survey radius."}
    research = state.get("research")
    if research is not None and (not isinstance(research, dict) or research.get("id") not in RESEARCH or type(research.get("completesAt")) is not int):
        return {"ok": False, "error": "Invalid active research."}
    event = state.get("event")
    if event is not None and (not isinstance(event, dict) or event.get("hub") not in hub_ids or not isinstance(event.get("title"), str) or not isinstance(event.get("description"), str) or not isinstance(event.get("choices"), list)):
        return {"ok": False, "error": "Invalid event state."}
    if any(not isinstance(item, dict) or type(item.get("turn")) is not int or not isinstance(item.get("message"), str) for item in state["log"]):
        return {"ok": False, "error": "Invalid mission log."}
    error = _validate_v3(state, hub_ids)
    if error:
        return {"ok": False, "error": error}
    return {"ok": True, "state": state}


def _validate_v3(state: dict, hub_ids: set) -> str | None:
    if type(state.get("budget")) is not int or not BUDGET_MIN <= state["budget"] <= BUDGET_MAX:
        return "Invalid programme budget."
    if not faults.validate_design(state.get("software"))["ok"]:
        return "Invalid flight software."
    profiles = state.get("softwareProfiles", {})
    if not isinstance(profiles, dict) or any(w not in WORLDS or not faults.validate_design(d)["ok"] for w, d in profiles.items()):
        return "Invalid planet flight software."
    if not orders.validate(state.get("orders"), state["tech"])["ok"]:
        return "Invalid standing orders."
    for hub in state["hubs"]:
        if hub.get("status") not in ("active", "dark", "lost") or type(hub.get("darkTurns")) is not int or not 0 <= hub["darkTurns"] <= 100:
            return "Invalid hub status."
        for tile in hub["tiles"]:
            building = tile.get("building")
            if building is not None and (type(building.get("condition")) is not int or not 0 <= building["condition"] <= 100):
                return "Invalid building condition."
    forecasts = state.get("forecasts")
    if not isinstance(forecasts, list) or len(forecasts) > 200:
        return "Invalid hazard forecasts."
    for item in forecasts:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str) or item.get("hub") not in hub_ids or type(item.get("turn")) is not int or type(item.get("severity")) is not int or not 0 <= item["severity"] <= 100 or type(item.get("prepared")) is not bool:
            return "Invalid hazard forecast."
    goal_ids = {g["id"] for g in GOALS}
    goals = state.get("goals")
    if not isinstance(goals, list) or any(not isinstance(g, dict) or g.get("id") not in goal_ids or g.get("status") not in ("open", "done", "missed") for g in goals):
        return "Invalid programme goals."
    if not isinstance(state.get("reviews"), list) or len(state["reviews"]) > 500 or any(not isinstance(r, dict) or type(r.get("turn")) is not int for r in state["reviews"]):
        return "Invalid programme reviews."
    for key in ("stats", "reviewBase"):
        block = state.get(key)
        if not isinstance(block, dict) or any(type(block.get(k)) is not int or block[k] < 0 for k in STAT_KEYS):
            return "Invalid programme statistics."
    if type(state["reviewBase"].get("science")) is not int:
        return "Invalid programme statistics."
    for mission in state["missions"]:
        if mission.get("launchOutcome") not in ("go", "flyby", "drift") or not isinstance(mission.get("report"), list):
            return "Invalid mission record."
    return None


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


def _active(hub: dict) -> bool:
    return hub.get("status", "active") == "active"


def _lost_site_hub(state: dict, world: str, site: str) -> dict | None:
    return next((h for h in state["hubs"] if h["world"] == world and h["kind"] == "surface" and h["site"] == site and h["status"] == "lost"), None)


def software_for(state: dict, world: str) -> dict:
    """The rule set a ship flying to `world` carries: that planet's own, else the shared default."""
    return state.get("softwareProfiles", {}).get(world) or state["software"]


def dangers_for(world: str, design: dict | None) -> list[str]:
    """The dangers a ship may meet at `world`. Designs from before ship parts keep their single old danger."""
    return [LEGACY_ARRIVAL_SCENARIO[world]] if design is None or ship.legacy(design) else list(PLANET_DANGERS[world])


def _software_test(software: dict, world: str, design: dict | None = None, objective: str = "surface", own: bool = False) -> dict:
    """Lab-test the rules against every danger of the planet, flying this ship. All must pass."""
    profile = ship.sim_profile(design, world, objective)
    runs = [(faults.simulate(software, s, 1.0, profile), faults.simulate(software, s, intensity_range(world)[1], profile)) for s in dangers_for(world, design)]
    worst = next((n for n, _ in runs if not n["passed"]), runs[0][0])
    return {"scenario": worst["scenario"], "name": " / ".join(n["name"] for n, _ in runs), "description": worst["description"],
            "dangers": [{"scenario": n["scenario"], "name": n["name"], "passed": n["passed"], "harsh": h["passed"], "lost": n["lost"], "science": n["science"], "target": n["target"]} for n, h in runs],
            "passedNominal": all(n["passed"] for n, _ in runs), "passedHarsh": all(h["passed"] for _, h in runs), "ownRules": own,
            "science": worst["science"], "target": worst["target"], "lost": any(n["lost"] for n, _ in runs), "hint": worst["hint"]}


def mission_quote(state: dict, design: Any) -> dict:
    """Validate a modular spacecraft and return its launch checks, costs and trade-offs."""
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
    if isinstance(payload, list):
        payload = ["survey" if p == "rover" else p for p in payload]
    site = design.get("site", "")
    if not source or world not in WORLDS or kind not in ("surface", "orbital", "survey"):
        return {"ok": False, "error": "Choose a valid origin, destination, and mission objective."}
    if not _active(source):
        return {"ok": False, "error": "That departure hub is not operating."}
    if source["world"] == world == "earth":
        return {"ok": False, "error": "Earth arrival missions must depart from a hub on another world."}
    if not hull or not engine or not traj:
        return {"ok": False, "error": "Choose a valid hull, engine, and trajectory."}
    vehicle = design.get("vehicle", "atlas_v_401")
    if source["world"] == "earth" and vehicle not in LAUNCH_VEHICLES:
        return {"ok": False, "error": "Choose a launch vehicle."}
    propellant = design.get("propellantKg", 1200)
    if type(propellant) is not int or not 0 <= propellant <= flight.PROPELLANT_MAX_KG:
        return {"ok": False, "error": f"Propellant load must be a whole number of kg from 0 to {flight.PROPELLANT_MAX_KG:,}."}
    if not isinstance(payload, list) or any(not isinstance(p, str) for p in payload) or len(payload) != len(set(payload)) or any(p not in PAYLOADS for p in payload):
        return {"ok": False, "error": "Choose each valid payload module at most once."}
    for category, item in (("engine", design["engine"]), ("hull", design["hull"]),
                           ("vehicle", vehicle if source["world"] == "earth" else ""),
                           ("surface", world if kind == "surface" else "")):
        required = research_rules.locked(state, category, item)
        if required:
            return {"ok": False, "error": f"Research {RESEARCH[required]['name']} to unlock this {category} option.", "requiredTech": required}
    carried = engine["mass"] + sum(PAYLOADS[p]["mass"] for p in payload)
    if carried > hull["capacity"]:
        return {"ok": False, "error": f"Engine and payload exceed hull capacity ({carried:,}/{hull['capacity']:,} kg).", "mass": carried}
    rescue = None
    if kind == "surface":
        if site not in WORLDS[world]["sites"]:
            return {"ok": False, "error": "Select a valid landing site."}
        if design.get("hull") == "scout":
            return {"ok": False, "error": "Surface outposts require a lander or freighter hull."}
        if "survey" not in payload and "habitat" not in payload:
            return {"ok": False, "error": "A new outpost needs a survey station or habitat payload."}
        if world in ("venus", "mercury", "europa", *ATMOSPHERIC_WORLDS) and "shield" not in payload:
            return {"ok": False, "error": "Harsh-world robotic outposts need an environmental shield."}
        if world in ATMOSPHERIC_WORLDS and "survey" not in payload:
            return {"ok": False, "error": "Atmospheric platforms require a robotic survey station payload."}
        if world in ATMOSPHERIC_WORLDS and "habitat" in payload:
            return {"ok": False, "error": "Atmospheric platforms are robotic; remove the crew habitat payload."}
        rescue = _lost_site_hub(state, world, site)
        if not rescue and any(h["world"] == world and _has_surface(h) and h["site"] == site for h in state["hubs"]):
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
        if "lab" not in payload and "survey" not in payload:
            return {"ok": False, "error": "Science missions need science instruments or a survey station."}
        site = "Remote Survey"
    normalized = {**design, "site": site, "vehicle": vehicle, "propellantKg": propellant, "payload": list(payload)}
    if "parts" in design:
        parts, error = ship.validate_parts(design["parts"])
        if error:
            return {"ok": False, "error": error}
        normalized["parts"] = parts
    software_design = software_for(state, world)
    computer = software_design["computer"]
    checked = flight.assess(state, normalized, source["world"], computer)
    if not checked["ok"]:
        return {"ok": False, "error": checked["error"]}
    numbers = checked["numbers"]
    from_earth = source["world"] == "earth"
    base = flight.transfer(source["world"], world, design["trajectory"], state["turn"])
    fuel = numbers["fuelUnits"]
    orbital_bonus = _has_orbital(state, source["world"]) or _has_orbital(state, world)
    if "propulsion" in state["tech"] or orbital_bonus:
        fuel = max(1, ceil(fuel * (0.85 if "propulsion" in state["tech"] else 1) * (0.82 if orbital_bonus else 1)))
    part_costs = {"materials": 0, "credits": 0} if ship.legacy(normalized) else ship.totals(normalized["parts"])
    use_local = design.get("useLocalSpares", False)
    if type(use_local) is not bool:
        return {"ok": False, "error": "Choose whether to use local spare parts."}
    spares = min(source["stocks"].get("spares", 0), part_costs["credits"] // industry.CREDITS_PER_SPARE) if use_local else 0
    savings = spares * industry.CREDITS_PER_SPARE
    materials = hull["materials"] + engine["materials"] + sum(PAYLOADS[p]["materials"] for p in payload) + part_costs["materials"]
    credits = hull["credits"] + FAULT_COMPUTERS[computer]["cost"] + (12 if kind == "surface" else 5) + part_costs["credits"] - savings
    credits += LAUNCH_VEHICLES[vehicle]["credits"] if from_earth else 9 * max(1, round(base["transferDays"] / 90))
    software = _software_test(software_design, world, normalized, kind, world in state.get("softwareProfiles", {}))
    relays = {h["world"] for h in state["hubs"] if h["kind"] == "orbital" and _active(h)}
    fit = ship.fit(normalized, world, kind, world in relays)
    return {
        "ok": True, "source": source["id"], "destination": world,
        "objective": kind, "site": site, "rescue": rescue["id"] if rescue else None,
        "mass": carried, "capacity": hull["capacity"],
        "materials": materials, "credits": credits, "fuel": fuel, "spares": spares, "creditSavings": savings,
        "turns": checked["turns"], "outcome": checked["outcome"], "checks": checked["checks"],
        "transfer": checked["transfer"], "arc": checked["arc"], "numbers": numbers, "vehicle": checked["vehicle"],
        "software": software, "lightMinutes": flight.light_minutes(world, state["turn"]),
        "fit": fit, "fitAll": ship.fit_all(normalized, kind, relays), "parts": normalized.get("parts"),
        "windows": flight.upcoming(world, state["turn"]) if from_earth else [],
        "arrivalTurn": state["turn"] + checked["turns"],
        "affordable": source["stocks"]["materials"] >= materials and source["stocks"]["fuel"] >= fuel and state["credits"] >= credits,
        "notice": ("Outer-planet routes, capture/entry, launch energy and direction are game estimates; no GMAT transfer data. Floating platforms are fictional game technology."
                   if base["source"] == "estimate" and world in ATMOSPHERIC_WORLDS else
                   "Earth departures: NASA GMAT data (DE421 ephemeris, Atlas V 401 curve), Sun-only two-body transfers. Other values are labelled game estimates." if from_earth else
                   "Departures from off-Earth hubs use game estimates; no GMAT data yet."),
    }


def _report(mission: dict, phase: str, text: str, ok: bool | None = None) -> None:
    mission["report"].append({"phase": phase, "text": text, "ok": ok})


def _launch(state: dict, design: Any, confirm: Any = False) -> dict:
    quote = mission_quote(state, design)
    if not quote["ok"]:
        return _fail(state, quote["error"])
    if not quote["affordable"]:
        return _fail(state, "Insufficient materials, fuel, or mission credits at the selected departure hub.")
    if quote["outcome"] != "go" and confirm is not True:
        failed = next(c for c in quote["checks"] if not c["ok"])
        return _fail(state, f"Launch check failed: {failed['label']}. Fix the plan or confirm to launch anyway.")
    source = _hub_by_id(state, quote["source"])
    source["stocks"]["materials"] -= quote["materials"]
    source["stocks"]["fuel"] -= quote["fuel"]
    source["stocks"]["spares"] -= quote["spares"]
    state["credits"] -= quote["credits"]
    mission_id = _next_id(state, "M")
    stored = {**deepcopy(design), "site": quote["site"], "vehicle": design.get("vehicle", "atlas_v_401"), "propellantKg": quote["numbers"]["propellantKg"]}
    if quote["parts"]:
        stored["parts"] = dict(quote["parts"])
    mission = {
        "id": mission_id, "source": source["id"], "destination": quote["destination"],
        "objective": quote["objective"], "site": quote["site"],
        "design": stored, "departed": state["turn"],
        "arrivesAt": state["turn"] + quote["turns"], "status": "in_flight",
        "riskPercent": 0, "result": None, "outcome": None, "report": [],
        "launchOutcome": "go", "software": deepcopy(software_for(state, quote["destination"])), "fit": quote["fit"],
        "intensity": round(intensity_range(quote["destination"])[0] + (intensity_range(quote["destination"])[1] - intensity_range(quote["destination"])[0]) * _roll(state["seed"], mission_id, "intensity"), 3),
        "transfer": quote["transfer"], "numbers": quote["numbers"], "arc": quote["arc"],
    }
    for check in quote["checks"]:
        _report(mission, "launch", f"{check['label']}: {check['detail']}", check["ok"])
    state["missions"].append(mission)
    outcome = quote["outcome"]
    world_name = WORLDS[quote["destination"]]["name"]
    if outcome == "scrub":
        source["stocks"]["materials"] = min(MAX_RESOURCE, source["stocks"]["materials"] + quote["materials"])
        source["stocks"]["fuel"] = min(MAX_RESOURCE, source["stocks"]["fuel"] + quote["fuel"])
        source["stocks"]["spares"] += quote["spares"]
        mission.update(status="failed", outcome="scrubbed", arrivesAt=state["turn"])
        _report(mission, "launch", "Scrubbed: the transfer leaves Earth outside the rocket's allowed launch directions. The spacecraft and propellant were returned; the launch campaign's credits are spent.", False)
        state["stats"]["missionsFailed"] += 1
        _log(state, f"{mission_id} to {world_name} SCRUBBED on the pad: launch direction out of range. Credits spent; spacecraft kept.", "warning")
        return {"ok": True, "state": state, "message": f"{mission_id} scrubbed: launch direction out of range.", "mission": mission_id, "outcome": "scrubbed"}
    if outcome == "stranded":
        mission.update(status="failed", outcome="stranded", arrivesAt=state["turn"])
        _report(mission, "launch", "Stranded: the rocket could not give this much mass enough energy, so the spacecraft never left Earth orbit.", False)
        state["stats"]["missionsFailed"] += 1
        _log(state, f"{mission_id} to {world_name} STRANDED in Earth orbit: too heavy for the rocket at this launch energy.", "warning")
        return {"ok": True, "state": state, "message": f"{mission_id} stranded in Earth orbit.", "mission": mission_id, "outcome": "stranded"}
    mission["launchOutcome"] = outcome  # "go", or "flyby"/"drift" when propellant is short
    _report(mission, "launch", f"Launched {quote['transfer']['launch']} toward {world_name}; arrival {quote['transfer']['arrival']} (turn {mission['arrivesAt']}).", True)
    _log(state, f"{mission_id} launched toward {world_name}. Arrives turn {mission['arrivesAt']}. Fuel {quote['fuel']}; credits {quote['credits']}.", "mission")
    return {"ok": True, "state": state, "message": f"{mission_id} launched toward {world_name}. Arrival on turn {mission['arrivesAt']}.", "mission": mission_id, "outcome": "launched"}


def _shipment(state: dict, args: Any) -> dict:
    if not isinstance(args, dict):
        return _fail(state, "Choose a cargo shipment.")
    source, target = _hub_by_id(state, args.get("source")), _hub_by_id(state, args.get("target"))
    resource, amount = args.get("resource"), args.get("amount")
    if not source or not target or source["id"] == target["id"]:
        return _fail(state, "Choose two different established hubs.")
    if not _active(source):
        return _fail(state, f"{source['name']} is not operating and cannot ship cargo.")
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
    specials = {MAP_CORE - MAP_SIZE * 2: "ice", MAP_CORE + MAP_SIZE * 2: "science", MAP_CORE - 2: "ice", MAP_CORE + 2: "science", MAP_CORE + MAP_SIZE + 2: "salvage"}
    if tile_id in specials:
        return specials[tile_id]
    biome = hub["tiles"][tile_id].get("biome")
    if hub["world"] in ATMOSPHERIC_WORLDS:
        if surface.BIOMES[biome].get("blocked"):
            return "hazard"
        if biome == "condensate":
            return "ice"  # Shared saved resource code; UI calls this a condensate deposit.
        roll = _roll(seed, hub["world"], hub["site"], tile_id)
        return "science" if roll < .25 else "ridge" if roll < .55 else "plain"
    if biome in surface.WATER:
        return "plain"
    if biome in ("lava", "fissure"):
        return "hazard"
    if biome in ("frost", "icefield", "shadow"):
        return "ice"
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
    label = {"ice": "condensate", "ridge": "aerosol resources"}.get(terrain, terrain) if hub["world"] in ATMOSPHERIC_WORLDS else terrain
    return f"{hub['name']}: sector {tile_id + 1} revealed ({label}); +{reward} science."


def _survey_plan(state: dict, hub: dict, tile_id: int) -> dict:
    tile = hub["tiles"][tile_id]
    local = any(t["building"] and t["building"]["condition"] > 0 and t["building"]["active"] and t["building"]["onlineFrom"] <= state["turn"] and abs(tile_id % MAP_SIZE - t["id"] % MAP_SIZE) + abs(tile_id // MAP_SIZE - t["id"] // MAP_SIZE) <= 2 for t in hub["tiles"])
    distance = abs(tile_id % MAP_SIZE - MAP_CENTER) + abs(tile_id // MAP_SIZE - MAP_CENTER)
    radius = 2 if "wideband" in state["tech"] else 1
    energy = 0 if local else 4 + min(12, distance // 2) + (8 if radius == 2 else 0)
    turns = 0 if local else max(1, min(3, ceil(distance / 8)) - int("surveying" in state["tech"]))
    reason = ""
    if not _active(hub):
        reason = "This hub is not operating."
    elif tile["revealed"]:
        reason = "Survey complete."
    elif any(e["hub"] == hub["id"] and e["tile"] == tile_id and e["status"] == "en_route" for e in state["surveys"]):
        reason = "This regional survey is already in progress."
    elif not local and hub["surveyUntil"] > state["turn"]:
        reason = f"Regional survey in progress until turn {hub['surveyUntil']}."
    elif hub["stocks"]["energy"] < energy:
        reason = f"Survey requires {energy} energy."
    return {"ok": not reason, "reason": reason, "energy": energy, "turns": turns, "area": 1 if local else (radius * 2 + 1) ** 2, "radius": 0 if local else radius}


def _explore(state: dict, hub_id: str, tile_id: Any) -> dict:
    hub = _hub_by_id(state, hub_id)
    if not hub or not _has_surface(hub) or type(tile_id) is not int or not 0 <= tile_id < MAP_TILES:
        return _fail(state, "Choose a valid surface sector to survey.")
    plan = _survey_plan(state, hub, tile_id)
    if not plan["ok"]:
        return _fail(state, plan["reason"])
    if not plan["turns"]:
        return _success(state, "Free local scan. " + _reveal(state, hub, tile_id))
    hub["stocks"]["energy"] -= plan["energy"]
    hub["surveyUntil"] = state["turn"] + plan["turns"]
    identifier = _next_id(state, "S")
    if len(state["surveys"]) >= 1000:
        completed = next((i for i, item in enumerate(state["surveys"]) if item["status"] == "returned"), None)
        if completed is not None:
            state["surveys"].pop(completed)
    state["surveys"].append({"id": identifier, "hub": hub_id, "tile": tile_id, "departed": state["turn"], "arrivesAt": hub["surveyUntil"], "radius": plan["radius"], "status": "en_route"})
    return _success(state, f"Regional survey {identifier} started: up to {plan['area']} sectors in {plan['turns']} turns; {plan['energy']} energy.")


def _neighbors(tile_id: int) -> list[int]:
    return surface.neighbors(tile_id)


def _construction_plan(state: dict, hub: dict, tile_id: int, kind: str) -> dict:
    tile, specs = hub["tiles"][tile_id], BUILDINGS[kind]
    biome = surface.BIOMES[tile["biome"]]
    discount = .8 if "modular" in state["tech"] else 1
    materials = ceil((specs["materials"] + biome.get("siteCost", 0)) * discount)
    site_cost = materials - ceil(specs["materials"] * discount)
    turns = max(1, specs["turns"] - int("modular" in state["tech"]))
    required = research_rules.locked(state, "building", kind)
    reason = ""
    if not _active(hub):
        reason = "This hub is not operating."
    elif required:
        reason = f"Research {RESEARCH[required]['name']} to unlock this facility."
    elif not tile["revealed"] or tile["building"]:
        reason = "Construction requires an empty surveyed sector."
    elif biome.get("blocked") or tile["terrain"] == "hazard":
        reason = "Vortices and jet streams cannot support a platform. Choose a stable cloud sector." if hub["world"] in ATMOSPHERIC_WORLDS else "Open water and unstable ground cannot support a facility. Build on adjacent land."
    elif not any(hub["tiles"][n]["building"] for n in _neighbors(tile_id)):
        reason = "Connect this module to an existing facility along an edge."
    elif kind == "extractor" and tile["terrain"] != "ice" and not surface.coastal(hub, tile):
        reason = "A cloud condenser needs a surveyed condensate deposit." if hub["world"] in ATMOSPHERIC_WORLDS else "A water plant needs an ice deposit or land beside Earth water."
    elif kind == "greenhouse" and hub["world"] not in ("earth", "mars"):
        reason = "Greenhouses are available on Earth and Mars."
    elif hub["stocks"]["materials"] < materials or hub["stocks"]["energy"] < specs["energy"]:
        reason = f"Construction requires {materials} materials and {specs['energy']} energy."
    return {"ok": not reason, "reason": reason, "materials": materials, "energy": specs["energy"], "turns": turns, "requiredTech": required, "siteCost": site_cost, **surface.production(hub, tile, kind, state["tech"], state["turn"])}


def inspect_surface(state: dict, hub_id: str, tile_id: Any) -> dict:
    """Read-only plans from exactly the same rules used by actions and production."""
    hub = _hub_by_id(state, hub_id)
    if not hub or not _has_surface(hub) or type(tile_id) is not int or not 0 <= tile_id < MAP_TILES:
        return {"ok": False, "error": "Choose a valid surface sector."}
    tile = hub["tiles"][tile_id]
    return {"ok": True, "hub": hub_id, "tile": tile_id,
            "survey": _survey_plan(state, hub, tile_id),
            "buildings": {kind: _construction_plan(state, hub, tile_id, kind) for kind in BUILDINGS},
            "facility": surface.production(hub, tile, tile["building"]["type"], state["tech"], state["turn"]) if tile["building"] else None}


def _construct(state: dict, hub_id: str, tile_id: Any, kind: str) -> dict:
    hub = _hub_by_id(state, hub_id)
    if not hub or not _has_surface(hub) or type(tile_id) is not int or not 0 <= tile_id < MAP_TILES or kind not in BUILDINGS:
        return _fail(state, "Choose a valid construction module and sector.")
    plan = _construction_plan(state, hub, tile_id, kind)
    if not plan["ok"]:
        return _fail(state, plan["reason"])
    hub["stocks"]["materials"] -= plan["materials"]
    hub["stocks"]["energy"] -= plan["energy"]
    hub["tiles"][tile_id]["building"] = _building(kind, state["turn"] + plan["turns"])
    hub["construction"] += 1
    return _success(state, f"{BUILDINGS[kind]['name']} ordered at {hub['name']} sector {tile_id + 1}; online in {plan['turns']} turns.")


def _assign_crew(state: dict, hub_id: str, crew_index: Any, assignment: str) -> dict:
    hub = _hub_by_id(state, hub_id)
    if not hub or type(crew_index) is not int or not 0 <= crew_index < len(hub["crew"]) or assignment not in ("engineering", "science", "survival"):
        return _fail(state, "Choose an astronaut and a valid task assignment.")
    member = hub["crew"][crew_index]
    member["assigned"] = assignment
    return _success(state, f"{member['name']} assigned to {assignment} at {hub['name']}.")


def _research(state: dict, tech: str) -> dict:
    checked = research_rules.plan(state, tech)
    if not checked["ok"]:
        return _fail(state, checked["reason"])
    specs = RESEARCH[tech]
    state["science"] -= specs["science"]
    state["credits"] -= specs["credits"]
    state["research"] = {"id": tech, "started": state["turn"], "completesAt": state["turn"] + specs["turns"]}
    return _success(state, f"Research started: {specs['name']} ({specs['turns']} turns).")


def _forecast_for(state: dict, hub_id: str, turn: int) -> dict | None:
    return next((f for f in state["forecasts"] if f["hub"] == hub_id and f["turn"] == turn), None)


def _modules(hub: dict, turn: int) -> list[tuple[int, dict]]:
    return [(t["id"], t["building"]) for t in hub["tiles"] if t["building"] and t["building"]["active"] and t["building"]["onlineFrom"] <= turn]


def _output_factor(module: dict) -> float:
    condition = module.get("condition", 100)
    return 0.0 if condition <= 0 else 0.5 if condition < 50 else 1.0


def _has_shield(hub: dict, turn: int) -> bool:
    return any(m["type"] == "shield" and _output_factor(m) > 0 for _, m in _modules(hub, turn))


def _order_sensors(state: dict, hub: dict) -> dict:
    now = _forecast_for(state, hub["id"], state["turn"])
    nxt = _forecast_for(state, hub["id"], state["turn"] + 1)
    conditions = [m.get("condition", 100) for _, m in _modules(hub, state["turn"])]
    return {
        "hazard": now["severity"] if now else 0, "hazard_next": nxt["severity"] if nxt else 0,
        "energy": hub["stocks"]["energy"], "heat": hub["stocks"]["heat"], "materials": hub["stocks"]["materials"],
        "food": hub["stocks"]["food"], "water": hub["stocks"]["water"],
        "health": hub["health"] if hub["crew"] else 100, "condition": min(conditions) if conditions else 100,
    }


def _damage(module: dict, amount: float) -> None:
    module["condition"] = max(0, min(100, round(module.get("condition", 100) - amount)))


def _operate_surface(state: dict, hub: dict) -> list[str]:
    """One turn of a surface hub: standing orders, hazard, production, upkeep and crew."""
    notes: list[str] = []
    stock = hub["stocks"]
    turn = state["turn"]
    modules = _modules(hub, turn)
    fired = orders.evaluate(state["orders"], _order_sensors(state, hub))
    responses = {response for _, response in fired}
    for index, response in fired:
        notes.append(f"Standing order {index + 1} fired: {orders.describe(state['orders'][index])}.")
    if "reinforce" in responses:
        if stock["materials"] >= 6:
            stock["materials"] -= 6
        else:
            responses.discard("reinforce")
            notes.append("Reinforce order skipped: not enough materials.")
    if "auto_repair" in responses:
        worn = min(modules, key=lambda m: m[1].get("condition", 100), default=None)
        if worn and worn[1].get("condition", 100) < 100 and stock["materials"] >= REPAIR_COST:
            stock["materials"] -= REPAIR_COST
            worn[1]["condition"] = 100
            notes.append(f"Repaired {worn[1]['type']} in sector {worn[0] + 1}.")

    hazard = _forecast_for(state, hub["id"], turn)
    spec = HAZARDS.get(hub["world"])
    severity = hazard["severity"] / 100 if hazard else 0.0
    shielded = _has_shield(hub, turn)
    mitigation = (0.75 if "thermal" in state["tech"] else 1) * (0.5 if hazard and hazard["prepared"] else 1.0) * (0.5 if "reinforce" in responses else 1.0) * (0.6 if shielded else 1.0)
    stowed = "stow_arrays" in responses
    sheltered = "shelter_crew" in responses
    power_save = "power_save" in responses or sheltered

    for tile_id, module in modules:
        if (module["type"] in ("solar", "reactor") or module["type"] == "command" and hub["world"] in ATMOSPHERIC_WORLDS) and _output_factor(module):
            flow = surface.production(hub, hub["tiles"][tile_id], module["type"], state["tech"])
            if any(stock[k] < amount for k, amount in flow["inputs"].items()):
                notes.append(f"Sector {tile_id+1}: Fission Reactor idle — retain water and materials for power generation.")
                continue
            for resource, amount in flow["inputs"].items():
                stock[resource] -= amount
            light = (0.3 if stowed else 1 - (spec["solarCut"] * severity if spec else 0)) if module["type"] == "solar" else 1
            stock["energy"] = min(MAX_RESOURCE, stock["energy"] + ceil(flow["outputs"]["energy"] * light * _output_factor(module)))
    science_gain = 0
    # Supply chain order is independent of the tiles on which facilities stand.
    priority = {"extractor": 0, "recycler": 1, "greenhouse": 2, "heater": 3, "habitat": 4, "shield": 5, "drill": 6,
                "laboratory": 7, "propellant": 9, "machine_shop": 9}
    for tile_id, module in sorted(modules, key=lambda item: (priority.get(item[1]["type"], 8), item[0])):
        kind = module["type"]
        factor = _output_factor(module)
        if kind in ("solar", "reactor", "command"):
            continue
        flow = surface.production(hub, hub["tiles"][tile_id], kind, state["tech"], turn)
        if kind in industry.RECIPES:
            module["lastBatch"] = industry.batch_result(stock, flow, module.get("mode", "reserve"), factor, power_save, MAX_RESOURCE)
            if module["lastBatch"] != "made":
                continue
        elif not factor or power_save and kind in ("laboratory", "drill", "extractor"):
            continue
        if any(stock[k] < amount for k, amount in flow["inputs"].items()):
            notes.append(f"Sector {tile_id+1}: {BUILDINGS.get(kind, {}).get('name', kind)} idle — insufficient inputs.")
            continue
        for resource, amount in flow["inputs"].items():
            stock[resource] -= amount
        for resource, amount in flow["outputs"].items():
            if resource == "science":
                science_gain += round(amount * factor)
            else:
                stock[resource] = min(MAX_RESOURCE, stock[resource] + round(amount * factor))

    if hazard and spec:
        for _, module in modules:
            if module["type"] == "solar" and stowed:
                continue
            hit = spec["building"]
            if module["type"] in ("laboratory", "command", "habitat") and not sheltered:
                hit += spec["electronics"]
            _damage(module, hit * severity * mitigation)
        stock["heat"] = max(0, stock["heat"] - round(spec["heat"] * severity * mitigation))
        if hub["crew"] and not sheltered:
            hub["health"] = max(0, hub["health"] - round(spec["crew"] * severity * mitigation))
        protections = [label for flag, label in (("thermal" in state["tech"], "extreme-world protection"), (hazard["prepared"], "prepared"), ("reinforce" in responses, "reinforced"), (shielded, "radiation shield"), (stowed, "arrays stowed"), (sheltered, "crew sheltered")) if flag]
        notes.append(f"{spec['name']} (severity {hazard['severity']}) hit {hub['name']}" + (f"; protection: {', '.join(protections)}." if protections else " with no protection."))

    # Wear and automatic maintenance (1 material per two buildings).
    wear = WEAR[hub["world"]] * (0.5 if shielded else 1)
    upkeep = ceil(len(modules) / 2)
    if modules:
        if stock["materials"] >= upkeep:
            stock["materials"] -= upkeep
        else:
            for _, module in modules:
                _damage(module, wear)
            notes.append(f"{hub['name']} could not pay {upkeep} materials of upkeep: buildings wore down.")

    if hub["crew"]:
        crew_reduction = 1 if "closed_loop" in state["tech"] else 0
        ration = 1 if "ration" in responses else 0
        comfort = 1 if any(c["assigned"] == "survival" for c in hub["crew"]) else 0
        requirements = {"oxygen": max(1, 3 - crew_reduction), "water": max(1, 3 - crew_reduction - ration), "food": max(1, 3 - comfort - ration - int("biosphere" in state["tech"])), "heat": 3, "energy": 2}
        short = 0
        for resource, amount in requirements.items():
            available = min(amount, stock[resource])
            stock[resource] -= available
            short += amount - available
        habitat_down = any(m["type"] == "habitat" and _output_factor(m) == 0 for _, m in modules)
        if short or habitat_down:
            hub["health"] = max(0, hub["health"] - short * 7 - (5 if habitat_down else 0))
            notes.append(f"{hub['name']} crew is short of supplies. Health {hub['health']}%.")
        elif not hazard:
            hub["health"] = min(100, hub["health"] + 1)
        if ration:
            hub["health"] = max(0, hub["health"] - 1)
        if hub["health"] <= 0:
            lost_names = ", ".join(c["name"] for c in hub["crew"])
            hub["crew"] = []
            hub["status"] = "lost"
            for _, module in modules:
                _damage(module, 50)
            state["stats"]["hubsLost"] += 1
            notes.append(f"BASE LOST: {hub['name']} could not keep its crew alive ({lost_names}). A new landing at {hub['site']} can reopen it.")
    elif hub["kind"] != "control":
        stock["energy"] = max(0, stock["energy"] - 1)
        if stock["energy"] == 0:
            hub["darkTurns"] += 1
            if hub["darkTurns"] >= DARK_TURNS_TO_LOSE:
                hub["status"] = "dark"
                state["stats"]["hubsLost"] += 1
                notes.append(f"STATION DARK: {hub['name']} ran out of power for {DARK_TURNS_TO_LOSE} turns and went silent. Ship 20+ energy to revive it.")
            else:
                notes.append(f"{hub['name']} has no power ({hub['darkTurns']}/{DARK_TURNS_TO_LOSE} turns before it goes dark).")
        else:
            hub["darkTurns"] = 0
    for resource in RESOURCE_KEYS:
        stock[resource] = min(MAX_RESOURCE, max(0, stock[resource]))
    if science_gain:
        state["science"] += science_gain
        state["scienceTotal"] += science_gain
    return notes


def _operate_hub(state: dict, hub: dict) -> None:
    stock = hub["stocks"]
    if not _active(hub):
        return
    if hub["kind"] == "control":
        stock["materials"] = min(MAX_RESOURCE, stock["materials"] + 6)
        stock["fuel"] = min(MAX_RESOURCE, stock["fuel"] + 12)
        state["credits"] += state["budget"]
        if not _has_surface(hub):
            return
    if hub["kind"] == "orbital":
        stock["fuel"] = min(MAX_RESOURCE, stock["fuel"] + 3)
        stock["energy"] = min(MAX_RESOURCE, stock["energy"] + 4)
        state["science"] += 1
        state["scienceTotal"] += 1
        return
    for note in _operate_surface(state, hub):
        tag = "warning" if any(word in note for word in ("LOST", "DARK", "no protection", "short", "no power", "wore")) else "info"
        _log(state, note, tag)


def _drop_module(payload: list[str], world: str) -> str | None:
    """Pick the module lost in a degraded arrival, keeping what the outpost needs."""
    for candidate in ("cargo", "lab", "relay"):
        if candidate in payload:
            return candidate
    if "habitat" in payload and "survey" in payload:
        return "survey"
    return None


def _arrive_mission(state: dict, mission: dict) -> None:
    world, objective, payload = mission["destination"], mission["objective"], list(mission["design"]["payload"])
    name = WORLDS[world]["name"]
    launch_outcome = mission.get("launchOutcome", "go")
    software = mission.get("software") or software_for(state, world)
    dangers = dangers_for(world, mission["design"])
    scenario = dangers[min(len(dangers) - 1, int(_roll(state["seed"], mission["id"], "danger") * len(dangers)))]
    profile = ship.sim_profile(mission["design"], world, objective)
    sim = faults.simulate(faults.validate_design(software)["design"], scenario, mission.get("intensity", 1.0), profile)
    mission["faultTest"] = {"scenario": scenario, "name": sim["name"], "passed": sim["passed"], "lost": sim["lost"],
                            "science": sim["science"], "target": sim["target"], "brownouts": sim["brownouts"],
                            "fired": sum(sim["fireCounts"]), "events": [e for row in sim["timeline"] for e in row["events"]][:6]}
    _report(mission, "cruise", f"{sim['name']} at {round(mission.get('intensity', 1.0) * 100)}% of the lab test's intensity. Flight software fired {sum(sim['fireCounts'])} times; {sim['science']} of {sim['target']} science returned; {sim['brownouts']} brownouts.", sim["passed"])
    bonus = 17 if objective == "survey" else 11 if objective == "surface" else 9
    if "lab" in payload:
        bonus += 11
    bonus += sim["science"] // 20

    def fail(outcome: str, text: str) -> None:
        mission.update(status="failed", outcome=outcome)
        _report(mission, "arrival", text, False)
        state["stats"]["missionsFailed"] += 1
        _log(state, f"{mission['id']} at {name}: {text}", "warning")

    if launch_outcome == "drift":
        fail("missed", "Course corrections ran out of propellant; the spacecraft drifted past without returning data.")
        return
    if sim["lost"]:
        fail("lost", "Contact lost: repeated brownouts during the approach. The flight software did not protect the power system.")
        return
    reached = True
    hub_id = None
    if launch_outcome == "flyby":
        outcome = "flyby"
        bonus = max(4, bonus // 2)
        text = "Not enough propellant to stop: the spacecraft flew past, returning flyby science only."
        reached = True
    elif not sim["passed"]:
        outcome = "degraded"
        text = "Arrived damaged: the flight software did not handle the approach faults."
    else:
        outcome = "nominal"
        text = "Arrived as planned."
    # Planet fit (warn-only at launch): a ship not built for this world arrives damaged.
    if not ship.legacy(mission["design"]):
        relay_here = any(h["world"] == world and h["kind"] == "orbital" and _active(h) for h in state["hubs"])
        report = ship.fit(mission["design"], world, objective, relay_here)
        mission["fit"] = report
        for check in report["checks"]:
            if check["status"] != "ok":
                _report(mission, "fit", f"{check['label']}: {check['detail']}", False if check["status"] == "fail" else None)
        unfit = [c["label"].lower() for c in report["checks"] if c["status"] == "fail" and c["id"] != "comms"]
        if unfit and outcome != "flyby":
            note = f"The ship was not built for {name} ({', '.join(unfit)})."
            text = f"Arrived damaged. {note}" if outcome == "nominal" else f"{text} {note}"
            outcome = "degraded"
        antenna = next(c for c in report["checks"] if c["id"] == "comms")["status"]
        if antenna != "ok":
            bonus = bonus // 2 if antenna == "fail" else bonus * 3 // 4
            text += " A weak antenna sent less science home."
    consequence = None
    if outcome != "flyby" and objective in ("surface", "orbital"):
        margin = mission.get("numbers", {}).get("dvMargin", 1.0)
        tight = objective == "surface" and margin < 0.05 and _roll(state["seed"], mission["id"], "landing") < 0.5
        if outcome == "degraded":
            options = ["damaged"] + (["module"] if objective == "surface" and _drop_module(payload, world) else []) + (["off_target"] if objective == "surface" else [])
            consequence = options[int(_roll(state["seed"], mission["id"], "consequence") * len(options))]
        elif tight:
            consequence = "off_target"
            outcome = "degraded"
            text = "Landed off target: the propellant margin was too thin to divert away from rough ground."
        if consequence == "module":
            lost_module = _drop_module(payload, world)
            payload.remove(lost_module)
            text += f" The {PAYLOADS[lost_module]['name']} was lost."
        rescue = _lost_site_hub(state, world, mission["site"]) if objective == "surface" else None
        if rescue:
            rescue.update(status="active", darkTurns=0, health=70)
            if world == "mars" and "habitat" in payload:
                rescue["crew"] = _hub(rescue["id"], world, "surface", rescue["site"], payload=payload)["crew"]
            hub_id = rescue["id"]
            text += f" {rescue['name']} is reopened."
        else:
            hub_id = _next_id(state, "H")
            hub = _hub(hub_id, world, objective, mission["site"], payload=payload, seed=state["seed"])
            state["hubs"].append(hub)
            rescue = hub
        if consequence == "damaged":
            for key in rescue["stocks"]:
                rescue["stocks"][key] //= 2
            for tile in rescue["tiles"]:
                if tile["building"]:
                    tile["building"]["condition"] = 50
            if rescue["crew"]:
                rescue["health"] = min(rescue["health"], 70)
            text += " Supplies were halved and equipment starts at 50% condition."
        if consequence == "off_target":
            for tile in rescue["tiles"]:
                if tile["revealed"] and not tile["building"]:
                    tile["terrain"] = "hazard"
            rescue["stocks"]["materials"] = max(0, rescue["stocks"]["materials"] - 10)
            if "Landed off target" not in text:
                text += " It landed off target, on rough hazardous ground."
        mission["result"] = hub_id
    else:
        if outcome == "degraded":
            bonus = max(6, bonus // 2)
            text += " Only half the planned science came home."
        mission["result"] = "science recovered"
    mission.update(status="complete", outcome=outcome)
    _report(mission, "arrival", text, outcome == "nominal")
    state["stats"]["missionsOk"] += 1
    state["science"] += bonus
    state["scienceTotal"] += bonus
    state["credits"] += 19 if objective == "survey" else 13
    if reached and world not in state["visitedWorlds"]:
        state["visitedWorlds"].append(world)
        state["credits"] += 34
        state["science"] += 12
        state["scienceTotal"] += 12
    _log(state, f"{mission['id']} reached {name}: {outcome.upper()}. {text} +{bonus} science.", "mission" if outcome == "nominal" else "warning")


def _arrive_shipment(state: dict, shipment: dict) -> None:
    target = _hub_by_id(state, shipment["target"])
    if target:
        target["stocks"][shipment["resource"]] = min(MAX_RESOURCE, target["stocks"][shipment["resource"]] + shipment["amount"])
        if shipment["route"] not in state["routes"]:
            state["routes"].append(shipment["route"])
        _log(state, f"{shipment['id']} delivered {shipment['amount']} {shipment['resource']} to {target['name']}; logistics route established.", "cargo")
        if target["status"] == "dark" and target["stocks"]["energy"] >= 20:
            target.update(status="active", darkTurns=0)
            _log(state, f"{target['name']} is powered up and back online.", "success")
    shipment["status"] = "delivered"


def _issue_forecasts(state: dict) -> None:
    """Deterministic hazard forecasts, FORECAST_LEAD turns ahead, for every active surface hub."""
    strike = state["turn"] + FORECAST_LEAD
    state["forecasts"] = [f for f in state["forecasts"] if f["turn"] >= state["turn"]]
    for hub in state["hubs"]:
        if hub["kind"] != "surface" or not _active(hub) or _forecast_for(state, hub["id"], strike):
            continue
        spec = HAZARDS.get(hub["world"])
        if spec is None:
            continue
        if _roll(state["seed"], hub["id"], strike, "hazard") >= spec["chance"]:
            continue
        severity = round(35 + 50 * _roll(state["seed"], hub["id"], strike, "severity") + spec["growth"] * strike)
        forecast = {"id": f"F{hub['id']}-{strike}", "hub": hub["id"], "turn": strike, "severity": max(0, min(100, severity)), "prepared": False, "kind": spec["name"]}
        state["forecasts"].append(forecast)
        _log(state, f"FORECAST: {spec['name']} (severity {forecast['severity']}) expected at {hub['name']} on turn {strike}.", "warning")


def _prepare(state: dict, forecast_id: Any) -> dict:
    forecast = next((f for f in state["forecasts"] if f["id"] == forecast_id), None)
    if not forecast:
        return _fail(state, "Choose a forecast hazard to prepare for.")
    if forecast["prepared"]:
        return _fail(state, "That hub is already prepared.")
    if forecast["turn"] <= state["turn"]:
        return _fail(state, "Too late: preparation must be ordered at least one turn before the hazard. Only standing orders can react now.")
    hub = _hub_by_id(state, forecast["hub"])
    if not hub or not _active(hub):
        return _fail(state, "That hub is not operating.")
    if hub["stocks"]["materials"] < PREPARE_COST:
        return _fail(state, f"Preparation needs {PREPARE_COST} materials at {hub['name']}.")
    hub["stocks"]["materials"] -= PREPARE_COST
    forecast["prepared"] = True
    return _success(state, f"{hub['name']} prepared for the {forecast.get('kind', 'hazard').lower()} on turn {forecast['turn']}: damage will be halved.")


def _factory_mode(state: dict, hub_id: Any, tile_id: Any, mode: Any) -> dict:
    hub = _hub_by_id(state, hub_id)
    if not hub or not _active(hub) or type(tile_id) is not int or not 0 <= tile_id < len(hub["tiles"]) or mode not in industry.MODES:
        return _fail(state, "Choose an operating hub, factory sector and production setting.")
    building = hub["tiles"][tile_id]["building"]
    if not building or building["type"] not in industry.RECIPES:
        return _fail(state, "Only factories have batch controls.")
    building["mode"] = mode
    return _success(state, f"{BUILDINGS[building['type']]['name']}: {mode} setting saved for the next turn.")


def _repair(state: dict, hub_id: Any, tile_id: Any, resource: str = "materials") -> dict:
    hub = _hub_by_id(state, hub_id)
    if not hub or not _has_surface(hub) or type(tile_id) is not int or not 0 <= tile_id < MAP_TILES:
        return _fail(state, "Choose a building to repair.")
    if not _active(hub):
        return _fail(state, "That hub is not operating.")
    building = hub["tiles"][tile_id]["building"]
    if not building or building.get("condition", 100) >= 100:
        return _fail(state, "That sector has no worn building.")
    if resource not in ("materials", "spares"):
        return _fail(state, "Choose materials or spare parts for this repair.")
    cost = industry.REPAIR_SPARES if resource == "spares" else REPAIR_COST
    if hub["stocks"][resource] < cost:
        return _fail(state, f"Repairs need {cost} {resource} at {hub['name']}.")
    hub["stocks"][resource] -= cost
    building["condition"] = 100
    return _success(state, f"{building['type'].title()} in sector {tile_id + 1} repaired to 100%.")


def _set_software(state: dict, args: dict) -> dict:
    """Save the shared default rules, or one planet's own rules (args.world). args.clear drops a planet's rules."""
    world = args.get("world")
    if world is not None and world not in WORLDS:
        return _fail(state, "Choose a valid planet.")
    profiles = state.setdefault("softwareProfiles", {})
    if world and args.get("clear") is True:
        profiles.pop(world, None)
        return {"ok": True, "state": state, "message": f"{WORLDS[world]['name']} now uses the default rules."}
    checked = faults.validate_design({"computer": args.get("computer"), "rules": args.get("rules")})
    if not checked["ok"]:
        return _fail(state, checked["error"])
    if world:
        profiles[world] = checked["design"]
    else:
        state["software"] = checked["design"]
    where = f"{WORLDS[world]['name']} rules" if world else "Default rules"
    return {"ok": True, "state": state, "message": f"{where} saved: {len(checked['design']['rules'])} rules on the {FAULT_COMPUTERS[checked['design']['computer']]['name'].lower()}."}


def _set_orders(state: dict, args: dict) -> dict:
    checked = orders.validate(args.get("rules"), state["tech"])
    if not checked["ok"]:
        return _fail(state, checked["error"])
    state["orders"] = checked["rules"]
    return {"ok": True, "state": state, "message": f"Standing orders saved: {len(checked['rules'])} orders for every base."}


def _goal_met(state: dict, goal: dict) -> bool:
    active = [h for h in state["hubs"] if _active(h)]
    kind = goal["kind"]
    if kind == "visit":
        return goal["world"] in state["visitedWorlds"] and any(m["destination"] == goal["world"] and m["status"] == "complete" for m in state["missions"])
    if kind == "orbital":
        return any(h["world"] == goal["world"] and h["kind"] == "orbital" for h in active)
    if kind == "science":
        return state["scienceTotal"] >= goal["value"]
    if kind == "surface_count":
        return sum(h["world"] == goal["world"] and _has_surface(h) for h in active) >= goal["value"]
    if kind == "health":
        crewed = [h for h in active if h["world"] == goal["world"] and h["crew"]]
        return state["turn"] == goal["deadline"] and bool(crewed) and min(h["health"] for h in crewed) >= goal["value"]
    return False


def _update_goals(state: dict) -> None:
    specs = {g["id"]: g for g in GOALS}
    for record in state["goals"]:
        if record["status"] != "open":
            continue
        goal = specs[record["id"]]
        if _goal_met(state, goal):
            record["status"] = "done"
            state["credits"] += goal["reward"]
            state["stats"]["goalsDone"] += 1
            _log(state, f"GOAL COMPLETE: {goal['title']}. +{goal['reward']} credits.", "success")
        elif state["turn"] >= goal["deadline"] and (goal["kind"] == "health" or state["turn"] > goal["deadline"]):
            record["status"] = "missed"
            state["stats"]["goalsMissed"] += 1
            _log(state, f"GOAL MISSED: {goal['title']} (deadline turn {goal['deadline']}).", "warning")


def _review(state: dict) -> None:
    """Annual programme review: results since the last review raise or cut the budget."""
    base, stats = state["reviewBase"], state["stats"]
    delta = {key: stats[key] - base[key] for key in STAT_KEYS}
    science = state["scienceTotal"] - base["science"]
    crewed = [h for h in state["hubs"] if _active(h) and h["crew"]]
    notes = [f"{science} science collected (+{science // 25})"]
    score = science // 25
    for key, weight, label in (("missionsOk", 3, "missions arrived"), ("missionsFailed", -4, "missions failed"), ("goalsDone", 5, "goals completed"), ("goalsMissed", -4, "goals missed"), ("hubsLost", -6, "bases lost")):
        if delta[key]:
            score += weight * delta[key]
            notes.append(f"{delta[key]} {label} ({weight * delta[key]:+d})")
    if crewed:
        worst = min(h["health"] for h in crewed)
        if worst >= 70:
            score += 2
            notes.append("crew healthy (+2)")
        elif worst < 40:
            score -= 2
            notes.append("crew in danger (-2)")
    change = 3 if score >= 10 else 1 if score >= 4 else 0 if score >= 0 else -2
    old = state["budget"]
    state["budget"] = max(BUDGET_MIN, min(BUDGET_MAX, old + change))
    state["reviews"].append({"turn": state["turn"], "score": score, "change": state["budget"] - old, "budget": state["budget"], "notes": notes})
    state["reviews"] = state["reviews"][-40:]
    state["reviewBase"] = {"science": state["scienceTotal"], **{key: stats[key] for key in STAT_KEYS}}
    verdict = "raised" if state["budget"] > old else "cut" if state["budget"] < old else "held"
    _log(state, f"PROGRAMME REVIEW: score {score}. Budget {verdict}: {old} -> {state['budget']} credits per turn.", "success" if state["budget"] >= old else "warning")


def _choose_event(state: dict, choice: str) -> dict:
    """Resolve an environmental event carried over from a Campaign V2 save."""
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
        before = hub["stocks"].copy()
        _operate_hub(state, hub)
        # Operations only; deliveries and player spending are separate transactions.
        hub["lastBalance"] = {k: hub["stocks"][k] - before[k] for k in RESOURCE_KEYS}
    state["turn"] += 1
    for mission in state["missions"]:
        if mission["status"] == "in_flight" and mission["arrivesAt"] <= state["turn"]:
            _arrive_mission(state, mission)
    for shipment in state["shipments"]:
        if shipment["status"] == "in_flight" and shipment["arrivesAt"] <= state["turn"]:
            _arrive_shipment(state, shipment)
    for expedition in state["surveys"]:
        if expedition["status"] == "en_route" and expedition["arrivesAt"] <= state["turn"]:
            hub = _hub_by_id(state, expedition["hub"])
            if hub:
                center = expedition["tile"]
                discovered = 0
                radius = expedition.get("radius", 1)
                for dy in range(-radius, radius + 1):
                    for dx in range(-radius, radius + 1):
                        x, y = center % MAP_SIZE + dx, center // MAP_SIZE + dy
                        if 0 <= x < MAP_SIZE and 0 <= y < MAP_SIZE and not hub["tiles"][y * MAP_SIZE + x]["revealed"]:
                            _reveal(state, hub, y * MAP_SIZE + x)
                            discovered += 1
                _log(state, f"Survey {expedition['id']} mapped {discovered} new sectors around {center + 1} at {hub['name']}.", "science")
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
    _update_goals(state)
    if (state["turn"] - 1) % REVIEW_EVERY == 0:
        _review(state)
    _issue_forecasts(state)
    return _success(state, f"Turn {state['turn']} ({flight.turn_date(state['turn'])}): production, arrivals, hazards and research resolved.")


ACTIONS = {"factoryMode", "launch", "shipment", "explore", "construct", "assignCrew", "research", "eventChoice", "advance",
           "setSoftware", "setOrders", "prepare", "repair"}


def execute(state: dict, action: str, args: Any) -> dict:
    checked = validate(state)
    if not checked["ok"]:
        return {"ok": False, "state": state, "message": checked["error"]}
    if action not in ACTIONS:
        return _fail(state, "Unknown campaign command.")
    new = deepcopy(checked["state"])
    if not isinstance(args, dict):
        return _fail(state, "Campaign command arguments must be an object.")
    try:
        if action == "launch":
            return _launch(new, args.get("design"), args.get("confirm", False))
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
        if action == "setSoftware":
            return _set_software(new, args)
        if action == "setOrders":
            return _set_orders(new, args)
        if action == "prepare":
            return _prepare(new, args.get("forecast"))
        if action == "factoryMode":
            return _factory_mode(new, args.get("hub"), args.get("tile"), args.get("mode"))
        if action == "repair":
            return _repair(new, args.get("hub"), args.get("tile"), args.get("resource", "materials"))
        return _advance(new)
    except (KeyError, IndexError, TypeError, ValueError):
        return _fail(state, "Invalid command details. No game state was changed.")
