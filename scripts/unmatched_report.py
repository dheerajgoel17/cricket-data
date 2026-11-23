"""Everything that did not match and so leaves a gap for the user: names to review one by one. Prints a markdown mail body.

Sources: the last value-bets run (team names and priced players it could not link), upcoming fixtures whose ground the history never saw under any name
(same stem and aliases as the site, `venueStem` in the engine), and players the scraped matches could not link (`data/provisional_unmatched.csv`, recent days).
Run: python scripts/unmatched_report.py [--days 7]
"""
import argparse, csv, glob, gzip, json, subprocess
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STEM_JS = "import {venueStem as s} from './site/packages/engine/markets.js';const v=JSON.parse(process.argv[1]);console.log(JSON.stringify(v.map(s)))"


def stems(names):
    out = subprocess.run(["node", "--input-type=module", "-e", STEM_JS, json.dumps(names)], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return json.loads(out)


def history_venues(root=ROOT):
    seen = set()
    for f in glob.glob(str(root / "data/matches/*.csv.gz")):
        with gzip.open(f, "rt", encoding="utf-8") as fh:
            seen.update(r["venue"] for r in csv.DictReader(fh) if r.get("venue"))
    return sorted(seen)


def missing_venues(fixtures, history, stem=stems):
    """Fixture grounds with no history under any spelling -> {ground: [match labels]}."""
    known = set(stem(history)) if history else set()
    names = sorted({f["venue"] for f in fixtures if f.get("venue")})
    out = defaultdict(list)
    for name, st in zip(names, stem(names) if names else []):
        if st not in known:
            out[name] = [f"{f['team_a']} v {f['team_b']} ({f['format']}, {f['start_utc'][:10]})" for f in fixtures if f.get("venue") == name]
    return dict(out)


def recent_unmatched(rows, since):
    """Provisional-match players that could not be linked since `since` -> Counter of (team, player, reason)."""
    return Counter((r["team"], r["player"], r["reason"]) for r in rows if r["date"] >= since)


def render(venues, teams, players, prov, days):
    L = [f"# Unmatched names (last {days} days)", "", "Each line leaves a user with an empty cell or a missing line. Review one by one."]
    L += ["", f"## Grounds with no history ({len(venues)})"] + ([f"- {v} — {', '.join(m[:3])}" for v, m in venues.items()] or ["- none"])
    L += ["", f"## Team names the pipeline could not link ({len(teams)})"] + ([f"- {t}" for t in teams] or ["- none"])
    L += ["", f"## Priced players with no identity ({len(players)})"] + ([f"- {p}" for p in players[:60]] or ["- none"])
    if len(players) > 60:
        L.append(f"- … and {len(players) - 60} more")
    L += ["", f"## Scraped-match players not linked ({len(prov)})"] + ([f"- {p} ({t}) — {r}" for (t, p, r), _ in prov.most_common(60)] or ["- none"])
    return "\n".join(L)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=7)
    a = ap.parse_args(argv)
    with open(ROOT / "data/fixtures/upcoming.csv", encoding="utf-8") as fh:
        fixtures = [r for r in csv.DictReader(fh) if r.get("status") != "Result"]
    vb = json.loads((ROOT / "value_bets/out/value_bets_latest.json").read_text(encoding="utf-8"))
    with open(ROOT / "data/provisional_unmatched.csv", encoding="utf-8") as fh:
        prov = recent_unmatched(csv.DictReader(fh), (date.today() - timedelta(days=a.days)).isoformat())
    print(render(missing_venues(fixtures, history_venues()), vb.get("unmatched_teams", []), vb.get("unmatched_players_in_window", []), prov, a.days))


if __name__ == "__main__":
    main()
