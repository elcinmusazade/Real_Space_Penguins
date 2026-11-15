"""Colony batch production. Quantities are authored game values per turn."""
RECIPES = {
    "propellant": {"input": "water", "amount": 4, "energy": 7, "output": "fuel", "yield": 8,
                   "supplier": "extractor", "supplyName": "water plant or cloud condenser"},
    "machine_shop": {"input": "materials", "amount": 4, "energy": 5, "output": "spares", "yield": 2,
                     "supplier": "drill", "supplyName": "materials drill or atmospheric refinery"},
}
MODES = ("reserve", "run", "pause")
RESERVES = {"energy": 8, "materials": 12, "water": 12}
RESULTS = {
    "made": "Batch completed", "paused": "Paused by player", "orders": "Held by standing orders",
    "storage": "Not enough storage for a batch", "short": "Not enough inputs",
    "reserve": "Protected stock would be spent", "offline": "Facility needs repair",
}
REPAIR_SPARES = 2
CREDITS_PER_SPARE = 4


def flow(kind, adjacent, turn):
    recipe = RECIPES[kind]
    linked = any(b and b["type"] == recipe["supplier"] and b["active"] and b["condition"] > 0
                 and b["onlineFrom"] <= turn for b in adjacent)
    explanation = ("Shared supply line: −2 energy per batch." if linked else
                   f"Place beside an online {recipe['supplyName']} to save 2 energy per batch.")
    return {"inputs": {recipe["input"]: recipe["amount"], "energy": recipe["energy"] - 2 * linked},
            "outputs": {recipe["output"]: recipe["yield"]}, "bonuses": [explanation]}


def batch_result(stock, flow, mode, factor, power_save, capacity):
    """Return one outcome before debiting anything; even a worn batch must fit."""
    if not factor:
        return "offline"
    if mode == "pause":
        return "paused"
    if power_save:
        return "orders"
    if any(stock[k] + round(n * factor) > capacity for k, n in flow["outputs"].items()):
        return "storage"
    if any(stock[k] < n for k, n in flow["inputs"].items()):
        return "short"
    if mode == "reserve" and any(stock[k] - n < RESERVES[k] for k, n in flow["inputs"].items()):
        return "reserve"
    return "made"
