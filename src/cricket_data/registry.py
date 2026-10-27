"""Link provisional (scraped) player names to Base registry IDs, and read canonical + provisional together.

Scrapers such as Source A give full names ("Harry Brook"); Base uses initials ("HC Brook") and an 8-hex
registry id. `link_players` fills `player_id` in provisional files from, in order:
  1. data/mappings/player_aliases.csv (raw_name, team, player_id), team may be blank;
  2. an exact name match within the team's canonical roster;
  3. same surname + compatible first name/initials, accepted only when exactly one roster player fits.
Anything else stays blank and is listed in data/provisional_unmatched.csv.
"""
from __future__ import annotations

import csv
import difflib
import json
import re
import unicodedata
from collections import defaultdict
from collections.abc import Iterator
from datetime import date, timedelta

from .models import MATCH_FIELDS, PLAYER_FIELDS
from .store import Store

UNMATCHED_FIELDS = ["date", "match_id", "team", "player", "reason", "candidates"]


def _fold(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c))


def _tokens(name: str) -> list[str]:
    return [t for t in re.split(r"[\s.\-]+", _fold(name).strip()) if t]


def _key(name: str) -> str:
    return " ".join(t.lower() for t in _tokens(name))


def _team(s: str) -> str:
    s = (s or "").lower().replace("&", " and ")
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"\s+(women|w)$", "", s.strip())
    return re.sub(r"[^a-z0-9]", "", s)


def _gender(g: str, team: str = "") -> str:
    g = (g or "").lower()
    if g in ("male", "female"):
        return g
    return "female" if re.search(r"\b(women|w)$", (team or "").lower().strip()) else "male"


def _initials(tok: str) -> bool:
    return tok.isalpha() and tok.isupper() and len(tok) <= 4


def _first_ok(raw_first: list[str], canon_first: list[str]) -> bool:
    """Do the given-name tokens agree? ('Harry' vs 'HC', 'Abhishek' vs 'Abhishek', 'Q' vs 'Quinton')."""
    if not raw_first or not canon_first:
        return False
    r0, c0 = raw_first[0], canon_first[0]
    if r0.lower() == c0.lower():
        return True
    if _initials(c0) and not _initials(r0):
        return c0[0] == raw_first[0][0].upper()
    if _initials(r0) and not _initials(c0):
        return r0[0] == c0[0].upper()
    if _initials(r0) and _initials(c0):
        return r0 == c0
    return False


def load_aliases(store: Store) -> dict[tuple[str, str], str]:
    p = store.root / "mappings" / "player_aliases.csv"
    out: dict[tuple[str, str], str] = {}
    if p.exists():
        with p.open(encoding="utf-8", newline="") as fh:
            for r in csv.DictReader(fh):
                if r.get("raw_name") and r.get("player_id"):
                    out[(_key(r["raw_name"]), _team(r.get("team", "")))] = r["player_id"].strip()
    return out


def build_rosters(store: Store, years: int = 6) -> dict[str, dict[str, tuple[str, str, int]]]:
    """team -> {player_id: (latest name, last date, appearances)} from canonical player rows."""
    cut = str(date.today().year - years)
    ros: dict[tuple[str, str], dict[str, list]] = defaultdict(dict)
    for m in store.months("players"):
        if m < cut:
            continue
        gender = {r["match_id"]: _gender(r.get("gender", "")) for r in store.read("matches", m)}
        for r in store.read("players", m):
            pid = r.get("player_id")
            if not pid:
                continue
            t = ros[(_team(r["team"]), gender.get(r["match_id"], "male"))]
            cur = t.get(pid)
            if cur is None:
                t[pid] = [r["player"], r["date"], 1]
            else:
                cur[2] += 1
                if r["date"] >= cur[1]:
                    cur[0], cur[1] = r["player"], r["date"]
    return {t: {pid: tuple(v) for pid, v in d.items()} for t, d in ros.items()}


def resolve(raw: str, team: str, rosters, aliases, gender: str = "") -> tuple[str, str, str]:
    """-> (player_id, reason, candidates). player_id '' when unmatched."""
    tk = _team(team)
    pid = aliases.get((_key(raw), tk)) or aliases.get((_key(raw), ""))
    if pid:
        return pid, "alias", ""
    roster = rosters.get((tk, _gender(gender, team)), {})
    if not roster:
        return "", "team_not_in_cricsheet", ""
    exact = [p for p, (n, _, _) in roster.items() if _key(n) == _key(raw)]
    if len(exact) == 1:
        return exact[0], "exact", ""
    rt = _tokens(raw)
    if not rt:
        return "", "empty_name", ""
    cands = []
    for p, (n, _, _) in roster.items():
        ct = _tokens(n)
        if not ct:
            continue
        # surname = last token; also allow a two-token surname ('de Kock', 'van der Dussen')
        for k in (1, 2, 3):
            if len(rt) > k and len(ct) > k and [x.lower() for x in rt[-k:]] == [x.lower() for x in ct[-k:]]:
                if _first_ok(rt[:-k], ct[:-k]):
                    cands.append(p)
                break
    cands = sorted(set(cands))
    reason = "surname_initial"
    if not cands:
        # 'Prasidh Krishna' -> 'M Prasidh Krishna', 'Varun Chakaravarthy' -> 'CV Varun': every non-initial
        # Base token is in the raw name (fuzzy, for spellings like Nitish/Nithish)
        raw_l = [t.lower() for t in rt]

        def has(tok):
            return any(t == tok or (len(tok) >= 5 and difflib.SequenceMatcher(None, t, tok).ratio() >= 0.85)
                       for t in raw_l)
        for p, (n, _, _) in roster.items():
            full = [t.lower() for t in _tokens(n) if not _initials(t)]
            if full and all(has(t) for t in full) and (len(full) >= 2 or len(rt) == 2):
                cands.append(p)
        cands, reason = sorted(set(cands)), "token_subset"
    if len(cands) == 1:
        return cands[0], reason, ""
    if len(cands) > 1:
        return "", "ambiguous", ";".join(f"{roster[p][0]}={p}" for p in cands)
    return "", "no_candidate", ""


