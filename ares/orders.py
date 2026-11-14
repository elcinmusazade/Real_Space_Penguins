"""Player-written standing orders for surface bases.

Each order is WHEN <condition> [AND <condition>] THEN <response>. Orders are
checked every turn, top to bottom; each response fires at most once per turn.
Standing orders act inside the turn, before Earth could react: they are how a
base survives a hazard that strikes faster than the ground team's planning cycle.
"""

from __future__ import annotations

from .campaign_data import ORDER_RESPONSES, ORDER_SENSORS, ORDER_SLOTS, ORDER_SLOTS_AUTONOMY

MAX_CONDITIONS = 2


def slots(tech: list[str]) -> int:
    return ORDER_SLOTS + (ORDER_SLOTS_AUTONOMY if "autonomy" in tech else 0)


def _number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value == value


def validate(rules: object, tech: list[str]) -> dict:
    if not isinstance(rules, list):
        return {"ok": False, "error": "Standing orders must be a list."}
    limit = slots(tech)
    if len(rules) > limit:
        return {"ok": False, "error": f"Bases can hold {limit} standing orders. Research Autonomous Operations for more."}
    clean = []
    for index, rule in enumerate(rules, start=1):
        where = f"Order {index}"
        if not isinstance(rule, dict):
            return {"ok": False, "error": f"{where}: must be an object."}
        conditions = rule.get("when")
        if not isinstance(conditions, list) or not 1 <= len(conditions) <= MAX_CONDITIONS:
            return {"ok": False, "error": f"{where}: needs 1-{MAX_CONDITIONS} conditions."}
        checked = []
        for cond in conditions:
            if not isinstance(cond, dict) or cond.get("sensor") not in ORDER_SENSORS:
                return {"ok": False, "error": f"{where}: unknown sensor."}
            spec = ORDER_SENSORS[cond["sensor"]]
            if cond.get("op") not in ("<", ">"):
                return {"ok": False, "error": f"{where}: use < or >."}
            if not _number(cond.get("value")) or not spec["min"] <= cond["value"] <= spec["max"]:
                return {"ok": False, "error": f"{where}: {spec['name']} threshold must be {spec['min']}-{spec['max']}."}
            checked.append({"sensor": cond["sensor"], "op": cond["op"], "value": round(cond["value"])})
        if rule.get("then") not in ORDER_RESPONSES:
            return {"ok": False, "error": f"{where}: unknown response."}
        clean.append({"when": checked, "then": rule["then"]})
    return {"ok": True, "rules": clean}


def describe(rule: dict) -> str:
    parts = [f"{ORDER_SENSORS[c['sensor']]['name']} {c['op']} {c['value']}{ORDER_SENSORS[c['sensor']]['unit']}" for c in rule["when"]]
    return f"WHEN {' AND '.join(parts)} THEN {ORDER_RESPONSES[rule['then']]['name']}"


def evaluate(rules: list[dict], sensors: dict) -> list[tuple[int, str]]:
    """Return (rule index, response) for every order that fires this turn."""
    fired, used = [], set()
    for index, rule in enumerate(rules):
        if rule["then"] in used:
            continue
        if all((sensors[c["sensor"]] < c["value"]) if c["op"] == "<" else (sensors[c["sensor"]] > c["value"]) for c in rule["when"]):
            fired.append((index, rule["then"]))
            used.add(rule["then"])
    return fired
