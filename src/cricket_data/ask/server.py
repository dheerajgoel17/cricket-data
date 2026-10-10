"""A small HTTP endpoint so any chat UI (or script) can ask the bot.

    POST /ask   {"question": "...", "history": [{"role": "user", "content": "..."}, ...]}
    ->          {"answer": "...", "queries": [...], "seconds": 3.2}
    GET  /health

Binds to localhost by default. Set CRICKET_BOT_TOKEN to require ``Authorization: Bearer <token>``
(do this before exposing it: every question spends API credit).
"""
from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .bot import CricketBot

MAX_BODY = 64 * 1024


def make_handler(bot: CricketBot, token: str | None, allow_origin: str | None):
    class Handler(BaseHTTPRequestHandler):
        def _send(self, code: int, body: dict) -> None:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            if allow_origin:
                self.send_header("Access-Control-Allow-Origin", allow_origin)
            self.end_headers()
            self.wfile.write(data)

        def do_OPTIONS(self):  # CORS preflight for browser chat UIs
            self.send_response(204)
            if allow_origin:
                self.send_header("Access-Control-Allow-Origin", allow_origin)
                self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
                self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
            self.end_headers()

        def do_GET(self):
            if self.path == "/health":
                self._send(200, {"ok": True, "data_through": bot.data_through, "model": bot.model})
            else:
                self._send(404, {"error": "not found"})

        def do_POST(self):
            if self.path != "/ask":
                return self._send(404, {"error": "not found"})
            if token and self.headers.get("Authorization") != f"Bearer {token}":
                return self._send(401, {"error": "unauthorized"})
            try:
                n = int(self.headers.get("Content-Length", "0"))
                if n <= 0 or n > MAX_BODY:
                    return self._send(413, {"error": "request body missing or too large"})
                body = json.loads(self.rfile.read(n))
                question = str(body["question"]).strip()
                history = body.get("history") or []
                if not question:
                    raise ValueError("empty question")
                if not all(isinstance(h, dict) and h.get("role") in ("user", "assistant")
                           and isinstance(h.get("content"), str) for h in history):
                    raise ValueError("bad history")
            except (ValueError, KeyError, TypeError):
                return self._send(400, {"error": 'send JSON like {"question": "..."}'})
            try:
                r = bot.ask(question, history)
            except Exception as exc:  # keep the server alive; report the failure
                return self._send(502, {"error": f"{type(exc).__name__}: {exc}"})
            self._send(200, {"answer": r.answer, "queries": r.queries, "seconds": r.seconds})

        def log_message(self, fmt, *args):  # quiet by default
            pass

    return Handler


def serve(bot: CricketBot, host: str = "127.0.0.1", port: int = 8000, allow_origin: str | None = None) -> None:
    server = ThreadingHTTPServer((host, port), make_handler(bot, os.environ.get("CRICKET_BOT_TOKEN"), allow_origin))
    print(f"cricket bot listening on http://{host}:{port}  (data through {bot.data_through})")
    server.serve_forever()
