"""Ball-by-ball (Cricsheet JSON) -> per-innings batting/bowling rows, partnerships and match-market aggregates.

Rules baked in here (see docs/SITE.md):
* balls faced exclude wides; a boundary four excludes `non_boundary` runs; sixes are batter runs == 6
* bowler wickets exclude run outs, retired and obstructing the field; "retired hurt" is never a wicket
* runs conceded = batter runs + wides + no-balls + penalty runs (byes / leg byes excluded), as in data/players
* penalty runs count in team totals, over totals and partnerships
* batting position = order in which a batter first appears at the crease (striker or non-striker)
* super-over innings are ignored
"""
from __future__ import annotations

# T20 = T20 + T20I, ODI = ODI + domestic List A, Test = Tests only (first-class "MDM" is not a Test and is left out).
# The Hundred (T20 type, 5-ball overs) is its own format so its numbers never leak into T20.
FORMATS = {"T20": 0, "IT20": 0, "ODI": 1, "ODM": 1, "Test": 2}
HUNDRED = 3
FORMAT_NAMES = ["T20", "ODI", "Test", "Hundred"]
BOWLER_WICKETS = {"bowled", "caught", "caught and bowled", "lbw", "stumped", "hit wicket"}
NOT_A_WICKET = {"retired hurt", "retired not out"}
KINDS = ["", "bowled", "caught", "caught and bowled", "lbw", "stumped", "hit wicket", "run out",
         "retired out", "obstructing the field", "other", "retired hurt"]
KIND_CODE = {k: i for i, k in enumerate(KINDS)}
# innings array layout (all ints, then the top-scorer player indices)
INN_FIELDS = ["team", "runs", "wkts", "balls", "f4", "f6", "n30", "n50", "n100", "n10", "nsd", "nduck",
              "ho", "mc", "ts"]
OVERS_QUAL = 0.8  # T20/ODI summary markets: void unless 80% of the scheduled overs were bowled in BOTH innings


def squad_quality(sizes: list[int], lo: int = 9, hi: int = 13) -> int:
    """1 when both sides' named XI looks complete (9-13 players). Anything else (missing list, a half-scraped scorecard, a whole
    15-man squad) is unreliable: "not in the XI" / "in the XI" cannot be trusted, so the site shows N/A instead of DNP / VOID."""
    return int(len(sizes) == 2 and all(lo <= n <= hi for n in sizes))


def kind_code(kind: str) -> int:
    return KIND_CODE.get(kind, KIND_CODE["other"])


def _is_legal(extras: dict) -> bool:
    return "wides" not in extras and "noballs" not in extras


def parse_match(mid: str, doc: dict) -> dict | None:
    info = doc.get("info", {})
    fmt = FORMATS.get(info.get("match_type"))
    if fmt is None:
        return None
    if fmt == 0 and info.get("balls_per_over") == 5:
        fmt = HUNDRED
    dates = info.get("dates") or []
    if not dates or not info.get("teams") or len(info["teams"]) != 2:
        return None
    people = (info.get("registry") or {}).get("people", {})
    outcome = info.get("outcome") or {}
    bpo = info.get("balls_per_over") or 6
    sched_overs = info.get("overs") or 0
    toss = info.get("toss") or {}
    winner = outcome.get("winner", "")
    if winner:
        res = 0
    elif outcome.get("result") == "tie" or "eliminator" in outcome:
        res = 1
    elif outcome.get("result") == "draw":
        res = 3
    else:
        res = 2  # no result / abandoned
    m = {
        "id": mid, "date": dates[0], "fmt": fmt, "gender": 1 if info.get("gender") == "female" else 0,
        "intl": 1 if info.get("team_type") == "international" else 0,
        "event": (info.get("event") or {}).get("name", "") if isinstance(info.get("event"), dict) else str(info.get("event") or ""),
        "venue": info.get("venue", "") or "", "city": info.get("city", "") or "",
        "teams": list(info["teams"]), "winner": winner, "res": res, "overs": sched_overs, "bpo": bpo,
        "days": len(dates), "toss_winner": toss.get("winner", ""), "toss_decision": toss.get("decision", ""),
        "pom": list(info.get("player_of_match") or []),
    }
    innings, bat, bowl, parts = [], [], [], []
    k = 0
    for inn in doc.get("innings", []):
        if inn.get("super_over"):
            continue
        k += 1
        team = inn.get("team")
        if team not in info["teams"]:
            continue
        opp = info["teams"][1 - info["teams"].index(team)]
        r = _parse_innings(inn, people)
        r["team"], r["opp"], r["no"] = team, opp, k
        innings.append(r)
        for p, b in r["bat"].items():
            bat.append({"pid": p, "inn": k, "team": team, "opp": opp, **b})
        for p, b in r["bowl"].items():
            bowl.append({"pid": p, "inn": k, "team": opp, "opp": team, **b})
        for pt in r["parts"]:
            parts.append({"inn": k, **pt})
    m["innings"] = innings
    m["bat"], m["bowl"], m["parts"] = bat, bowl, parts
    # the named playing XI (registry ids): in the XI but never batting / bowling means player bets on that stat are void
    m["xi"] = [people[n] for names in (info.get("players") or {}).values() for n in names if people.get(n)]
    m["first"] = innings[0]["team"] if innings else ""
    _market_aggregates(m)
    return m


