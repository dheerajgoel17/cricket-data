"""Synthetic Cricsheet-shaped matches with hand-known numbers (used by the pytest suite and the JS fixture)."""
from __future__ import annotations

import hashlib
import json
import zipfile
from pathlib import Path


def pid(name: str) -> str:
    return hashlib.md5(name.encode()).hexdigest()[:8]


def D(bat, ns, bowl="?", runs=0, extras=None, wickets=None):
    ex = extras or {}
    total = runs + sum(ex.values())
    d = {"batter": bat, "non_striker": ns, "bowler": bowl, "runs": {"batter": runs, "extras": sum(ex.values()), "total": total}}
    if ex:
        d["extras"] = ex
    if wickets:
        d["wickets"] = wickets
    return d


def to_overs(deliveries, bowlers):
    """Group deliveries into overs of 6 legal balls; each over gets one bowler (round-robin)."""
    overs, cur, legal, n = [], [], 0, 0
    for d in deliveries:
        d = json.loads(json.dumps(d))
        d["bowler"] = d["bowler"] if d["bowler"] != "?" else bowlers[n % len(bowlers)]
        cur.append(d)
        ex = d.get("extras", {})
        if "wides" not in ex and "noballs" not in ex:
            legal += 1
        if legal == 6:
            overs.append({"over": len(overs), "deliveries": cur})
            cur, legal, n = [], 0, n + 1
    if cur:
        overs.append({"over": len(overs), "deliveries": cur})
    return overs


def scripted(team, order, stats, bowlers, pad_to=120, extra=None):
    """Batters take turns facing a full innings while the next batter waits at the other end.

    stats[name] = dict(runs, f4, f6, out=True, kind='bowled', wides=0). Everyone not marked out stays not out; the last
    two batters are not out and pad the innings with dot balls until `pad_to` legal balls.
    """
    ds = list(extra or [])
    for i, p in enumerate(order):
        s = stats[p]
        partner = order[i + 1] if i + 1 < len(order) else order[i - 1]
        ones = s["runs"] - 4 * s.get("f4", 0) - 6 * s.get("f6", 0)
        assert ones >= 0, (p, s)
        balls = [4] * s.get("f4", 0) + [6] * s.get("f6", 0) + [1] * ones + [0] * s.get("dots", 0)
        for _ in range(s.get("wides", 0)):
            ds.append(D(p, partner, extras={"wides": 1}))
        out_ball = None
        if s.get("out") and i < len(order) - 2:
            if not balls:
                balls = [0]
            out_ball = {"player_out": p, "kind": s.get("kind", "bowled")}
        for k, r in enumerate(balls):
            w = [out_ball] if out_ball and k == len(balls) - 1 else None
            ds.append(D(p, partner, runs=r, wickets=w))
    legal = sum(1 for d in ds if "wides" not in d.get("extras", {}) and "noballs" not in d.get("extras", {}))
    while legal < pad_to:
        ds.append(D(order[-1], order[-2]))
        legal += 1
    return {"team": team, "overs": to_overs(ds, bowlers)}


def doc(date, teams, innings, *, event="Test Series", venue="Ground", mtype="T20", gender="male", winner=None,
        overs=20, bpo=6, team_type="international", people=None, dates=None):
    dl = [d for i in innings for o in i["overs"] for d in o["deliveries"]]
    names = sorted({d["batter"] for d in dl} | {d["non_striker"] for d in dl} | {d["bowler"] for d in dl})
    info = {"dates": dates or [date], "match_type": mtype, "team_type": team_type, "gender": gender, "event": {"name": event},
            "venue": venue, "teams": list(teams), "balls_per_over": bpo, "toss": {"winner": teams[0], "decision": "bat"},
            "outcome": {"winner": winner or teams[0], "by": {"runs": 1}},
            "registry": {"people": people or {n: pid(n) for n in names}}}
    if overs:
        info["overs"] = overs
    return {"info": info, "innings": innings}


# ----------------------------------------------------------------------------- the "Alpha v Beta" fixture dataset
BROOK, DUCKETT, ROOT, KOHLI = "HC Brook", "BM Duckett", "JE Root", "V Kohli"
BROOK_RUNS = [10, 35, 52, 5, 0, 27, 61, 9, 44, 18]
BROOK_F4 = [1, 3, 5, 0, 0, 2, 6, 1, 4, 2]
BROOK_F6 = [0, 2, 1, 0, 0, 3, 1, 0, 2, 0]
DUCK_RUNS = [20, 8, 15, 40, 33, 11, 9, 70, 3, 26]
DUCK_F4 = [2, 1, 1, 3, 2, 1, 0, 5, 0, 2]
DUCK_F6 = [0, 0, 0, 1, 0, 0, 0, 2, 0, 0]
ODI_BROOK_F6 = [1, 1, 1, 1]
ALPHA_BOWL = ["A Bowl1", "A Bowl2", "A Bowl3", "A Bowl4", "A Bowl5"]
BETA_BOWL = ["B Bowl1", "B Bowl2", "B Bowl3", "B Bowl4", "B Bowl5"]


