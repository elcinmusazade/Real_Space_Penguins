"""Test complete batches, local accounting and the link between factories and flight."""
from copy import deepcopy
import unittest

from ares import campaign, ship
from ares.campaign_data import MAP_SIZE
from test_campaign import design, act, advance
from campaign_fixtures import earth_campaign

CORE = campaign.MAP_CORE


class ColonyIndustryTests(unittest.TestCase):
    def setUp(self):
        self.s = campaign.create_campaign("INDUSTRY")
        self.h = self.s["hubs"][0]
        self.s["orders"] = []

    def test_build_supply_line_from_survey_to_first_exportable_fuel(self):
        # Free local scan finds ice a tile beyond the starting solar array.
        s = act(self.s, "explore", hub="H1", tile=CORE-2)
        s = act(s, "construct", hub="H1", tile=CORE-2, building="extractor")
        site = CORE-2-MAP_SIZE
        s = act(s, "explore", hub="H1", tile=site)
        # The supplier is adjacent but still being built; the saving comes online next turn.
        plan = campaign.inspect_surface(s, "H1", site)["buildings"]["propellant"]
        self.assertEqual(plan["inputs"], {"water":4, "energy":7})
        self.assertTrue(plan["ok"],plan)
        s = act(s, "construct", hub="H1", tile=site, building="propellant")
        s = advance(s,2)
        h = s["hubs"][0]
        self.assertNotIn("lastBatch",h["tiles"][site]["building"])
        self.assertEqual(campaign.inspect_surface(s,"H1",site)["facility"]["inputs"],{"energy":5,"water":4})
        s = advance(s,1); h=s["hubs"][0]
        self.assertEqual(h["lastBalance"]["fuel"],20)  # HQ +12 and plant +8
        self.assertEqual(h["lastBalance"]["water"],5)  # extract 9, spend 4
        self.assertEqual(h["tiles"][site]["building"]["lastBatch"],"made")
        self.assertTrue(campaign.validate(s)["ok"])

    def test_industrial_limits_pause_and_standing_orders_do_not_spend_partial_inputs(self):
        self.h["tiles"][CORE+1]["building"] = campaign._building("propellant")
        stock = self.h["stocks"]; stock.update(energy=100,water=15,fuel=0)
        plant = self.h["tiles"][CORE+1]["building"]
        def run(result):
            water,fuel=stock["water"],stock["fuel"]
            campaign._operate_surface(self.s,self.h)
            self.assertEqual(plant["lastBatch"],result)
            self.assertEqual(stock["water"]-water,-4 if result=="made" else 0)
            self.assertEqual(stock["fuel"]-fuel,8 if result=="made" else 0)
        run("reserve")
        plant["mode"]="run";run("made")
        plant["mode"]="pause";run("paused")
        plant["mode"]="run";stock["fuel"]=399;run("storage")
        stock["fuel"]=0;stock["water"]=3;run("short")
        stock["water"]=30
        self.s["orders"]=[{"when":[{"sensor":"energy","op":">","value":0}],"then":"power_save"}]
        run("orders")
        self.s["orders"]=[];plant["condition"]=0;run("offline")

    def test_machine_shop_uses_same_turn_drill_output_and_repairs_locally(self):
        shop = CORE+1
        h=self.h; h["tiles"][shop]["building"]=campaign._building("machine_shop")
        h["tiles"][shop+1]["building"]=campaign._building("drill")
        h["stocks"].update(materials=0,energy=50);h["tiles"][CORE-1]["building"]["condition"]=40
        self.s=act(self.s,"factoryMode",hub="H1",tile=shop,mode="run")
        h=self.s["hubs"][0]
        self.assertEqual(campaign.inspect_surface(self.s,"H1",shop)["facility"]["inputs"],{"materials":4,"energy":3})
        campaign._operate_surface(self.s,h)
        self.assertEqual(h["stocks"]["spares"],2)
        mats=h["stocks"]["materials"]
        s=act(self.s,"repair",hub="H1",tile=CORE-1,resource="spares")
        self.assertEqual(s["hubs"][0]["stocks"]["materials"],mats)
        self.assertEqual(s["hubs"][0]["stocks"]["spares"],0)
        self.assertEqual(s["hubs"][0]["tiles"][CORE-1]["building"]["condition"],100)
        self.assertFalse(campaign.execute(s,"factoryMode",{"hub":"H1","tile":CORE,"mode":"run"})["ok"])

    def test_local_spares_are_optional_and_cannot_change_flight_physics(self):
        d={**design(destination="earth",site="Cape Canaveral",propellant=600),"parts":ship.DEFAULT_PARTS}
        self.h["stocks"]["spares"]=100
        regular=campaign.mission_quote(self.s,d)
        fitted=campaign.mission_quote(self.s,{**d,"useLocalSpares":True})
        self.assertEqual(regular["spares"],0)
        self.assertGreater(fitted["spares"],0)
        self.assertLessEqual(fitted["creditSavings"],ship.totals(ship.DEFAULT_PARTS)["credits"])
        self.assertEqual(regular["credits"]-fitted["credits"],fitted["spares"]*4)
        self.assertEqual(regular["numbers"],fitted["numbers"])
        self.assertEqual(regular["fuel"],fitted["fuel"])
        self.assertEqual(regular["fit"],fitted["fit"])
        self.assertEqual(regular["outcome"],"go")
        s=act(self.s,"launch",design={**d,"useLocalSpares":True})
        self.assertEqual(s["hubs"][0]["stocks"]["spares"],100-fitted["spares"])
        self.assertEqual(self.s["credits"]-s["credits"],fitted["credits"])
        self.assertFalse(campaign.mission_quote(s,{**d,"useLocalSpares":"yes"})["ok"])

    def test_scrub_returns_local_hardware_but_not_credits(self):
        s=earth_campaign("SCRUB-SPARES");s["hubs"][0]["stocks"]["spares"]=3
        for turn in range(1,81):
            s["turn"]=turn
            d={**design(trajectory="efficient"),"parts":ship.DEFAULT_PARTS,"useLocalSpares":True}
            q=campaign.mission_quote(s,d)
            if q["ok"] and q["affordable"] and q["outcome"]=="scrub":break
        self.assertEqual(q["outcome"],"scrub")
        self.assertGreater(q["spares"],0)
        after=act(s,"launch",design=d,confirm=True)
        self.assertEqual(s["hubs"][0]["stocks"],after["hubs"][0]["stocks"])
        self.assertEqual(s["credits"]-after["credits"],q["credits"])

    def test_spares_arrive_by_shipment_not_by_shared_inventory(self):
        self.s["hubs"].append(campaign._hub("H2","earth","surface","Pacific Coast"))
        self.s["nextId"]=3;self.h["stocks"]["spares"]=8
        s=act(self.s,"shipment",source="H1",target="H2",resource="spares",amount=4)
        self.assertEqual([h["stocks"]["spares"] for h in s["hubs"]],[4,0])
        s=advance(s,s["shipments"][0]["arrivesAt"]-s["turn"])
        self.assertEqual([h["stocks"]["spares"] for h in s["hubs"]],[4,4])
        self.assertEqual(s["hubs"][1]["lastBalance"]["spares"],0)

    def test_old_saves_migrate_without_changing_caller_and_bad_modes_rejected(self):
        del self.h["stocks"]["spares"]
        before=deepcopy(self.s)
        checked=campaign.validate(self.s)
        self.assertTrue(checked["ok"])
        self.assertEqual(self.s,before)
        self.assertEqual(checked["state"]["hubs"][0]["stocks"]["spares"],0)
        self.h["tiles"][CORE+1]["building"]={**campaign._building("machine_shop"),"mode":"unlimited"}
        self.assertFalse(campaign.validate(self.s)["ok"])
