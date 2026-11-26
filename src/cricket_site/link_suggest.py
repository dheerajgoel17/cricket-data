"""Link suggester: tie a name a book prints to our Base player (and to his page on the source) from the fixture the book prices him in.

The books print "A Gul" or "Smit Patel"; Base writes "Arab Gul" or "SN Patel"; the source has several players of one name. The fixture settles most of it: a line in a match between
two sides can only be a player of those sides (or their country), and the source's player page says which nation a candidate plays for. For each name the odds job could not
resolve, this module

1. finds the Base players the name could be (surname, given-name initials, same gender, active lately: the same rules as ``crex_assets.match_players``),
2. keeps the ones that played for one of the fixture's sides, or for the nation those sides stand for,
3. when exactly one is left and his evidence is first-hand, proposes a ``value_bets/mappings/players.csv`` line (book spelling -> Base id),
4. finds the source pages of that name (exact, then initial + surname), keeps those whose nationality is the Base player's national side, and when exactly one is left proposes a
   ``data/mappings/player_identity.csv`` line (Base id -> source id).

Only a proposal with all its evidence is applied (``apply``); the rest is listed with the reason, for a person. A name with no Base candidate cannot be mapped (there is no id to
map it to) and is listed as such. Stdlib only; the network is only touched through the ``fetch`` callables the caller passes.

    python -m cricket_site.link_suggest --data data --vb value_bets [--apply] [--out report.md]
"""
from __future__ import annotations

import argparse
import csv
import glob
import gzip
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from .crex_assets import fold

WOMEN = re.compile(r"\(w\)|\(wom\)|\bwomen\b|\bwbbl\b|\bwomen's\b", re.I)
# demonym on the source's player page -> the national side's name as Base spells it, folded
NATION = {
    "indian": "india", "pakistani": "pakistan", "bangladeshi": "bangladesh", "sri lankan": "sri lanka", "afghan": "afghanistan", "english": "england", "australian": "australia",
    "new zealander": "new zealand", "south african": "south africa", "west indian": "west indies", "caribbean": "west indies", "irish": "ireland", "scottish": "scotland",
    "zimbabwean": "zimbabwe", "emirati": "united arab emirates", "nepalese": "nepal", "nepali": "nepal", "nepalis": "nepal", "omani": "oman", "american": "united states of america",
    "canadian": "canada", "dutch": "netherlands", "namibian": "namibia", "kuwaiti": "kuwait", "qatari": "qatar", "thai": "thailand", "japanese": "japan", "saudi arabians": "saudi arabia",
    "malaysian": "malaysia", "singaporean": "singapore", "hong konger": "hong kong", "papua new guinean": "papua new guinea", "ugandan": "uganda", "kenyan": "kenya", "welsh": "england",
}
NOT_PLAYERS = {"yes", "no", "draw", "bowled", "lbw", "stumped", "run out", "caught", "keeper catch", "fielder catch", "others", "other", "tie", "over", "under", "odd", "even", "none", "any"}


MARKET_WORDS = {"to", "win", "over", "under", "both", "teams", "team", "top", "batsman", "batter", "score", "hit", "six", "sixes", "four", "fours", "or", "more", "total", "runs", "wicket", "wickets", "and", "any",
                "first", "last", "most", "highest", "lowest", "match", "innings", "toss", "will", "a", "the", "including", "partnership", "run", "out", "lbw", "lbws", "no", "ball", "wide", "extras"}


def plausible_name(n: str) -> bool:
    """A printed player name: two to four words of letters, no market wording (the catalogue's `player` field also carries combo markets like "Both Teams To Hit Over 6.5 Sixes")."""
    t = n.replace(".", " ").split()
    return 2 <= len(t) <= 4 and bool(re.fullmatch(r"[A-Za-z][A-Za-z'\-\. ]{2,40}", n)) and not any(w.lower() in MARKET_WORDS for w in t)


