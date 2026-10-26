"""CREX deliveries (``data/balls``) -> a Cricsheet-shaped match document, so ``parse.parse_match`` reads them unchanged.

Only the fields the parser uses are produced: per-delivery batter / non-striker / bowler names, runs, extras
(wides, noballs, legbyes, byes, penalty) and wickets. Names are the scorecard's, so ``registry`` (name -> player
id) decides which players the site knows.
"""
from __future__ import annotations

EXTRA_KEY = {"wd": "wides", "nb": "noballs", "lb": "legbyes", "b": "byes", "pen": "penalty"}


def balls_doc(rows: list[dict], info: dict) -> dict:
    """``rows``: stored delivery rows of one match (string values). ``info``: the Cricsheet-style ``info`` block."""
    by_inn: dict[int, list[dict]] = {}
    for r in rows:
        by_inn.setdefault(int(r["innings"]), []).append(r)
    innings = []
    for no in sorted(by_inn):
        deliveries = sorted(by_inn[no], key=lambda r: int(r["seq"]))
        overs: dict[int, list[dict]] = {}
        for r in deliveries:
            bat, extra, total = int(r["bat_runs"]), int(r["extra_runs"]), int(r["total"])
            dl = {"batter": r["striker_name"] or r["striker"], "bowler": r["bowler_name"] or r["bowler"],
                  "non_striker": r["non_striker_name"] or r["non_striker"] or r["striker_name"] or r["striker"],
                  "runs": {"batter": bat, "extras": extra, "total": total}}
            if r["extra_type"] in EXTRA_KEY:
                dl["extras"] = {EXTRA_KEY[r["extra_type"]]: extra}
            if r["wicket"] == "1":
                dl["wickets"] = [{"player_out": r["dismissed_name"] or r["dismissed"] or dl["batter"],
                                  "kind": r["dismissal"] or "caught"}]
            overs.setdefault(int(r["over"]), []).append(dl)
        innings.append({"team": deliveries[0]["team_name"],
                        "overs": [{"over": o, "deliveries": overs[o]} for o in sorted(overs)]})
    return {"info": info, "innings": innings}
