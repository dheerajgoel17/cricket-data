"""A Claude-powered assistant that answers cricket questions from the dataset.

Claude gets two tools (``resolve_name`` and ``run_sql``), calls them as needed (usually one name
lookup and one query, in a single round when it can), and writes the answer. Everything it states
comes from query results; the data runs up to the date shown in ``CricketBot.data_through``.
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from pathlib import Path

from .db import ensure_db
from .tools import TOOLS, CricketDB, call_tool

DEFAULT_MODEL = "claude-opus-5-5"
FALLBACK_BETA = "server-side-fallback-2026-07-01"

SYSTEM_TEMPLATE = """You answer cricket questions using a database of {n_matches} matches and per-player match performances.
The data runs up to {last_date}. Answer ONLY from query results; if the data cannot answer, say so plainly.

Tools: resolve_name (turn what the user typed into exact dataset names) and run_sql (one SQLite SELECT).
Work efficiently: call resolve_name for every name the question mentions in one go (parallel calls), then run
one aggregate query that answers the question, then reply. Do not explore the data aimlessly.

Schema:
{schema}

Conventions:
- One row per match in `matches`; one row per player per match in `players`; `player_matches` joins them (use it
  for any player question that needs venue/event/format).
- match_type: T20 (this INCLUDES T20 internationals; they have team_type='international'), ODI, Test,
  ODM (domestic one-day / List A), MDM (domestic multi-day / first-class). "T20I" = match_type='T20' AND
  team_type='international'. IPL = event 'Indian Premier League'.
- gender is 'male' or 'female': assume 'male' unless the user asks about women's cricket.
- Dates are ISO text (YYYY-MM-DD); "last N matches" = ORDER BY date DESC LIMIT N.
- toss_decision is 'bat' or 'field' (what the toss winner chose); winner is '' for ties, draws and no results
  (see `result`); result_margin looks like '8 wickets', '52 runs', 'innings 9 runs'.
- Player names in the data are Cricsheet style ('AR Patel', 'V Kohli'); filter players by player_id when
  resolve_name gives one. A person can appear under two spellings (a scraped copy has no player_id):
  match on name OR id when it matters.
- Venues can have several spellings (with/without city): use every spelling from resolve_name in IN (...).
- Multi-day (Test/first-class) player rows already add both innings together.
- Points are the dataset's fantasy-style points (1/run, 20/wicket, 10/catch, 25/stumping).

Style: lead with the answer, then a compact table if there are several rows. Keep it short. Mention a caveat
only when it changes how the user should read the answer (small sample, ties, a missing season)."""


@dataclass
class BotAnswer:
    answer: str
    queries: list[dict] = field(default_factory=list)  # [{tool, input, output}] for transparency
    seconds: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0


class CricketBot:
    def __init__(self, data_dir: str | Path = "data", db_path: str | Path | None = None, model: str | None = None,
                 client=None, effort: str = "low", max_rounds: int = 6, fallbacks: bool = True):
        self.db = CricketDB(ensure_db(data_dir, db_path))
        self.model = model or os.environ.get("CRICKET_BOT_MODEL", DEFAULT_MODEL)
        self.effort, self.max_rounds, self.fallbacks = effort, max_rounds, fallbacks
        self._client = client
        n = self.db.con.execute("SELECT COUNT(*) FROM matches").fetchone()[0]
        self.data_through = self.db.last_match_date()
        self.system = [{
            "type": "text",
            "text": SYSTEM_TEMPLATE.format(n_matches=f"{n:,}", last_date=self.data_through, schema=self.db.schema()),
            "cache_control": {"type": "ephemeral"},  # the long, unchanging part: cached between questions
        }]

    @property
    def client(self):
        if self._client is None:
            try:
                import anthropic
            except ImportError as exc:  # pragma: no cover
                raise RuntimeError("The assistant needs the Anthropic SDK: pip install 'cricket-data[bot]'") from exc
            self._client = anthropic.Anthropic()  # ANTHROPIC_API_KEY, or an `ant auth login` profile
        return self._client

    def _create(self, messages: list):
        kwargs = dict(model=self.model, max_tokens=8000, system=self.system, tools=TOOLS, messages=messages,
                      output_config={"effort": self.effort})
        if self.fallbacks:  # re-run on another model if a safety classifier declines (very unlikely here)
            kwargs.update(betas=[FALLBACK_BETA], fallbacks="default")
        return self.client.beta.messages.create(**kwargs)

    def ask(self, question: str, history: list[dict] | None = None) -> BotAnswer:
        """Answer one question. ``history`` is earlier turns as [{'role': 'user'|'assistant', 'content': str}]."""
        t0 = time.monotonic()
        messages = [{"role": m["role"], "content": m["content"]} for m in (history or [])]
        messages.append({"role": "user", "content": question})
        out = BotAnswer(answer="")
        for _ in range(self.max_rounds):
            resp = self._create(messages)
            usage = getattr(resp, "usage", None)
            out.input_tokens += getattr(usage, "input_tokens", 0) or 0
            out.output_tokens += getattr(usage, "output_tokens", 0) or 0
            if resp.stop_reason == "refusal":
                out.answer = "Sorry, I can't help with that request."
                break
            messages.append({"role": "assistant", "content": resp.content})  # thinking blocks must be passed back as-is
            uses = [b for b in resp.content if b.type == "tool_use"]
            if not uses:
                out.answer = "".join(b.text for b in resp.content if b.type == "text").strip()
                if resp.stop_reason == "max_tokens":
                    out.answer += "\n\n(The answer was cut short.)"
                break
            results = []
            for u in uses:  # all results go back together in one user message
                text = call_tool(self.db, u.name, dict(u.input))
                out.queries.append({"tool": u.name, "input": dict(u.input), "output": text[:2000]})
                results.append({"type": "tool_result", "tool_use_id": u.id, "content": text})
            messages.append({"role": "user", "content": results})
        else:
            out.answer = "I couldn't finish working that out. Try asking in a simpler or more specific way."
        out.seconds = round(time.monotonic() - t0, 2)
        return out
