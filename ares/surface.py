"""Seeded, fictional landscapes and shared surface-economy rules.

Biomes/elevation are visible in orbital imagery. Deposits remain hidden until
surveyed. These are game maps, not measurements of actual landing sites.
"""
from functools import lru_cache
from hashlib import sha256
from math import sin, floor

from .campaign_data import MAP_SIZE

BIOMES = {
    "settlement": {"name": "Landing plain", "color": "#9d956c"},
    "ocean": {"name": "Open sea", "color": "#125673", "blocked": True},
    "water": {"name": "Fresh water", "color": "#318eaa", "blocked": True},
    "beach": {"name": "Sandy coast", "color": "#cfb77c"},
    "grassland": {"name": "Fertile grassland", "color": "#799653", "food": 3},
    "forest": {"name": "Forest", "color": "#416e49", "siteCost": 4},
    "wetland": {"name": "Wetland", "color": "#5c8f7b", "siteCost": 4, "food": 2},
    "mountain": {"name": "Mountain ridge", "color": "#9a9986", "siteCost": 6, "materials": 3},
    "dunes": {"name": "Dune field", "color": "#c38753"},
    "basin": {"name": "Dry basin", "color": "#966951"},
    "mesa": {"name": "Rocky plateau", "color": "#a95f49", "siteCost": 6, "materials": 3},
    "frost": {"name": "Frost field", "color": "#aac6c7"},
    "basalt": {"name": "Basalt plain", "color": "#665861", "materials": 2},
    "sulfur": {"name": "Sulfur plain", "color": "#b4a063"},
    "lava": {"name": "Volcanic fissure", "color": "#833b30", "blocked": True},
    "crater": {"name": "Crater floor", "color": "#797d85"},
    "highland": {"name": "Crater rim", "color": "#aa9f96", "siteCost": 6, "materials": 3},
    "shadow": {"name": "Shadowed depression", "color": "#434e66"},
    "icefield": {"name": "Ice sheet", "color": "#acd3df"},
    "chaos": {"name": "Broken ice ridges", "color": "#7296ac", "siteCost": 6},
    "fissure": {"name": "Ice fissure", "color": "#326276", "blocked": True},
}
WATER = {"ocean", "water"}


def _noise(x, y, salt):
    def value(a, b):
        return int.from_bytes(sha256(f"{salt}:{a}:{b}".encode()).digest()[:4], "big") / 2**32
    ix, iy = floor(x), floor(y)
    fx, fy = x - ix, y - iy
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    return (value(ix, iy) * (1-fx) + value(ix+1, iy) * fx) * (1-fy) + (value(ix, iy+1) * (1-fx) + value(ix+1, iy+1) * fx) * fy


