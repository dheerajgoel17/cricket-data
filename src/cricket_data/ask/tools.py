"""The two tools the bot uses: name matching and a read-only SQL runner.

``resolve_name`` turns what people type ("Cheapuk", "Windies", "Axar") into the names the data
actually uses, with counts so ambiguity is visible. ``run_sql`` runs one SELECT with a row cap,
a time limit and a read-only connection, so a question can never change or slow down the data.
"""
from __future__ import annotations

import difflib
import json
import re
import sqlite3
import time
from collections import defaultdict
from pathlib import Path

from .db import norm

# Words that say nothing about *which* venue/team ("Ranchi cricket stadium" -> "Ranchi"), when other words remain.
_GENERIC = {"cricket", "stadium", "ground", "international", "the", "of", "club", "sports", "complex", "park", "oval"}
MAX_ROWS = 200
SQL_TIMEOUT_S = 5.0
_FORBIDDEN = re.compile(r"\b(attach|detach|pragma|insert|update|delete|drop|create|alter|replace|vacuum|"
                        r"reindex|load_extension|analyze)\b", re.I)

TOOLS = [
    {
        "name": "resolve_name",
        "description": (
            "Find the exact spelling(s) the dataset uses for a team, venue, player or event, from what the "
            "user typed (typos, nicknames, partial names). Always call this before filtering on a name. "
            "Returns candidates with match counts and last match date; venues often have several spellings "
            "(use all of them with IN (...)). For players, `info` is 'player_id|teams' - prefer player_id."
        ),
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "kind": {"type": "string", "enum": ["team", "venue", "player", "event"]},
                "text": {"type": "string", "description": "What the user typed"},
            },
            "required": ["kind", "text"],
            "additionalProperties": False,
        },
    },
    {
        "name": "run_sql",
        "description": (
            "Run ONE read-only SQLite SELECT (or WITH ... SELECT) over the cricket tables and return rows "
            f"(max {MAX_ROWS}). Use exact names from resolve_name. Aggregate in SQL instead of returning many rows."
        ),
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {"sql": {"type": "string", "description": "A single SELECT statement"}},
            "required": ["sql"],
            "additionalProperties": False,
        },
    },
]


