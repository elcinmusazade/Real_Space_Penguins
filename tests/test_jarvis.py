"""Check campaign grounding and Gemini transport without consuming API quota."""
from copy import deepcopy
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import Mock, patch

from ares import campaign, jarvis


class JarvisTests(TestCase):
    def setUp(self):
        self.state = campaign.create_campaign("JARVIS-TEST")

    def test_briefing_follows_campaign_without_modifying_or_exposing_map(self):
        before = deepcopy(self.state)
        view = {"tab": "system", "world": "mars", "hub": "H1", "tile": 0, "building": "drill"}
        brief = jarvis.briefing(self.state, view, "What should I build?")
        self.assertEqual(self.state, before)
        self.assertEqual(brief["selected_sector"], {"id": 0, "revealed": False})
        self.assertNotIn("selected_construction", brief)
        self.assertNotIn("tiles", brief["hubs"][0])
        self.assertEqual(brief["hubs"][0]["facilities"], {"solar": 1, "command": 1})
        self.state["credits"] = 91
        self.state["hubs"][0]["stocks"]["water"] = 26
        view.update(tile=campaign.MAP_CORE + 1, building="greenhouse")
        after = jarvis.briefing(self.state, view, "Can I build here?")
        self.assertEqual(after["credits"], 91)
        self.assertEqual(after["hubs"][0]["stocks"]["water"], 26)
        self.assertEqual(after["selected_construction"]["materials"], 18)
        self.assertNotIn("selected_sector", jarvis.briefing(self.state, {**view, "world": "earth"}, "hello"))

    @patch("ares.jarvis._generate", return_value={"kind":"answer", "text":"You have 390 credits."})
    def test_history_and_active_lesson_reach_the_model(self, generate):
        history = [{"role": "user", "content": "What is my budget?"}, {"role": "assistant", "content": "12 per turn."}]
        out = jarvis.answer(self.state, {"question": "And my credits?", "history": history,
                                          "view": {"tutorial": "Step 29: Add the hurricane rule"}})
        self.assertEqual(out, {"reply": "You have 390 credits.", "turn": 1, "ok": True})
        messages = generate.call_args.args[0]
        self.assertEqual(messages[1:3], history)
        self.assertIn("Step 29", messages[-1]["content"])
        self.assertIn('"credits":390', messages[-1]["content"])
        for invalid in ({"question": " "}, {"question": "a" * 601}, {"question": "hi", "history": [{"role": "system", "content": "x"}]}):
            with self.assertRaises(jarvis.JarvisError) as caught:
                jarvis.answer(self.state, invalid)
            self.assertEqual(caught.exception.status, 400)
        generate.assert_called_once()

    @patch("ares.jarvis._generate", return_value={"kind": "campaign_readout", "text": ""})
    def test_campaign_readout_uses_current_turn_after_a_followup(self, generate):
        self.state.update(turn=2, credits=402)
        out = jarvis.answer(self.state, {"question": "And now?",
                           "history": [{"role": "assistant", "content": "Turn 1, 390 credits."}]})
        self.assertIn("Turn 2", out["reply"])
        self.assertIn("402 credits", out["reply"])
        self.assertIn("1 hub · Mars", out["reply"])

    def test_private_key_setup_and_missing_key_avoid_network(self):
        with TemporaryDirectory() as tmp, patch.object(jarvis, "KEY_FILE", Path(tmp) / "game" / "key"), patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            with patch.object(jarvis, "HTTPSConnection") as connect, self.assertRaisesRegex(jarvis.JarvisError, "--setup"):
                jarvis.answer(self.state, {"question": "Where am I?"})
            connect.assert_not_called()
            jarvis._save_key("first-test-key")
            self.assertEqual(jarvis._api_key(), "first-test-key")
            self.assertEqual(jarvis.KEY_FILE.stat().st_mode & 0o777, 0o600)
            jarvis._save_key("replacement-test-key")
            self.assertEqual(jarvis._api_key(), "replacement-test-key")
            with patch.dict(os.environ, {"GEMINI_API_KEY": "environment-test-key"}):
                self.assertEqual(jarvis._api_key(), "environment-test-key")
            with self.assertRaises(ValueError):
                jarvis._save_key("invalid key")

    @patch.dict(os.environ, {"GEMINI_API_KEY": "example-only"})
    @patch("ares.jarvis.HTTPSConnection")
    def test_gemini_request_and_followup(self, connect):
        connection = connect.return_value
        result = {"candidates": [{"content": {"parts": [{"thought": True, "text": "internal"},
                  {"text": json.dumps({"kind": "campaign_readout", "text": ""})}]}}]}
        connection.getresponse.return_value = Mock(status=200, read=Mock(return_value=json.dumps(result).encode()))
        history = [{"role": "user", "content": "Where is my base?"}, {"role": "assistant", "content": "Mars."}]
        reply = jarvis.answer(self.state, {"question": "How many credits now?", "history": history})
        self.assertIn("390 credits", reply["reply"])
        method, path, raw, headers = connection.request.call_args.args
        self.assertEqual((method, path), ("POST", "/v1beta/models/gemini-3.1-flash-lite:generateContent"))
        self.assertEqual(connect.call_args.args[0], "generativelanguage.googleapis.com")
        self.assertEqual(headers["x-goog-api-key"], "example-only")
        self.assertNotIn(b"example-only", raw)
        request = json.loads(raw)
        self.assertIn("JARVIS", request["systemInstruction"]["parts"][0]["text"])
        self.assertEqual([c["role"] for c in request["contents"]], ["user", "model", "user"])
        self.assertNotIn('"tiles"', request["contents"][-1]["parts"][0]["text"])
        self.assertEqual(request["generationConfig"]["responseMimeType"], "application/json")
        connection.close.assert_called_once()

    @patch.dict(os.environ, {"GEMINI_API_KEY": "example-only"})
    @patch("ares.jarvis.HTTPSConnection")
    def test_provider_errors_handle_quota_invalid_keys_and_empty_answers(self, connect):
        cases = [(429, b"", 429), (403, b"", 503), (400, b"API_KEY_INVALID", 503),
                 (503, b"", 502), (200, b'{"candidates":[]}', 502), (200, b"{}", 502), (200, b"invalid", 502)]
        for status, raw, expected in cases:
            with self.subTest(status=status, raw=raw):
                connection = connect.return_value
                connection.getresponse.return_value = Mock(status=status, read=Mock(return_value=raw))
                with self.assertRaises(jarvis.JarvisError) as caught:
                    jarvis._generate([{"role": "system", "content": "Test"}])
                self.assertEqual(caught.exception.status, expected)
                self.assertNotIn("example-only", str(caught.exception))
