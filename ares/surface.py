"""Seeded, fictional landscapes and shared surface-economy rules.

Biomes/elevation are visible in orbital imagery. Deposits remain hidden until
surveyed. These are game maps, not measurements of actual landing sites.
"""
from functools import lru_cache
from hashlib import sha256
from math import sin, floor

from .campaign_data import ATMOSPHERIC_WORLDS, MAP_SIZE

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
    "platform": {"name": "Stable platform zone", "color": "#9badb9"},
    "jovian_belt": {"name": "Amber cloud belt", "color": "#b67d56", "materials": 2},
    "jovian_zone": {"name": "Cream cloud deck", "color": "#e2c3a0"},
    "red_vortex": {"name": "Red storm vortex", "color": "#a84632", "blocked": True},
    "golden_cloud": {"name": "Golden cloud deck", "color": "#d3b96f", "materials": 2},
    "ring_shadow": {"name": "Ring-shadow belt", "color": "#786c69", "siteCost": 4},
    "polar_current": {"name": "Polar jet stream", "color": "#9b8465", "blocked": True},
    "cyan_cloud": {"name": "Cyan cloud deck", "color": "#8dcfca", "materials": 2},
    "cold_haze": {"name": "Cold haze layer", "color": "#b3e1da", "siteCost": 4},
    "shear": {"name": "Turbulent current", "color": "#4d959f", "blocked": True},
    "blue_cloud": {"name": "Deep-blue cloud deck", "color": "#3866a6", "materials": 2},
    "bright_plume": {"name": "Bright cloud plume", "color": "#99c5e2", "siteCost": 4},
    "dark_vortex": {"name": "Dark wind vortex", "color": "#243b73", "blocked": True},
    "condensate": {"name": "Condensate cloud", "color": "#d5dfda"},
}
WATER = {"ocean", "water"}


def _cloud_layer(world, x, y, n, m, phase):
    """Fictional operating regions, not measured atmospheric geography."""
    band = sin(y * .38 + sin(x * .10 + phase) * 1.4 + phase)
    # Seeded, repeating broad vortices retain variety across the large region.
    dx = (x + phase * 4) % 38 - 19
    dy = (y + phase * 3) % 30 - 15
    vortex = (dx / 8) ** 2 + (dy / 4.8) ** 2 < 1
    if world == "jupiter":
        biome = "red_vortex" if vortex else "jovian_belt" if band > .1 else "jovian_zone"
    elif world == "saturn":
        shadow = abs((x + y * .55 + phase) % 27 - 13) < 3.5
        biome = "polar_current" if band > .91 else "ring_shadow" if shadow else "golden_cloud"
    elif world == "uranus":
        biome = "shear" if band > .93 else "cold_haze" if n > .5 else "cyan_cloud"
    else:
        biome = "dark_vortex" if vortex else "bright_plume" if band > .68 else "blue_cloud"
    if not BIOMES[biome].get("blocked") and m > .74:
        biome = "condensate"
    return biome, 0 if BIOMES[biome].get("blocked") else 2 if biome in ("bright_plume", "cold_haze", "jovian_zone", "condensate") else 1


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
    # Extend the original 32×32 geography around its center, without rescaling it.
    offset = MAP_SIZE // 2 - 16
    for row in range(MAP_SIZE):
        for column in range(MAP_SIZE):
            x, y = column - offset, row - offset
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
            elif world in ATMOSPHERIC_WORLDS:
                biome, elevation = _cloud_layer(world, x, y, n, m, phase)
            elif world == "europa":
                biome = "fissure" if abs(x-10-sin(y*.22+phase)*4) < .6 else "chaos" if n > .57 else "icefield"
                elevation = 2 if biome == "chaos" else 0 if biome == "fissure" else 1
            else:
                raise ValueError(f"No map configured for {world}")
            # A connected, fair foothold for all starts and legacy resource sites.
            if abs(x-16) <= 2 and abs(y-16) <= 2:
                biome, elevation = ("platform" if world in ATMOSPHERIC_WORLDS else "settlement"), 1
            result.append((biome, elevation))
    return tuple(result)