def clean_team(t: str) -> str:
    return fold(re.sub(r"\s*\((w|wom|women)\)|\bwomen\b|\bwomens\b|\bu19\b|\bu23\b|\bxi\b", " ", str(t or ""), flags=re.I))


# ------------------------------------------------------------------ Base
def load_base(data_dir: Path, since_year: int = 2018) -> dict[str, dict]:
    """{player id: {name, g: gender, n: matches, last, teams: Counter, nat: Counter of national sides}} from the monthly Base player and match files."""
    meta: dict[str, tuple[str, str]] = {}
    for f in sorted(glob.glob(str(data_dir / "matches" / "*.csv.gz"))):
        if int(Path(f).name[:4]) < since_year:
            continue
        with gzip.open(f, "rt", encoding="utf-8", newline="") as fh:
            for r in csv.DictReader(fh):
                meta[r["match_id"]] = (r.get("gender") or "male", r.get("team_type") or "")
    out: dict[str, dict] = {}
    for f in sorted(glob.glob(str(data_dir / "players" / "*.csv.gz"))):
        if int(Path(f).name[:4]) < since_year:
            continue
        with gzip.open(f, "rt", encoding="utf-8", newline="") as fh:
            for r in csv.DictReader(fh):
                pid = r.get("player_id")
                if not pid:
                    continue
                g, tt = meta.get(r["match_id"], ("male", ""))
                p = out.setdefault(pid, {"name": r["player"], "g": Counter(), "n": 0, "last": "", "teams": Counter(), "nat": Counter()})
                p["name"], p["n"], p["last"] = r["player"], p["n"] + 1, max(p["last"], r["date"])
                p["g"][g] += 1
                team = clean_team(r["team"])
                p["teams"][team] += 1
                if tt == "international":
                    p["nat"][team] += 1
    return out


def strength(raw: str, base_name: str) -> str | None:
    """How well a printed name fits a Base name: 'exact', 'strong' (every given-name token accounted for), 'weak' (only the first initial or name agrees) or None."""
    rt = [x for x in re.split(r"[\s.\-]+", raw.strip()) if x]
    bt = [x for x in re.split(r"[\s.\-]+", base_name.strip()) if x]
    if not rt or not bt:
        return None
    if fold(raw) == fold(base_name):
        return "exact"
    initials = bool(re.fullmatch(r"[A-Z]{1,5}", bt[0])) and len(bt) > 1
    fr, fb = [fold(x) for x in rt], [fold(x) for x in bt]
    sur = fb[1:] if initials else fb[-1:]
    if not sur or fr[-len(sur):] != sur:
        return None
    given = fr[:-len(sur)]
    if not given:
        return None
    if initials:
        ini = fb[0]
        if given[0][0] != ini[0]:
            return None
        if len(given) >= len(ini) and all(given[i][0] == ini[i] for i in range(len(ini))):
            return "strong"
        if len(given) >= 2 and any(given[i][0] != ini[i] for i in range(min(len(ini), len(given)))):
            return None
        return "weak"
    bg = [fold(x) for x in bt[:-1]]
    if bg and all(len(g) >= 3 and (g == b or b.startswith(g) or g.startswith(b)) for g, b in zip(given, bg, strict=False)):
        return "strong"
    return None


def _by_surname(base: dict[str, dict]) -> dict[str, list[str]]:
    """{folded surname: [player ids]}, built once per base (the lookup per name is then a dictionary hit, not a scan of every player)."""
    idx = base.get("__surnames__")
    if idx is None:
        idx = defaultdict(list)
        for pid, p in base.items():
            if pid == "__surnames__":
                continue
            bt = fold(p["name"]).split()
            if bt:
                idx[bt[-1]].append(pid)
        base["__surnames__"] = idx  # type: ignore[assignment]
    return idx