def _parse_innings(inn: dict, people: dict) -> dict:
    pid = lambda n: people.get(n) or ""  # noqa: E731 - unknown registry ids are dropped by the exporter
    B: dict[str, dict] = {}
    W: dict[str, dict] = {}
    order: list[str] = []
    parts: list[dict] = []
    runs = wkts = legal = 0
    ho = 0
    seg = None
    seg_k = 0
    for ov in inn.get("overs", []):
        orun = 0
        for dl in ov["deliveries"]:
            bt, ns, bw = dl["batter"], dl["non_striker"], dl["bowler"]
            for p in (bt, ns):
                if p not in B:
                    B[p] = {"r": 0, "b": 0, "f": 0, "s": 0, "k": 0, "o": len(order) + 1}
                    order.append(p)
            rr = dl["runs"]
            ex = dl.get("extras", {})
            tot = rr["total"]
            runs += tot
            orun += tot
            b = B[bt]
            b["r"] += rr["batter"]
            if "wides" not in ex:
                b["b"] += 1
            if rr["batter"] == 4 and not rr.get("non_boundary"):
                b["f"] += 1
            if rr["batter"] == 6:
                b["s"] += 1
            w = W.setdefault(bw, {"w": 0, "rc": 0, "bb": 0})
            w["rc"] += rr["batter"] + ex.get("wides", 0) + ex.get("noballs", 0) + ex.get("penalty", 0)
            leg = _is_legal(ex)
            if leg:
                w["bb"] += 1
                legal += 1
            # partnership segment
            pair = frozenset((bt, ns))
            if seg is not None and seg["pair"] != pair:  # pair changed without a wicket (retirement): close it
                parts.append(_close(seg, pid, None, 0))
                seg = None
            if seg is None:
                seg = {"pair": pair, "k": seg_k, "w": wkts + 1, "runs": 0, "balls": 0, "ra": {}}
                seg_k += 1
            seg["runs"] += tot
            if "wides" not in ex:
                seg["balls"] += 1
            seg["ra"][bt] = seg["ra"].get(bt, 0) + rr["batter"]
            ended = False
            for wk in dl.get("wickets", []):
                kind = wk["kind"]
                out = wk["player_out"]
                if kind in NOT_A_WICKET:
                    if seg is not None:
                        parts.append(_close(seg, pid, out, kind_code(kind), counted=False))
                        seg = None
                    continue
                wkts += 1
                if out in B:
                    B[out]["k"] = kind_code(kind)
                if kind in BOWLER_WICKETS:
                    w["w"] += 1
                if seg is not None and not ended:
                    parts.append(_close(seg, pid, out, kind_code(kind)))
                    seg = None
                    ended = True
        ho = max(ho, orun)
    if seg is not None:
        parts.append(_close(seg, pid, None, 0))
    return {"bat": {pid(p): v for p, v in B.items() if pid(p)}, "bowl": {pid(p): v for p, v in W.items() if pid(p)},
            "parts": [p for p in parts if p], "runs": runs, "wkts": wkts, "balls": legal, "ho": ho,
            "order": [pid(p) for p in order]}


