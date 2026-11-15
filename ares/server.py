"""Dependency-free HTTP server for the Python-powered browser edition.

Run: python -m ares.server
Open: http://127.0.0.1:8000
"""

from __future__ import annotations

import argparse
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

from . import __version__
from . import advice, engine, campaign, faults, research, ship
from .campaign_data import ARRIVAL_SCENARIO, PAYLOADS, PLANET_DANGERS
from .campaign_data import WORLDS, campaign_catalog


WEB = Path(__file__).resolve().parent.parent / "web"
STATIC_TYPES = {
    "index.html": "text/html; charset=utf-8",
    "classic.html": "text/html; charset=utf-8",
    "app.js": "text/javascript; charset=utf-8",
    "tech-tree.js": "text/javascript; charset=utf-8",
    "tech-tree.css": "text/css; charset=utf-8",
    "campaign-save.js": "text/javascript; charset=utf-8",
    "campaign.js": "text/javascript; charset=utf-8",
    "campaign.css": "text/css; charset=utf-8",
    "map-game.css": "text/css; charset=utf-8",
    "music/credits.txt": "text/plain; charset=utf-8",
    "planet-music.js": "text/javascript; charset=utf-8",
    **{f"music/{world}.mp3": "audio/mpeg" for world in WORLDS},
    "planet-map.js": "text/javascript; charset=utf-8",
    "map-ui.js": "text/javascript; charset=utf-8",
    "solar-system.js": "text/javascript; charset=utf-8",
    "solar-system.css": "text/css; charset=utf-8",
    "program-ui.js": "text/javascript; charset=utf-8",
    "rule-editor.js": "text/javascript; charset=utf-8",
    "flight-view.js": "text/javascript; charset=utf-8",
    "program.css": "text/css; charset=utf-8",
    "tutorial.js": "text/javascript; charset=utf-8",
    "tutorial.css": "text/css; charset=utf-8",
    "advisor.js": "text/javascript; charset=utf-8",
    "advisor.css": "text/css; charset=utf-8",
    "ship-view.js": "text/javascript; charset=utf-8",
    "shipyard.css": "text/css; charset=utf-8",
    "bridge.js": "text/javascript; charset=utf-8",
    "engine-view.js": "text/javascript; charset=utf-8",
    "art.js": "text/javascript; charset=utf-8",
    "science.js": "text/javascript; charset=utf-8",
    "styles.css": "text/css; charset=utf-8",
}
MAX_BODY = 4_000_000
MAX_CAMPAIGN_BODY = 96_000_000  # Multi-hub 96×96 saves; Classic keeps its smaller limit.


