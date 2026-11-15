"""Hourly board-site score supplement for priced matches Source A does not score.

When the books price a match and the live source has no usable card, configured feeds may fill
team totals. Result: ``value_bets/out/board_scores.json`` (merged client-side via ``mergeBoardLive``).
Priced matches stay on the rail even when every board is silent.

Reality check (2026-11 web survey): official board live JSON is mostly closed.

* India board BFF live feed needs a shared secret (not free anonymous).
* England Play-Cricket API needs a club key and is explicitly not for real-time.
* South Africa board site is WordPress HTML; no public score JSON. A third-party SA publisher
  feed exists but robots Disallow ``/api/`` — we do not use it.
* Australia PlayHQ live is partner webhooks only.

What we *do* use when configured:

* ``SRC_D_BASE`` + ``CRICKETDATA_API_KEY`` — free Source D ``currentMatches`` (covers CSA T20,
  domestic and internationals the free tier lists). Primary gap filler.
* Optional ``BOARD_{IN,EN,ZA,AU}_BASE`` + ``_FEED`` — relative path on that host, for a future
  robots-allowed public JSON. Hosts never live in the tree.

Series hints pick which optional board to try first for a gap (CSA → za, IPL → in, …).
"""
from __future__ import annotations

import argparse
import json
import os
import re
import urllib.request
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from cricket_data.polite import PoliteFetcher, RobotsDisallowed
from cricket_site.sides import same_pair
from value_bets import config
from value_bets.archive import _sides, team_key

# Limited-overs keep window for gap matching (Test uses 6 days).
WINDOW = {"Test": 6 * 86400, "FC": 6 * 86400}

# Optional national-board slots. ``hints`` match book match/competition text (lowercased).
# ``feed_default`` is the relative path used when BASE is set and FEED env is empty.
BOARD_SLOTS: dict[str, dict[str, Any]] = {
    "in": {
        "base": "BOARD_IN_BASE", "feed": "BOARD_IN_FEED",
        "feed_default": "/feed/v1/matches/live",  # India board BFF shape when a secret proxy exposes it
        "hints": ("ipl", "bcci", "ranji", "vijay hazare", "syed mushtaq", "india ", " ind "),
    },
    "en": {
        "base": "BOARD_EN_BASE", "feed": "BOARD_EN_FEED",
        "feed_default": "/api/v2/matches.json",  # Play-Cricket shape when a key-gated proxy exposes it
        "hints": ("county", "the hundred", "vitality blast", "ecb", "england", "sussex", "surrey", "yorkshire"),
    },
    "za": {
        "base": "BOARD_ZA_BASE", "feed": "BOARD_ZA_FEED",
        "feed_default": "",  # no known robots-allowed public CSA JSON; leave empty → Source D only
        "hints": ("csa", "sa20", "proteas", "titans", "dolphins", "warriors", "lions", "knights",
                  "western province", "boland", "north west", "free state", "south africa"),
    },
    "au": {
        "base": "BOARD_AU_BASE", "feed": "BOARD_AU_FEED",
        "feed_default": "",
        "hints": ("bbl", "wbbl", "sheffield", "marsh cup", "australia", "sydney sixers", "melbourne"),
    },
}


def _window(fmt: str) -> float:
    return float(WINDOW.get(fmt or "", 14 * 3600))


def _parse_ts(s: str | None) -> datetime | None:
    if not s:
        return None
    t = str(s).strip().replace(" ", "T")
    if t.endswith("Z"):
        t = t[:-1] + "+00:00"
    try:
        d = datetime.fromisoformat(t)
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def priced_matches(book: dict) -> list[dict]:
    """Unique book-priced matches: match label, sides, start, fmt."""
    seen: dict[str, dict] = {}
    for kind in ("events", "lines", "fancy"):
        for x in book.get(kind) or []:
            a, b = _sides(x)
            st = _parse_ts(x.get("start_utc"))
            if not (a and b and st):
                continue
            key = f"{team_key(a)}|{team_key(b)}|{st.strftime('%Y-%m-%dT%H:%M')}"
            cur = seen.get(key)
            fmt = str(x.get("fmt") or "")
            if not cur:
                seen[key] = {
                    "match": x.get("match") or f"{a} vs {b}",
                    "a": a,
                    "b": b,
                    "start": st,
                    "fmt": fmt,
                    "keys": frozenset((team_key(a), team_key(b))),
                }
            elif not cur["fmt"] and fmt:
                cur["fmt"] = fmt
    return list(seen.values())


