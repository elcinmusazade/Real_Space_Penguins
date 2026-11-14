"""Authoritative technology prerequisites, field evidence and equipment unlocks."""
from .campaign_data import RESEARCH, TECH_UNLOCKS, WORLDS


def laboratories(state):
    return sum(1 for h in state["hubs"] if h.get("status", "active") == "active"
               for t in h["tiles"] if t["building"] and t["building"]["type"] == "laboratory"
               and t["building"]["active"] and t["building"]["condition"] > 0
               and t["building"]["onlineFrom"] <= state["turn"])


def plan(state, tech, labs=None):
    if not isinstance(tech, str) or tech not in RESEARCH:
        return {"ok": False, "reason": "Unknown technology."}
    spec = RESEARCH[tech]
    requirements = [{"tech": r, "label": RESEARCH[r]["name"], "met": r in state["tech"]} for r in spec["requires"]]
    if spec.get("labs"):
        count = laboratories(state) if labs is None else labs
        requirements.append({"label": f"{spec['labs']} online research lab(s) ({count} ready)", "met": count >= spec["labs"]})
    if spec.get("discoveries"):
        count = sum(h["discovered"] for h in state["hubs"])
        requirements.append({"label": f"Survey {spec['discoveries']} new sectors ({count} discovered)", "met": count >= spec["discoveries"]})
    if spec.get("world"):
        requirements.append({"label": f"Complete a mission reaching {WORLDS[spec['world']]['name']}", "met": spec["world"] in state["visitedWorlds"] and any(m["destination"] == spec["world"] and m["status"] == "complete" for m in state["missions"])})
    missing = [r["label"] for r in requirements if not r["met"]]
    complete = tech in state["tech"]
    active = bool(state["research"] and state["research"]["id"] == tech)
    shortage = []
    if state["science"] < spec["science"]:
        shortage.append(f"{spec['science']-state['science']} more science")
    if state["credits"] < spec["credits"]:
        shortage.append(f"{spec['credits']-state['credits']} more credits")
    reason = ("Already researched." if complete else "Research in progress." if active else
              "Requires: " + "; ".join(missing) + "." if missing else
              "Finish the current research project first." if state["research"] else
              "Need " + " and ".join(shortage) + "." if shortage else "")
    status = "complete" if complete else "active" if active else "locked" if missing else "waiting" if state["research"] else "funding" if shortage else "ready"
    return {"ok": not reason, "status": status, "reason": reason, "requirements": requirements,
            "science": spec["science"], "credits": spec["credits"], "turns": spec["turns"]}


def inspect(state):
    labs = laboratories(state)
    return {"ok": True, "laboratories": labs, "plans": {tech: plan(state, tech, labs) for tech in RESEARCH}}


def locked(state, category, item):
    tech = TECH_UNLOCKS.get(category, {}).get(item)
    return tech if tech and tech not in state["tech"] else None
