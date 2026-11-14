"""HTTP tests use a temporary loopback port and require no third-party packages."""

from http.server import ThreadingHTTPServer
import json
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from ares.server import GameHandler
from ares import campaign
from ares.campaign_data import MAP_SIZE


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), GameHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=2)

    def request(self, path, data=None):
        payload = json.dumps(data).encode("utf-8") if data is not None else None
        request = Request(self.url + path, data=payload, headers={"Content-Type": "application/json"} if data is not None else {})
        try:
            with urlopen(request, timeout=10) as response:
                return response.status, response.headers.get_content_type(), response.read()
        except HTTPError as error:
            return error.code, error.headers.get_content_type(), error.read()

    def test_serves_campaign_and_preserves_classic_game(self):
        status, mime, html = self.request("/")
        self.assertEqual((status, mime), (200, "text/html"))
        self.assertIn(b"campaign.js", html)
        self.assertIn(b"map-game.css", html)
        status, mime, js = self.request("/campaign.js")
        self.assertEqual((status, mime), (200, "text/javascript"))
        self.assertIn(b"/api/campaign/quote", js)
        status, mime, css = self.request("/campaign.css")
        self.assertEqual((status, mime), (200, "text/css"))
        self.assertIn(b".terrain-map", css)
        for path, expected_type in (("/campaign-save.js", "text/javascript"),("/planet-map.js", "text/javascript"),("/map-ui.js", "text/javascript"),("/map-game.css", "text/css"),("/solar-system.js", "text/javascript"),("/solar-system.css", "text/css"),("/tutorial.js", "text/javascript"),("/tutorial.css", "text/css")):
            code, kind, body = self.request(path)
            self.assertEqual((code,kind),(200,expected_type))
            self.assertGreater(len(body),100)
        status, mime, classic = self.request("/classic.html")
        self.assertEqual((status, mime), (200, "text/html"))
        self.assertIn(b"app.js", classic)
        status, mime, js = self.request("/app.js")
        self.assertEqual((status, mime), (200, "text/javascript"))
        self.assertIn(b"./bridge.js", js)

    def test_surface_inspection_endpoint_reports_costs_without_changing_save(self):
        state = json.loads(self.request("/api/campaign/new", {"seed":"COAST"})[2])["state"]
        before = json.dumps(state, sort_keys=True)
        status, _, raw = self.request("/api/campaign/inspect", {"state":state, "hub":"H1", "tile":campaign.MAP_CORE+1})
        self.assertEqual(status,200)
        plan = json.loads(raw)
        self.assertTrue(plan["ok"])
        self.assertEqual(plan["buildings"]["recycler"]["inputs"], {"energy":4,"water":2})
        self.assertEqual(plan["buildings"]["recycler"]["materials"],22)
        self.assertEqual(json.dumps(state, sort_keys=True),before)
        status, _, raw = self.request("/api/campaign/inspect", {"state":state, "hub":"H1", "tile":[]})
        self.assertEqual(status,200)
        self.assertFalse(json.loads(raw)["ok"])

    def test_research_endpoint_assets_and_authoritative_start(self):
        for path, mime in (("/tech-tree.js", "text/javascript"), ("/tech-tree.css", "text/css")):
            status, kind, body = self.request(path)
            self.assertEqual((status, kind), (200, mime))
            self.assertGreater(len(body), 100)
        state = campaign.create_campaign("HTTP-RESEARCH")
        before = json.dumps(state, sort_keys=True)
        status, _, raw = self.request("/api/campaign/research", {"state":state})
        self.assertEqual(status, 200)
        plans = json.loads(raw)["plans"]
        self.assertEqual(len(plans), 16)
        self.assertTrue(plans["surveying"]["ok"])
        self.assertFalse(plans["fission"]["ok"])
        self.assertEqual(json.dumps(state, sort_keys=True), before)
        status, _, raw = self.request("/api/campaign/action", {"state":state,"action":"research","args":{"tech":"fission"}})
        self.assertEqual(status, 200)
        self.assertFalse(json.loads(raw)["ok"])
        self.assertEqual(json.loads(raw)["state"], state)
        status, _, raw = self.request("/api/campaign/action", {"state":state,"action":"research","args":{"tech":"surveying"}})
        active = json.loads(raw)["state"]
        status, _, raw = self.request("/api/campaign/research", {"state":active})
        self.assertEqual(json.loads(raw)["plans"]["surveying"]["status"], "active")
        state["science"] = -1
        self.assertEqual(self.request("/api/campaign/research", {"state":state})[0], 400)

    def test_health_uses_python_engine(self):
        status, _, raw = self.request("/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw)["engine"], "python")
        self.assertTrue(json.loads(raw)["campaign"])

    def test_large_multi_hub_save_crosses_the_old_request_limit(self):
        state = campaign.create_campaign("LARGE-HTTP")
        for i, world in enumerate(("earth", "venus", "mercury", "europa"), 2):
            state["hubs"].append(campaign._hub(f"H{i}",world,"surface","Test site",seed=state["seed"]))
        self.assertGreater(len(json.dumps({"state":state},separators=(",", ":")).encode()),4_000_000)
        status, _, raw = self.request("/api/campaign/action", {"state":state,"action":"advance","args":{}})
        self.assertEqual(status,200)
        result = json.loads(raw)
        self.assertTrue(result["ok"],result)
        self.assertEqual(len(result["state"]["hubs"]),5)
        self.assertTrue(all(len(h["tiles"]) == MAP_SIZE**2 for h in result["state"]["hubs"]))

    def test_campaign_launch_and_transit_over_http(self):
        status, _, raw = self.request("/api/campaign/catalog")
        self.assertEqual(status, 200)
        catalog = json.loads(raw)["catalog"]
        self.assertEqual(set(catalog["worlds"]), {"earth", "mars", "venus", "mercury", "europa", "jupiter", "saturn", "uranus", "neptune"})
        self.assertEqual(set(catalog["surfacePreviews"]), set(catalog["worlds"]))
        self.assertTrue(all(len(tiles) == MAP_SIZE**2 for tiles in catalog["surfacePreviews"].values()))
        self.assertEqual(json.loads(raw)["catalog"]["mapSize"],MAP_SIZE)
        status, _, raw = self.request("/api/campaign/new", {"seed": "HTTP-V2"})
        self.assertEqual(status, 200)
        state = json.loads(raw)["state"]
        self.assertEqual(state["turn"], 1)
        self.assertEqual([h["world"] for h in state["hubs"]],["mars"])
        self.assertEqual(state["visitedWorlds"],[])
        design = {
            "source": "H1", "destination": "earth", "objective": "surface",
            "site": "Cape Canaveral", "hull": "lander", "engine": "chemical",
            "trajectory": "balanced", "payload": ["rover", "lab", "shield"],
            "vehicle": "heavy", "propellantKg": 200,
        }
        status, _, raw = self.request("/api/campaign/quote", {"state": state, "design": design})
        self.assertEqual(status, 200)
        quote = json.loads(raw)
        self.assertTrue(quote["ok"])
        self.assertTrue(quote["affordable"])
        self.assertEqual(quote["outcome"], "go")
        self.assertEqual(quote["transfer"]["source"], "estimate")
        status, _, raw = self.request("/api/campaign/action", {"state": state, "action": "launch", "args": {"design": design}})
        self.assertEqual(status, 200)
        result = json.loads(raw)
        self.assertTrue(result["ok"])
        state = result["state"]
        self.assertEqual(len(state["missions"]), 1)
        self.assertEqual(state["missions"][0]["status"], "in_flight")
        for _ in range(quote["turns"]):
            status, _, raw = self.request("/api/campaign/action", {"state": state, "action": "advance", "args": {}})
            self.assertEqual(status, 200)
            state = json.loads(raw)["state"]
        self.assertIn("earth", state["visitedWorlds"])
        self.assertTrue(any(h["world"] == "earth" and h["kind"] == "surface" for h in state["hubs"]))
        status, _, raw = self.request("/api/campaign/validate", {"state": state})
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(raw)["ok"])

    def test_flight_software_test_endpoint(self):
        status, _, raw = self.request("/api/campaign/faults/test", {"design": {"computer": "standard", "rules": []}})
        self.assertEqual(status, 200)
        result = json.loads(raw)
        self.assertTrue(result["ok"])
        self.assertEqual(len(result["results"]), 4)
        status, _, _ = self.request("/api/campaign/faults/test", {"design": {"computer": "quantum", "rules": []}})
        self.assertEqual(status, 400)
        status, _, raw = self.request("/api/campaign/catalog")
        catalog = json.loads(raw)["catalog"]
        for key in ("vehicles", "physics", "faults", "orders", "goals", "hazards"):
            self.assertIn(key, catalog)

    def test_campaign_rejects_bad_design_and_invalid_save(self):
        state = json.loads(self.request("/api/campaign/new", {"seed": "HTTP-INVALID"})[2])["state"]
        status, _, raw = self.request("/api/campaign/quote", {"state": state, "design": {"destination": [], "payload": [{"x": 1}]}})
        self.assertEqual(status, 200)
        self.assertFalse(json.loads(raw)["ok"])
        state["hubs"][0]["stocks"]["fuel"] = -100
        status, _, raw = self.request("/api/campaign/validate", {"state": state})
        self.assertEqual(status, 400)
        self.assertFalse(json.loads(raw)["ok"])

    def test_create_scan_and_validate_game(self):
        status, _, raw = self.request("/api/new", {"seed": "PY-TEST", "loadout": ["supplies", "materials", "battery"]})
        self.assertEqual(status, 200)
        state = json.loads(raw)["state"]
        self.assertEqual(state["seed"], "PY-TEST")
        status, _, raw = self.request("/api/action", {"state": state, "action": "explore", "args": [12]})
        self.assertEqual(status, 200)
        result = json.loads(raw)
        self.assertTrue(result["ok"])
        self.assertTrue(result["state"]["tiles"][12]["revealed"])
        status, _, raw = self.request("/api/validate", {"state": result["state"]})
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(raw)["ok"])

    def test_rejects_invalid_actions_and_saves(self):
        state = json.loads(self.request("/api/new", {"seed": "SECURITY"})[2])["state"]
        status, _, raw = self.request("/api/action", {"state": state, "action": "__import__", "args": []})
        self.assertEqual(status, 200)
        self.assertFalse(json.loads(raw)["ok"])
        state["tiles"][0]["id"] = 999
        status, _, raw = self.request("/api/action", {"state": state, "action": "advanceSol", "args": []})
        self.assertEqual(status, 400)
        self.assertFalse(json.loads(raw)["ok"])

    def test_outer_platform_quote_arrival_and_inspection_over_http(self):
        from test_campaign import GOOD_SOFTWARE
        state = campaign.execute(campaign.create_campaign("HTTP-OUTER"), "setSoftware", GOOD_SOFTWARE)["state"]
        design = {"source":"H1", "destination":"jupiter", "site":"Equatorial Cloud Belt", "objective":"surface",
                  "hull":"lander", "engine":"chemical", "trajectory":"balanced", "payload":["survey","shield"], "propellantKg":1200}
        status, _, raw = self.request("/api/campaign/quote", {"state":state,"design":design})
        self.assertEqual(status,200)
        self.assertEqual(json.loads(raw)["requiredTech"],"deep_space")
        state["tech"] = ["deep_space"]
        status, _, raw = self.request("/api/campaign/quote", {"state":state,"design":design})
        quote = json.loads(raw)
        self.assertEqual(quote["outcome"],"go")
        self.assertEqual(quote["transfer"]["source"],"estimate")
        status, _, raw = self.request("/api/campaign/action", {"state":state,"action":"launch","args":{"design":design}})
        state = json.loads(raw)["state"]
        self.assertEqual(len(state["hubs"]),1)
        for _ in range(quote["turns"]):
            status, _, raw = self.request("/api/campaign/action", {"state":state,"action":"advance","args":{}})
            self.assertEqual(status,200)
            result = json.loads(raw)
            self.assertTrue(result["ok"],result)
            state = result["state"]
        platform = next(h for h in state["hubs"] if h["world"] == "jupiter")
        status, _, raw = self.request("/api/campaign/inspect", {"state":state,"hub":platform["id"],"tile":campaign.MAP_CORE})
        self.assertEqual(status,200)
        self.assertEqual(json.loads(raw)["facility"]["outputs"],{"energy":6})

    def test_rejects_over_budget_and_unknown_files(self):
        status, _, _ = self.request("/api/new", {"seed": "X", "loadout": ["supplies", "materials", "battery", "instruments"]})
        self.assertEqual(status, 400)
        status, _, _ = self.request("/not-an-asset.js")
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
