"""Data guard: invariants over the freshly built site data and the published book lines, checked on every build before the deploy.

    python -m cricket_site.guard --site site/public/data --data data [--live URL_OR_FILE] [--summary FILE]

Prints a table (markdown; also appended to ``--summary``, the job summary) and exits 1 only when a *hard* check finds something: the build stops before the deploy and the
last good deploy stays up. Warnings are listed and never stop a build. Each rule is restated here in plain terms on purpose: a check that called the builder's or the
engine's own function would agree with a bug in it (the one place the engine is asked, check c, is compared with a recount).

    a  hard  a fixture published as Live has the schedule's word for it (a stop-gap row from the books cannot know); warn: the live body lists a match in play with no score and no players
    b  hard  a match flagged in play is inside its keep window (24 h, a Test 6 days) and has no result; published book lines are inside the pipeline's own carry window
    c  hard  each edition's bat-first win % equals a recount over every match in it with a winner (the engine is run on the built data)
    d  hard  a complete match (both innings ran their course) is not void; warn: the share of void summary-market matches per format per week
    e  warn  a scraped innings' stated total agrees with the batters' runs plus extras and with ball by ball
    f  hard  one pair of sides is not two fixtures within 12 h, and a stop-gap row from the books is not a scheduled match under other names (same start, both sides alike)
    g  warn  priced players that could not be linked to the live source
    h  warn  the published hot rows file (when there is one) is for this build of the data, is well formed and kept most of the priced lines it was asked to score
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from .build import _side
from .parse import FORMAT_NAMES, INN_LEN
from .sides import find_scheduled
from .wrap import unwrap

HARD, WARN = "hard", "warn"
H = 3600
# Windows. Kept equal to BOOK_KEEP_MS / TEST_KEEP_MS in site/packages/engine/lines.js and LIVE_KEEP / TEST_KEEP in src/value_bets/booklines.py (tests/site/test_guard.py checks both).
KEEP_S, TEST_KEEP_S = 24 * H, 6 * 24 * H
CARRY_S, TEST_CARRY_S = 40 * H, 6 * 24 * H
LINES_STALE_S = 3 * H  # two missed hourly runs
GRACE_S = H  # the build runs hourly: a row inside its window at the last build may be a little past it now
DUP_S = 12 * H
VOID_WARN, VOID_MIN, VOID_WEEKS = 0.2, 10, 8
SHOWN = 12  # findings listed per check in the summary
BALLS = {0: 120, 1: 300, 3: 100, 4: 60, 5: 360}  # scheduled balls per innings by format index (T20, ODI, Hundred, T10, 60-over); a Test has none
MULTI_DAY = ("Test", "FC")
ROOT = Path(__file__).resolve().parents[2]


@dataclass
class Check:
    id: str
    title: str
    level: str
    checked: int = 0
    problems: list[str] = field(default_factory=list)
    skipped: str = ""
    note: str = ""

    @property
    def status(self) -> str:
        if self.skipped:
            return f"skipped: {self.skipped}"
        if not self.problems:
            return "ok"
        return f"{'FAIL' if self.level == HARD else 'warn'} ({len(self.problems)})"


def _ts(iso: str) -> float | None:
    """Seconds since the epoch for an ISO start ("2026-11-01T07:30Z", with seconds or a date only); None when unreadable."""
    s = (iso or "").strip().replace("Z", "")
    try:
        if len(s) == 10:
            return datetime.fromisoformat(s).replace(tzinfo=timezone.utc).timestamp() + 12 * H
        return datetime.fromisoformat(s[:19]).replace(tzinfo=timezone.utc).timestamp()
    except ValueError:
        return None


def _name(f: dict) -> str:
    return f"{f.get('a')} v {f.get('b')} ({str(f.get('start'))[:16]})"


def keep_s(fmt: str) -> int:
    return TEST_KEEP_S if fmt in MULTI_DAY else KEEP_S


# ------------------------------------------------------------------ a: evidence for "in play"
def check_live_evidence(fixtures: list[dict], live: dict | None = None) -> list[Check]:
    c = Check("a", "Live has evidence: only the schedule's word makes a fixture Live", HARD, len(fixtures))
    c.problems = [f"{_name(f)} is Live from source '{f.get('source')}', which cannot know (only the schedule says Live)" for f in fixtures if f.get("status") == "Live" and f.get("source") != "src"]
    c.note = f"{sum(f.get('status') == 'Started' for f in fixtures)} started with no word on play (shown as Started, no score), {sum(f.get('status') == 'Live' for f in fixtures)} Live"
    if live is None:
        return [c]
    w = Check("a-live", "The live body has a score or players for every match in play", WARN, 0)
    for m in live.get("matches") or []:
        if m.get("status") != "live":
            continue
        w.checked += 1
        scored = any((t or {}).get("display") for t in m.get("teams") or [])
        if not (scored or m.get("innings") or m.get("players")):
            w.problems.append(f"{' v '.join(str((t or {}).get('name')) for t in m.get('teams') or [])} ({str(m.get('start'))[:16]}) is in play with no score and no players")
    return [c, w]


# ------------------------------------------------------------------ b: keep windows
def check_keep_window(fixtures: list[dict], lines: dict | None, now: float) -> Check:
    c = Check("b", "Nothing finished or long gone is flagged in play (24 h; a Test 6 days)", HARD)
    for f in fixtures:
        if f.get("status") not in ("Live", "Started"):
            continue
        c.checked += 1
        t = _ts(f.get("start"))
        if (f.get("result") or "").strip():
            c.problems.append(f"{_name(f)} is {f['status']} but has a result: {f['result']}")
        elif t is not None and now > t + keep_s(f.get("fmt")) + GRACE_S:
            c.problems.append(f"{_name(f)} is {f['status']} {(now - t) / H:.0f} h after its start (keep {keep_s(f.get('fmt')) // H} h)")
    # the published book lines: the pipeline carries a started match 40 h (a Test 6 days) at the moment it writes the file; older rows mean a finished match was kept
    ref = _ts((lines or {}).get("generated_at_utc")) or now
    rows = [x for k in ("lines", "events", "fancy") for x in (lines or {}).get(k) or []]
    tests = {x.get("match") for x in rows if x.get("fmt") == "Test"}
    stale: dict[tuple, float] = {}
    for x in rows:
        t = _ts(x.get("start_utc"))
        if t is None:
            continue
        c.checked += 1
        limit = TEST_CARRY_S if x.get("fmt") == "Test" or x.get("match") in tests else CARRY_S
        if ref > t + limit + GRACE_S:
            stale[(x.get("match"), x.get("start_utc"))] = (ref - t) / H
    c.problems += [f"book lines for {m} ({s[:16]}) were written {h:.0f} h after the start" for (m, s), h in sorted(stale.items(), key=lambda kv: str(kv[0]))]
    return c


def check_lines_fresh(lines: dict | None, now: float) -> Check:
    """The book lines file is written hourly; one older than this has stopped being kept up, and every started match in it is stale."""
    c = Check("b-fresh", f"The published book lines are less than {LINES_STALE_S // H} h old", WARN, 1)
    t = _ts((lines or {}).get("generated_at_utc"))
    if t is None:
        c.problems.append("the book lines carry no generated_at_utc")
    elif now - t > LINES_STALE_S:
        c.problems.append(f"the book lines were written {(now - t) / H:.0f} h ago ({lines['generated_at_utc'][:16]})")
    return c


# ------------------------------------------------------------------ c: bat-first win %
def recount_bat_first(M: dict, ids: list[str]) -> tuple[int, float | None]:
    """(decided, bat-first win %) over every match in `ids` that has a winner and a known first-innings side: no summary-market filter."""
    at = {i: k for k, i in enumerate(M["id"])}
    decided = wins = 0
    for i in ids:
        k = at.get(i)
        if k is not None and M["r"][k] == 0 and M["w"][k] >= 0 and M["fi"][k] >= 0:
            decided += 1
            wins += M["w"][k] == M["fi"][k]
    # Round exact half-tenths up, as the engine does (9/16 is 56.25%, shown as 56.3%).
    return decided, ((2000 * wins + decided) // (2 * decided) / 10 if decided else None)


def check_bat_first(M: dict, editions: list[dict] | None) -> Check:
    c = Check("c", "Each edition's bat-first win % is a recount over every match with a winner", HARD)
    if editions is None:
        c.skipped = "node is not available"
        return c
    for e in editions:
        c.checked += 1
        n, pct = recount_bat_first(M, e["ids"])
        if n != e["decided"] or (pct is None) != (e["pct"] is None) or (pct is not None and abs(pct - e["pct"]) > 0.051):
            c.problems.append(f"{e['event']} {e['name']}: the site says {e['pct']}% over {e['decided']}, a recount says {pct}% over {n}")
    return c


def engine_editions(site: Path) -> list[dict] | None:
    """The engine's own edition numbers for the built data (site/scripts/edition-bat-first.mjs); None without node."""
    node = shutil.which("node")
    if not node:
        return None
    r = subprocess.run([node, str(ROOT / "site" / "scripts" / "edition-bat-first.mjs"), str(site)], capture_output=True, text=True, timeout=300)
    if r.returncode:
        raise RuntimeError(f"the engine could not read the built data: {r.stderr.strip()[-400:]}")
    return json.loads(r.stdout)


