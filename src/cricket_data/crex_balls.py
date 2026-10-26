"""Ball-by-ball from CREX's commentary feed -> one row per delivery, checked against the scorecard.

The match page (summary tab) loads its commentary through ``getBallFeeds``, newest first, a page at a
time as the reader scrolls (the next page is requested with ``lastDocId`` = the oldest event id seen).
``CREXBrowser.capture`` scrolls the real page and collects those responses, so we only ever visit URLs
that crex.com's robots.txt allows, at the browser's own pace.

Event kinds (``type``): ``b`` a delivery, ``w`` a wicket card, ``o`` an over summary, ``t`` plain text and
``tm``/``ac``/``pl``/... milestones that we ignore. ``inning`` is 0-based (-1 = pre-match chatter).

Ball codes (``b``): digits = runs off the bat, ``W`` wicket, ``WD`` wide, ``<n>lb`` leg byes, ``<n>b``
byes, ``<n>nb`` no-ball (n = runs off the bat), ``<n>W`` a wicket after n runs. Only the code is used: the
running score ``s`` ("111/4") is stamped by the scorer a ball late now and then. ``reconcile`` proves
the whole parse against the scorecard, and ``collect`` stores a match only when it does.
"""
from __future__ import annotations

import re
from dataclasses import asdict, dataclass, fields

BALL_FIELDS = ("match_key", "innings", "seq", "over", "ball", "legal", "batting_team", "striker", "non_striker",
               "bowler", "bat_runs", "extra_type", "extra_runs", "total", "wicket", "dismissed", "dismissal",
               "score", "text")
BALL_COLUMNS = ("match_id", "date") + BALL_FIELDS
FEED_PART = "/getBallFeeds"  # the version in the path (v1/v2/v3) differs from match to match

_CODE = re.compile(r"^(?P<n>\d*)(?P<k>wd|nb|lb|b|pen|w)?$", re.I)
_KIND = re.compile(r"^(?:(?P<ro>run out)|(?P<st>st\b)|(?P<lbw>lbw\b)|(?P<cb>c\s*&\s*b\b)|(?P<c>c\b)|(?P<b>b\b)|"
                   r"(?P<hw>hit wicket)|(?P<other>[a-z ]+))", re.I)


@dataclass
class Ball:
    match_key: str
    innings: int  # 1-based
    seq: int  # order within the innings, 1-based, every delivery incl. wides/no-balls
    over: int  # 0-based over number
    ball: int  # legal balls bowled in the over including this one
    legal: int  # 1 if the delivery counts as one of the over's six, else 0 (wide / no-ball)
    batting_team: str = ""
    striker: str = ""
    non_striker: str = ""
    bowler: str = ""
    bat_runs: int = 0
    extra_type: str = ""  # wd | nb | lb | b | pen
    extra_runs: int = 0
    total: int = 0
    wicket: int = 0
    dismissed: str = ""
    dismissal: str = ""
    score: str = ""  # innings score after the ball as CREX stamped it, "111/4"
    text: str = ""  # start of the commentary

    def row(self) -> dict:
        return asdict(self)


def _plain(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html or "").replace("&nbsp;", " ").replace("&amp;", "&")
    return re.sub(r"\s+", " ", text).strip()


def decode(code: str) -> tuple[int, str, int, bool, bool]:
    """(bat_runs, extra_type, extra_runs, legal, wicket) for a ball code (see the module docstring)."""
    m = _CODE.match((code or "").strip())
    if not m:
        return 0, "", 0, True, False
    n = int(m.group("n")) if m.group("n") else None
    k = (m.group("k") or "").lower()
    if k == "wd":
        return 0, "wd", n if n else 1, False, False  # '2wd' = a wide that went for 2 in all
    if k == "nb":
        return n or 0, "nb", 1, False, False  # the number is runs off the bat; the no-ball is one more
    if k in ("lb", "b", "pen"):
        return 0, k, n if n is not None else 1, True, False
    if k == "w":
        return n or 0, "", 0, True, True  # '1W' = a run-out after one run
    return n or 0, "", 0, True, False


def dismissal_kind(desc: str) -> str:
    """'c D Kulkarni b R Dhawan' -> 'caught', 'run out (X)' -> 'run out', ... ('' if unreadable)."""
    m = _KIND.match(_plain(desc))
    if not m:
        return ""
    for name, label in (("ro", "run out"), ("st", "stumped"), ("lbw", "lbw"), ("cb", "caught and bowled"),
                        ("c", "caught"), ("b", "bowled"), ("hw", "hit wicket")):
        if m.group(name):
            return label
    return (m.group("other") or "").strip().lower()


