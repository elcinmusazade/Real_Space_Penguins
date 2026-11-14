"""Reachable atmospheric maps, earned platforms and explicit estimated flight data."""
from copy import deepcopy
import unittest
from unittest.mock import patch

from ares import campaign, flight, surface
from ares.campaign_data import ATMOSPHERIC_WORLDS, WORLDS, ROUTES, RESEARCH, HAZARDS, MAP_SIZE, campaign_catalog
from campaign_fixtures import earth_campaign
from test_campaign import act, advance, design, GOOD_SOFTWARE

CORE = campaign.MAP_CORE
OUTER = sorted(ATMOSPHERIC_WORLDS)


def platform(world, **options):
    return design(destination=world, site=WORLDS[world]['sites'][0], payload=['survey', 'shield'], propellant=1200, **options)


class OuterPlanetMapTests(unittest.TestCase):
    def ready(self, seed='OUTER-MAPS'):
        s = act(campaign.create_campaign(seed), 'setSoftware', **GOOD_SOFTWARE)
        s['tech'] = list(RESEARCH)
        return s

    def test_all_planets_have_distinct_seeded_maps_and_catalog_coverage(self):
        s = campaign.create_campaign('MAP-CATALOG')
        before = deepcopy(s)
        catalog = campaign_catalog()
        self.assertEqual(set(catalog['surfacePreviews']), set(WORLDS))
        self.assertEqual(len(WORLDS), 9)  # eight planets and Europa
        self.assertNotIn('sun', WORLDS)
        regions = []
        for world in OUTER:
            with self.subTest(world=world):
                grid = surface.landscape('OUTER', world, 'A')
                self.assertEqual(len(grid), 9216)
                self.assertEqual(grid, surface.landscape('OUTER', world, 'A'))
                self.assertNotEqual(grid, surface.landscape('OTHER', world, 'A'))
                self.assertNotEqual(grid, surface.landscape('OUTER', world, 'B'))
                biomes = {b for b, _ in grid}
                self.assertGreaterEqual(len(biomes), 5)
                self.assertIn('condensate', biomes)
                self.assertTrue(any(surface.BIOMES[b].get('blocked') for b in biomes))
                self.assertEqual(grid[CORE], ('platform', 1))
                self.assertTrue(biomes.isdisjoint({'mountain', 'icefield', 'ocean', 'forest'}))
                regions.append(biomes)
        self.assertEqual(len({frozenset(b) for b in regions}), 4)
        self.assertEqual(s, before, 'reading maps never grants hubs')
        self.assertEqual([h['world'] for h in s['hubs']], ['mars'])

    def test_platforms_require_research_appropriate_payloads_and_unique_sites(self):
        for world in OUTER:
            with self.subTest(world=world):
                s = campaign.create_campaign('GATES')
                q = campaign.mission_quote(s, platform(world))
                self.assertEqual(q['requiredTech'], 'deep_space')
                s['tech'] = list(RESEARCH)
                for payload in (['survey'], ['habitat','shield'], ['survey','shield','habitat']):
                    self.assertFalse(campaign.mission_quote(s, {**platform(world), 'payload':payload})['ok'])
                self.assertFalse(campaign.mission_quote(s, {**platform(world), 'site':'Imaginary landing'})['ok'])
                s = act(s, 'launch', design=platform(world))
                self.assertFalse(campaign.mission_quote(s, platform(world))['ok'], 'an in-flight mission reserves its platform zone')
                self.assertEqual(len(s['hubs']), 1)

    def test_each_platform_is_created_only_on_arrival_then_surveys_and_builds(self):
        for world in OUTER:
            with self.subTest(world=world):
                s = self.ready()
                q = campaign.mission_quote(s, platform(world))
                self.assertEqual(q['outcome'], 'go')
                self.assertTrue(q['affordable'])
                s = act(s, 'launch', design=platform(world))
                self.assertEqual(len(s['hubs']), 1)
                s = advance(s, q['turns']-1)
                self.assertEqual(len(s['hubs']), 1)
                s = advance(s, 1)
                mission = s['missions'][0]
                self.assertEqual(mission['status'], 'complete')
                h = next(h for h in s['hubs'] if h['id'] == mission['result'])
                self.assertEqual(h['world'], world)
                self.assertEqual(h['kind'], 'surface')  # Existing save/action schema reused.
                self.assertFalse(h['crew'])
                self.assertEqual(len(h['tiles']), MAP_SIZE**2)
                self.assertFalse(campaign.mission_quote(s, platform(world))['ok'], 'a deployed zone remains occupied')
                s = act(s, 'explore', hub=h['id'], tile=CORE-2)
                self.assertTrue(s['hubs'][-1]['tiles'][CORE-2]['revealed'])
                plan = campaign.inspect_surface(s, h['id'], CORE+MAP_SIZE)['buildings']['drill']
                self.assertTrue(plan['ok'], plan)
                s = act(s, 'construct', hub=h['id'], tile=CORE+MAP_SIZE, building='drill')
                s = advance(s, plan['turns']+1)
                self.assertEqual(s['hubs'][-1]['tiles'][CORE+MAP_SIZE]['building']['type'], 'drill')
                self.assertEqual(s['hubs'][-1]['status'], 'active')
                s = act(s, 'explore', hub=h['id'], tile=CORE+7*MAP_SIZE)
                eta = s['surveys'][-1]['arrivesAt']-s['turn']
                s = advance(s, eta)
                self.assertTrue(s['hubs'][-1]['tiles'][CORE+7*MAP_SIZE]['revealed'])
                before = deepcopy(s)
                self.assertEqual(campaign.validate(s)['state'], before)

    def test_non_deployment_missions_and_failed_capture_do_not_unlock_cloud_maps(self):
        for objective, propellant in (('survey',1200), ('orbital',3000), ('surface',0)):
            with self.subTest(objective=objective):
                s = self.ready()
                payload = ['survey','shield'] if objective == 'surface' else ['lab','relay']
                d = {**platform('jupiter'), 'objective':objective, 'payload':payload, 'propellantKg':propellant}
                q = campaign.mission_quote(s,d)
                s = act(s,'launch',design=d,confirm=True)
                s = advance(s,q['turns'])
                self.assertFalse(any(h['world']=='jupiter' and h['tiles'] for h in s['hubs']))
                self.assertEqual(s['missions'][0]['outcome'],'flyby' if not propellant else 'nominal')

    def test_outer_transfers_are_labelled_estimates_from_earth_and_every_hub(self):
        for world in OUTER:
            with self.subTest(world=world):
                s = self.ready()
                q = campaign.mission_quote(s, platform(world))
                self.assertEqual(q['transfer']['source'], 'estimate')
                self.assertIsNone(q['arc'])
                self.assertEqual(q['windows'], [])
                self.assertIn('game estimates',q['notice'])
                self.assertIn('fictional',q['notice'])
                self.assertIsNone(flight.transfer('earth',world,'assist',1))
                self.assertEqual(flight.upcoming(world,1),[])
                self.assertGreater(flight.light_minutes(world,1),0)
                s = earth_campaign('EARTH-OUTER')
                s['tech'] = list(RESEARCH)
                d = {**platform(world), 'engine':'ion', 'vehicle':'super_heavy', 'trajectory':'efficient', 'propellantKg':400}
                q = campaign.mission_quote(s,d)
                self.assertTrue(q['ok'],q)
                self.assertEqual(q['outcome'],'go',q['checks'])
                self.assertEqual(q['transfer']['source'],'estimate')
                self.assertEqual({c['id'] for c in q['checks']}, {'mass','dla','dv'})
                self.assertEqual(q['windows'],[])
                for source in WORLDS:
                    if source != world:
                        self.assertTrue((source,world) in ROUTES or (world,source) in ROUTES)
                    self.assertIsNotNone(flight.transfer(source,world,'balanced',1))
        self.assertEqual(flight.transfer('earth','mars','efficient',1)['source'],'gmat')
        self.assertTrue(flight.upcoming('mars',1))

    def test_platform_economy_bootstraps_and_rejects_dangerous_clouds(self):
        for world in OUTER:
            with self.subTest(world=world):
                s = self.ready()
                h = campaign._hub('H2',world,'surface',WORLDS[world]['sites'][0],payload=['survey','shield'])
                s['hubs'].append(h)
                s['nextId'] = 3
                h['stocks'].update(energy=0,materials=100,water=0)
                # Command supply is generated before consuming facilities, even at zero stored power.
                h['tiles'][CORE-MAP_SIZE].update(building=campaign._building('extractor'),terrain='ice')
                s['tech'] = []
                campaign._operate_surface(s,h)
                self.assertEqual(h['stocks']['water'],9)
                self.assertGreaterEqual(h['stocks']['energy'],0)
                self.assertEqual(campaign.inspect_surface(s,'H2',CORE)['facility']['outputs'], {'energy':6})
                tile=h['tiles'][CORE+MAP_SIZE]
                tile.update(biome=next(b for b,_ in surface.landscape(s['seed'],world,h['site']) if surface.BIOMES[b].get('blocked')),terrain='plain')
                p=campaign.inspect_surface(s,'H2',tile['id'])['buildings']['solar']
                self.assertFalse(p['ok'])
                self.assertIn('stable cloud',p['reason'])
                with patch.object(campaign,'_roll',return_value=0):
                    campaign._issue_forecasts(s)
                self.assertEqual(s['forecasts'][0]['kind'],HAZARDS[world]['name'])
                self.assertGreater(s['forecasts'][0]['turn'],s['turn'])
                self.assertTrue(campaign.validate(s)['ok'])
        h['world']='saturn'
        tile.update(biome='golden_cloud',elevation=1)
        ordinary=surface.production(h,tile,'solar')['outputs']['energy']
        tile['biome']='ring_shadow'
        self.assertEqual(surface.production(h,tile,'solar')['outputs']['energy'],ordinary*.5)

    def test_distant_supply_shipments_and_old_save_preservation(self):
        s = self.ready()
        h = campaign._hub('H2','neptune','surface',WORLDS['neptune']['sites'][0],payload=['survey','shield'])
        s['hubs'].append(h);s['nextId']=3
        s = act(s,'shipment',source='H1',target='H2',resource='fuel',amount=20)
        self.assertEqual(s['hubs'][1]['stocks']['fuel'],15)
        shipment=s['shipments'][-1]
        self.assertGreater(shipment['arrivesAt']-s['turn'],5)
        s=advance(s,shipment['arrivesAt']-s['turn'])
        self.assertEqual(s['shipments'][-1]['status'],'delivered')
        self.assertEqual(s['hubs'][1]['stocks']['fuel'],35)
        legacy=earth_campaign('PRE-OUTER')
        before=deepcopy(legacy)
        self.assertEqual(campaign.validate(legacy)['state'],before)
        self.assertEqual(legacy,before)