def _team_scored(t: dict) -> bool:
    return t.get("runs") is not None or bool(str(t.get("display") or "").strip())


def live_has_scores(m: dict) -> bool:
    """True when a live-route match already carries usable team totals."""
    teams = m.get("teams") or []
    return any(_team_scored(t) for t in teams) or bool(m.get("card"))


def live_covers(live: dict | None, gap: dict) -> bool:
    """Does the live body already list this priced match with scores?"""
    if not live:
        return False
    start = gap["start"]
    for m in live.get("matches") or []:
        names = frozenset(team_key(t.get("name")) for t in (m.get("teams") or []) if t.get("name"))
        if not same_pair(gap["keys"], names):
            continue
        mt = _parse_ts(m.get("start"))
        if mt and abs((mt - start).total_seconds()) >= _window(gap.get("fmt") or m.get("fmt") or ""):
            continue
        if live_has_scores(m):
            return True
    return False


def gaps(book: dict, live: dict | None, now: datetime | None = None) -> list[dict]:
    """Priced matches that have started (or start within an hour) and lack Source A scores."""
    now = now or datetime.now(timezone.utc)
    out = []
    for g in priced_matches(book):
        # Upcoming more than an hour away: boards not needed yet.
        if g["start"] > now + timedelta(hours=1):
            continue
        # Past the keep window: leave to archive settle.
        keep = _window(g.get("fmt") or "")
        if g["start"] < now - timedelta(seconds=keep):
            continue
        if live_covers(live, g):
            continue
        out.append(g)
    return out


def _row_sides(row: dict) -> tuple[str, str]:
    for ka, kb in (("team1", "team2"), ("team_a", "team_b"), ("home", "away"), ("home_team", "away_team"), ("t1", "t2")):
        va, vb = row.get(ka), row.get(kb)
        if isinstance(va, dict):
            va = va.get("name")
        if isinstance(vb, dict):
            vb = vb.get("name")
        if va and vb:
            return str(va), str(vb)
    teams = row.get("teams") or row.get("Competitors") or []
    if isinstance(teams, list) and len(teams) >= 2:
        n0 = teams[0].get("name") if isinstance(teams[0], dict) else teams[0]
        n1 = teams[1].get("name") if isinstance(teams[1], dict) else teams[1]
        if n0 and n1:
            return str(n0), str(n1)
    match = str(row.get("match") or row.get("name") or row.get("title") or "")
    a, b = _sides({"match": match})
    return a, b


def _row_start(row: dict) -> datetime | None:
    for k in ("start_utc", "start", "startTime", "StartDateTime", "match_start", "datetime", "dateTimeGMT", "starts_at"):
        raw = row.get(k)
        d = _parse_ts(raw if not isinstance(raw, (int, float)) else None)
        if d:
            return d
        if isinstance(raw, (int, float)):
            try:
                return datetime.fromtimestamp(float(raw) / (1000 if raw > 1e12 else 1), tz=timezone.utc)
            except (OSError, ValueError, OverflowError):
                pass
    return None


def _score_pair(val: Any) -> tuple[int | None, int | None]:
    """Parse runs/wickets from an int, ``{r,w}``, or ``\"186/7\"`` / ``\"186-7\"`` string."""
    if val is None or val == "":
        return None, None
    if isinstance(val, dict):
        r = val.get("r") if val.get("r") is not None else val.get("runs")
        w = val.get("w") if val.get("w") is not None else val.get("wickets", val.get("wkts"))
        return (int(r) if r is not None else None), (int(w) if w is not None else None)
    if isinstance(val, (int, float)):
        return int(val), None
    m = re.match(r"\s*(\d+)\s*[/\-]\s*(\d+)", str(val))
    if m:
        return int(m.group(1)), int(m.group(2))
    m = re.match(r"\s*(\d+)\s*$", str(val))
    return (int(m.group(1)), None) if m else (None, None)


def _status_of(row: dict) -> str:
    s = str(row.get("status") or row.get("match_status") or row.get("State") or "").lower()
    if any(x in s for x in ("complete", "result", "finished", "ended")):
        return "final"
    if any(x in s for x in ("live", "progress", "innings", "play")):
        return "live"
    if any(x in s for x in ("stump", "lunch", "tea", "delay", "rain")):
        return "live"
    return "started"