# ------------------------------------------------------------------ d: void summary markets
def _sched_balls(fmt: int, overs: int) -> int:
    default = BALLS[fmt]
    per = default // INN_LEN[fmt]
    return overs * per if 0 < overs <= INN_LEN[fmt] else default


def complete_match(M: dict, k: int) -> bool:
    """Both innings of a limited-overs match ran their course: the first all out or its overs bowled, the second also if it overtook the first and won."""
    inn = M["inn"][k]
    if len(inn) < 2 or M["f"][k] not in BALLS:
        return False
    sched = _sched_balls(M["f"][k], M["o"][k] or 0)
    (t1, r1, w1, b1), (t2, r2, w2, b2) = [(i[0], i[1] or 0, i[2] or 0, i[3] or 0) for i in inn[:2]]
    first = w1 >= 10 or b1 >= sched
    second = w2 >= 10 or b2 >= sched or (M["r"][k] == 0 and M["w"][k] == t2 and r2 > r1)
    return first and second


def check_complete_not_void(M: dict) -> Check:
    c = Check("d-complete", "A complete match is not void for summary markets (no weather, no early finish)", HARD)
    dls = M.get("dls")  # the weather flag, when the build publishes it
    for k in range(len(M["id"])):
        if M["f"][k] not in BALLS or M["q"][k] == -1:
            continue
        c.checked += 1
        if M["q"][k] == 0 and not (dls and dls[k]) and complete_match(M, k):
            c.problems.append(f"{M['id'][k]} ({M['d'][k]}, {FORMAT_NAMES[M['f'][k]]}) is void for summary markets but both innings ran their course")
    return c