def parse_balls(events: list[dict], key: str = "", scorecard=None) -> list[Ball]:
    """Normalise a captured feed (any order, duplicates and re-entered balls allowed), oldest first.

    ``scorecard`` (a ``crex_scorecard.Scorecard``) supplies the batting order, which makes the
    non-striker exact; without it the non-striker is inferred and may be blank early in an innings.
    """
    latest: dict[tuple, dict] = {}
    for e in events or []:
        if isinstance(e, dict) and "id" in e and e.get("type") in ("b", "w") and e.get("inning", -1) >= 0:
            slot = (e["type"], e["inning"], e.get("delivery") if e["type"] == "b" else e.get("o"), e.get("o"))
            if slot not in latest or e["id"] > latest[slot]["id"]:
                latest[slot] = e  # a corrected re-entry carries the same delivery number and a newer id
    deliveries = sorted((e for e in latest.values() if e["type"] == "b"), key=lambda e: (e["inning"], e["id"]))
    cards = {(e["inning"], e.get("o")): e for e in latest.values() if e["type"] == "w"}

    order = {}
    if scorecard:
        for i, inn in enumerate(scorecard.innings):
            order[i] = [b.pid for b in inn.batters]
    out: list[Ball] = []
    seq: dict[int, int] = {}
    legal_in_over: dict[tuple[int, int], int] = {}
    pair: dict[int, list[str]] = {}
    queue: dict[int, list[str]] = {}
    for e in deliveries:
        inn = e["inning"]
        if inn not in pair:
            pair[inn], queue[inn] = list(order.get(inn, [])[:2]), list(order.get(inn, [])[2:])
        striker, p = e.get("pf", ""), pair[inn]
        if striker and striker not in p:  # not in the order we expected (no card, retired batter back, ...)
            p.append(striker)
            if striker in queue[inn]:
                queue[inn].remove(striker)
            if len(p) > 2:
                p.pop(0)
        non = next((x for x in p if x != striker), "")
        card = cards.get((inn, e.get("o")))
        kind = dismissal_kind(card.get("wicketDesc") or card.get("dismissal") or "") if card else ""
        bat, ex_type, ex_runs, legal, wicket = decode(str(e.get("b", "")))
        over = int(e.get("on", 0))
        lo = legal_in_over.get((inn, over), 0) + (1 if legal else 0)
        legal_in_over[(inn, over)] = lo
        seq[inn] = seq.get(inn, 0) + 1
        dismissed = ""
        if wicket:
            dismissed = (card or {}).get("player_fkey") or striker
            if dismissed in p:
                p.remove(dismissed)
                while queue[inn] and len(p) < 2:
                    nxt = queue[inn].pop(0)
                    if nxt not in p:
                        p.append(nxt)
        out.append(Ball(match_key=key or e.get("mfkey", ""), innings=inn + 1, seq=seq[inn], over=over, ball=lo,
                        legal=int(legal), batting_team=e.get("bat_team_fkey", ""), striker=striker,
                        non_striker=non, bowler=e.get("bf", ""), bat_runs=bat, extra_type=ex_type,
                        extra_runs=ex_runs, total=bat + ex_runs, wicket=int(wicket), dismissed=dismissed,
                        dismissal=kind if wicket else "", score=e.get("s", ""),
                        text=_plain(e.get("c2") or e.get("c1") or e.get("c") or "")[:200]))
    return out


def totals(balls: list[Ball]) -> dict[int, dict]:
    """Per-innings sums used by ``reconcile`` and handy for quick checks."""
    t: dict[int, dict] = {}
    for b in balls:
        d = t.setdefault(b.innings, {"runs": 0, "wkts": 0, "legal": 0, "bat": {}, "bowl": {}})
        d["runs"] += b.total
        d["wkts"] += b.wicket
        d["legal"] += b.legal
        s = d["bat"].setdefault(b.striker, [0, 0, 0, 0])  # runs, balls faced, fours, sixes
        if b.extra_type != "wd":
            s[1] += 1  # a no-ball counts as a ball faced, a wide does not
        s[0] += b.bat_runs
        s[2] += int(b.bat_runs == 4)
        s[3] += int(b.bat_runs == 6)
        w = d["bowl"].setdefault(b.bowler, [0, 0])  # legal balls, runs conceded (byes and leg-byes are not the bowler's)
        w[0] += b.legal
        w[1] += b.total - (b.extra_runs if b.extra_type in ("lb", "b", "pen") else 0)
    return t