def _innings_totals(row: dict, a: str, b: str) -> list[dict]:
    """Normalise team score objects for the live-card shape."""
    out: list[dict] = []
    inn = row.get("innings") or row.get("Innings") or []
    if isinstance(inn, list) and inn:
        for i in inn:
            if not isinstance(i, dict):
                continue
            name = str(i.get("team") or i.get("batting_team") or i.get("name") or "")
            runs = i.get("runs") if i.get("runs") is not None else i.get("score")
            wkts = i.get("wickets") if i.get("wickets") is not None else i.get("wkts")
            overs = i.get("overs")
            if name and (runs is not None or wkts is not None):
                display = f"{runs}/{wkts}" if runs is not None and wkts is not None else (str(runs) if runs is not None else "")
                out.append({"name": name, "abbr": name[:3].upper(), "runs": runs, "wkts": wkts, "overs": overs, "display": display})
        if out:
            return out
    # Flat team1_score / team2_score / home_score ("186/7") style
    for name, rk, wk, ok in (
        (a, "team1_runs", "team1_wickets", "team1_overs"),
        (b, "team2_runs", "team2_wickets", "team2_overs"),
        (a, "score1", "wickets1", "overs1"),
        (b, "score2", "wickets2", "overs2"),
        (a, "home_score", None, "home_overs"),
        (b, "away_score", None, "away_overs"),
    ):
        if wk is None:
            runs, wkts = _score_pair(row.get(rk))
            overs = row.get(ok)
        else:
            if row.get(rk) is None and row.get(wk) is None:
                continue
            runs, wkts, overs = row.get(rk), row.get(wk), row.get(ok)
        if runs is None and wkts is None:
            continue
        display = f"{runs}/{wkts}" if runs is not None and wkts is not None else (str(runs) if runs is not None else "")
        out.append({"name": name, "abbr": name[:3].upper(), "runs": runs, "wkts": wkts, "overs": overs, "display": display})
    # Source D / CricAPI-style score: [{r,w,o,inning}]
    score_rows = row.get("score")
    if isinstance(score_rows, list) and score_rows:
        for s in score_rows:
            if not isinstance(s, dict):
                continue
            runs, wkts = _score_pair(s)
            if runs is None and s.get("r") is not None:
                runs, wkts = _score_pair({"r": s.get("r"), "w": s.get("w")})
            inn_label = str(s.get("inning") or "")
            name = a if team_key(a) and team_key(a) in team_key(inn_label) else (
                b if team_key(b) and team_key(b) in team_key(inn_label) else (a if not out else b))
            if runs is None and wkts is None:
                continue
            display = f"{runs}/{wkts}" if runs is not None and wkts is not None else str(runs or "")
            out.append({"name": name, "abbr": name[:3].upper(), "runs": runs, "wkts": wkts, "overs": s.get("o") or s.get("overs"), "display": display})
    if out:
        # de-dupe by side
        seen: set[str] = set()
        uniq = []
        for t in out:
            k = team_key(t["name"])
            if k in seen:
                continue
            seen.add(k)
            uniq.append(t)
        return uniq
    # teams[] already carry scores
    for t in row.get("teams") or []:
        if not isinstance(t, dict) or not t.get("name"):
            continue
        runs = t.get("runs") if t.get("runs") is not None else t.get("score")
        wkts = t.get("wickets") if t.get("wickets") is not None else t.get("wkts")
        if runs is None and wkts is None and not t.get("display"):
            continue
        display = t.get("display") or (f"{runs}/{wkts}" if runs is not None and wkts is not None else str(runs or ""))
        out.append({
            "name": t["name"], "abbr": t.get("abbr") or str(t["name"])[:3].upper(),
            "runs": runs, "wkts": wkts, "overs": t.get("overs"), "display": display,
            **({"flag": t["flag"]} if t.get("flag") else {}),
        })
    return out


def _flag_for(row: dict, name: str) -> str | None:
    flags = row.get("flags") or row.get("crests") or {}
    if isinstance(flags, dict):
        for k, v in flags.items():
            if team_key(k) == team_key(name) and v:
                return str(v)
    for t in row.get("teams") or []:
        if isinstance(t, dict) and team_key(t.get("name") or "") == team_key(name) and t.get("flag"):
            return str(t["flag"])
    return None