class GameHandler(BaseHTTPRequestHandler):
    server_version = f"AresPython/{__version__}"

    def _respond(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, data: dict, status: int = HTTPStatus.OK) -> None:
        self._respond(status, json.dumps(data, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8"), "application/json; charset=utf-8")

    def do_GET(self) -> None:
        path = urlsplit(self.path).path
        if path == "/api/health":
            self._json({"ok": True, "engine": "python", "version": __version__, "campaign": True})
            return
        if path == "/api/campaign/catalog":
            self._json({"ok": True, "catalog": campaign_catalog()})
            return
        name = "index.html" if path == "/" else path.lstrip("/")
        if name not in STATIC_TYPES:
            self.send_error(HTTPStatus.NOT_FOUND, "Not found")
            return
        self._respond(HTTPStatus.OK, (WEB / name).read_bytes(), STATIC_TYPES[name])

    def do_POST(self) -> None:
        path = urlsplit(self.path).path
        if path not in ("/api/new", "/api/action", "/api/validate", "/api/campaign/new", "/api/campaign/quote", "/api/campaign/action", "/api/campaign/validate", "/api/campaign/faults/test", "/api/campaign/inspect", "/api/campaign/research", "/api/campaign/advice"):
            self._json({"ok": False, "error": "Unknown endpoint."}, HTTPStatus.NOT_FOUND)
            return
        if self.headers.get("Content-Type", "").split(";")[0].strip().lower() != "application/json":
            self._json({"ok": False, "error": "Expected application/json."}, HTTPStatus.UNSUPPORTED_MEDIA_TYPE)
            return
        try:
            size = int(self.headers.get("Content-Length", ""))
        except (ValueError, TypeError):
            self._json({"ok": False, "error": "A request length is required."}, HTTPStatus.LENGTH_REQUIRED)
            return
        if not 0 < size <= (MAX_CAMPAIGN_BODY if path.startswith("/api/campaign/") else MAX_BODY):
            self._json({"ok": False, "error": "Request too large or empty."}, HTTPStatus.REQUEST_ENTITY_TOO_LARGE)
            return
        try:
            payload = json.loads(self.rfile.read(size))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json({"ok": False, "error": "Invalid JSON."}, HTTPStatus.BAD_REQUEST)
            return
        if not isinstance(payload, dict):
            self._json({"ok": False, "error": "Expected a JSON object."}, HTTPStatus.BAD_REQUEST)
            return
        if path == "/api/campaign/faults/test":
            world = payload.get("world")
            plan = payload.get("ship") if isinstance(payload.get("ship"), dict) else None
            if world is not None and world not in ARRIVAL_SCENARIO:
                self._json({"ok": False, "error": "Unknown destination."}, HTTPStatus.BAD_REQUEST)
                return
            profile = None
            if world and plan is not None:
                parts, error = ship.validate_parts(plan.get("parts"))
                payload_list = plan.get("payload") if isinstance(plan.get("payload"), list) else []
                objective = plan.get("objective") if plan.get("objective") in ("surface", "orbital", "survey") else "surface"
                if error or any(p not in PAYLOADS for p in payload_list):
                    self._json({"ok": False, "error": error or "Unknown payload."}, HTTPStatus.BAD_REQUEST)
                    return
                profile = ship.sim_profile({"parts": parts, "payload": payload_list}, world, objective)
            result = faults.run_tests(payload.get("design"), PLANET_DANGERS[world] if world else None, profile)
            self._json(result, HTTPStatus.OK if result["ok"] else HTTPStatus.BAD_REQUEST)
            return
        if path.startswith("/api/campaign/"):
            if path == "/api/campaign/new":
                try:
                    state = campaign.create_campaign(payload.get("seed", "HORIZON-01"))
                except (ValueError, TypeError) as exc:
                    self._json({"ok": False, "error": str(exc)}, HTTPStatus.BAD_REQUEST)
                    return
                self._json({"ok": True, "state": state})
                return
            checked = campaign.validate(payload.get("state"))
            if not checked["ok"]:
                self._json(checked, HTTPStatus.BAD_REQUEST)
                return
            if path == "/api/campaign/validate":
                self._json(checked)
                return
            if path == "/api/campaign/advice":
                self._json(advice.advise(checked["state"]))
                return
            if path == "/api/campaign/research":
                self._json(research.inspect(checked["state"]))
                return
            if path == "/api/campaign/inspect":
                self._json(campaign.inspect_surface(checked["state"], payload.get("hub"), payload.get("tile")))
                return
            if path == "/api/campaign/quote":
                self._json(campaign.mission_quote(checked["state"], payload.get("design")))
                return
            command = payload.get("action")
            if not isinstance(command, str):
                self._json({"ok": False, "error": "Invalid campaign action."}, HTTPStatus.BAD_REQUEST)
                return
            self._json(campaign.execute(checked["state"], command, payload.get("args", {})))
            return
        if path == "/api/new":
            seed, loadout = payload.get("seed", "ARES-01"), payload.get("loadout", list(engine.DEFAULT_LOADOUT))
            if not isinstance(seed, str):
                self._json({"ok": False, "error": "Invalid mission seed."}, HTTPStatus.BAD_REQUEST)
                return
            try:
                state = engine.create_game(seed, loadout)
            except (ValueError, TypeError) as exc:
                self._json({"ok": False, "error": str(exc)}, HTTPStatus.BAD_REQUEST)
                return
            self._json({"ok": True, "state": state})
            return
        checked = engine.validate_save(payload.get("state"))
        if not checked["ok"]:
            self._json({"ok": False, "error": checked["error"]}, HTTPStatus.BAD_REQUEST)
            return
        if path == "/api/validate":
            self._json(checked)
            return
        action, args = payload.get("action"), payload.get("args", [])
        if not isinstance(action, str):
            self._json({"ok": False, "error": "Invalid action name."}, HTTPStatus.BAD_REQUEST)
            return
        self._json(engine.execute_action(action, checked["state"], args))


def main() -> None:
    parser = argparse.ArgumentParser(description="Ares: First Light Python web game")
    parser.add_argument("--host", default=os.getenv("HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("PORT", "8000")))
    parser.add_argument("--strictPort", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args()
    with ThreadingHTTPServer((args.host, args.port), GameHandler) as server:
        print(f"Ares Python is running at http://{args.host}:{args.port}/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nMission server stopped.", flush=True)


if __name__ == "__main__":
    main()
