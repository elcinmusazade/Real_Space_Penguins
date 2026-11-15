"""AURA advice: situation-aware, prioritised suggestions for the player.

Read-only. Advice is derived from the authoritative rules: the next turn is
simulated on a copy of the state to project supplies, the saved flight
software is lab-tested, and Earth launch windows come from the GMAT-derived
table. Nothing here changes the game.
"""

from __future__ import annotations

from copy import deepcopy

from . import campaign, faults, flight, research
from .campaign_data import ARRIVAL_SCENARIO, GOALS, RESEARCH, REVIEW_EVERY, WORLDS

LEVELS = ("critical", "warning", "opportunity", "info")
WATCHED = ("oxygen", "water", "food", "heat", "energy")
FIX = {
    "oxygen": "Build an Oxygen Plant (water + energy) or ship oxygen in.",
    "water": "Build a Water Plant on ice or a coast, or ship water in.",
    "food": "Build a Greenhouse (needs water), or ship food in.",
    "heat": "Build Thermal Control, or ship heat in.",
    "energy": "Build another Solar Array (or a reactor), or switch work off with standing orders.",
}


def _item(items, level, category, title, detail, action=None, rank=0):
    items.append({"level": level, "category": category, "title": title, "detail": detail, "action": action, "rank": rank})


def _projection(state):
    """Simulate one turn on a copy and return it, or None when the turn cannot advance."""
    result = campaign._advance(deepcopy(state))
    return result["state"] if result["ok"] else None