def enrich(tiles, seed, world, site):
    for tile, (biome, elevation) in zip(tiles, landscape(seed, world, site)):
        # Old construction is preserved even if the new geography would block it.
        if tile.get("building") and BIOMES[biome].get("blocked"):
            biome, elevation = ("platform" if world in ATMOSPHERIC_WORLDS else "settlement"), 1
        tile.update(biome=biome, elevation=elevation)


def neighbors(tile_id):
    x, y = tile_id % MAP_SIZE, tile_id // MAP_SIZE
    return [ny*MAP_SIZE+nx for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)) if 0 <= nx < MAP_SIZE and 0 <= ny < MAP_SIZE]


def coastal(hub, tile):
    return hub["world"] == "earth" and any(hub["tiles"][i].get("biome") in WATER for i in neighbors(tile["id"]))


def production(hub, tile, kind, tech=()):
    """Nominal inputs/outputs used by both turn resolution and the inspector."""
    spec = BIOMES.get(tile.get("biome"), {})
    atmosphere = hub["world"] in ATMOSPHERIC_WORLDS
    inputs, outputs, reasons = {}, {}, []
    if kind == "solar":
        outputs["energy"] = 12 * {"venus": .45, "mercury": 1.6, "europa": .27, "jupiter": .20, "saturn": .12, "uranus": .06, "neptune": .04}.get(hub["world"], 1)
        if tile.get("elevation", 1) >= 3 and not atmosphere:
            outputs["energy"] += 3
            reasons.append("High ground: +3 energy")
        if tile.get("biome") == "shadow":
            outputs["energy"] *= .25
            reasons.append("Deep shadow: 75% less solar power")
        if tile.get("biome") == "ring_shadow":
            outputs["energy"] *= .5
            reasons.append("Ring shadow: 50% less solar power")
        if atmosphere:
            reasons.append("Weak outer-system sunlight (game yield); expand power before running many facilities")
    elif kind == "command" and atmosphere:
        outputs = {"energy": 6}
        reasons.append("Platform radioisotope supply: +6 energy per turn (game estimate); maintenance and condition still apply")
    elif kind == "reactor":
        inputs, outputs = {"water": 2, "materials": 2}, {"energy": 28}
        reasons.append("Steady power: independent of sunlight; reserves consumed before other facilities")
    elif kind == "extractor":
        inputs, outputs = {"energy": 4}, {"water": 9}
        if atmosphere:
            reasons.append("Cloud condenser processes surveyed condensate (fictional game yield)")
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
            reasons.append(f"{'Rich aerosols' if atmosphere else 'Rich geology'}: +{bonus} materials")
        if atmosphere:
            reasons.append("Atmospheric refinery: converts collected aerosols into construction supplies (fictional game technology)")
    elif kind in ("shield", "habitat"):
        inputs = {"energy": 2}
    if kind == "solar" and "solar_cells" in tech:
        outputs["energy"] *= 1.35
        reasons.append("Advanced Photovoltaics: +35% solar output")
    if kind == "drill" and "refining" in tech:
        outputs["materials"] += 2
        inputs["energy"] -= 1
        reasons.append("Resource Refining: +2 materials, −1 energy")
    if kind == "laboratory" and "analysis" in tech:
        outputs["science"] += 4
        reasons.append("Planetary Analytics: +4 science")
    if kind == "greenhouse" and "agriculture" in tech:
        outputs["food"] += 4
        inputs["water"] -= 1
        reasons.append("Controlled Agriculture: +4 food, −1 water")
    if kind in ("extractor", "recycler") and "biosphere" in tech:
        outputs = {k: v*1.5 for k, v in outputs.items()}
        reasons.append("Integrated Biospheres: +50% water/oxygen output")
    return {"inputs": inputs, "outputs": outputs, "bonuses": reasons}