def _top_name(brook: int, duck: int) -> str:
    best = max(brook, duck, 30)  # Kohli always makes 30
    names = [n for n, r in (("brook", brook), ("duckett", duck), ("kohli", 30)) if r == best]
    return names[0] if len(names) == 1 else "tie"


def alpha_innings(i, fmt="T20", brook=None):
    first = DUCKETT if i >= 7 else BROOK
    second = BROOK if i >= 7 else DUCKETT
    st = {
        BROOK: dict(runs=BROOK_RUNS[i], f4=BROOK_F4[i], f6=BROOK_F6[i], out=True),
        DUCKETT: dict(runs=DUCK_RUNS[i], f4=DUCK_F4[i], f6=DUCK_F6[i], out=True),
        "F One": dict(runs=0, out=False), "F Two": dict(runs=0, out=False),
    }
    return st, [first, second, "F One", "F Two"]


def beta_innings():
    st = {KOHLI: dict(runs=30, f4=2, f6=1, out=True), "G Gill": dict(runs=3, out=True),
          "H One": dict(runs=0, out=False), "H Two": dict(runs=0, out=False)}
    return st, [KOHLI, "G Gill", "H One", "H Two"]


def make_dataset() -> tuple[dict[str, dict], dict]:
    docs, exp = {}, {"t20": []}
    for i in range(10):
        away = i % 2 == 0
        alpha_first = i < 5
        st, order = alpha_innings(i)
        a = scripted("Alpha", order, st, BETA_BOWL)
        bst, border = beta_innings()
        b = scripted("Beta", border, bst, ALPHA_BOWL)
        innings = [a, b] if alpha_first else [b, a]
        date = f"2024-{1 + i // 3:02d}-{10 + i:02d}"
        event = "Alpha tour of Beta, 2024" if away else "Beta tour of Alpha, 2024"
        venue = "Beta Oval" if away else "Alpha Park"
        docs[f"t20_{i:02d}"] = doc(date, ("Alpha", "Beta"), innings, event=event, venue=venue, winner="Alpha")
        exp["t20"].append({"id": f"t20_{i:02d}", "away": away, "alpha_first": alpha_first, "brook_pos": 2 if i >= 7 else 1,
                           "fours": BROOK_F4[i] + DUCK_F4[i] + 2, "sixes": BROOK_F6[i] + DUCK_F6[i] + 1,
                           "alpha_runs": BROOK_RUNS[i] + DUCK_RUNS[i], "beta_runs": 33,
                           "n30": sum(x >= 30 and x < 50 for x in (BROOK_RUNS[i], DUCK_RUNS[i], 30)),
                           "n50": sum(50 <= x < 100 for x in (BROOK_RUNS[i], DUCK_RUNS[i], 30)),
                           "top": max(BROOK_RUNS[i], DUCK_RUNS[i], 30),
                           "open_runs": DUCK_RUNS[i] if i >= 7 else BROOK_RUNS[i], "first_out": "duckett" if i >= 7 else "brook",
                           "top_name": _top_name(BROOK_RUNS[i], DUCK_RUNS[i])})
    for j, s6 in enumerate(ODI_BROOK_F6):
        st = {BROOK: dict(runs=30 + j, f4=1, f6=s6, out=True), DUCKETT: dict(runs=10, out=True),
              "F One": dict(runs=0, out=False), "F Two": dict(runs=0, out=False)}
        a = scripted("Alpha", [BROOK, DUCKETT, "F One", "F Two"], st, BETA_BOWL, pad_to=300)
        bst, border = beta_innings()
        b = scripted("Beta", border, bst, ALPHA_BOWL, pad_to=300)
        docs[f"odi_{j:02d}"] = doc(f"2025-0{1 + j}-05", ("Alpha", "Beta"), [a, b], event="Alpha tour of Beta, 2025", venue="Beta Oval",
                                   mtype="ODI", overs=50, winner="Alpha")
    # a short, rain-affected T20 (void for summary markets): 5 overs each
    st, order = alpha_innings(0)
    a = scripted("Alpha", order, st, BETA_BOWL, pad_to=30)
    bst, border = beta_innings()
    b = scripted("Beta", border, bst, ALPHA_BOWL, pad_to=30)
    docs["t20_short"] = doc("2024-06-01", ("Alpha", "Beta"), [a, b], event="Beta tour of Alpha, 2024", venue="Alpha Park", winner="Alpha")
    return docs, exp


def write_zip(docs: dict[str, dict], path: Path) -> Path:
    with zipfile.ZipFile(path, "w") as z:
        for k, v in docs.items():
            z.writestr(f"{k}.json", json.dumps(v))
    return path
