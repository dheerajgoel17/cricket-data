"""The question-answering layer: database build, name matching, safe SQL and the bot loop (no network)."""
from __future__ import annotations

import json
import sqlite3
from types import SimpleNamespace as NS

import pytest
from conftest import make_match

from cricket_data.ask.bot import CricketBot
from cricket_data.ask.db import build_db, ensure_db
from cricket_data.ask.server import make_handler
from cricket_data.ask.tools import MAX_ROWS, CricketDB, call_tool
from cricket_data.cricsheet import iter_zip
from cricket_data.store import Store


@pytest.fixture
def data(tmp_path, make_zip):
    m1 = make_match(date="2026-03-01", teams=("India", "West Indies"), winner="India")
    m1["info"]["venue"] = "MA Chidambaram Stadium, Chepauk"
    m2 = make_match(date="2026-03-05", teams=("India", "West Indies"), winner="West Indies", runs=50)
    m2["info"]["venue"] = "MA Chidambaram Stadium"
    m3 = make_match(date="2026-03-09", teams=("Australia", "South Africa"))
    m3["info"]["venue"] = "JSCA International Stadium Complex, Ranchi"
    m4 = make_match(date="2026-03-10", teams=("Chennai Super Kings", "Mumbai Indians"))
    m4["info"]["event"] = {"name": "Indian Premier League"}
    Store(tmp_path).upsert(iter_zip(make_zip(m1, m2, m3, m4)))
    return tmp_path


@pytest.fixture
def db(data, tmp_path):
    return CricketDB(build_db(data, tmp_path / "q.db"))


# ---- database ------------------------------------------------------------------------------------
def test_db_has_indexed_tables_and_the_joined_view(db):
    assert db.sql("SELECT COUNT(*) FROM matches")["rows"] == [[4]]
    r = db.sql("SELECT player, runs, venue FROM player_matches WHERE player='M Renshaw' AND date='2026-03-01'")
    assert r["rows"] and r["rows"][0][2] == "MA Chidambaram Stadium, Chepauk"
    assert db.last_match_date() == "2026-03-10"
    assert "player_matches" in db.schema()


def test_db_is_rebuilt_only_when_the_data_changes(data, tmp_path, make_zip):
    path = tmp_path / "e.db"
    ensure_db(data, path)
    first = path.stat().st_mtime_ns
    assert ensure_db(data, path) == path and path.stat().st_mtime_ns == first  # unchanged -> reused
    Store(data).upsert(iter_zip(make_zip(make_match(date="2026-04-01", teams=("Nepal", "Oman")), name="n.zip")))
    ensure_db(data, path)
    con = sqlite3.connect(path)
    assert con.execute("SELECT COUNT(*) FROM matches").fetchone()[0] == 5


# ---- name matching ---------------------------------------------------------------------------------
def test_resolve_venue_typo_and_spelling_variants(db):
    names = [r["name"] for r in db.resolve("venue", "Cheapuk")]
    assert "MA Chidambaram Stadium, Chepauk" in names and "MA Chidambaram Stadium" in names  # both spellings


def test_resolve_ignores_generic_words_and_finds_the_stadium(db):
    assert db.resolve("venue", "Ranchi cricket stadium")[0]["name"] == "JSCA International Stadium Complex, Ranchi"


def test_resolve_nicknames_and_acronyms(db):
    assert db.resolve("team", "windies")[0]["name"] == "West Indies"
    assert db.resolve("event", "ipl")[0]["name"] == "Indian Premier League"
    assert db.resolve("team", "csk")[0]["name"] == "Chennai Super Kings"


def test_resolve_player_by_initials_style_name(db):
    top = db.resolve("player", "Renshaw")
    assert top[0]["name"] == "M Renshaw" and "|" in top[0]["info"]  # 'player_id|teams'
    assert db.resolve("player", "nobody here at all") == []


# ---- safe SQL ----------------------------------------------------------------------------------------
@pytest.mark.parametrize("q", ["DELETE FROM matches", "DROP TABLE matches", "SELECT 1; SELECT 2",
                               "PRAGMA writable_schema=1", "ATTACH DATABASE 'x' AS y",
                               "WITH x AS (SELECT 1) INSERT INTO matches SELECT * FROM matches"])
def test_sql_rejects_anything_but_one_select(db, q):
    assert "error" in db.sql(q)
    assert db.sql("SELECT COUNT(*) FROM matches")["rows"] == [[4]]  # nothing changed


def test_sql_caps_rows_and_reports_errors(db):
    r = db.sql("WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i+1 FROM n WHERE i < 1000) SELECT i FROM n")
    assert len(r["rows"]) == MAX_ROWS and r["truncated"]
    assert "error" in db.sql("SELECT nope FROM matches")


def test_sql_comments_cannot_smuggle_a_second_statement(db):
    assert "error" in db.sql("SELECT 1 -- ok\n; DELETE FROM matches")