def base_candidates(raw: str, gender: str, base: dict[str, dict], since: str) -> list[tuple[str, str]]:
    """[(player id, strength)] for the Base players this printed name could be, best-played first."""
    t = fold(raw).split()
    if not t:
        return []
    out = []
    for pid in _by_surname(base).get(t[-1], []):
        p = base[pid]
        if p["last"] < since or (p["g"] and p["g"].most_common(1)[0][0] != gender):
            continue
        s = strength(raw, p["name"])
        if s:
            out.append((pid, s))
    return sorted(out, key=lambda x: -base[x[0]]["n"])


def evidence(pid: str, fixture_teams: set[str], base: dict[str, dict]) -> list[str]:
    """What ties this Base player to the fixture: he played for one of its sides, or for a national side that is one of them."""
    p, why = base[pid], []
    for t in sorted(fixture_teams):
        if t and p["teams"].get(t):
            why.append(f"played for {t}")
    for nat in p["nat"]:
        if nat in fixture_teams and f"played for {nat}" not in why:
            why.append(f"plays for {nat}")
    return why


def choose(raw: str, cands: list[tuple[str, str]], fixture_teams: set[str], base: dict[str, dict]) -> tuple[str | None, list[str], str]:
    """-> (player id or None, evidence, why not). One candidate must remain after the fixture's evidence."""
    if not cands:
        return None, [], "no Base player fits the name"
    tied = [(pid, s, evidence(pid, fixture_teams, base)) for pid, s in cands]
    on = [x for x in tied if x[2]]
    if len(on) == 1:
        pid, s, why = on[0]
        return (pid, why, "") if s in ("exact", "strong") or why else (None, why, "weak name fit")
    if len(on) > 1:
        return None, [], "several Base players fit and the fixture does not separate them"
    if len(tied) == 1 and tied[0][1] == "exact":
        return tied[0][0], ["the only Base player of this exact name"], ""
    return None, [], "no candidate ever played for the fixture's sides"


# ------------------------------------------------------------------ source
def parse_profile(html: str) -> dict:
    """{nat: the national side as Base spells it (folded), demonym: as printed, birth_place} from a source player page."""
    txt = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", re.sub(r"<script.*?</script>|<style.*?</style>", "", html, flags=re.S)))
    m = re.search(r" Nationality (.+?) Role ", txt)
    bp = re.search(r"Birth Place (.+?) (?:Height|Nationality)", txt)
    dem = m.group(1).strip().lower() if m else ""
    return {"demonym": dem, "nat": NATION.get(dem, dem), "birth_place": bp.group(1).strip() if bp else ""}