def _close(seg: dict, pid, out: str | None, kind: int, counted: bool = True) -> dict | None:
    """Close a partnership. `out` is who was dismissed (None = innings ended / still together)."""
    ids = sorted(pid(p) for p in seg["pair"])
    if len(ids) != 2 or not all(ids):
        return None
    a, b = ids
    outid = pid(out) if out else ""
    who = 1 if outid == a else 2 if outid == b else 0
    if not counted:  # retired hurt: the stand ended without a wicket
        who = 0
    ra = {pid(p): v for p, v in seg["ra"].items()}
    return {"a": a, "b": b, "open": 1 if seg["k"] == 0 else 0, "w": seg["w"], "runs": seg["runs"],
            "balls": seg["balls"], "ra": ra.get(a, 0), "rb": ra.get(b, 0), "x": who, "kd": kind}


def _market_aggregates(m: dict) -> None:
    mc_by: dict[str, int] = {}
    top_all = 0
    for inn in m["innings"]:
        sc = [v["r"] for v in inn["bat"].values()]
        inn["f4"] = sum(v["f"] for v in inn["bat"].values())
        inn["f6"] = sum(v["s"] for v in inn["bat"].values())
        inn["n30"] = sum(30 <= s < 50 for s in sc)
        inn["n50"] = sum(50 <= s < 100 for s in sc)
        inn["n100"] = sum(s >= 100 for s in sc)
        inn["n10"] = sum(s >= 10 for s in sc)
        inn["nsd"] = sum(1 <= s <= 9 for s in sc)  # single digits: ducks (dismissed for 0) are NOT single-digit
        inn["nduck"] = sum(1 for v in inn["bat"].values() if v["r"] == 0 and v["k"] and v["k"] != KIND_CODE["retired hurt"])
        inn["ts"] = max(sc) if sc else 0
        inn["mc"] = max((v["rc"] for v in inn["bowl"].values()), default=0)
        inn["tops"] = [p for p, v in inn["bat"].items() if v["r"] == inn["ts"] and inn["ts"] > 0]
        top_all = max(top_all, inn["ts"])
        for p, v in inn["bowl"].items():
            mc_by[p] = mc_by.get(p, 0) + v["rc"]
        for p, v in inn["bat"].items():
            others = [q for q in inn["bat"] if q != p and inn["bat"][q]["r"] == v["r"]]
            v["tb"] = 0 if v["r"] != inn["ts"] or v["r"] == 0 else (2 if others else 1)
    tied = sum(1 for i2 in m["innings"] for w in i2["bat"].values() if w["r"] == top_all and top_all > 0)
    for inn in m["innings"]:
        for v in inn["bat"].values():
            v["mt"] = 0 if v["r"] != top_all or top_all == 0 else (2 if tied > 1 else 1)
    m["mc"] = max(mc_by.values(), default=0)
    m["ts"] = top_all
    m["ho"] = max((i["ho"] for i in m["innings"]), default=0)
    m["q"] = qualifies(m)


def qualifies(m: dict) -> int:
    """Exchange-style validity of match-summary markets (1 valid, 0 void)."""
    inns = m["innings"]
    if m["fmt"] != 2:
        default = {0: 20, 1: 50, HUNDRED: 20}[m["fmt"]]
        overs = m["overs"] if 0 < m["overs"] <= default else default  # a few T20 files carry overs=50: use the format's own length
        sched = overs * m["bpo"]
        need = round(OVERS_QUAL * sched)
        return int(len(inns) >= 2 and min(i["balls"] for i in inns[:2]) >= need)
    if m["res"] in (0, 1):  # Test with a result (win or tie)
        return 1
    overs = sum(i["balls"] for i in inns) / m["bpo"]
    need = 300 if m["days"] >= 5 else 200
    return int(overs >= need)