# ---- the bot loop (scripted model; no network) --------------------------------------------------------
def _resp(blocks, stop="tool_use"):
    return NS(content=blocks, stop_reason=stop, usage=NS(input_tokens=10, output_tokens=5))


def _use(i, name, **inp):
    return NS(type="tool_use", id=f"t{i}", name=name, input=inp)


class FakeClient:
    def __init__(self, script):
        self.script, self.calls = list(script), []
        self.beta = NS(messages=NS(create=self._create))

    def _create(self, **kw):
        self.calls.append(kw)
        return self.script.pop(0)


def test_bot_runs_tools_in_parallel_and_returns_the_final_text(data, tmp_path):
    client = FakeClient([
        _resp([NS(type="thinking", thinking="", signature="s"),
               _use(1, "resolve_name", kind="venue", text="cheapuk"),
               _use(2, "resolve_name", kind="team", text="windies")]),
        _resp([_use(3, "run_sql", sql="SELECT date, toss_winner FROM matches WHERE team_a='India' ORDER BY date DESC")]),
        _resp([NS(type="text", text="India won the toss in both.")], stop="end_turn"),
    ])
    bot = CricketBot(data, db_path=tmp_path / "b.db", client=client)
    r = bot.ask("who won the toss?", history=[{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}])
    assert r.answer == "India won the toss in both."
    assert [q["tool"] for q in r.queries] == ["resolve_name", "resolve_name", "run_sql"]
    # both results of the parallel calls went back in ONE user message, and history was sent first
    second = client.calls[1]["messages"]
    assert second[0]["content"] == "hi"
    results = second[4]["content"]  # history x2, question, assistant turn, then the tool results
    assert [x["tool_use_id"] for x in results] == ["t1", "t2"]
    assert "Chepauk" in results[0]["content"]
    # request shape: tools, cached system prompt, low effort, refusal fallback
    kw = client.calls[0]
    assert kw["model"] == "claude-opus-5-5" and kw["output_config"] == {"effort": "low"}
    assert kw["system"][0]["cache_control"] == {"type": "ephemeral"} and kw["fallbacks"] == "default"
    assert {t["name"] for t in kw["tools"]} == {"resolve_name", "run_sql"}
    assert r.input_tokens == 30 and r.seconds >= 0


def test_bot_handles_refusals_and_runaway_loops(data, tmp_path):
    bot = CricketBot(data, db_path=tmp_path / "r.db", client=FakeClient([_resp([], stop="refusal")]))
    assert "can't help" in bot.ask("x").answer
    loop = FakeClient([_resp([_use(i, "run_sql", sql="SELECT 1")]) for i in range(10)])
    assert "couldn't finish" in CricketBot(data, db_path=tmp_path / "r.db", client=loop, max_rounds=3).ask("x").answer


def test_tool_errors_go_back_to_the_model_instead_of_crashing(db):
    assert "error" in json.loads(call_tool(db, "run_sql", {"sql": "DROP TABLE matches"}))
    assert "error" in json.loads(call_tool(db, "nope", {}))


# ---- HTTP endpoint ---------------------------------------------------------------------------------------
class _Bot:
    data_through, model = "2026-03-10", "m"

    def ask(self, q, history):
        return NS(answer=f"echo {q}", queries=[], seconds=0.1)


def _call(handler_cls, method, path, body=None, headers=None):
    import io

    raw = json.dumps(body).encode() if body is not None else b""
    h = handler_cls.__new__(handler_cls)
    h.rfile, h.wfile = io.BytesIO(raw), io.BytesIO()
    h.path, h.headers = path, {"Content-Length": str(len(raw)), **(headers or {})}
    h.headers = NS(get=lambda k, d=None, _h=h.headers: _h.get(k, d))
    sent = []
    h.send_response = lambda c: sent.append(c)
    h.send_header = lambda *a: None
    h.end_headers = lambda: None
    getattr(h, f"do_{method}")()
    return sent[0], json.loads(h.wfile.getvalue() or b"{}")


def test_http_ask_health_and_auth():
    open_ = make_handler(_Bot(), None, None)
    assert _call(open_, "POST", "/ask", {"question": "hi"}) == (200, {"answer": "echo hi", "queries": [], "seconds": 0.1})
    assert _call(open_, "GET", "/health")[1]["data_through"] == "2026-03-10"
    assert _call(open_, "POST", "/ask", {"nope": 1})[0] == 400
    assert _call(open_, "POST", "/ask", {"question": "hi", "history": [{"role": "x", "content": "y"}]})[0] == 400
    locked = make_handler(_Bot(), "secret", None)
    assert _call(locked, "POST", "/ask", {"question": "hi"})[0] == 401
    assert _call(locked, "POST", "/ask", {"question": "hi"}, {"Authorization": "Bearer secret"})[0] == 200