def advise(state: dict) -> dict:
    items: list[dict] = []
    turn = state["turn"]
    nxt = _projection(state)
    hubs = {h["id"]: h for h in state["hubs"]}
    after = {h["id"]: h for h in nxt["hubs"]} if nxt else {}

    # --- Bases: lost, dark, crew, supplies -------------------------------------------------
    for hub in state["hubs"]:
        name = hub["name"]
        if hub["status"] == "lost":
            _item(items, "warning", "Bases", f"{name} is lost", "Land a new mission at the same site to reopen it with its buildings.", {"type": "plan", "destination": hub["world"], "label": "Plan a rescue landing"}, 1)
            continue
        if hub["status"] == "dark":
            _item(items, "critical", "Bases", f"{name} has gone dark", "Ship at least 20 energy to bring it back online.", {"type": "nav", "tab": "logistics", "label": "Send energy"}, 0)
            continue
        if not hub["tiles"]:
            continue
        if hub["crew"]:
            if hub["health"] < 40:
                _item(items, "critical", "Crew", f"{name}: crew health {hub['health']}%", "At 0% the crew is lost with the base. Fix shortages now and shelter them during hazards.", {"type": "hub", "hub": hub["id"], "label": "Show base"}, 0)
            elif hub["health"] < 70:
                _item(items, "warning", "Crew", f"{name}: crew health {hub['health']}%", "Below 70% hurts your yearly review. Keep food, water, oxygen, heat and energy positive.", {"type": "hub", "hub": hub["id"], "label": "Show base"}, 2)
        projected = after.get(hub["id"])
        if not projected or projected.get("status") != "active":
            continue
        for key in WATCHED:
            if key != "energy" and not hub["crew"]:
                continue
            now, then = hub["stocks"][key], projected["stocks"][key]
            change = then - now
            if change >= 0:
                continue
            left = now // -change
            if left <= 5:
                level = "critical" if left <= 2 else "warning"
                when = "next turn" if left <= 1 else f"in about {left} turns"
                _item(items, level, "Supplies", f"{name}: {key} runs out {when}",
                      f"{now} {key} left, falling by {-change} per turn. {FIX[key]}",
                      {"type": "hub", "hub": hub["id"], "label": "Show base"}, left)

    # --- Hazards and standing orders --------------------------------------------------------
    reacts = any(c["sensor"] in ("hazard", "hazard_next") for rule in state["orders"] for c in rule["when"])
    for forecast in sorted(state["forecasts"], key=lambda f: f["turn"]):
        hub = hubs.get(forecast["hub"])
        if not hub or hub["status"] != "active" or forecast["turn"] < turn:
            continue
        kind, sev = forecast.get("kind", "Hazard"), forecast["severity"]
        where = f"{kind} (severity {sev}) at {hub['name']}"
        if forecast["turn"] == turn:
            text = "It strikes when you end this turn. It is too late to prepare; only standing orders can react."
            level = "critical" if not reacts or sev >= 70 else "warning"
            _item(items, level, "Hazards", f"{where} this turn", text + ("" if reacts else " You have no order that reacts to hazards."),
                  {"type": "nav", "tab": "software", "label": "Edit standing orders"}, 0)
        elif not forecast["prepared"]:
            last = forecast["turn"] == turn + 1
            _item(items, "warning" if last or sev >= 70 else "info", "Hazards",
                  f"{where} on turn {forecast['turn']}" + (" — last chance to prepare" if last else ""),
                  "Preparing halves the damage. It must be ordered at least one turn before the hazard.",
                  {"type": "prepare", "forecast": forecast["id"], "label": "Prepare now"}, 1 if last else 3)
    if not reacts and any(h["crew"] or h["kind"] == "surface" for h in state["hubs"] if h["status"] == "active"):
        _item(items, "warning", "Hazards", "No standing order reacts to hazards",
              "Add an order such as WHEN Hazard severity this turn above 50 THEN Shelter crew / safe mode.",
              {"type": "nav", "tab": "software", "label": "Edit standing orders"}, 4)

    # --- Wear -----------------------------------------------------------------------------
    for hub in state["hubs"]:
        if hub["status"] != "active":
            continue
        worn = [t for t in hub["tiles"] if t["building"] and t["building"].get("condition", 100) < 50]
        if worn:
            worst = min(worn, key=lambda t: t["building"]["condition"])
            offline = sum(t["building"]["condition"] == 0 for t in worn)
            _item(items, "critical" if offline else "warning", "Upkeep",
                  f"{hub['name']}: {len(worn)} building{'s' if len(worn) > 1 else ''} below 50% condition",
                  ("Offline buildings produce nothing. " if offline else "Worn buildings produce half. ") + "Repair costs 10 materials; keep materials for upkeep.",
                  {"type": "tile", "hub": hub["id"], "tile": worst["id"], "label": "Show worst building"}, 3)

    # --- Flight software and missions -----------------------------------------------------
    test = faults.run_tests(state["software"])
    if test["ok"]:
        by_scenario = {r["scenario"]: r for r in test["results"]}
        failing = [w for w, s in ARRIVAL_SCENARIO.items() if not by_scenario[s]["passed"]]
        if failing:
            lost = [w for w in failing if by_scenario[ARRIVAL_SCENARIO[w]]["lost"]]
            names = ", ".join(WORLDS[w]["name"] for w in failing)
            _item(items, "warning", "Flight software", f"Flight software fails the lab test for {names}",
                  ("Spacecraft would be LOST arriving at " + ", ".join(WORLDS[w]["name"] for w in lost) + ". " if lost else "") + "Fix the rules before launching there; spacecraft keep the software they launched with.",
                  {"type": "nav", "tab": "software", "label": "Open Software"}, 2)
    for mission in state["missions"]:
        if mission["status"] == "in_flight" and mission["arrivesAt"] == turn + 1:
            _item(items, "info", "Missions", f"{mission['id']} arrives at {WORLDS[mission['destination']]['name']} next turn",
                  "Its saved flight software will handle the approach. A debrief follows the arrival.", None, 2)
    if not state["missions"]:
        target = "earth" if not any(h["world"] == "earth" for h in state["hubs"]) else "mars"
        _item(items, "opportunity", "Missions", f"Plan your first mission to {WORLDS[target]['name']}",
              "Open the Shipyard, make every launch check green, then launch and advance turns until it arrives.",
              {"type": "plan", "destination": target, "label": "Open Shipyard"}, 2)

    # --- Launch windows (GMAT, Earth departures only) --------------------------------------
    if any(h["world"] == "earth" and h["status"] == "active" for h in state["hubs"]):
        for world in ("mars", "venus"):
            windows = flight.upcoming(world, turn, 8)
            best = min(windows, key=lambda w: w["totalDvKms"])
            wait = best["turn"] - turn
            if wait <= 2:
                when = "now open" if wait == 0 else f"opens in {wait} turn{'s' if wait > 1 else ''} (turn {best['turn']})"
                _item(items, "opportunity", "Launch windows", f"Cheap Earth → {WORLDS[world]['name']} window {when}",
                      f"Lowest total delta-v in the next 8 turns: {best['totalDvKms']} km/s (NASA GMAT data). Missing it can mean a long wait.",
                      {"type": "plan", "destination": world, "label": "Plan mission"}, 2 + wait)

    # --- Goals, review, research, money --------------------------------------------------
    specs = {g["id"]: g for g in GOALS}
    for record in state["goals"]:
        goal = specs[record["id"]]
        left = goal["deadline"] - turn
        if record["status"] == "open" and 0 <= left <= 4:
            _item(items, "warning" if left <= 2 else "info", "Goals", f"Goal due in {left} turn{'s' if left != 1 else ''}: {goal['title']}",
                  f"Completing it pays {goal['reward']} credits; missing it costs you at the yearly review.",
                  {"type": "nav", "tab": "program", "label": "Open Programme"}, 3 + left)
    if turn % REVIEW_EVERY == 0:
        _item(items, "info", "Programme", "The review board meets when you end this turn",
              "Science, arrived missions and completed goals raise your budget; failures, missed goals and lost bases cut it.",
              {"type": "nav", "tab": "program", "label": "Open Programme"}, 4)
    if not state["research"]:
        plans = research.inspect(state)["plans"]
        ready = sorted((t for t, p in plans.items() if p["status"] == "ready"), key=lambda t: RESEARCH[t]["science"])
        if ready:
            _item(items, "opportunity", "Research", f"Research is idle: {RESEARCH[ready[0]]['name']} is affordable",
                  RESEARCH[ready[0]]["description"], {"type": "tech", "tech": ready[0], "label": "Open Tech Tree"}, 4)
        elif research.laboratories(state) == 0:
            _item(items, "info", "Research", "Build a Research Lab",
                  "Labs produce science and are required for advanced technologies.", {"type": "nav", "tab": "system", "label": "Go to the map"}, 6)
    if state["credits"] < 80:
        _item(items, "warning", "Programme", f"Only {state['credits']} credits left",
              f"You earn {state['budget']} per turn. Arrived missions and completed goals pay extra; failed launches waste credits.", None, 3)
    home = next((h for h in state["hubs"] if h["tiles"] and h["status"] == "active"), None)
    if home and home["discovered"] < 3:
        _item(items, "info", "Exploration", "Scan the land around your base",
              "Scans within two sectors of a building are free. They reveal ice, rich ground and science sites.", {"type": "nav", "tab": "system", "label": "Go to the map"}, 5)

    items.sort(key=lambda i: (LEVELS.index(i["level"]), i["rank"]))
    for i in items:
        del i["rank"]
    counts = {level: sum(i["level"] == level for i in items) for level in LEVELS}
    return {"ok": True, "turn": turn, "date": flight.turn_date(turn), "items": items, "counts": counts, "projected": nxt is not None}
