"""Player photos and team logos from CREX's public sitemaps (the repo already scrapes CREX), with Wikidata as the fallback.

CREX lists every player (`/player/<name-slug>-<ID>`) and team (`/team/<name-slug>-<ID>`) in its sitemaps, and serves images at
`cricketvectors.akamaized.net/players/org/<ID>.png` and `.../Teams/<ID>.png`. We only store the ids; the browser loads the images.
Matching a CREX full name ("harry-brook") to a Cricsheet name ("HC Brook") is deliberately conservative: surname must match,
the first initial must agree, and an ambiguous name is skipped rather than guessed (a wrong face is worse than a silhouette).
"""
from __future__ import annotations

import re
import unicodedata
import urllib.request

SITEMAP = "https://crex.com/crex_sitemap/{}.xml"
UA = "Mozilla/5.0 (compatible; cricket-props-hub/0.1; +https://github.com/dheerajgoel17/cricket-data)"
_PLAYER = re.compile(r"/player/(.+)-([0-9A-Z]+)(?:/matches)?$")
_TEAM = re.compile(r"/team/(.+)-([0-9A-Z]+)(?:/[a-z-]+)?$")
PARTICLES = {"van", "der", "de", "den", "du", "la", "le", "di", "da", "bin", "al", "el", "mc", "von", "ten", "te"}


def fold(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    return re.sub(r"[^a-z0-9 ]+", " ", "".join(c for c in s if not unicodedata.combining(c)).lower()).strip()


def parse_sitemap(xml: str, kind: str) -> list[tuple[str, str]]:
    """-> [(name tokens joined by space, crex id)], de-duplicated by id."""
    rx = _PLAYER if kind == "player" else _TEAM
    out, seen = [], set()
    for loc in re.findall(r"<loc>([^<]+)</loc>", xml):
        m = rx.search(loc.strip())
        if m and m.group(2) not in seen:
            seen.add(m.group(2))
            out.append((m.group(1).replace("-", " "), m.group(2)))
    return out


def fetch_sitemap(kind: str) -> str:
    req = urllib.request.Request(SITEMAP.format(kind), headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def _split_cricsheet(name: str) -> tuple[str, str, str]:
    """'HC Brook' -> (initials 'hc', given '', surname 'brook'); 'Rashid Khan' -> ('', 'rashid', 'khan')."""
    toks = name.split()
    k = 0
    while k < len(toks) - 1 and re.fullmatch(r"[A-Z]{1,4}", toks[k]):
        k += 1
    initials = "".join(toks[:k]).lower()
    rest = [fold(t) for t in toks[k:]]
    given = " ".join(rest[:-1]) if not initials else ""
    sur = " ".join(rest) if initials else (rest[-1] if rest else "")
    return initials, given, sur


def match_players(players: list[dict], crex: list[tuple[str, str]], named: dict[str, int] | None = None) -> dict[int, str]:
    """players: [{'idx', 'name', 'n', 'last'}] -> {player idx: CREX id}. Unique or clearly dominant matches only.

    If `named` is given it is filled with {folded CREX full name: player idx} for every accepted match (used to link scraped names).
    """
    by_sur: dict[str, list[tuple[dict, str, str]]] = {}
    for p in players:
        ini, given, sur = _split_cricsheet(p["name"])
        for key in {sur, sur.split(" ")[-1]}:
            if key:
                by_sur.setdefault(key, []).append((p, ini, given))
    best: dict[int, tuple[int, str]] = {}
    crex_sur: dict[str, int] = {}
    for name, _ in crex:
        t = fold(name).split()
        if t:
            crex_sur[t[-1]] = crex_sur.get(t[-1], 0) + 1
    for name, cid in crex:
        toks = fold(name).split()
        if len(toks) < 2:
            continue
        cands: dict[int, dict] = {}
        for take in (1, 2, 3):  # surname may carry particles ("van der Merwe")
            if len(toks) <= take:
                break
            sur, given = " ".join(toks[-take:]), toks[:-take]
            if take > 1 and toks[-take] not in PARTICLES:
                continue
            for p, ini, g in by_sur.get(sur, []):
                if ini:
                    ok = ini[0] == given[0][0] and (len(given) < 2 or len(ini) < 2 or ini[1] == given[1][0])
                else:
                    ok = g.split(" ")[0] == given[0] or (len(given[0]) > 2 and g.startswith(given[0][:3]) and g.split(" ")[0][:1] == given[0][:1] and g.split(" ")[0] == given[0])
                if ok:
                    cands[p["idx"]] = p
        if not cands and crex_sur.get(toks[-1]) == 1 and len(by_sur.get(toks[-1], [])) == 1:
            # second pass for an uncommon surname: the only Cricsheet player and the only CREX player with it, and his
            # initials contain the given name's first letter ("MD Shanaka" = "Dasun Shanaka")
            p, ini, g = by_sur[toks[-1]][0]
            if (ini and toks[0][0] in ini) or (not ini and g[:1] == toks[0][:1]):
                cands[p["idx"]] = p
        if not cands:
            continue
        ranked = sorted(cands.values(), key=lambda p: -p["n"])
        if len(ranked) > 1 and ranked[0]["n"] < 3 * ranked[1]["n"]:
            continue  # ambiguous: leave the silhouette
        p = ranked[0]
        if p["idx"] not in best or p["n"] > 0 and best[p["idx"]][0] < len(toks):
            best[p["idx"]] = (len(toks), cid, fold(name))
    if named is not None:
        counts: dict[str, int] = {}
        for _, _, nm in best.values():
            counts[nm] = counts.get(nm, 0) + 1
        for i, (_, _, nm) in best.items():
            if counts[nm] == 1:  # two Cricsheet players behind one CREX name would be a guess: leave it out
                named[nm] = i
    return {i: cid for i, (_, cid, _) in best.items()}


# Cricsheet names for franchises that were renamed or spelled differently on CREX (folded names)
TEAM_ALIASES = {
    "royal challengers bangalore": "royal challengers bengaluru", "kings xi punjab": "punjab kings", "delhi daredevils": "delhi capitals",
    "rising pune supergiants": "rising pune supergiant", "st kitts and nevis patriots": "st kitts nevis patriots", "jammu kashmir": "jammu and kashmir",
    "manchester originals": "manchesters super giants", "hyderabad india": "hyderabad", "lucknow super giants": "lucknow super giants",
}


def match_teams(teams: list[dict], crex: list[tuple[str, str]]) -> dict[str, str]:
    """teams: [{'name', 'g'}] (Cricsheet) -> {folded Cricsheet team name: CREX id}. Men's / unisex ids win; women-only slugs are ignored."""
    avail: dict[str, str] = {}
    for name, cid in crex:
        f = fold(name)
        if re.search(r"\b(women|w|u19|u 19|under 19|ii|2nd xi|academy)$", f):
            continue
        avail.setdefault(f, cid)
    out: dict[str, str] = {}
    for t in teams:
        f = fold(t["name"].replace("&", " and "))
        raw = fold(t["name"])
        for cand in (raw, f, TEAM_ALIASES.get(raw), TEAM_ALIASES.get(f)):
            if cand and cand in avail:
                out[raw] = avail[cand]
                break
    return out