def source_candidates(raw: str, sitemap: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """[(slug name, source id)]: the pages of exactly this name, else the ones with this initial and surname (at most 8)."""
    f = fold(raw)
    exact = [(n, i) for n, i in sitemap if n == f]
    if exact:
        return exact[:6]
    t = f.split()
    if len(t) < 2:
        return []
    return [(n, i) for n, i in sitemap if n.split()[-1] == t[-1] and n.split()[0][:1] == t[0][:1]][:8]


def confirm_source(pid: str, cands: list[tuple[str, str]], base: dict[str, dict], fetch_profile) -> tuple[str | None, str]:
    """The one source page whose nationality is this Base player's national side; (None, why) otherwise."""
    p = base[pid]
    nat = p["nat"].most_common(1)[0][0] if p["nat"] else ""
    if not nat:
        return None, "no national side in Base to compare with the source's nationality"
    fit = []
    for name, sid in cands:
        prof = fetch_profile(name, sid)
        if prof and prof.get("nat") == nat:
            fit.append((sid, prof))
    if len(fit) == 1:
        return fit[0][0], f"source page {fit[0][0]}: {fit[0][1]['demonym']}, born {fit[0][1]['birth_place'] or '?'}"
    return None, "no source page of this name has his nationality" if not fit else "several source pages have his nationality"


def suggest(names: dict[str, list[dict]], base: dict[str, dict], sitemap, fetch_profile, since: str = "2022-01-01") -> list[dict]:
    """names: {printed name: [{match, competition, start}]} -> a proposal per name with its evidence, `certain` when the Base player and his source page are both settled."""
    out = []
    for raw, ctxs in sorted(names.items()):
        teams: set[str] = set()
        women = False
        for c in ctxs:
            for side in re.split(r"\s+vs\s+", c.get("match", ""), flags=re.I):
                teams.add(clean_team(side))
            women = women or bool(WOMEN.search(f"{c.get('match', '')} {c.get('competition', '')}"))
        gender = "female" if women else "male"
        cands = base_candidates(raw, gender, base, since)
        pid, why, why_not = choose(raw, cands, teams, base)
        row = {"name": raw, "gender": gender, "matches": [c.get("match") for c in ctxs][:3], "pid": pid, "base_name": base[pid]["name"] if pid else "", "evidence": why, "why_not": why_not,
               "source_id": None, "source_note": "", "certain": False}
        if pid:
            sid, note = confirm_source(pid, source_candidates(raw, sitemap) or source_candidates(base[pid]["name"], sitemap), base, fetch_profile)
            row["source_id"], row["source_note"] = sid, note
            row["certain"] = True  # the Base player is settled by the fixture; the source link is applied only with its own evidence
        out.append(row)
    return out


# ------------------------------------------------------------------ files
def _lines(path: Path) -> list[list[str]]:
    if not path.exists():
        return []
    return [r for r in csv.reader(x for x in path.read_text(encoding="utf-8").splitlines() if x.strip() and not x.lstrip().startswith("#"))]


def apply(proposals: list[dict], data_dir: Path, vb_dir: Path, stamp: str) -> dict[str, int]:
    """Append the certain lines: players.csv (printed name -> Base id) and player_identity.csv (Base id -> source id), never a name, player or source id twice."""
    players, ident = vb_dir / "mappings" / "players.csv", data_dir / "mappings" / "player_identity.csv"
    have_names = {r[0].strip().lower() for r in _lines(players) if r}
    have_pids = {r[0] for r in _lines(ident) if r}
    have_sids = {r[1] for r in _lines(ident) if len(r) > 1}
    new_p, new_i = [], []
    for p in proposals:
        if not (p["certain"] and p["pid"]):
            continue
        if p["name"].strip().lower() not in have_names:
            new_p.append((p["name"], p["pid"]))
            have_names.add(p["name"].strip().lower())
        if p["source_id"] and p["pid"] not in have_pids and p["source_id"] not in have_sids:
            new_i.append((p["pid"], p["source_id"], f"{p['base_name']} is {p['name']} ({'; '.join(p['evidence'])}; {p['source_note']})"))
            have_pids.add(p["pid"])
            have_sids.add(p["source_id"])
    if new_p:
        with players.open("a", encoding="utf-8", newline="") as fh:
            fh.write(f"# link_suggest {stamp}: the fixture's sides settle the Base player\n")
            csv.writer(fh, lineterminator="\n").writerows(new_p)
    if new_i:
        with ident.open("a", encoding="utf-8", newline="") as fh:
            fh.write(f"# link_suggest {stamp}: source page confirmed by the national side\n")
            csv.writer(fh, lineterminator="\n").writerows(new_i)
    return {"players": len(new_p), "identity": len(new_i)}


def unmatched_names(vb_dir: Path, days_back: int = 1, days_ahead: int = 4, now: datetime | None = None) -> dict[str, list[dict]]:
    """{printed name: [{match, competition, start}]} for the players the odds job could not resolve: its own full list (``unmatched_players_detail`` in value_bets_latest.json),
    else (an older file) the names in the archive's player markets that no archived line carries."""
    mapped = {r[0].strip().lower() for r in _lines(vb_dir / "mappings" / "players.csv") if r}
    latest = vb_dir / "out" / "value_bets_latest.json"
    try:
        detail = json.loads(latest.read_text(encoding="utf-8")).get("unmatched_players_detail") if latest.exists() else None
    except ValueError:
        detail = None
    if detail is not None:
        return {n: c for n, c in detail.items() if plausible_name(n) and n.lower() not in mapped and n.lower() not in NOT_PLAYERS}
    now = now or datetime.now(timezone.utc)
    lo, hi = (now - timedelta(days=days_back)).strftime("%Y-%m-%d"), (now + timedelta(days=days_ahead)).strftime("%Y-%m-%d")
    out: dict[str, list[dict]] = defaultdict(list)
    for f in sorted(glob.glob(str(vb_dir / "archive" / "*" / "*.json"))):
        try:
            a = json.loads(Path(f).read_text(encoding="utf-8"))
        except ValueError:
            continue
        start = str(a.get("start_utc") or "")[:10]
        if not start or start < lo or start > hi:
            continue
        priced = {x for ln in a.get("lines") or [] for x in (ln.get("book_name"), ln.get("player")) if x}
        match = a.get("match") or ""
        sides = {clean_team(s) for s in re.split(r"\s+vs\s+", match, flags=re.I)}
        for c in a.get("catalogue") or []:
            for nm in str(c.get("player") or "").split("/"):
                nm = nm.strip()
                if not nm or not plausible_name(nm) or nm in priced or nm.lower() in NOT_PLAYERS or nm.lower() in mapped or clean_team(nm) in sides:
                    continue
                if not any(x["match"] == match for x in out[nm]):
                    out[nm].append({"match": match, "competition": a.get("competition") or "", "start": a.get("start_utc") or ""})
    return dict(out)


def report(proposals: list[dict], applied: dict[str, int]) -> str:
    done = [p for p in proposals if p["certain"]]
    left = [p for p in proposals if not p["certain"]]
    lines = [f"# Link suggestions: {len(proposals)} unmatched names, {len(done)} settled by the fixture, applied {applied}", ""]
    lines += ["## Settled", ""] + [f"- {p['name']} -> {p['base_name']} (`{p['pid']}`): {'; '.join(p['evidence'])}" + (f"; source `{p['source_id']}` ({p['source_note']})" if p["source_id"] else "; source page not confirmed") for p in done]
    lines += ["", "## For a person", ""] + [f"- {p['name']} ({', '.join(m for m in p['matches'] if m)}): {p['why_not']}" for p in left]
    return "\n".join(lines) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", type=Path, default=Path("data"))
    ap.add_argument("--vb", type=Path, default=Path("value_bets"))
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--out", type=Path)
    a = ap.parse_args(argv)
    from cricket_data.hosts import host
    from cricket_data.polite import PoliteFetcher

    from .crex_assets import fetch_sitemap, parse_sitemap

    names = unmatched_names(a.vb)
    if not names:
        print("no unmatched names")
        return 0
    base = load_base(a.data)
    xml = fetch_sitemap("player")
    sitemap = parse_sitemap(xml, "player")
    fetcher, cache = PoliteFetcher(min_interval=1.0), {}
    slug = {m.group(2): m.group(1) for loc in re.findall(r"<loc>([^<]+)</loc>", xml) if (m := re.search(r"/player/(.+)-([0-9A-Z]+)(?:/matches)?$", loc.strip()))}

    def fetch_profile(name: str, sid: str):
        if sid not in cache:
            try:
                cache[sid] = parse_profile(fetcher.get(f"{host('LIVE_SOURCE_BASE')}/player/{slug.get(sid, name.replace(' ', '-'))}-{sid}"))
            except Exception:  # an unreadable page proves nothing: no source link
                cache[sid] = None
        return cache[sid]

    props = suggest(names, base, [(fold(n), i) for n, i in sitemap], fetch_profile)
    applied = apply(props, a.data, a.vb, date.today().isoformat()) if a.apply else {"players": 0, "identity": 0}
    text = report(props, applied)
    if a.out:
        a.out.write_text(text, encoding="utf-8")
    print(text[:3000])
    return 0


if __name__ == "__main__":
    sys.exit(main())