@lru_cache(maxsize=96)
def landscape(seed, world, site):
    """Immutable cached cells; callers copy metadata into independently saved tiles."""
    salt = f"{seed}:{world}:{site}"
    phase = _noise(0, 0, salt) * 6
    result = []
    for y in range(MAP_SIZE):
        for x in range(MAP_SIZE):
            n = _noise(x/5, y/5, salt)
            m = _noise(x/3, y/3, salt+'detail')
            elevation = 1
            if world == "earth":
                coast = 10 + sin(y*.3+phase)*2 + sin(y*.65)*.7
                river = 21 - y*.24 + sin(y*.32+phase)*1.6
                lake = ((x-25)/3.2)**2 + ((y-25)/2.7)**2 < 1
                if x < coast-1:
                    biome, elevation = "ocean", 0
                elif lake or (y > 2 and abs(x-river) < .65):
                    biome, elevation = "water", 0
                elif x < coast+.7:
                    biome = "beach"
                elif n > .72:
                    biome, elevation = "mountain", 3
                elif n > .49 and m > .35:
                    biome, elevation = "forest", 2
                elif abs(x-river) < 1.6:
                    biome = "wetland"
                else:
                    biome = "grassland"
            elif world == "mars":
                biome = "mesa" if n > .63 else "frost" if n < .27 else "dunes" if m > .48 else "basin"
                elevation = 3 if biome == "mesa" else 0 if biome == "basin" else 1
            elif world == "venus":
                biome = "lava" if abs(x-8-sin(y*.28+phase)*3) < .55 else "mesa" if n > .68 else "sulfur" if n < .36 else "basalt"
                elevation = 3 if biome == "mesa" else 0 if biome == "lava" else 1
            elif world == "mercury":
                radius = ((x-9)**2+(y-11)**2)**.5
                biome = "highland" if 5 < radius < 7 or n > .67 else "shadow" if n < .28 else "crater"
                elevation = 3 if biome == "highland" else 0 if biome == "shadow" else 1
            else:
                biome = "fissure" if abs(x-10-sin(y*.22+phase)*4) < .6 else "chaos" if n > .57 else "icefield"
                elevation = 2 if biome == "chaos" else 0 if biome == "fissure" else 1
            # A connected, fair foothold for all starts and legacy resource sites.
            if abs(x-MAP_SIZE//2) <= 2 and abs(y-MAP_SIZE//2) <= 2:
                biome, elevation = "settlement", 1
            result.append((biome, elevation))
    return tuple(result)


def enrich(tiles, seed, world, site):
    for tile, (biome, elevation) in zip(tiles, landscape(seed, world, site)):
        # Old construction is preserved even if the new geography would block it.
        if tile.get("building") and BIOMES[biome].get("blocked"):
            biome, elevation = "settlement", 1
        tile.update(biome=biome, elevation=elevation)


def neighbors(tile_id):
    x, y = tile_id % MAP_SIZE, tile_id // MAP_SIZE
    return [ny*MAP_SIZE+nx for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)) if 0 <= nx < MAP_SIZE and 0 <= ny < MAP_SIZE]


def coastal(hub, tile):
    return hub["world"] == "earth" and any(hub["tiles"][i].get("biome") in WATER for i in neighbors(tile["id"]))


def production(hub, tile, kind):
    """Nominal inputs/outputs used by both turn resolution and the inspector."""
    spec = BIOMES.get(tile.get("biome"), {})
    inputs, outputs, reasons = {}, {}, []
    if kind == "solar":
        outputs["energy"] = 12 * {"venus": .45, "mercury": 1.6, "europa": .27}.get(hub["world"], 1)
        if tile.get("elevation", 1) >= 3:
            outputs["energy"] += 3
            reasons.append("High ground: +3 energy")
        if tile.get("biome") == "shadow":
            outputs["energy"] *= .25
            reasons.append("Deep shadow: 75% less solar power")
    elif kind == "extractor":
        inputs, outputs = {"energy": 4}, {"water": 9}
        if coastal(hub, tile) and tile["terrain"] != "ice":
            inputs["energy"], outputs["water"] = 6, 12
            reasons.append("Coastal intake: +3 water, +2 energy cost")
    elif kind == "greenhouse":
        inputs, outputs = {"energy": 3, "water": 3}, {"food": 8 + spec.get("food", 0)}
        if spec.get("food"):
            reasons.append(f"Fertile soil: +{spec['food']} food")
    elif kind == "recycler":
        inputs, outputs = {"energy": 4, "water": 2}, {"oxygen": 6}
        reasons.append("Water → oxygen for crew life support")
    elif kind == "laboratory":
        bonus = 2 if tile["terrain"] == "science" else 0
        inputs, outputs = {"energy": 4}, {"science": 6 + bonus + 2*any(c["assigned"] == "science" for c in hub["crew"])}
        if bonus:
            reasons.append("Discovered anomaly: +2 science")
    elif kind == "heater":
        inputs, outputs = {"energy": 3}, {"heat": 9}
    elif kind == "drill":
        bonus = max(spec.get("materials", 0), 3 if tile["terrain"] == "ridge" else 0)
        inputs, outputs = {"energy": 4}, {"materials": 6 + bonus + 2*any(c["assigned"] == "engineering" for c in hub["crew"])}
        if bonus:
            reasons.append(f"Rich geology: +{bonus} materials")
    elif kind in ("shield", "habitat"):
        inputs = {"energy": 2}
    return {"inputs": inputs, "outputs": outputs, "bonuses": reasons}
