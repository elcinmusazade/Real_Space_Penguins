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

    def test_serves_html_and_python_bridge(self):
        status, mime, html = self.request("/")
        self.assertEqual((status, mime), (200, "text/html"))
        self.assertIn(b"app.js", html)
        status, mime, js = self.request("/app.js")
        self.assertEqual((status, mime), (200, "text/javascript"))
        self.assertIn(b"./bridge.js", js)

    def test_health_uses_python_engine(self):
        status, _, raw = self.request("/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(raw)["engine"], "python")

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


    def test_fault_lab_catalog_and_test_run(self):
        status, _, raw = self.request("/api/faults/catalog")
        self.assertEqual(status, 200)
        catalog = json.loads(raw)["catalog"]
        self.assertIn("safe_mode", catalog["responses"])
        status, _, raw = self.request("/api/faults/test", {"design": catalog["example"]})
        self.assertEqual(status, 200)
        result = json.loads(raw)
        self.assertTrue(result["ok"])
        self.assertEqual(len(result["results"]), len(catalog["scenarios"]))
        status, _, raw = self.request("/api/faults/test", {"design": {"computer": "basic", "rules": [{"when": [], "then": "safe_mode"}]}})
        self.assertEqual(status, 400)
        status, mime, _ = self.request("/faults.html")
        self.assertEqual((status, mime), (200, "text/html"))


if __name__ == "__main__":
    unittest.main()