def link_players(store: Store, today: date | None = None) -> dict[str, int]:
    """Fill player_id in every provisional JSON file; write data/provisional_unmatched.csv."""
    rosters, aliases = build_rosters(store), load_aliases(store)
    stats = {"files": 0, "rows": 0, "already": 0, "linked": 0, "unmatched": 0, "files_changed": 0}
    unmatched = []
    for path in sorted((store.root / "provisional").glob("*.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        stats["files"] += 1
        changed = False
        for pl in doc.get("players", []):
            stats["rows"] += 1
            if pl.get("player_id"):
                stats["already"] += 1
                continue
            pid, reason, cands = resolve(pl.get("player", ""), pl.get("team", ""), rosters, aliases,
                                         doc.get("gender", ""))
            if pid:
                pl["player_id"], changed = pid, True
                stats["linked"] += 1
            else:
                stats["unmatched"] += 1
                unmatched.append({"date": doc.get("date", ""), "match_id": doc.get("match_id", ""),
                                  "team": pl.get("team", ""), "player": pl.get("player", ""),
                                  "reason": reason, "candidates": cands})
        if changed:
            path.write_text(json.dumps(doc, indent=2, sort_keys=True) + "\n", encoding="utf-8")
            stats["files_changed"] += 1
    rep = store.root / "provisional_unmatched.csv"
    unmatched.sort(key=lambda r: (r["date"], r["match_id"], r["player"]))
    with rep.open("w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=UNMATCHED_FIELDS, lineterminator="\n")
        w.writeheader()
        w.writerows(unmatched)
    return stats


# ---------------------------------------------------------------- combined reads
def _fixture_key(d: str, a: str, b: str) -> tuple[str, frozenset]:
    return d, frozenset({_team(a), _team(b)})


def _provisional_docs(store: Store) -> list[dict]:
    return [json.loads(p.read_text(encoding="utf-8")) for p in sorted((store.root / "provisional").glob("*.json"))]


def pending_provisional(store: Store) -> list[dict]:
    """Provisional docs whose fixture is not yet in the canonical store (+/-1 day). Deduped by fixture."""
    docs = _provisional_docs(store)
    months = set()
    for d in docs:
        try:
            x = date.fromisoformat(d.get("date", ""))
        except ValueError:
            continue
        months |= {(x + timedelta(days=i)).isoformat()[:7] for i in (-1, 1)}
    canon = set()
    for m in months:
        for r in store.read("matches", m):
            canon.add(_fixture_key(r["date"], r["team_a"], r["team_b"]))
    out, seen = [], set()
    for d in docs:
        try:
            x = date.fromisoformat(d.get("date", ""))
        except ValueError:
            continue
        keys = [_fixture_key((x + timedelta(days=i)).isoformat(), d["team_a"], d["team_b"]) for i in (-1, 0, 1)]
        if any(k in canon for k in keys) or keys[1] in seen or d["match_id"] in seen:
            continue
        seen |= {keys[1], d["match_id"]}
        out.append(d)
    return out


def iter_combined(store: Store, kind: str, include_provisional: bool = True) -> Iterator[dict[str, str]]:
    """Canonical rows, then provisional rows for matches Base has not published yet."""
    yield from store.iter_all(kind)
    if not include_provisional:
        return
    fields = MATCH_FIELDS if kind == "matches" else PLAYER_FIELDS
    for d in pending_provisional(store):
        if kind == "matches":
            yield {f: str(d.get(f, "")) for f in fields}
        else:
            for pl in d.get("players", []):
                yield {f: str(pl.get(f, "")) for f in fields}


def freshness(store: Store, today: date | None = None) -> dict:
    today = today or date.today()
    newest = ""
    for m in reversed(store.months("matches")):
        rows = [r["date"] for r in store.read("matches", m) if r.get("status", "canonical") == "canonical"]
        if rows:
            newest = max(rows)
            break
    age = (today - date.fromisoformat(newest)).days if newest else None
    pend = pending_provisional(store)
    after = [d for d in pend if newest and d.get("date", "") > newest]
    return {"newest_canonical": newest, "age_days": age, "provisional_pending": len(pend),
            "provisional_after_canonical": len(after),
            "newest_provisional": max((d.get("date", "") for d in pend), default="")}


