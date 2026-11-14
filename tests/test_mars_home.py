"""Mars headquarters, earned Earth access and sustainable travel in both directions."""
from copy import deepcopy
import unittest

from ares import campaign, flight, research
from ares.campaign_data import WORLDS, RESEARCH
from test_campaign import act, advance, design, GOOD_SOFTWARE

CORE = campaign.MAP_CORE


def earth_lander(**overrides):
    return design(destination='earth', site='Cape Canaveral', payload=['survey','lab'], propellant=600, **overrides)


class MarsHomeTests(unittest.TestCase):
    def setUp(self):
        self.state = campaign.create_campaign('MARS-HOME')

    def arrived(self):
        s = act(self.state, 'setSoftware', **GOOD_SOFTWARE)
        q = campaign.mission_quote(s, earth_lander())
        s = act(s, 'launch', design=earth_lander())
        return advance(s, q['turns'])

    def test_mars_headquarters_is_playable_and_funds_expansion_without_earth(self):
        s = self.state
        h = s['hubs'][0]
        self.assertEqual((h['world'], h['kind'], h['site']), ('mars','control','Mars HQ'))
        self.assertEqual(h['tiles'][CORE]['building']['type'], 'command')
        self.assertEqual(len(h['tiles']), 9216)
        s = act(s,'explore',hub='H1',tile=CORE-2)
        s = act(s,'construct',hub='H1',tile=CORE+1,building='laboratory')
        before = deepcopy(s['hubs'][0]['stocks'])
        credits, science = s['credits'], s['science']
        s = advance(s, 3)
        self.assertEqual(s['credits'], credits+3*s['budget'])
        self.assertEqual(s['hubs'][0]['stocks']['fuel'], before['fuel']+36)
        self.assertGreater(s['hubs'][0]['stocks']['materials'], before['materials'])
        self.assertGreater(s['science'], science)
        self.assertEqual([h['world'] for h in s['hubs']], ['mars'])
        self.assertEqual(s['hubs'][0]['status'], 'active')
        self.assertFalse(s['forecasts'], 'headquarters retains its protected command role')
        self.assertEqual(campaign.validate(s)['state'], s)

    def test_earth_requires_paid_flight_and_surface_arrival(self):
        s = self.state
        before = deepcopy(s)
        q = campaign.mission_quote(s, earth_lander())
        self.assertTrue(q['ok'])
        self.assertTrue(q['affordable'])
        self.assertEqual(q['outcome'], 'go')
        self.assertEqual(q['turns'], 3)
        self.assertEqual(q['transfer']['source'], 'estimate')
        self.assertEqual(q['windows'], [])
        self.assertIsNone(q['transfer']['c3'])
        self.assertFalse(campaign.inspect_surface(s, 'earth', CORE)['ok'])
        self.assertFalse(campaign.execute(s,'construct',{'hub':'H2','tile':CORE+1,'building':'solar'})['ok'])
        s = act(s, 'launch', design=earth_lander())
        self.assertEqual(self.state, before)
        self.assertEqual(s['credits'], before['credits']-q['credits'])
        self.assertEqual(s['hubs'][0]['stocks']['fuel'], before['hubs'][0]['stocks']['fuel']-q['fuel'])
        self.assertEqual(s['hubs'][0]['stocks']['materials'], before['hubs'][0]['stocks']['materials']-q['materials'])
        s = advance(s,q['turns']-1)
        self.assertEqual(len(s['hubs']),1)
        s = advance(s,1)
        earth = next(h for h in s['hubs'] if h['world']=='earth')
        self.assertEqual((earth['kind'],earth['site']),('surface','Cape Canaveral'))
        self.assertEqual(earth['stocks']['materials'],24, 'landing gets an outpost inventory, not the old free HQ stockpile')
        self.assertEqual(earth['stocks']['fuel'],15)
        self.assertEqual(len(earth['tiles']),9216)
        self.assertTrue(campaign.validate(s)['ok'])
        s = act(s,'explore',hub=earth['id'],tile=CORE-2)
        s = act(s,'construct',hub=earth['id'],tile=CORE-2,building='extractor')
        s = advance(s,2)
        self.assertTrue(campaign.inspect_surface(s,earth['id'],CORE-2)['facility']['outputs']['water'])
        self.assertFalse(any(f['hub']==earth['id'] for f in s['forecasts']))

    def test_flyby_and_science_missions_do_not_unlock_an_earth_base(self):
        for objective, propellant, expected in (('surface',0,'flyby'), ('survey',100,'go')):
            with self.subTest(objective=objective):
                d = earth_lander()
                d.update(objective=objective, propellantKg=propellant)
                s = act(self.state,'setSoftware',**GOOD_SOFTWARE)
                q = campaign.mission_quote(s,d)
                self.assertEqual(q['outcome'],expected)
                s = act(s,'launch',design=d,confirm=True)
                s = advance(s,q['turns'])
                self.assertTrue(all(h['world']!='earth' for h in s['hubs']))
                self.assertIn('earth',s['visitedWorlds'], 'remote knowledge alone cannot grant build access')

    def test_earth_orbital_station_does_not_grant_surface_access(self):
        d = design(destination='earth',site='',objective='orbital',hull='scout',payload=['relay'],propellant=2200)
        s = act(self.state,'setSoftware',**GOOD_SOFTWARE)
        q = campaign.mission_quote(s,d)
        self.assertEqual(q['outcome'],'go')
        s = act(s,'launch',design=d)
        s = advance(s,q['turns'])
        earth = next(h for h in s['hubs'] if h['world']=='earth')
        self.assertEqual(earth['kind'],'orbital')
        self.assertEqual(earth['tiles'],[])
        self.assertFalse(campaign.inspect_surface(s,earth['id'],CORE)['ok'])
        self.assertTrue(campaign.validate(advance(s,2))['ok'])

    def test_earth_sites_reservations_and_unsupported_self_departure(self):
        s = act(self.state,'launch',design=earth_lander())
        self.assertIn('already deploying',campaign.mission_quote(s,earth_lander())['error'])
        s = advance(s,3)
        self.assertIn('already has',campaign.mission_quote(s,earth_lander())['error'])
        other = earth_lander()
        other['site'] = WORLDS['earth']['sites'][1]
        self.assertTrue(campaign.mission_quote(s,other)['ok'])
        earth = next(h for h in s['hubs'] if h['world']=='earth')
        other['source'] = earth['id']
        self.assertIn('another world',campaign.mission_quote(s,other)['error'])
        self.assertFalse(campaign.execute(s,'launch',{'design':other})['ok'])
        self.assertIsNone(flight.transfer('earth','earth','balanced',s['turn']))

    def test_shipments_supply_earth_and_enable_a_return_mission(self):
        s = self.arrived()
        earth = next(h for h in s['hubs'] if h['world']=='earth')
        eid = earth['id']
        start_fuel = earth['stocks']['fuel']
        s = act(s,'shipment',source='H1',target=eid,resource='fuel',amount=80)
        s = act(s,'shipment',source='H1',target=eid,resource='materials',amount=80)
        self.assertEqual(next(h for h in s['hubs'] if h['id']==eid)['stocks']['fuel'],start_fuel)
        eta = max(x['arrivesAt'] for x in s['shipments'])-s['turn']
        s = advance(s,eta)
        self.assertEqual(next(h for h in s['hubs'] if h['id']==eid)['stocks']['fuel'],start_fuel+80)
        self.assertTrue(s['routes'])
        back = design(source=eid,site='Jezero Rim',payload=['survey'],propellant=500,vehicle='heavy')
        for _ in range(12):
            q = campaign.mission_quote(s,back)
            self.assertTrue(q['ok'],q)
            self.assertEqual(q['transfer']['source'],'gmat')
            if q['outcome']=='go' and q['affordable']:
                break
            s = advance(s,1)
        self.assertEqual(q['outcome'],'go')
        self.assertTrue(q['affordable'])
        s = act(s,'launch',design=back)
        s = advance(s,q['turns'])
        self.assertTrue(any(h['world']=='mars' and h['site']=='Jezero Rim' for h in s['hubs']))
        self.assertEqual(s['hubs'][0]['name'],'Mars Mission Control')
        self.assertTrue(campaign.validate(s)['ok'])

    def test_headquarters_counts_as_surface_but_not_mission_experience(self):
        s = self.state
        s['tech'] = ['ion_drive','thermal']
        s['science'] = s['credits'] = 500
        for offset in (1,-campaign.MAP_SIZE):
            s['hubs'][0]['tiles'][CORE+offset]['building'] = campaign._building('laboratory')
        s['visitedWorlds'] = ['mars']
        self.assertFalse(research.plan(s,'deep_space')['ok'])
        goal={'kind':'surface_count','world':'mars','value':2}
        self.assertFalse(campaign._goal_met(s,goal))
        s['hubs'].append(campaign._hub('H2','mars','surface','Jezero Rim',seed=s['seed']))
        self.assertTrue(campaign._goal_met(s,goal))
        s['missions']=[{'destination':'mars','status':'complete'}]
        self.assertTrue(research.plan(s,'deep_space')['ok'])
