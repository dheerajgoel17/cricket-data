"""Player profiles: role, batting hand and bowling style, read once per player from the source's public player page.

    python -m cricket_site.profiles --site site/public/data --data data [--value-bets value_bets/out] [--limit 250] [--budget 600] [--pause 2]

The page is the same one the photo map and the identity table already point at (``/player/<name>-<source id>``, found in the source's sitemap, robots-allowed; its API is never
called). The "Role", "Bats" and "Bowls" rows are read off the HTML and reduced to a small fixed vocabulary:

* role  ``BAT`` ``BWL`` ``AR`` ``WK``
* bat   ``RHB`` ``LHB``
* bowl  ``RF`` ``RFM`` ``RM`` ``LF`` ``LFM`` ``LM`` ``OB`` ``LB`` ``SLA`` ``SLC`` (``BOWL_LABELS`` has the readable form)

Anything the page does not say, or says in a way the vocabulary does not cover, stays missing: a style is never guessed. One compact row per *source* player lives in
``data/profiles/profiles.csv`` (``source_id,role,bat,bowl,checked``); a player who has a value is never fetched again, a player whose page had none is asked again after
``RETRY_DAYS``. The run is resumable (the file is saved as it goes), polite (``PoliteFetcher``: robots.txt, one request per ``--pause`` seconds), bounded (``--limit`` pages,
``--budget`` seconds), takes priced players first and then the ones with the most matches, and fails soft: a source outage ends the step with exit code 0 and the files as they were.
``profiles.json`` (``build_json``) maps *our* player id to the fields through the identity table. Stdlib only.
"""
from __future__ import annotations

import argparse
import csv
import html
import json
import re
import sys
import time
import urllib.error
from datetime import date, timedelta
from pathlib import Path

from cricket_data.hosts import host
from cricket_data.polite import PoliteFetcher

from . import identity
from .crex_assets import fetch_sitemap

STORE = Path("profiles") / "profiles.csv"  # under the data folder
FIELDS = ["source_id", "role", "bat", "bowl", "checked"]
RETRY_DAYS = 60  # a player whose page gave nothing is asked again after this long
ROLE_LABELS = {"BAT": "Batter", "BWL": "Bowler", "AR": "All-rounder", "WK": "Wicketkeeper"}
BAT_LABELS = {"RHB": "Right-hand bat", "LHB": "Left-hand bat"}
BOWL_LABELS = {"RF": "Right-arm fast", "RFM": "Right-arm fast-medium", "RM": "Right-arm medium", "LF": "Left-arm fast", "LFM": "Left-arm fast-medium",
               "LM": "Left-arm medium", "OB": "Off-spin", "LB": "Leg-spin", "SLA": "Left-arm orthodox", "SLC": "Left-arm wrist-spin"}
_ROW = re.compile(r'class="key"[^>]*>\s*([^<]+?)\s*</td>\s*<td[^>]*class="value"[^>]*>\s*([^<]*?)\s*</td>', re.S)


def norm_role(s: str) -> str:
    t = re.sub(r"[^a-z]+", "", (s or "").lower())
    if "keeper" in t or t == "wk":
        return "WK"
    if t.startswith("allround"):
        return "AR"
    return {"batter": "BAT", "batsman": "BAT", "bowler": "BWL"}.get(t, "")


def norm_bat(s: str) -> str:
    t = (s or "").lower().strip()
    return "RHB" if t.startswith("right") else "LHB" if t.startswith("left") else ""


def norm_bowl(s: str) -> str:
    """'right-arm offbreak . Spinner' -> 'OB'; 'na .' or a style the vocabulary does not cover -> ''."""
    t = re.sub(r"[^a-z]+", " ", (s or "").lower().split(" . ")[0]).strip()
    if not t or t.startswith("na"):
        return ""
    arm = "L" if re.search(r"\bleft\b", t) else "R" if re.search(r"\bright\b", t) else ""
    if "orthodox" in t:
        return "SLA" if arm == "L" else ""
    if "chinaman" in t or "wrist" in t or "unorthodox" in t:
        return "SLC" if arm == "L" else ""
    if "leg" in t or "googly" in t:
        return "LB"
    if "off" in t and "break" in t.replace(" ", "") or t.endswith("off spin"):
        return "OB" if arm != "L" else ""
    if not arm:
        return ""
    if "fast" in t and "medium" in t:
        return arm + "FM"
    if "fast" in t:
        return arm + "F"
    if "medium" in t:
        return arm + "M"
    return ""


def parse_profile(page: str) -> dict[str, str] | None:
    """{role, bat, bowl} read off a player page (missing fields are ''), or None when the page has no profile table at all."""
    rows = {html.unescape(k).strip(): html.unescape(v).strip() for k, v in _ROW.findall(page or "")}
    if not any(k in rows for k in ("Role", "Bats", "Bowls")):
        return None
    return {"role": norm_role(rows.get("Role", "")), "bat": norm_bat(rows.get("Bats", "")), "bowl": norm_bowl(rows.get("Bowls", ""))}


def load(data_dir: Path) -> dict[str, dict[str, str]]:
    f = data_dir / STORE
    if not f.exists():
        return {}
    with f.open(encoding="utf-8", newline="") as fh:
        return {r["source_id"]: r for r in csv.DictReader(fh) if r.get("source_id")}