def parse_feed(doc: Any, board: str) -> list[dict]:
    """Board feed JSON → normalised cards (may lack scores; caller filters)."""
    rows = doc
    if isinstance(doc, dict):
        for k in ("matches", "data", "fixtures", "Matches", "items", "results"):
            if isinstance(doc.get(k), list):
                rows = doc[k]
                break
        else:
            rows = [doc]
    if not isinstance(rows, list):
        return []
    out = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        a, b = _row_sides(row)
        if not (a and b):
            continue
        start = _row_start(row) or datetime.now(timezone.utc)
        teams = _innings_totals(row, a, b)
        if not teams:
            teams = [
                {"name": a, "abbr": a[:3].upper(), "runs": None, "wkts": None, "overs": None, "display": ""},
                {"name": b, "abbr": b[:3].upper(), "runs": None, "wkts": None, "overs": None, "display": ""},
            ]
        for t in teams:
            fl = _flag_for(row, t["name"])
            if fl:
                t["flag"] = fl
        out.append({
            "id": f"board-{board}-{team_key(a)}-v-{team_key(b)}-{start.strftime('%Y%m%d%H%M')}",
            "board": board,
            "source": "board",
            "match": f"{a} vs {b}",
            "a": a,
            "b": b,
            "keys": frozenset((team_key(a), team_key(b))),
            "start": start,
            "start_iso": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "fmt": str(row.get("fmt") or row.get("format") or ""),
            "status": _status_of(row),
            "teams": teams,
            "summary": str(row.get("summary") or row.get("result") or row.get("status_text") or ""),
        })
    return out


def match_gap(gap: dict, cards: list[dict]) -> dict | None:
    for c in cards:
        if not same_pair(gap["keys"], c["keys"]):
            continue
        if abs((c["start"] - gap["start"]).total_seconds()) >= _window(gap.get("fmt") or c.get("fmt") or ""):
            continue
        if not any(_team_scored(t) for t in c.get("teams") or []):
            continue
        return c
    return None


def to_live_match(card: dict, gap: dict) -> dict:
    """Shape close enough to a `/api/live` matches[] entry for scoreboard + liveForFixture."""
    return {
        "id": card["id"],
        "status": card["status"],
        "fmt": gap.get("fmt") or card.get("fmt") or "",
        "start": gap["start"].strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "board",
        "board": card.get("board"),
        "summary": card.get("summary") or "",
        "teams": card["teams"],
        "players": [],
        "card": [],
        "innings": [
            {"team": t["name"], "runs": t.get("runs"), "wkts": t.get("wkts"), "overs": t.get("overs")}
            for t in card["teams"] if _team_scored(t)
        ],
    }


def boards_configured() -> list[tuple[str, str, str]]:
    """(board_id, base_url, feed_path) for optional national boards with a usable BASE+path."""
    out = []
    for bid, slot in BOARD_SLOTS.items():
        base = os.environ.get(slot["base"], "").strip().rstrip("/")
        feed = os.environ.get(slot["feed"], "").strip() or str(slot.get("feed_default") or "")
        if base and feed:
            if not feed.startswith("/"):
                feed = "/" + feed
            out.append((bid, base, feed))
    return out


def board_affinity(gap: dict, board_id: str) -> int:
    """Higher = better match for this gap (series / side names vs board hints)."""
    if board_id == "cd":
        return 1  # Source D is the global free fallback
    hints = BOARD_SLOTS.get(board_id, {}).get("hints") or ()
    blob = f" {gap.get('match', '')} {gap.get('a', '')} {gap.get('b', '')} ".lower()
    return 10 + sum(1 for h in hints if h in blob)


def fetch_feed(base: str, feed: str, fetcher: PoliteFetcher) -> Any:
    url = base + feed
    text = fetcher.get(url)
    return json.loads(text)


def fetch_source_d(fetcher: PoliteFetcher) -> Any | None:
    """Free Source D currentMatches (needs SRC_D_BASE + CRICKETDATA_API_KEY)."""
    key = os.environ.get("CRICKETDATA_API_KEY", "").strip()
    base = os.environ.get("SRC_D_BASE", "").strip().rstrip("/")
    if not (key and base):
        return None
    url = f"{base}/currentMatches?apikey={key}&offset=0"
    text = fetcher.get(url)
    return json.loads(text)