def void_share(M: dict, today: date, weeks: int = VOID_WEEKS) -> dict[tuple[str, str], tuple[int, int]]:
    """{(format, ISO week): (void, matches)} for the last `weeks` weeks, over matches whose validity is known."""
    out: dict[tuple[str, str], list[int]] = defaultdict(lambda: [0, 0])
    since = today - timedelta(weeks=weeks)
    for k in range(len(M["id"])):
        if M["q"][k] not in (0, 1) or M["f"][k] not in BALLS:
            continue
        d = date.fromisoformat(M["d"][k])
        if d < since or d > today:
            continue
        y, w, _ = d.isocalendar()
        v = out[(FORMAT_NAMES[M["f"][k]], f"{y}-W{w:02d}")]
        v[0] += M["q"][k] == 0
        v[1] += 1
    return {k: (v[0], v[1]) for k, v in out.items()}


def check_void_share(M: dict, today: date) -> Check:
    c = Check("d-share", f"Void summary-market matches per format per week stay under {VOID_WARN:.0%}", WARN)
    share = void_share(M, today)
    c.checked = sum(n for _, n in share.values())
    for (fmt, wk), (v, n) in sorted(share.items()):
        if n >= VOID_MIN and v / n > VOID_WARN:
            c.problems.append(f"{fmt} {wk}: {v} of {n} matches void ({v / n:.0%})")
    if share:
        c.note = "; ".join(f"{fmt} {sum(v for (f, _), (v, _n) in share.items() if f == fmt)} of {sum(n for (f, _), (_v, n) in share.items() if f == fmt)}" for fmt in FORMAT_NAMES if any(f == fmt for f, _ in share)) + f" void in {VOID_WEEKS} weeks"
    return c


