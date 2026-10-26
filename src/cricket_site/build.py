"""Build the static site data (site/public/data) from Cricsheet ball-by-ball + the repo's provisional matches.

    python -m cricket_site.build --zip all_json.zip --data data --out site/public/data

Everything here is stdlib-only. Output (all JSON, columnar, deterministic):
  meta.json      freshness, counts, rules
  index.json     players / teams / venues / events tables
  matches.json   one column per field, one entry per match (+ per-innings market aggregates)
  p/NN.json      player shards: batting rows, bowling spells, partnerships keyed by the lower player index
  fixtures.json  upcoming fixtures
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import zipfile
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from .crex_doc import balls_doc
from .parse import FORMAT_NAMES, KINDS, parse_match, squad_quality

NSHARD = 64
SCHEMA = 1
NEUTRAL_VENUE = re.compile(r"dubai|sharjah|abu dhabi|zayed|dhabi|al amerat|muscat|doha", re.I)


# ------------------------------------------------------------------ worker (picklable, compact output)
_ZIP: zipfile.ZipFile | None = None


def _compact(m: dict) -> dict:
    out = {k: m[k] for k in ("id", "date", "fmt", "gender", "intl", "event", "venue", "city", "teams", "winner",
                              "res", "overs", "bpo", "days", "first", "q", "mc", "ts", "ho")}
    out["pv"] = 0
    out["inn"] = [[i["team"], i["opp"], i["runs"], i["wkts"], i["balls"], i["f4"], i["f6"], i["n30"], i["n50"],
                   i["n100"], i["n10"], i["nsd"], i["nduck"], i["ho"], i["mc"], i["ts"], i["tops"]]
                  for i in m["innings"]]
    out["bat"] = [(p, i["no"], i["team"], i["opp"], v["o"], v["r"], v["b"], v["f"], v["s"], v["k"], v["tb"], v["mt"])
                  for i in m["innings"] for p, v in i["bat"].items()]
    out["bowl"] = [(p, i["no"], i["opp"], i["team"], v["w"], v["rc"], v["bb"])
                   for i in m["innings"] for p, v in i["bowl"].items()]
    out["xi"] = m.get("xi", [])
    out["xq"] = m.get("xq", 0)
    out["parts"] = [(t["a"], t["b"], i["no"], t["open"], t["w"], t["runs"], t["balls"], t["ra"], t["rb"], t["x"], t["kd"])
                    for i in m["innings"] for t in i["parts"]]
    return out


def _work(args: tuple[str, str]) -> dict | None:
    global _ZIP
    zpath, name = args
    if _ZIP is None:
        _ZIP = zipfile.ZipFile(zpath)
    try:
        m = parse_match(name[:-5].rsplit("/", 1)[-1], json.loads(_ZIP.read(name)))
    except Exception as exc:  # one bad file must not sink the build
        print(f"skip {name}: {exc}", file=sys.stderr)
        return None
    return _compact(m) if m else None


def parse_zip(zpath: Path, workers: int = 4) -> list[dict]:
    with zipfile.ZipFile(zpath) as z:
        names = [n for n in z.namelist() if n.endswith(".json")]
    jobs = [(str(zpath), n) for n in names]
    if workers <= 1:
        res = [_work(j) for j in jobs]
    else:
        with ProcessPoolExecutor(workers) as ex:
            res = list(ex.map(_work, jobs, chunksize=200))
    return [r for r in res if r]


# ------------------------------------------------------------------ provisional
def _norm_team(s: str) -> str:
    s = (s or "").lower().replace("&", " and ")
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"\s+(women|w)$", "", s.strip())
    return re.sub(r"[^a-z0-9]", "", s)


def _strip_women(s: str) -> str:
    return re.sub(r"\s+(women|\(w\)|w)$", "", (s or "").strip(), flags=re.I)


def fold_name(s: str) -> str:
    from .crex_assets import fold

    return fold(s)


def _int_getter(row: dict):
    return lambda k: int(row.get(k) or 0)


def load_provisional(data_dir: Path, canonical: list[dict], name_pid: dict[str, str] | None = None) -> tuple[list[dict], dict]:
    """Provisional (scraped) matches that Cricsheet has not published yet, as compact match dicts."""
    from cricket_data.registry import pending_provisional  # local import: keeps the parser usable standalone
    from cricket_data.store import Store

    store = Store(data_dir)
    gen = {"male": 0, "female": 1}
    seen: dict[tuple, list[int | None]] = {}  # (date, teams, gender) -> total batter runs of each canonical match that day
    for m in canonical:
        runs = sum(r[5] for r in m["bat"]) if m["bat"] else None
        for dd in (-1, 0, 1):
            d = (date.fromisoformat(m["date"]) + timedelta(days=dd)).isoformat()
            seen.setdefault((d, frozenset(_norm_team(t) for t in m["teams"]), m["gender"]), []).append(runs if dd else -1)
    out, stat = [], {"files": 0, "matches": 0, "rows": 0, "rows_unlinked": 0, "unlinked_names": [], "with_deliveries": 0}
    deliveries: dict[str, list[dict]] = {}  # CREX ball-by-ball (data/balls), keyed by match id
    for month in store.months("balls"):
        for r in store.read("balls", month):
            deliveries.setdefault(r["match_id"], []).append(r)
    for d in pending_provisional(store):
        stat["files"] += 1
        g = gen.get(d.get("gender", ""), 0)
        key = (d.get("date", ""), frozenset((_norm_team(d["team_a"]), _norm_team(d["team_b"]))), g)
        if not d.get("date"):
            continue
        if key in seen:
            # same fixture +/-1 day, but consecutive-day games between the same two sides are real: an adjacent-date "duplicate" only
            # counts when the batter-run totals agree (CREX and Cricsheet can differ by a day across time zones)
            prov_runs = sum(int(p.get("runs") or 0) for p in d.get("players", []))
            if any(r == -1 or r is None or not prov_runs or r == prov_runs for r in seen[key]):
                continue
        fmt = {"T20": 0, "IT20": 0, "ODI": 1, "ODM": 1, "Test": 2}.get(d.get("match_type", ""))
        if fmt is None:
            continue
        if "hundred" in (d.get("event") or "").lower():
            fmt = 3  # The Hundred is its own format: never feed it into T20
        mid = d["match_id"]
        m = {"id": mid, "date": d["date"], "fmt": fmt, "gender": g, "intl": 1 if d.get("team_type") == "international" else 0,
             "event": d.get("event", ""), "venue": d.get("venue", ""), "city": "",
             "teams": [d["team_a"], d["team_b"]], "winner": d.get("winner", ""),
             "res": 0 if d.get("winner") else 2, "overs": 0, "bpo": 6, "days": 1, "first": "", "q": -1,
             "mc": 0, "ts": 0, "ho": 0, "pv": 1, "inn": [], "bat": [], "bowl": [], "parts": [], "aliases": [], "xi": [], "xq": 0}
        registry: dict[str, str] = {}
        for p in d.get("players", []):
            stat["rows"] += 1
            pid = p.get("player_id", "")
            if not pid and name_pid:  # not linked by `link-players` (e.g. Afghanistan, withheld by Cricsheet): use CREX's full-name match
                pid = name_pid.get(fold_name(p.get("player", "")), "")
                stat["rows_linked_by_crex"] = stat.get("rows_linked_by_crex", 0) + bool(pid)
            if pid:
                registry[p.get("player", "")] = pid
                m["xi"].append(pid)  # scraped squads list everyone named for the match, batting or not
            if not pid:
                stat["rows_unlinked"] += 1
                if len(stat["unlinked_names"]) < 50:
                    stat["unlinked_names"].append(p.get("player", ""))
                continue
            m["aliases"].append((pid, p.get("player", "")))
            n = _int_getter(p)
            if n("balls") or n("runs"):
                m["bat"].append((pid, 0, p["team"], p["opponent"], 0, n("runs"), n("balls"), n("fours"), n("sixes"), -1, -1, -1))
            if n("balls_bowled"):
                m["bowl"].append((pid, 0, p["team"], p["opponent"], n("wickets"), n("runs_conceded"), n("balls_bowled")))
        sides: dict[str, int] = {}
        for p in d.get("players", []):
            sides[p.get("team", "")] = sides.get(p.get("team", ""), 0) + 1
        m["xq"] = squad_quality(list(sides.values()), lo=10)  # scraped squads: stricter, a side with 1-2 players is a failed scrape
        if mid in deliveries:
            _with_deliveries(m, d, fmt, deliveries[mid], registry, stat)
        out.append(m)
        stat["matches"] += 1
        seen.setdefault(key, []).append(-1)
    return out, stat


def _with_deliveries(m: dict, d: dict, fmt: int, rows: list[dict], registry: dict[str, str], stat: dict) -> None:
    """Replace a provisional match's totals-only rows with the full parse of its CREX deliveries.

    Gives it innings, batting order, partnerships, extras-style aggregates and a valid ``q`` like a Cricsheet
    match. Skipped (the match stays totals-only) if the deliveries do not form two innings of this fixture.
    """
    info = {"dates": [d["date"]], "match_type": {0: "T20", 1: "ODI", 2: "Test", 3: "T20"}[fmt],
            "team_type": d.get("team_type", ""), "gender": d.get("gender", ""), "teams": [d["team_a"], d["team_b"]],
            "outcome": {"winner": d["winner"]} if d.get("winner") else {}, "registry": {"people": registry}}
    try:
        parsed = parse_match(m["id"], balls_doc(rows, info))
    except (KeyError, ValueError) as exc:  # malformed stored rows: keep the totals-only match, never sink the build
        print(f"skip deliveries of {m['id']}: {exc!r}", file=sys.stderr)
        return
    if not parsed or len(parsed["innings"]) < 1:
        return
    c = _compact(parsed)
    for k in ("first", "q", "mc", "ts", "ho", "inn", "bat", "bowl", "parts"):
        m[k] = c[k]
    stat["with_deliveries"] += 1


# ------------------------------------------------------------------ assembly
GEO_TEAM = {"IN": "India", "AU": "Australia", "NZ": "New Zealand", "ZA": "South Africa", "PK": "Pakistan", "LK": "Sri Lanka",
            "BD": "Bangladesh", "ZW": "Zimbabwe", "IE": "Ireland", "NL": "Netherlands", "NP": "Nepal", "KE": "Kenya",
            "NA": "Namibia", "UG": "Uganda", "AF": "Afghanistan", "SG": "Singapore", "MY": "Malaysia", "OM": None,
            "AE": None, "QA": None, "KW": None, "AG": "West Indies", "BB": "West Indies", "GY": "West Indies",
            "JM": "West Indies", "KN": "West Indies", "LC": "West Indies", "VC": "West Indies", "TT": "West Indies",
            "GD": "West Indies", "DM": "West Indies"}  # None = neutral ground
TOUR = re.compile(r"\btour of ([A-Za-z' ]+?)(?:,|\s+\d{4}|\s+\(|\s+-|$)", re.I)
IN_COUNTRY = re.compile(r"\(in ([A-Za-z ]+)\)", re.I)


def _norm_venue(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s.lower())).strip()


def _load_geo(path: Path | None) -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    if path and path.exists():
        with path.open(encoding="utf-8", newline="") as fh:
            for r in csv.DictReader(fh):
                c = (r.get("country") or "").strip()
                if c in GEO_TEAM:
                    out[r["venue_key"]] = GEO_TEAM[c] or "-"
    return out


def event_host(event: str, national: set[str]) -> str | None:
    """'India tour of England, 2021' / 'Women's T20 Quadrangular Series (in Namibia)' -> the host nation's team name."""
    for rx in (TOUR, IN_COUNTRY):
        m = rx.search(event or "")
        if m:
            y = m.group(1).strip()
            for n in national:
                if n.lower() == y.lower():
                    return n
    return None


def infer_hosts(matches: list[dict], geo: dict[str, str | None]) -> tuple[list[str], dict[tuple[str, int], str], dict[str, str]]:
    """Home-ground model. Returns (host names, venue->host name or '-' for neutral, per-match overrides by id).

    Order of evidence: the event's own host ("X tour of Y"), the venue's host as voted by its tour matches, the venue's
    country (value_bets/mappings/venue_geo.csv), then the team that plays >= half of the venue's internationals.
    Cricsheet has no home flag, so this is an inference and the UI says so.
    """
    national = {t for m in matches if m["intl"] for t in m["teams"]}
    votes: dict[str, Counter] = defaultdict(Counter)
    per_match: dict[str, str] = {}
    for m in matches:
        if not m["intl"]:
            continue
        h = event_host(m["event"], national)
        if h:
            per_match[m["id"]] = h
            votes[m["venue"]][h] += 1
    tot: dict[tuple[str, int], int] = Counter()
    cnt: dict[tuple[str, int], Counter] = defaultdict(Counter)
    for m in matches:
        k = (m["venue"] or "?", m["intl"])
        tot[k] += 1
        for t in m["teams"]:
            cnt[k][t] += 1
    venue_host: dict[tuple[str, int], str] = {}
    for (v, intl), n in tot.items():
        if NEUTRAL_VENUE.search(v):
            venue_host[(v, intl)] = "-"
            continue
        if intl and votes.get(v):
            venue_host[(v, intl)] = votes[v].most_common(1)[0][0]
            continue
        g = geo.get(_norm_venue(v))
        if intl and g:
            venue_host[(v, intl)] = g
            continue
        t, k = cnt[(v, intl)].most_common(1)[0]
        if (intl and n >= 4 and k / n >= 0.5) or (not intl and n >= 5 and k / n >= 0.35):
            venue_host[(v, intl)] = t
    hosts = sorted({h for h in venue_host.values() if h != "-"} | set(per_match.values()))
    return hosts, venue_host, per_match


MATCH_KEYS = ("id", "d", "f", "g", "i", "e", "v", "a", "b", "w", "r", "o", "dy", "h", "fi", "pv", "q", "ho", "mc", "ts", "xq")
BAT_KEYS = ("p", "m", "i", "t", "q", "o", "r", "b", "f", "s", "k", "tb", "mt")
BOWL_KEYS = ("p", "m", "i", "t", "q", "w", "c", "n")
XI_KEYS = ("p", "m")
PART_KEYS = ("a", "b", "m", "i", "o", "w", "r", "n", "ra", "rb", "x", "kd")


def _push(store: dict, keys: tuple, vals: tuple) -> None:
    for k, v in zip(keys, vals, strict=True):
        store[k].append(v)


def _team_fixer(canon_name: dict, gender: int):
    return lambda t: canon_name.get((_norm_team(t), gender), _strip_women(t))


def _team_lookup(team_ix: dict, gender: int):
    return lambda t: team_ix[(t, gender)]


def assemble(canonical: list[dict], provisional: list[dict], geo: dict | None = None) -> dict:
    ms = sorted(canonical + provisional, key=lambda m: (m["date"], m["id"]))
    # team / venue / event / player tables
    tkeys, vkeys, ekeys = set(), set(), set()
    canon_name = {(_norm_team(t), m["gender"]): t for m in canonical for t in m["teams"]}
    for m in ms:
        if m["pv"]:
            m["teams"] = [canon_name.get((_norm_team(t), m["gender"]), _strip_women(t)) for t in m["teams"]]
            if m["winner"]:
                m["winner"] = canon_name.get((_norm_team(m["winner"]), m["gender"]), _strip_women(m["winner"]))
            fix = _team_fixer(canon_name, m["gender"])
            m["bat"] = [(r[0], r[1], fix(r[2]), fix(r[3])) + r[4:] for r in m["bat"]]
            m["bowl"] = [(r[0], r[1], fix(r[2]), fix(r[3])) + r[4:] for r in m["bowl"]]
        for t in m["teams"]:
            tkeys.add((t, m["gender"]))
        vkeys.add(m["venue"] or "?")
        ekeys.add(m["event"] or "")
    teams = sorted(tkeys, key=lambda k: (k[1], k[0]))
    team_ix = {k: i for i, k in enumerate(teams)}
    venues = sorted(vkeys)
    venue_ix = {v: i for i, v in enumerate(venues)}
    events = sorted(ekeys)
    event_ix = {e: i for i, e in enumerate(events)}
    hosts, venue_host, host_of_match = infer_hosts(ms, geo or {})
    host_ix = {h: i for i, h in enumerate(hosts)}

    pstat: dict[str, dict] = {}
    aliases: dict[str, set] = defaultdict(set)

    def touch(pid, m, tix):
        s = pstat.get(pid)
        if s is None:
            s = pstat[pid] = {"g": m["gender"], "last": m["date"], "n": 0, "fm": 0, "tm": tix}
        s["n"] += 1
        s["fm"] |= 1 << m["fmt"]
        if m["date"] >= s["last"]:
            s["last"], s["tm"], s["g"] = m["date"], tix, m["gender"]

    cols = defaultdict(list)
    for mi, m in enumerate(ms):
        g = m["gender"]
        a, b = (team_ix[(t, g)] for t in m["teams"])
        v = venue_ix[m["venue"] or "?"]
        w = team_ix[(m["winner"], g)] if m["winner"] and (m["winner"], g) in team_ix else -1
        fi = team_ix[(m["first"], g)] if m["first"] else -1
        hn = host_of_match.get(m["id"]) or venue_host.get((m["venue"] or "?", m["intl"]))
        hs = -2 if hn is None else -1 if hn == "-" else host_ix[hn]  # -1 neutral ground, -2 host unknown
        _push(cols, MATCH_KEYS, (m["id"], m["date"], m["fmt"], g, m["intl"], event_ix[m["event"] or ""], v, a, b, w, m["res"],
                                 m["overs"], m["days"], hs, fi, m["pv"], m["q"], m["ho"], m["mc"], m["ts"], m["xq"]))
        m["_ix"] = mi
        m["_tix"] = (a, b)

    # player ids actually present
    pids = sorted({r[0] for m in ms for r in m["bat"]} | {r[0] for m in ms for r in m["bowl"]})
    pix = {p: i for i, p in enumerate(pids)}

    shards: dict[int, dict] = defaultdict(lambda: {"bat": defaultdict(list), "bowl": defaultdict(list), "pt": defaultdict(list), "xi": defaultdict(list)})

    def shard_of(pid: str) -> int:
        try:
            return int(pid, 16) % NSHARD
        except ValueError:
            return 0

    inn_col = []
    for m in ms:
        g = m["gender"]
        mi, (a, b) = m["_ix"], m["_tix"]
        T = _team_lookup(team_ix, g)
        inn_col.append([[T(i[0]), i[2], i[3], i[4], i[5], i[6], i[7], i[8], i[9], i[10], i[11], i[12], i[13], i[14], i[15]]
                        + [pix[p] for p in i[16] if p in pix] for i in m["inn"]])
        for r in m["bat"]:
            pid = r[0]
            touch(pid, m, T(r[2]))
            S = shards[shard_of(pid)]["bat"]
            _push(S, BAT_KEYS, (pix[pid], mi, r[1], T(r[2]), T(r[3]), r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11]))
        for r in m["bowl"]:
            pid = r[0]
            touch(pid, m, T(r[2]))
            S = shards[shard_of(pid)]["bowl"]
            _push(S, BOWL_KEYS, (pix[pid], mi, r[1], T(r[2]), T(r[3]), r[4], r[5], r[6]))
        for r in m["parts"]:
            a_, b_ = pix.get(r[0]), pix.get(r[1])
            if a_ is None or b_ is None:
                continue
            S = shards[shard_of(r[0])]["pt"]
            _push(S, PART_KEYS, (a_, b_, mi, r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9], r[10]))
        for pid in set(m.get("xi", [])):
            if pid in pix:
                _push(shards[shard_of(pid)]["xi"], XI_KEYS, (pix[pid], mi))
        for pid, nm in m.get("aliases", []):
            aliases[pid].add(nm)
    return {"ms": ms, "cols": cols, "inn": inn_col, "teams": teams, "venues": venues, "events": events, "hosts": hosts,
            "pids": pids, "pix": pix, "pstat": pstat, "shards": shards, "aliases": aliases, "team_ix": team_ix}


def player_names(zpath: Path | None) -> dict[str, str]:
    """Latest Cricsheet name per id, from the registry blocks (cheap second pass over the zip)."""
    names: dict[str, tuple[str, str]] = {}
    if zpath is None:
        return {}
    with zipfile.ZipFile(zpath) as z:
        for n in z.namelist():
            if not n.endswith(".json"):
                continue
            d = json.loads(z.read(n))
            info = d["info"]
            dt = (info.get("dates") or [""])[0]
            for nm, pid in ((info.get("registry") or {}).get("people") or {}).items():
                if pid not in names or dt >= names[pid][0]:
                    names[pid] = (dt, nm)
    return {p: v[1] for p, v in names.items()}


def load_cricinfo(path: Path | None) -> dict[str, str]:
    """Cricsheet register people.csv -> {player id: ESPNcricinfo id}; the site maps it to Wikidata photos."""
    out: dict[str, str] = {}
    if path and path.exists():
        with path.open(encoding="utf-8", newline="") as fh:
            for r in csv.DictReader(fh):
                if r.get("key_cricinfo"):
                    out[r["identifier"]] = r["key_cricinfo"]
    return out


def crex_match(canonical: list[dict], names: dict[str, str], cricinfo: dict[str, str], wikidata: bool = True, chunk: int = 400) -> dict:
    """Match CREX's players and teams to ours, keyed by Cricsheet player id (never by array index: indices shift between builds).

    {"p": {pid: "c:<CREX id>" | "w:<Commons file>"}, "t": {folded team name: CREX id}, "names": {folded CREX full name: pid},
     "index": {"players": [[crex id, name, pid|None]], "teams": [[crex id, name, folded]]}}.
    CREX first (public sitemaps), Wikidata (P2697 Cricinfo id -> P18, free licences) as the photo fallback. Best effort: a network failure
    yields less, never an error. Teams are matched on the Cricsheet team names seen in `canonical`.
    """
    import urllib.parse
    import urllib.request

    from . import crex_assets as ca

    out: dict = {"p": {}, "t": {}, "names": {}, "index": {"players": [], "teams": []}}
    stat: dict[str, list] = {}
    teams = set()
    for m in canonical:
        for r in m["bat"] + m["bowl"]:
            s = stat.setdefault(r[0], [0, ""])
            s[0] += 1
            s[1] = max(s[1], m["date"])
        teams.update((t, m["gender"]) for t in m["teams"])
    pids = sorted(stat)
    try:
        players = [{"idx": i, "name": names.get(p, p), "n": stat[p][0], "last": stat[p][1]} for i, p in enumerate(pids)]
        crex_players = ca.parse_sitemap(ca.fetch_sitemap("player"), "player")
        crex_teams = ca.parse_sitemap(ca.fetch_sitemap("team"), "team")
        named: dict[str, int] = {}
        matched = ca.match_players(players, crex_players, named)
        out["p"] = {pids[i]: "c:" + c for i, c in matched.items()}
        out["names"] = {nm: pids[i] for nm, i in named.items()}
        out["t"] = ca.match_teams([{"name": t, "g": g} for t, g in sorted(teams)], crex_teams)
        owner = {c.removeprefix("c:"): p for p, c in out["p"].items()}
        out["index"] = {"players": [[cid, nm, owner.get(cid)] for nm, cid in crex_players], "teams": [[cid, nm, ca.fold(nm)] for nm, cid in crex_teams]}
    except Exception as exc:  # noqa: BLE001
        print(f"crex: sitemaps failed: {exc}", file=sys.stderr)
        return out
    by_ci = {c: p for p, c in cricinfo.items() if p in stat and p not in out["p"]} if wikidata else {}
    ids = sorted(by_ci)
    for i in range(0, len(ids), chunk):
        values = " ".join(f'"{x}"' for x in ids[i:i + chunk])
        q = "SELECT ?id ?img WHERE { VALUES ?id { " + values + " } ?p wdt:P2697 ?id; wdt:P18 ?img }"
        req = urllib.request.Request("https://query.wikidata.org/sparql", data=urllib.parse.urlencode({"query": q, "format": "json"}).encode(),
                                     headers={"User-Agent": "cricket-props-hub/0.1 (https://github.com/dheerajgoel17/cricket-data)",
                                              "Accept": "application/sparql-results+json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                for b in json.load(r)["results"]["bindings"]:
                    out["p"].setdefault(by_ci[b["id"]["value"]], "w:" + urllib.parse.unquote(b["img"]["value"].rsplit("/", 1)[-1]))
        except Exception as exc:  # noqa: BLE001 - photos are optional
            print(f"crex: wikidata chunk {i} failed: {exc}", file=sys.stderr)
    return out


def crex_cached(cache_dir: Path | None, canonical: list[dict], names: dict[str, str], cricinfo: dict[str, str]) -> dict:
    """crex_match() cached for the day in cache_dir/crex_match.json (an empty result is never cached)."""
    f = cache_dir / "crex_match.json" if cache_dir else None
    if f and f.exists():
        return json.loads(f.read_text(encoding="utf-8"))
    res = crex_match(canonical, names, cricinfo)
    if f and res["p"]:
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text(json.dumps(res, separators=(",", ":")), encoding="utf-8")
    return res


def write(out: Path, A: dict, names: dict[str, str], meta_extra: dict, cricinfo: dict[str, str] | None = None) -> dict:
    out.mkdir(parents=True, exist_ok=True)
    (out / "p").mkdir(exist_ok=True)
    for f in (out / "p").glob("*.json"):
        f.unlink()
    dump = lambda o: json.dumps(o, separators=(",", ":"), ensure_ascii=False)  # noqa: E731
    cols = dict(A["cols"])
    cols["inn"] = A["inn"]
    (out / "matches.json").write_text(dump(cols), encoding="utf-8")
    ps = A["pstat"]
    pcols = {"id": A["pids"], "nm": [names.get(p, p) for p in A["pids"]],
             "g": [ps[p]["g"] for p in A["pids"]], "last": [ps[p]["last"] for p in A["pids"]],
             "n": [ps[p]["n"] for p in A["pids"]], "tm": [ps[p]["tm"] for p in A["pids"]],
             "fm": [ps[p]["fm"] for p in A["pids"]]}
    al = {A["pix"][p]: sorted(n for n in v if n and n != names.get(p)) for p, v in A["aliases"].items() if p in A["pix"]}
    index = {"players": pcols, "aliases": {k: v for k, v in al.items() if v},
             "teams": [{"n": t, "g": g} for t, g in A["teams"]], "venues": A["venues"], "events": A["events"],
             "hosts": A["hosts"],

             "kinds": KINDS, "formats": FORMAT_NAMES, "nshard": NSHARD}
    (out / "index.json").write_text(dump(index), encoding="utf-8")
    for s, d in sorted(A["shards"].items()):
        (out / "p" / f"{s:02d}.json").write_text(dump({k: dict(v) for k, v in d.items()}), encoding="utf-8")
    meta = {"schema": SCHEMA, "built_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
            "matches": len(A["ms"]), "players": len(A["pids"]), "teams": len(A["teams"]), "venues": len(A["venues"]),
            **meta_extra}
    (out / "meta.json").write_text(dump(meta), encoding="utf-8")
    return meta


# ------------------------------------------------------------------ fixtures
def _minutes(iso: str) -> int:
    return int(datetime.strptime(iso[:16], "%Y-%m-%dT%H:%M").replace(tzinfo=timezone.utc).timestamp() // 60)


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (s or "").lower()).strip("-")


def build_sitemap(out: Path, A: dict, names: dict[str, str], site_url: str) -> int:
    """sitemap.xml + robots.txt next to the site (the app maps /player/12 style paths onto its hash routes)."""
    if not site_url:
        return 0
    base = site_url.rstrip("/")
    urls = [f"{base}/{p}" for p in ("", "players", "teams", "competitions", "props", "trends", "tools", "odds", "glossary", "features", "about", "pair", "ask")]
    top = sorted(range(len(A["pids"])), key=lambda i: -A["pstat"][A["pids"][i]]["n"])[:3000]
    urls += [f"{base}/player/{i}" for i in top]
    cnt = Counter(m["event"] for m in A["ms"] if m["event"])
    urls += [f"{base}/league/{A['events'].index(e)}" for e, c in cnt.most_common(400) if c >= 20]
    tcnt = Counter()
    for m in A["ms"]:
        for t in m["teams"]:
            tcnt[(t, m["gender"])] += 1
    urls += [f"{base}/team/{A['team_ix'][k]}" for k, c in tcnt.most_common(800) if c >= 10]
    body = "".join(f"<url><loc>{u}</loc></url>" for u in urls)
    root = out.parent
    (root / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + body + "</urlset>", encoding="utf-8")
    (root / "robots.txt").write_text(f"User-agent: *\nAllow: /\nSitemap: {base}/sitemap.xml\n", encoding="utf-8")
    return len(urls)


def build_fixtures(data_dir: Path, vb_dir: Path | None, team_ix: dict) -> list[dict]:
    """Fixtures and start times come from CREX's schedule only (data/fixtures/upcoming.csv).

    The bookmaker feed (vb_dir) is for odds: books serve different regions, so its start times and team labels
    are not trustworthy as a schedule. vb_dir is accepted for call compatibility and deliberately unused."""
    rows = []
    p = data_dir / "fixtures" / "upcoming.csv"
    if p.exists():
        with p.open(encoding="utf-8", newline="") as fh:
            for r in csv.DictReader(fh):
                rows.append({"start": r["start_utc"], "fmt": r["format"], "gender": r["gender"], "a": r["team_a"],
                             "b": r["team_b"], "venue": r.get("venue", ""), "series": r.get("series", ""),
                             "source": "crex"})
    out, seen = [], set()
    canon = {(_norm_team(t), gg): t for (t, gg) in team_ix}
    for r in sorted(rows, key=lambda r: r["start"]):
        key = (r["start"][:10], frozenset((_norm_team(r["a"]), _norm_team(r["b"]))))
        if key in seen:
            continue
        seen.add(key)
        g = 1 if r["gender"] == "female" else 0
        for side in ("a", "b"):
            n = canon.get((_norm_team(r[side]), g))
            r[side + "_ix"] = team_ix.get((n, g), -1) if n else -1
        r["id"] = f"{r['start'][:10]}-{_slug(r['a'])}-v-{_slug(r['b'])}"
        out.append(r)
    return out


# ------------------------------------------------------------------ prop hunter snapshot
BET_FIELDS = ["match", "start_utc", "start_ist", "format", "gender", "market", "selection", "player_matched_as", "line", "side",
              "best_odds", "best_source", "fair_odds", "edge_pct", "kelly_quarter_stake_pct", "confidence", "why", "notes",
              "rain_risk"]


def build_props(vb_dir: Path | None) -> dict:
    """Small snapshot of the value-bets output (the site also reads the live file from GitHub at view time)."""
    out = {"generated_at_utc": "", "generated_at_ist": "", "value_bets": [], "recent_alerts": [], "sources": {}, "stats": {}}
    if not vb_dir:
        return out
    latest = vb_dir / "value_bets_latest.json"
    if latest.exists():
        d = json.loads(latest.read_text(encoding="utf-8"))
        out.update(generated_at_utc=d.get("generated_at_utc", ""), generated_at_ist=d.get("generated_at_ist", ""),
                   sources=d.get("sources", {}), stats=d.get("stats", {}))
        out["value_bets"] = [{k: v.get(k) for k in BET_FIELDS} for v in d.get("value_bets", [])]
    hist = vb_dir / "alerts_history.jsonl"
    if hist.exists():
        rows = [json.loads(x) for x in hist.read_text(encoding="utf-8").splitlines() if x.strip()]
        out["recent_alerts"] = rows[-60:]
    return out


# ------------------------------------------------------------------ main
def build(zpath: Path, data_dir: Path, out: Path, vb_dir: Path | None = None, workers: int = 4,
          geo_path: Path | None = None, people_path: Path | None = None, photos: bool = False, site_url: str = "",
          crex_cache: Path | None = None) -> dict:
    canonical = parse_zip(zpath, workers)
    names = player_names(zpath)
    cx = crex_cached(crex_cache, canonical, names, load_cricinfo(people_path)) if photos else {"p": {}, "t": {}, "names": {}, "index": {"players": [], "teams": []}}
    prov, pstat = load_provisional(data_dir, canonical, cx["names"])
    A = assemble(canonical, prov, _load_geo(geo_path))
    newest = max((m["date"] for m in canonical), default="")
    newest_prov = max((m["date"] for m in prov), default="")
    meta = write(out, A, names, {
        "newest_cricsheet": newest, "provisional_matches": len(prov), "newest_provisional": newest_prov,
        "provisional_included": bool(prov), "provisional_rows_unlinked": pstat["rows_unlinked"],
        "provisional_rows_linked_by_crex": pstat.get("rows_linked_by_crex", 0),
        "zip_matches": len(canonical)}, load_cricinfo(people_path))
    fx = build_fixtures(data_dir, vb_dir, A["team_ix"])
    (out / "fixtures.json").write_text(json.dumps(fx, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    build_sitemap(out, A, names, site_url)
    if photos:
        keep = set(A["pids"])
        (out / "photos.json").write_text(json.dumps({"p": {p: v for p, v in cx["p"].items() if p in keep}, "t": cx["t"]}, separators=(",", ":")), encoding="utf-8")
        (out / "crex_index.json").write_text(json.dumps(cx["index"], separators=(",", ":")), encoding="utf-8")  # for assets_sync; not deployed
    (out / "props.json").write_text(json.dumps(build_props(vb_dir), separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    return meta


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--zip", required=True, help="Cricsheet all_json.zip")
    ap.add_argument("--data", default="data")
    ap.add_argument("--out", default="site/public/data")
    ap.add_argument("--value-bets", default="value_bets/out")
    ap.add_argument("--geo", default="value_bets/mappings/venue_geo.csv", help="venue -> country (optional)")
    ap.add_argument("--people", default="", help="Cricsheet register people.csv (optional: enables player photos)")
    ap.add_argument("--photos", action="store_true", help="look up player photos on Wikidata (needs --people)")
    ap.add_argument("--site-url", default="", help="public base URL: enables sitemap.xml and robots.txt")
    ap.add_argument("--crex-cache", default="", help="directory caching the CREX/Wikidata matching for the day")
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args(argv)
    meta = build(Path(a.zip), Path(a.data), Path(a.out), Path(a.value_bets), a.workers, Path(a.geo), Path(a.people) if a.people else None, a.photos and bool(a.people), a.site_url, Path(a.crex_cache) if a.crex_cache else None)
    print(json.dumps(meta))
    return 0


if __name__ == "__main__":
    sys.exit(main())