def parse_source_d(doc: Any) -> list[dict]:
    """Normalise Source D currentMatches into board cards."""
    if not isinstance(doc, dict) or doc.get("status") == "failure":
        return []
    rows = doc.get("data")
    if not isinstance(rows, list):
        return []
    # Re-use parse_feed after shaping each row
    shaped = []
    for m in rows:
        if not isinstance(m, dict):
            continue
        teams = m.get("teams") or []
        if len(teams) < 2 and m.get("name"):
            a, b = _sides({"match": m["name"]})
            teams = [a, b] if a and b else teams
        if len(teams) < 2:
            continue
        shaped.append({
            "team1": teams[0], "team2": teams[1],
            "dateTimeGMT": m.get("dateTimeGMT") or m.get("date"),
            "status": "final" if m.get("matchEnded") else ("live" if m.get("matchStarted") else m.get("status")),
            "fmt": {"t20": "T20", "odi": "ODI", "test": "Test"}.get(str(m.get("matchType") or "").lower(), m.get("matchType") or ""),
            "score": m.get("score") or [],
            "summary": m.get("status") or "",
            "name": m.get("name") or f"{teams[0]} vs {teams[1]}",
        })
    return parse_feed({"matches": shaped}, "cd")


GetJson = Callable[[str], Any]


def read_live_body(src: str | None, get_json: GetJson | None = None) -> dict | None:
    if not src:
        return None
    try:
        if re.match(r"https?://", src):
            if get_json:
                return get_json(src)
            req = urllib.request.Request(src, headers={"user-agent": "cricket-props-hub-board/1", "accept": "application/json"})
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        return json.loads(Path(src).read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError):
        return None


def collect(
    book: dict,
    live: dict | None,
    feeds: dict[str, Any],
    now: datetime | None = None,
) -> list[dict]:
    """For each priced gap, attach the best-affinity board card that scores it."""
    cards_by_board = {bid: (parse_source_d(doc) if bid == "cd" else parse_feed(doc, bid)) for bid, doc in feeds.items()}
    found = []
    for g in gaps(book, live, now):
        order = sorted(cards_by_board.keys(), key=lambda bid: -board_affinity(g, bid))
        for bid in order:
            hit = match_gap(g, cards_by_board[bid])
            if hit:
                found.append(to_live_match(hit, g))
                break
    return found


def write_out(matches: list[dict], path: Path, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    doc = {
        "generated_at_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": "board",
        "matches": matches,
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)
    return doc


def run(
    book_path: Path,
    out_path: Path,
    live_src: str | None = None,
    fetcher: PoliteFetcher | None = None,
    now: datetime | None = None,
) -> dict:
    """Read book + optional live body, fetch Source D + configured boards, write board_scores.json."""
    book = json.loads(book_path.read_text(encoding="utf-8")) if book_path.exists() else {"lines": [], "events": [], "fancy": []}
    live = read_live_body(live_src)
    need = gaps(book, live, now)
    feeds: dict[str, Any] = {}
    fetcher = fetcher or PoliteFetcher(min_interval=2.0)
    notes = []
    if need:
        try:
            cd = fetch_source_d(fetcher)
            if cd is not None:
                feeds["cd"] = cd
            else:
                notes.append("cd: SRC_D_BASE or CRICKETDATA_API_KEY unset")
        except RobotsDisallowed as e:
            notes.append(f"cd: robots {e}")
        except (OSError, ValueError, json.JSONDecodeError) as e:
            notes.append(f"cd: {type(e).__name__}")
        for bid, base, feed in boards_configured():
            try:
                feeds[bid] = fetch_feed(base, feed, fetcher)
            except RobotsDisallowed as e:
                notes.append(f"{bid}: robots {e}")
            except (OSError, ValueError, json.JSONDecodeError) as e:
                notes.append(f"{bid}: {type(e).__name__}")
    matches = collect(book, live, feeds, now) if feeds else []
    doc = write_out(matches, out_path, now)
    doc["_meta"] = {"gaps": len(need), "filled": len(matches), "boards": list(feeds), "notes": notes}
    return doc


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--book", default=str(config.OUT / "book_lines.json"))
    ap.add_argument("--out", default=str(config.OUT / "board_scores.json"))
    ap.add_argument("--live", default="", help="optional /api/live URL or file; gaps are priced matches it does not score")
    a = ap.parse_args(argv)
    live = a.live or (os.environ.get("SITE_URL", "").rstrip("/") + "/api/live" if os.environ.get("SITE_URL") else "")
    doc = run(Path(a.book), Path(a.out), live_src=live or None)
    meta = doc.pop("_meta", {})
    print(json.dumps({"wrote": a.out, "matches": len(doc.get("matches") or []), **meta}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