# ------------------------------------------------------------------ e: scraped totals
def _fold(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def _int(x) -> int:
    try:
        return int(float(x))
    except (TypeError, ValueError):
        return 0


def check_scraped_totals(docs: list[dict], balls: dict[str, dict[str, tuple[int, int]]] | None) -> Check:
    """`balls` is {match id: {team: (total, extras)}} for the first two innings. Extras are the ball by ball's; the scorecard states a total only."""
    c = Check("e", "A scraped innings' stated total is the batters' runs plus extras and the ball-by-ball total", WARN)
    for d in docs:
        if d.get("match_type") in ("Test", "FC", "MDM"):  # four innings: the ball data and the stated totals cover the first two only
            continue
        bat: dict[str, int] = defaultdict(int)
        for p in d.get("players") or []:
            bat[_fold(p.get("team"))] += _int(p.get("runs"))
        stated = {_fold(i.get("team")): _int(i["runs"]) for i in d.get("innings") or [] if i.get("runs") is not None}
        bb = {_fold(t): v for t, v in (balls or {}).get(d.get("match_id", ""), {}).items()}
        for t in sorted(set(stated) | set(bb)):
            s, b, x = stated.get(t), bat.get(t, 0), bb.get(t)
            if s is None and x is None:
                continue
            if s is not None and x is None:
                c.checked += 1
                if s < b:
                    c.problems.append(f"{d['match_id']} {t}: the stated {s} is below the batters' {b}")
                continue
            c.checked += 1
            total, extras = x
            if (s is not None and not s == total == b + extras) or (s is None and b + extras != total):
                c.problems.append(f"{d['match_id']} {t}: stated {s if s is not None else '-'}, batters {b} + extras {extras} = {b + extras}, ball by ball {total}")
    return c


def ball_totals(data: Path, match_ids: set[str]) -> dict[str, dict[str, tuple[int, int]]]:
    """Ball-by-ball totals (runs, extras) per batting side for the first two innings of the given matches (data/balls/*.csv.gz); a team batting in two innings of a Test is left out."""
    acc: dict[str, dict[tuple[str, str], list]] = defaultdict(dict)
    for f in sorted((data / "balls").glob("*.csv.gz")):
        with gzip.open(f, "rt", encoding="utf-8", newline="") as fh:
            for r in csv.DictReader(fh):
                if r["match_id"] not in match_ids or r["innings"] not in ("1", "2"):
                    continue
                a = acc[r["match_id"]].setdefault((r["innings"], r["team_name"]), [0, 0])
                a[0] += _int(r["total"])
                a[1] += _int(r["extra_runs"])
    out: dict[str, dict[str, tuple[int, int]]] = {}
    for mid, innings in acc.items():
        teams = [t for _, t in innings]
        out[mid] = {t: (v[0], v[1]) for (_, t), v in innings.items() if teams.count(t) == 1}
    return out


# ------------------------------------------------------------------ f: duplicate fixtures
def check_duplicate_fixtures(fixtures: list[dict]) -> Check:
    c = Check("f", "One pair of sides is not two fixtures within 12 h", HARD, len(fixtures))
    by: dict[tuple, list[tuple[float, dict]]] = defaultdict(list)
    for f in fixtures:
        t = _ts(f.get("start"))
        if t is not None:
            by[(f.get("gender"), frozenset((_side(f.get("a")), _side(f.get("b")))))].append((t, f))
    for rows in by.values():
        rows.sort(key=lambda r: r[0])
        for (t1, f1), (t2, f2) in zip(rows, rows[1:], strict=False):
            if t2 - t1 < DUP_S:
                c.problems.append(f"{_name(f1)} and {_name(f2)} are {(t2 - t1) / H:.1f} h apart")
    sched = [(f, f.get("a"), f.get("b"), _ts(f.get("start")), f.get("gender") == "female") for f in fixtures if f.get("source") != "books" and f.get("fmt") not in ("Test", "FC") and _ts(f.get("start")) is not None]
    for f in fixtures:
        t = _ts(f.get("start"))
        if f.get("source") == "books" and f.get("fmt") not in ("Test", "FC") and t is not None and (g := find_scheduled(f.get("a"), f.get("b"), t, f.get("gender") == "female", sched)):
            c.problems.append(f"{_name(f)} (from the books) is the scheduled {_name(g)}: same start, sides alike")
    return c


# ------------------------------------------------------------------ g: unlinked priced players
def check_unlinked(review: list[dict] | None, linked: int | None = None) -> Check:
    c = Check("g", "Every priced player is linked to the live source", WARN, (linked or 0) + len(review or []))
    c.problems = [f"{r.get('name')} (`{r.get('pid')}`): {r.get('why')}" for r in review or []]
    return c


HOT_FIELDS = ("idx", "name", "line", "prior", "opp", "venue", "l5", "l10", "season", "h2h", "ven", "last", "max", "settled")


def check_hot_rows(hot: dict | None, meta: dict, now: float) -> Check:
    """``hot-rows.json`` (docs/PROJECT_GUIDE.md 5.11) is optional: the apps score on the phone without it. A file that is there must be for this build of the data (its row numbers are
    positions in that build's player list), well formed, recent, and not a collapse of the pass (most of the lines it was asked to score have a row)."""
    c = Check("h", "The hot rows file matches this build and kept most of its lines", WARN)
    if hot is None:
        c.skipped = "no hot rows file (the apps score on the phone)"
        return c
    rows = hot.get("rows")
    if hot.get("v") != 1 or not isinstance(rows, dict):
        c.problems.append("not a version 1 file with a rows object")
        return c
    c.checked = len(rows)
    if hot.get("build") != meta.get("built_at"):
        c.problems.append(f"built for data {hot.get('build')}, the site data is {meta.get('built_at')}")
    t = _ts(str(hot.get("generated_at_utc") or ""))
    if t is None or now - t > 6 * H:
        c.problems.append(f"generated {hot.get('generated_at_utc')}, more than 6 h ago")
    if hot.get("scored") != len(rows):
        c.problems.append(f"says {hot.get('scored')} rows scored, holds {len(rows)}")
    n = int(hot.get("lines") or 0)
    if n >= 20 and len(rows) < 0.5 * n:
        c.problems.append(f"only {len(rows)} of {n} priced lines have a row")
    bad = [k for k, r in rows.items() if not isinstance(r, dict) or any(f not in r for f in HOT_FIELDS)]
    if bad:
        c.problems.append(f"{len(bad)} rows lack a field, e.g. `{bad[0]}`")
    return c


# ------------------------------------------------------------------ run and report
def _read(path: Path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def load_live(src: str) -> dict | None:
    """The /api/live body from a file or a URL (unwrapped with DATA_WRAP_KEY when the route wraps it); None when it cannot be read (the check is then skipped, never failed)."""
    try:
        if re.match(r"https?://", src):
            with urllib.request.urlopen(src, timeout=20) as r:  # noqa: S310
                body = json.loads(r.read().decode("utf-8"))
        else:
            body = json.loads(Path(src).read_text(encoding="utf-8"))
        body = unwrap(body, os.environ.get("DATA_WRAP_KEY", "").strip())
    except (OSError, ValueError):
        return None
    return body if isinstance(body, dict) and isinstance(body.get("matches"), list) else None


def run(site: Path, data: Path, live: dict | None = None, now: float | None = None, editions: list[dict] | None | str = "run") -> list[Check]:
    now = datetime.now(timezone.utc).timestamp() if now is None else now
    today = datetime.fromtimestamp(now, timezone.utc).date()
    fixtures = _read(site / "fixtures.json", [])
    lines = _read(site / "lines.json", {})
    M = _read(site / "matches.json")
    if M is None:
        raise FileNotFoundError(f"{site / 'matches.json'} is missing or unreadable")
    meta = _read(site / "meta.json", {})
    checks = [*check_live_evidence(fixtures, live), check_keep_window(fixtures, lines, now), check_lines_fresh(lines, now)]
    checks.append(check_bat_first(M, engine_editions(site) if editions == "run" else editions))
    checks += [check_complete_not_void(M), check_void_share(M, today)]
    docs = [d for f in sorted((data / "provisional").glob("*.json")) if (d := _read(f))]
    checks.append(check_scraped_totals(docs, ball_totals(data, {d.get("match_id", "") for d in docs}) if (data / "balls").is_dir() else None))
    checks += [check_duplicate_fixtures(fixtures), check_unlinked(_read(site / "identity_review.json", []), meta.get("identity_linked"))]
    checks.append(check_hot_rows(_read(site / "hot-rows.json"), meta, now))
    return checks


def to_markdown(checks: list[Check]) -> str:
    hard = [c for c in checks if c.level == HARD and c.problems]
    head = f"### Data guard: {'FAILED, ' + str(len(hard)) + ' hard check' + ('s' if len(hard) > 1 else '') if hard else 'passed'}"
    rows = ["| | check | level | checked | result |", "|---|---|---|---|---|"]
    rows += [f"| {c.id} | {c.title}{f' ({c.note})' if c.note else ''} | {c.level} | {c.checked} | {c.status} |" for c in checks]
    body = []
    for c in checks:
        if c.problems:
            body += ["", f"**{c.id}: {c.title}**", *[f"- {p}" for p in c.problems[:SHOWN]]]
            if len(c.problems) > SHOWN:
                body.append(f"- … and {len(c.problems) - SHOWN} more")
    return "\n".join([head, "", *rows, *body]) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", default="site/public/data", help="the built site data")
    ap.add_argument("--data", default="data", help="the dataset (provisional matches, ball by ball)")
    ap.add_argument("--live", default="", help="a /api/live body, as a file or URL (optional: its findings are warnings)")
    ap.add_argument("--summary", default="", help="append the table to this file (the job summary)")
    ap.add_argument("--now", default="", help="judge by this ISO time instead of the clock (replays and tests)")
    a = ap.parse_args(argv)
    live = load_live(a.live) if a.live else None
    try:
        checks = run(Path(a.site), Path(a.data), live, _ts(a.now) if a.now else None)
    except (OSError, RuntimeError) as exc:
        print(f"::error title=Data guard::{exc}")
        return 2
    if a.live and live is None:
        checks.append(Check("a-live", "The live body has a score or players for every match in play", WARN, skipped="the live body could not be read"))
    md = to_markdown(checks)
    print(md)
    if a.summary:
        with open(a.summary, "a", encoding="utf-8") as fh:
            fh.write(md)
    for c in checks:
        for p in c.problems[:5]:
            print(f"::{'error' if c.level == HARD else 'warning'} title=Data guard {c.id}::{p}")
    return 1 if any(c.level == HARD and c.problems for c in checks) else 0


if __name__ == "__main__":
    sys.exit(main())