def save(data_dir: Path, rows: dict[str, dict[str, str]]) -> None:
    f = data_dir / STORE
    f.parent.mkdir(parents=True, exist_ok=True)
    tmp = f.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=FIELDS, lineterminator="\n")
        w.writeheader()
        for k in sorted(rows):
            w.writerow({c: rows[k].get(c, "") for c in FIELDS})
    tmp.replace(f)


def known(row: dict[str, str] | None, today: date) -> bool:
    """A row with any value is final; an empty one is a "nothing yet" that stands for RETRY_DAYS."""
    if not row:
        return False
    if row.get("role") or row.get("bat") or row.get("bowl"):
        return True
    try:
        return date.fromisoformat(row.get("checked", "")) + timedelta(days=RETRY_DAYS) > today
    except ValueError:
        return False


def build_json(rows: dict[str, dict[str, str]], links: dict[str, str]) -> dict:
    """The site file: {"v": 1, "l": labels, "p": {our player id: {"r": role, "b": hand, "w": bowling style}}}; a missing field is left out, a player with none is not listed."""
    p: dict[str, dict[str, str]] = {}
    for pid, sid in sorted(links.items()):
        r = rows.get(sid) or {}
        e = {k: r[c] for k, c in (("r", "role"), ("b", "bat"), ("w", "bowl")) if r.get(c)}
        if e:
            p[pid] = e
    return {"v": 1, "l": {"r": ROLE_LABELS, "b": BAT_LABELS, "w": BOWL_LABELS}, "p": p}


def write_site(out: Path, data_dir: Path, links: dict[str, str]) -> dict:
    doc = build_json(load(data_dir), links)
    (out / "profiles.json").write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    return doc


def order(links: dict[str, str], priced: set[str], matches: dict[str, int]) -> list[str]:
    """Source ids to fetch, priced players first, then by matches played (most first); ties by id so a run is repeatable."""
    return [t[2] for t in sorted((pid not in priced, -matches.get(pid, 0), sid) for pid, sid in links.items())]


def run(site: Path, data_dir: Path, vb_dir: Path | None, limit: int, budget: float, pause: float, today: date | None = None, fetcher=None, sitemap: str | None = None) -> dict:
    today = today or date.today()
    ident = json.loads((site / "identity.json").read_text(encoding="utf-8"))
    links: dict[str, str] = ident.get("s", {})
    idx = json.loads((site / "index.json").read_text(encoding="utf-8"))["players"]
    matches = dict(zip(idx["id"], idx["n"], strict=True))
    rows = load(data_dir)
    todo = [s for s in order(links, set(identity.collect_books(vb_dir)), matches) if not known(rows.get(s), today)]
    stats = {"linked": len(links), "stored": len(rows), "pending": len(todo), "fetched": 0, "found": 0, "empty": 0, "failed": 0}
    if not todo or limit <= 0:
        return stats
    try:
        base = host("LIVE_SOURCE_BASE")
        urls = dict(re.findall(r"<loc>\s*(" + re.escape(base) + r"/player/[^<\s]+-([0-9A-Za-z]+))\s*</loc>", sitemap if sitemap is not None else fetch_sitemap("player")))
        by_id = {sid: u for u, sid in urls.items()}
    except (RuntimeError, urllib.error.URLError, OSError) as exc:
        print(f"profiles: the source's player list is unavailable ({exc}); nothing fetched", file=sys.stderr)
        return stats
    fetcher = fetcher or PoliteFetcher(min_interval=pause)
    t0, bad = time.monotonic(), 0
    for sid in todo[:limit]:
        if time.monotonic() - t0 > budget or bad >= 5:
            break
        url = by_id.get(sid)
        if not url:
            continue  # the source's list no longer has him
        try:
            prof = parse_profile(fetcher.get(url))
        except (urllib.error.URLError, OSError, PermissionError, ValueError):
            bad += 1
            stats["failed"] += 1
            continue
        bad = 0
        stats["fetched"] += 1
        rows[sid] = {"source_id": sid, **(prof or {"role": "", "bat": "", "bowl": ""}), "checked": today.isoformat()}
        stats["found" if prof and any(prof.values()) else "empty"] += 1
        if stats["fetched"] % 25 == 0:
            save(data_dir, rows)
    if stats["fetched"]:
        save(data_dir, rows)
    stats["stored"] = len(rows)
    return stats


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--site", default="site/public/data", help="the built site data (needs identity.json and index.json; profiles.json is written here)")
    ap.add_argument("--data", default="data")
    ap.add_argument("--value-bets", default="value_bets/out")
    ap.add_argument("--limit", type=int, default=250, help="most pages to fetch this run")
    ap.add_argument("--budget", type=float, default=600, help="stop fetching after this many seconds")
    ap.add_argument("--pause", type=float, default=2.0, help="seconds between requests")
    a = ap.parse_args(argv)
    site, data = Path(a.site), Path(a.data)
    try:
        stats = run(site, data, Path(a.value_bets) if a.value_bets else None, a.limit, a.budget, a.pause)
        doc = write_site(site, data, json.loads((site / "identity.json").read_text(encoding="utf-8")).get("s", {}))
    except (OSError, ValueError, KeyError) as exc:
        print(f"profiles: skipped ({exc})", file=sys.stderr)
        return 0
    print(json.dumps({**stats, "with_profile": len(doc["p"])}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