def reconcile(balls: list[Ball], scorecard) -> list[str]:
    """Differences between the deliveries and a ``crex_scorecard.Scorecard`` (empty = proven).

    Messages start with ``innings:`` / ``bat:`` (the parse is wrong or incomplete) or ``bowl:`` (CREX's own
    feed and card sometimes disagree by a ball or a run: a warning, see ``is_hard``).
    """
    issues: list[str] = []
    t = totals(balls)
    if len(t) != len(scorecard.innings):
        issues.append(f"innings: balls {len(t)} vs scorecard {len(scorecard.innings)}")
    for i, inn in enumerate(scorecard.innings, 1):
        d = t.get(i)
        if not d:
            issues.append(f"innings: {i} has no deliveries")
            continue
        for b in inn.batters:
            if not b.balls and not b.runs:
                continue
            got = d["bat"].get(b.pid, [0, 0, 0, 0])
            if got != [b.runs, b.balls, b.fours, b.sixes]:
                issues.append(f"bat: innings {i} {scorecard.names.get(b.pid, b.pid)} {got} vs card "
                              f"{[b.runs, b.balls, b.fours, b.sixes]} (runs, balls, 4s, 6s)")
        for bw in inn.bowlers:
            got = d["bowl"].get(bw.pid, [0, 0])
            if got != [bw.balls, bw.runs]:
                issues.append(f"bowl: innings {i} {scorecard.names.get(bw.pid, bw.pid)} {got} vs card "
                              f"{[bw.balls, bw.runs]} (balls, runs)")
        if d["wkts"] != sum(1 for b in inn.batters if b.code):
            issues.append(f"bat: innings {i} wickets {d['wkts']} vs card {sum(1 for b in inn.batters if b.code)}")
    return issues


def is_hard(issue: str) -> bool:
    return not issue.startswith("bowl:")


def rows_for(match_id: str, date: str, balls: list[Ball]) -> list[dict]:
    return [{"match_id": match_id, "date": date, **b.row()} for b in balls]


def feed_events(html: str, bodies: list) -> list[dict]:
    """The newest events embedded in the page's state plus every page the scroll loaded."""
    from .crex_scorecard import parse_state

    events: list[dict] = []
    for k, v in (parse_state(html) or {}).items():
        if FEED_PART in k and isinstance(v, list):
            events += [e for e in v if isinstance(e, dict)]
    for body in bodies:
        if isinstance(body, list):
            events += [e for e in body if isinstance(e, dict)]
    return events


def match_key(url: str) -> str:
    """CREX's short match key: the id at the end of the slug (``...-match-updates-13W5`` -> ``13W5``)."""
    return url.rstrip("/").rsplit("-", 1)[-1]


def fetch_events(browser, url: str) -> list[dict]:
    """Scroll a match's summary page and return every feed event it loads (empty if CREX has none)."""
    page, bodies = browser.capture(url, FEED_PART)
    return feed_events(page.html, bodies)


def collect(browser, store, targets: list[tuple[str, str, str]], min_balls: int = 60, verbose: bool = True) -> dict:
    """Scrape and store ball-by-ball for ``targets`` = [(match_id, date, url)], one match at a time.

    A match is stored only if the parse reconciles with the scorecard (no hard issues); otherwise it is
    reported and skipped, so wrong numbers never reach the dataset. Returns counts plus the problems.
    """
    from .crex_scorecard import parse_scorecard

    out = {"saved": 0, "no_feed": 0, "rejected": 0, "failed": 0, "warnings": 0, "problems": []}
    for match_id, date, url in targets:
        try:
            events = fetch_events(browser, url)
            if sum(1 for e in events if e.get("type") == "b") < min_balls:
                out["no_feed"] += 1
                out["problems"].append(f"{match_id}: CREX has no ball-by-ball feed for this match")
                continue
            page = browser.render(url + "/match-scorecard", marker="getSC4")
            sc = parse_scorecard(page.html) if page.status < 400 else None
            if sc is None:
                out["failed"] += 1
                out["problems"].append(f"{match_id}: scorecard unavailable, cannot verify")
                continue
            balls = parse_balls(events, match_key(url), sc)
            issues = reconcile(balls, sc)
        except Exception as exc:  # one bad match must not stop the run
            out["failed"] += 1
            out["problems"].append(f"{match_id}: {str(exc).splitlines()[0][:160]}")
            continue
        hard = [i for i in issues if is_hard(i)]
        if hard:
            out["rejected"] += 1
            out["problems"].append(f"{match_id}: {len(hard)} hard mismatch(es), e.g. {hard[0]}")
            continue
        out["warnings"] += len(issues)
        store.upsert_balls(match_id, date, rows_for(match_id, date, balls))
        out["saved"] += 1
        if verbose:
            print(f"balls: {match_id}: {len(balls)} deliveries" + (f" ({len(issues)} warning(s))" if issues else ""))
    return out


assert tuple(f.name for f in fields(Ball)) == BALL_FIELDS
