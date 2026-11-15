"""Explicit historical Earth-start scenarios for compatibility and regression tests."""
from ares import campaign


def earth_campaign(seed):
    state = campaign.create_campaign(seed)
    state['hubs'] = [campaign._hub('H1', 'earth', 'control', 'Earth HQ', seed=seed)]
    state['colonizedPlanets'] = ['earth']
    state['log'][0]['message'] = 'Earth Mission Control online (historical save).'
    return state


def established_campaign(seed):
    state = earth_campaign(seed)
    state['hubs'].append(campaign._hub('H2', 'mars', 'surface', 'Arcadia Planitia', starter=True, seed=seed))
    state['colonizedPlanets'] = ['earth', 'mars']
    state['visitedWorlds'] = ['mars']
    state['nextId'] = 3
    return state
