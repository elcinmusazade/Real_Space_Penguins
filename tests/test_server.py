"""HTTP tests use a temporary loopback port and require no third-party packages."""

from http.server import ThreadingHTTPServer
import json
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from ares.server import GameHandler


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
            with urlopen(request, timeout=2) as response:
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
        for path, expected_type in (("/planet-map.js", "text/javascript"),("/map-ui.js", "text/javascript"),("/map-game.css", "text/css")):
            code, kind, body = self.request(path)
            self.assertEqual((code,kind),(200,expected_type))
            self.assertGreater(len(body),100)
        status, mime, classic = self.request("/classic.html")
        self.assertEqual((status, mime), (200, "text/html"))
        self.assertIn(b"app.js", classic)
        status, mime, js = self.request("/app.js")
        self.assertEqual((status, mime), (200, "text/javascript"))
        self.assertIn(b"./bridge.js", js)

    def test_health_uses_python_engine(self):
        status, _, raw = self.request("/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw)["engine"], "python")
        self.assertTrue(json.loads(raw)["campaign"])

    def test_campaign_launch_and_transit_over_http(self):
        status, _, raw = self.request("/api/campaign/catalog")
        self.assertEqual(status, 200)
        self.assertIn("europa", json.loads(raw)["catalog"]["worlds"])
        self.assertEqual(json.loads(raw)["catalog"]["mapSize"],32)
        status, _, raw = self.request("/api/campaign/new", {"seed": "HTTP-V2"})
        self.assertEqual(status, 200)
        state = json.loads(raw)["state"]
        self.assertEqual(state["turn"], 1)
        design = {
            "source": "H1", "destination": "venus", "objective": "surface",
            "site": "Ishtar Terra", "hull": "lander", "engine": "chemical",
            "trajectory": "balanced", "payload": ["rover", "lab", "shield"],
            "vehicle": "heavy", "propellantKg": 200,
        }
        status, _, raw = self.request("/api/campaign/quote", {"state": state, "design": design})
        self.assertEqual(status, 200)
        quote = json.loads(raw)
        self.assertTrue(quote["ok"])
        self.assertTrue(quote["affordable"])
        self.assertEqual(quote["outcome"], "go")
        self.assertEqual(quote["transfer"]["source"], "gmat")
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
        self.assertIn("venus", state["visitedWorlds"])
        self.assertTrue(any(h["world"] == "venus" and h["kind"] == "surface" for h in state["hubs"]))
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

    def test_rejects_over_budget_and_unknown_files(self):
        status, _, _ = self.request("/api/new", {"seed": "X", "loadout": ["supplies", "materials", "battery", "instruments"]})
        self.assertEqual(status, 400)
        status, _, _ = self.request("/not-an-asset.js")
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
