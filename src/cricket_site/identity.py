"""The player-identity table: one place that links a player's three names by id.

The data knows a player by our id and a history name ("V Suryavanshi"), the live source by its own id and full name ("Vaibhav Sooryavanshi"), the books by
whatever they print ("Kusal Mendis" for "BKG Mendis"). Matching those by name goes wrong in a different way each time, so the table is built once per site build and
the live lookups read ids from it; a name stays the fallback.

    {"v": 1, "s": {our id: the live source's player id}, "b": {our id: [names the books use, when they differ from ours]}}

A source id is taken from, in this order (an id is never given to two players):
1. ``data/mappings/player_identity.csv``: a link somebody checked by hand. It overrides every automatic link.
2. The photo map: the conservative name match in ``crex_assets`` (surname and first initial agree, an ambiguous name is skipped).
3. The books: the pipeline already resolved a book line to our id, so for a *priced* player an exact full-name match (his history name or a name the books use
   against the source's full names) is evidence enough, provided exactly one source player has that name and nobody else claims him. It also replaces a photo-map
   link to a different source player (the initials-and-surname match can pick a namesake), but never takes a source player another player holds.

Whatever could not be linked comes back as the review list (priced players only: they are the ones the live numbers are read for), each with the source players it
might be, so a fix is one line in the overrides file. Stdlib only.
"""
from __future__ import annotations

import csv
import difflib
import json
import sys
from collections import defaultdict
from pathlib import Path

from .crex_assets import fold

OVERRIDES = Path("mappings") / "player_identity.csv"  # under the data folder: player_id,source_id,note


def load_overrides(data_dir: Path | None) -> dict[str, str]:
    """{our id: source id} from the hand-checked file. Blank lines and `#` comments are skipped; a later line for the same player wins."""
    f = data_dir / OVERRIDES if data_dir else None
    out: dict[str, str] = {}
    if f and f.exists():
        with f.open(encoding="utf-8", newline="") as fh:
            for r in csv.reader(x for x in fh if x.strip() and not x.lstrip().startswith("#")):
                if len(r) >= 2 and r[0].strip().lower() != "player_id" and r[0].strip() and r[1].strip():
                    out[r[0].strip()] = r[1].strip()
    return out


def _json(path: Path) -> dict:
    try:
        d = json.loads(path.read_text(encoding="utf-8"))
        return d if isinstance(d, dict) else {}
    except (OSError, ValueError):
        return {}  # a half-written file must not fail the site build


def collect_books(vb_dir: Path | None) -> dict[str, dict]:
    """{our id: {"hist": the name we use, "names": the names the books use}} from the current book file and the permanent archive (``value_bets/archive``, next to ``out``)."""
    out: dict[str, dict] = {}
    if not vb_dir:
        return out
    files = [vb_dir / "book_lines.json", *sorted((vb_dir.parent / "archive").glob("*/*.json"))]
    for f in files:
        for ln in _json(f).get("lines") or []:
            pid = ln.get("pid")
            if not pid:
                continue
            e = out.setdefault(pid, {"hist": "", "names": set()})
            e["hist"] = e["hist"] or ln.get("player") or ""
            if ln.get("book_name"):
                e["names"].add(ln["book_name"])
    return {p: {"hist": e["hist"], "names": sorted(e["names"])} for p, e in out.items()}


def _initials(name: str) -> str:
    """'WIA Fernando' -> 'wia'; 'Avishka Fernando' -> 'a' (the first letter of the given name)."""
    toks = name.split()
    first = toks[0] if toks else ""
    return first.lower() if len(toks) > 1 and first.isupper() and len(first) <= 4 else first[:1].lower()


def suggest(names: list[str], sitemap: list[tuple[str, str]], taken: set[str], limit: int = 5) -> list[list[str]]:
    """Source players that could be this one: the same or a near surname, and a given name that starts with one of his initials. [[source id, name]], best first. Never linked from here."""
    scored = []
    for raw in names:
        toks = fold(raw).split()
        if not toks:
            continue
        ini, sur = _initials(raw.replace("-", " ")), toks[-1]
        for sid, nm in sitemap:
            t = fold(nm).split()
            if sid in taken or len(t) < 2:
                continue
            r = 1.0 if t[-1] == sur else difflib.SequenceMatcher(None, t[-1], sur).ratio()
            if r >= 0.8 and len(sur) >= 5 or r == 1.0:
                if len(toks) == 1 or t[0][0] in ini:
                    scored.append((-r, t[0] != toks[0], sid, nm))
    seen, out = set(), []
    for _, _, sid, nm in sorted(scored):
        if sid not in seen:
            seen.add(sid)
            out.append([sid, nm])
    return out[:limit]