class CricketDB:
    def __init__(self, path: str | Path):
        self.path = str(path)
        self.con = sqlite3.connect(f"file:{self.path}?mode=ro", uri=True, check_same_thread=False)
        self.con.execute("PRAGMA query_only=1")
        self._vocab: dict[str, list[tuple]] = {}
        self._index: dict[str, dict[str, set[int]]] = {}
        self._initials: dict[str, dict[str, set[int]]] = {}
        self._stem: dict[str, dict[str, set[int]]] = {}
        self._by_first: dict[str, dict[str, list[str]]] = {}
        self._cache: dict[tuple, list[dict]] = {}

    # ---- schema / currency (for the system prompt) -----------------------------------------------
    def schema(self) -> str:
        out = []
        for name, kind in self.con.execute("SELECT name, type FROM sqlite_master WHERE type IN ('table','view') "
                                           "AND name NOT IN ('names','meta') ORDER BY type DESC, name"):
            cols = ", ".join(r[1] for r in self.con.execute(f"PRAGMA table_info({name})"))
            out.append(f"{kind} {name}({cols})")
        return "\n".join(out)

    def last_match_date(self) -> str:
        r = self.con.execute("SELECT v FROM meta WHERE k='last_match_date'").fetchone()
        return r[0] if r else ""

    # ---- resolve_name ------------------------------------------------------------------------------
    def _load(self, kind: str) -> None:
        if kind in self._vocab:
            return
        rows = self.con.execute("SELECT name, norm, n, last_date, info FROM names WHERE kind=?", (kind,)).fetchall()
        idx: dict[str, set[int]] = defaultdict(set)
        by_initials: dict[str, set[int]] = defaultdict(set)
        by_stem: dict[str, set[int]] = defaultdict(set)
        for i, r in enumerate(rows):
            toks = r[1].split()
            for tok in toks:
                idx[tok].add(i)
            if len(toks) > 1:
                by_initials["".join(t[0] for t in toks)].add(i)
            by_stem[norm(r[0].split(",")[0])].add(i)
        self._vocab[kind], self._index[kind] = rows, idx
        self._initials[kind], self._stem[kind] = by_initials, by_stem
        self._by_first[kind] = defaultdict(list)
        for t in idx:
            self._by_first[kind][t[0]].append(t)

    @staticmethod
    def _token_score(q: str, tok: str, original: str, kind: str) -> float:
        if q == tok:
            return 1.0
        if len(q) >= 3 and (tok.startswith(q) or (len(tok) >= 3 and q.startswith(tok))):
            return 0.9
        if kind == "player" and original.isupper() and len(original) <= 4 and q[0] == tok[0]:
            return 0.7  # 'Axar' vs the initials in 'AR Patel'
        r = difflib.SequenceMatcher(None, q, tok).ratio()
        return r * 0.95 if r >= 0.78 else 0.0

    def _candidates(self, kind: str, qtoks: list[str], same_first_letter: bool) -> set[int]:
        idx = self._index[kind]
        cand: set[int] = set()
        for q in qtoks:
            pool = self._by_first[kind].get(q[0], ()) if same_first_letter else idx
            for t in pool:
                if self._token_score(q, t, "", "team") > 0 or (kind == "player" and t[0] == q[0] and len(t) <= 4):
                    cand |= idx[t]
        return cand

    def resolve(self, kind: str, text: str, limit: int = 15) -> list[dict]:
        key = (kind, norm(text), limit)
        if key not in self._cache:
            self._cache[key] = self._resolve(kind, text, limit)
        return self._cache[key]

    def _resolve(self, kind: str, text: str, limit: int) -> list[dict]:
        self._load(kind)
        rows = self._vocab[kind]
        qtoks = norm(text).split()
        meaningful = [q for q in qtoks if q not in _GENERIC]
        qtoks = meaningful or qtoks
        if not qtoks:
            return []
        scored: dict[int, float] = {}
        for i in self._initials[kind].get("".join(qtoks) if len(qtoks) == 1 else "", ()):  # 'ipl', 'csk'
            scored[i] = 0.95
        cand = self._candidates(kind, qtoks, same_first_letter=True)
        if not cand and not scored:  # a typo in the first letter ('windies' ~ 'indies'): search every token
            cand = self._candidates(kind, qtoks, same_first_letter=False)
        for i in cand:
            name, nm, n, last, info = rows[i]
            orig_toks = re.sub(r"[^A-Za-z0-9 ]", " ", name).split()
            total = sum(max((self._token_score(q, t.lower(), o, kind) for t, o in zip(nm.split(), orig_toks, strict=True)),
                            default=0.0) for q in qtoks)
            score = total / len(qtoks)
            if score >= 0.6:
                scored[i] = max(scored.get(i, 0.0), score)
        if not scored:
            return []
        best = max(scored.values())
        keep = {i for i, sc in scored.items() if sc >= max(0.6, best - 0.1)}
        if kind == "venue":  # same stadium written with and without the city: 'X, Chennai' / 'X'
            for i in list(keep):
                keep |= self._stem[kind].get(norm(rows[i][0].split(",")[0]), set())
        ranked = sorted(keep, key=lambda i: (-scored.get(i, best - 0.05), -rows[i][2]))[:limit]
        return [{"name": rows[i][0], "matches": rows[i][2], "last_match": rows[i][3], "info": rows[i][4],
                 "score": round(scored.get(i, best - 0.05), 2)} for i in ranked]

    # ---- run_sql -------------------------------------------------------------------------------------
    def sql(self, query: str) -> dict:
        q = re.sub(r"--[^\n]*|/\*.*?\*/", " ", query, flags=re.S).strip().rstrip(";").strip()
        if ";" in q:
            return {"error": "only one statement is allowed"}
        if not re.match(r"(?is)^(select|with)\b", q) or _FORBIDDEN.search(q):
            return {"error": "only read-only SELECT queries are allowed"}
        deadline = time.monotonic() + SQL_TIMEOUT_S
        self.con.set_progress_handler(lambda: 1 if time.monotonic() > deadline else 0, 10000)
        try:
            cur = self.con.execute(f"SELECT * FROM ({q}) LIMIT {MAX_ROWS + 1}")
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
        except sqlite3.Error as exc:
            return {"error": f"{type(exc).__name__}: {exc}"}
        finally:
            self.con.set_progress_handler(None, 0)
        return {"columns": cols, "rows": [list(r) for r in rows[:MAX_ROWS]], "truncated": len(rows) > MAX_ROWS}


def call_tool(db: CricketDB, name: str, args: dict) -> str:
    """Run a tool and return its result as JSON text for the model."""
    if name == "resolve_name":
        result: object = db.resolve(args.get("kind", ""), args.get("text", ""))
    elif name == "run_sql":
        result = db.sql(args.get("sql", ""))
    else:
        result = {"error": f"unknown tool {name}"}
    return json.dumps(result, ensure_ascii=False, default=str)