def build(photo_p: dict[str, str], sitemap: list[tuple[str, str]], names: dict[str, str], books: dict[str, dict], overrides: dict[str, str]) -> tuple[dict, list[dict], dict[str, str]]:
    """-> (the table, the review list, {our id: source id} for the links the photo map did not already have or had differently).

    photo_p: the photo map ({our id: "c:<source id>" | "w:<file>"}); sitemap: [(source id, full name)]; names: our name per id; books: ``collect_books``;
    overrides: ``load_overrides``. With no sitemap (an offline build) overrides are taken on trust and the other routes find nothing.
    """
    known = {sid for sid, _ in sitemap}
    by_name: dict[str, set[str]] = defaultdict(set)
    for sid, nm in sitemap:
        by_name[fold(nm)].add(sid)
    link: dict[str, str] = {}
    owner: dict[str, str] = {}
    review: list[dict] = []

    def item(pid: str, why: str, *, cands: list | None = None) -> None:
        b = books.get(pid, {})
        mine = [n for n in [b.get("hist") or names.get(pid, pid), *b.get("names", [])] if n]
        review.append({"pid": pid, "name": names.get(pid) or b.get("hist") or pid, "books": b.get("names", []), "why": why,
                       "suggest": cands if cands is not None else suggest(mine, sitemap, set(owner))})

    for pid, sid in sorted(overrides.items()):
        if known and sid not in known:
            item(pid, f"the override names source id {sid}, which the source's list does not have")
            continue
        if sid in owner:
            item(pid, f"the override gives source id {sid}, which another override already gave to {owner[sid]}")
            continue
        link[pid], owner[sid] = sid, pid
    hand = set(link)
    for pid, v in sorted(photo_p.items()):
        if v.startswith("c:") and pid not in link and v[2:] not in owner:
            link[pid], owner[v[2:]] = v[2:], pid
    # The books: a priced player's names against the source's full names. Exactly one source player with that name is stronger evidence than the photo map's
    # initials-and-surname match (which gave Axar Patel to a source "Ajaz Patel"), so it replaces that link, but never takes a source player another player holds.
    hits_of: dict[str, set[str]] = {}
    claims: dict[str, list[str]] = defaultdict(list)
    for pid in sorted(books):
        if pid in hand:
            continue
        hits: set[str] = set()
        for n in [books[pid]["hist"], *books[pid]["names"]]:
            hits |= by_name.get(fold(n), set())
        hits_of[pid] = hits
        if len(hits) == 1:
            claims[next(iter(hits))].append(pid)
    stuck: dict[str, tuple[str, list | None]] = {}
    for pid, hits in hits_of.items():
        sid = next(iter(hits)) if len(hits) == 1 else ""
        if not hits:
            stuck[pid] = ("no source player has this name", None)
        elif not sid:
            stuck[pid] = ("several source players have this name", [[s, nm] for s, nm in sitemap if s in hits])
        elif link.get(pid) == sid:
            continue
        elif len(claims[sid]) > 1:
            stuck[pid] = (f"source player {sid} is claimed by {len(claims[sid])} of our players: " + ", ".join(claims[sid]), None)
        elif sid in owner:
            mine = f"; his own link {link[pid]} came from a name match" if pid in link else ""
            stuck[pid] = (f"the source player with this name ({sid}) is already linked to {owner[sid]}{mine}", None)
        else:
            if pid in link:
                del owner[link[pid]]  # the photo map's match gives way to the exact name
            link[pid], owner[sid] = sid, pid
    for pid, (reason, cands) in stuck.items():
        if pid not in link or "his own link" in reason:  # a player left unlinked, or linked by a name match the books contradict
            item(pid, reason, cands=cands)
    added = {p: s for p, s in link.items() if photo_p.get(p) != "c:" + s}
    table = {"v": 1, "s": dict(sorted(link.items())),
             "b": {p: [n for n in b["names"] if n != b["hist"]] for p, b in sorted(books.items()) if any(n != b["hist"] for n in b["names"])}}
    return table, sorted(review, key=lambda r: (r["name"], r["pid"])), added


def to_markdown(review: list[dict]) -> str:
    """The review list as a table for a job summary; the last column is the line to add to the overrides file once somebody has checked the right source player."""
    if not review:
        return "Every priced player is linked to the source.\n"
    rows = ["| player | our id | books call him | why | could be |", "|---|---|---|---|---|"]
    for r in review:
        rows.append(f"| {r['name']} | `{r['pid']}` | {', '.join(r['books']) or '-'} | {r['why']} | " + (", ".join(f"`{s}` {n}" for s, n in r["suggest"]) or "-") + " |")
    return "\n".join(rows) + "\n\nFix a row by adding `<our id>,<source id>,<note>` to `data/mappings/player_identity.csv`.\n"


def main(argv: list[str] | None = None) -> int:
    """Print a review list written by the site build (``identity_review.json``) as markdown."""
    a = list(sys.argv[1:] if argv is None else argv)
    if len(a) != 1:
        print("usage: python -m cricket_site.identity identity_review.json", file=sys.stderr)
        return 2
    try:
        review = json.loads(Path(a[0]).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        review = []
    print(to_markdown(review), end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
