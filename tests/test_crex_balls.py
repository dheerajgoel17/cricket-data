import random
from types import SimpleNamespace

import pytest
from crex_fixture import FIXTURE, card

from cricket_data import crex_balls, crex_scorecard
from cricket_data.crex_balls import collect, decode, dismissal_kind, parse_balls, reconcile, totals
from cricket_data.store import Store


@pytest.mark.parametrize("code,expected", [
    ("0", (0, "", 0, True, False)),
    ("4", (4, "", 0, True, False)),
    ("6", (6, "", 0, True, False)),
    ("W", (0, "", 0, True, True)),
    ("1W", (1, "", 0, True, True)),  # run-out after one run
    ("WD", (0, "wd", 1, False, False)),
    ("2wd", (0, "wd", 2, False, False)),  # a wide that went for two in all
    ("1lb", (0, "lb", 1, True, False)),
    ("4b", (0, "b", 4, True, False)),
    ("2nb", (2, "nb", 1, False, False)),  # two off the bat plus the no-ball
    ("nb", (0, "nb", 1, False, False)),
    ("???", (0, "", 0, True, False)),
])
def test_decode(code, expected):
    assert decode(code) == expected


@pytest.mark.parametrize("desc,kind", [
    ("c D Kulkarni b R Dhawan", "caught"),
    ("b R Dhawan", "bowled"),
    ("lbw b R Reifer", "lbw"),
    ("st K Keeper b S Spinner", "stumped"),
    ("run out (Harbhajan)", "run out"),
    ("c &amp; b M Miller", "caught and bowled"),
    ("hit wicket b Y", "hit wicket"),
    ("", ""),
])
def test_dismissal_kind(desc, kind):
    assert dismissal_kind(desc) == kind


def test_fixture_match_reconciles_with_the_scorecard():
    balls = parse_balls(FIXTURE["events"], "13W5", card())
    assert len(balls) == 215  # 211 legal-or-not deliveries across both innings
    t = totals(balls)
    assert (t[1]["runs"], t[1]["wkts"], t[1]["legal"]) == (110, 8, 120)
    assert (t[2]["runs"], t[2]["wkts"]) == (111, 4)
    issues = reconcile(balls, card())
    assert [i for i in issues if crex_balls.is_hard(i)] == []
    assert all(i.startswith("bowl:") for i in issues)  # CREX's own card is a ball out on one over


def test_extras_and_wickets_are_decoded():
    balls = parse_balls(FIXTURE["events"], "13W5", card())
    assert sum(b.extra_type == "wd" for b in balls) == 5
    assert sum(b.extra_type == "lb" for b in balls) == 4
    nb = next(b for b in balls if b.extra_type == "nb")
    assert (nb.bat_runs, nb.extra_runs, nb.total, nb.legal) == (2, 1, 3, 0)
    kinds = [b.dismissal for b in balls if b.wicket]
    assert len(kinds) == 12 and set(kinds) == {"caught", "bowled", "lbw", "run out"}
    assert all(b.dismissed for b in balls if b.wicket)


def test_non_striker_is_known_on_every_ball_with_the_scorecard():
    balls = parse_balls(FIXTURE["events"], "13W5", card())
    assert all(b.non_striker and b.non_striker != b.striker for b in balls)
    first = balls[0]
    assert (first.striker, first.non_striker) == tuple(b.pid for b in card().innings[0].batters[:2])


def test_over_and_ball_counters():
    balls = [b for b in parse_balls(FIXTURE["events"], "13W5", card()) if b.innings == 1]
    assert (balls[0].over, balls[0].ball) == (0, 1)
    assert max(b.ball for b in balls) == 6
    assert sum(b.legal for b in balls if b.over == 19) == 6 or max(b.over for b in balls) < 20


def test_order_and_duplicates_do_not_matter():
    events = list(FIXTURE["events"])
    random.Random(1).shuffle(events)
    again = parse_balls(events + events[:40], "13W5", card())
    assert [b.row() for b in again] == [b.row() for b in parse_balls(FIXTURE["events"], "13W5", card())]


def test_a_corrected_ball_replaces_the_original():
    events = [dict(e) for e in FIXTURE["events"]]
    orig = next(e for e in events if e["type"] == "b" and e["inning"] == 0 and e["b"] == "0")
    fixed = dict(orig, id=orig["id"] + 5, b="4")  # the scorer re-entered the same delivery
    balls = parse_balls(events + [fixed], "13W5", card())
    assert len(balls) == 215
    assert sum(b.bat_runs for b in balls if b.innings == 1) == totals(parse_balls(events, "13W5", card()))[1]["runs"] - sum(
        b.extra_runs for b in balls if b.innings == 1) + 4


def test_reconcile_catches_a_wrong_parse():
    balls = parse_balls(FIXTURE["events"], "13W5", card())
    victim = next(b for b in balls if b.innings == 2 and b.bat_runs == 1)
    victim.bat_runs = 0
    hard = [i for i in reconcile(balls, card()) if crex_balls.is_hard(i)]
    assert hard and hard[0].startswith("bat:")


def test_reconcile_catches_missing_innings():
    balls = [b for b in parse_balls(FIXTURE["events"], "13W5", card()) if b.innings == 1]
    assert any(i.startswith("innings:") for i in reconcile(balls, card()))


def test_store_upsert_balls_is_idempotent_and_replaces(tmp_path):
    store = Store(tmp_path)
    balls = parse_balls(FIXTURE["events"], "13W5", card())
    rows = crex_balls.rows_for("crex-x", "2026-10-13", balls)
    assert store.upsert_balls("crex-x", "2026-10-13", rows) is True
    assert store.upsert_balls("crex-x", "2026-10-13", rows) is False  # byte-identical: no git diff
    store.upsert_balls("crex-y", "2026-10-14", rows[:10])
    store.upsert_balls("crex-x", "2026-10-13", rows[:5])  # re-scrape replaces, never duplicates
    got = store.read("balls", "2026-10")
    assert sum(r["match_id"] == "crex-x" for r in got) == 5 and sum(r["match_id"] == "crex-y" for r in got) == 10
    assert set(got[0]) == set(crex_balls.BALL_COLUMNS)
    assert store.balls_match_ids() == {"crex-x", "crex-y"}


class FakeBrowser:
    def __init__(self, events):
        self.events = events

    def capture(self, url, part):
        return SimpleNamespace(html="", status=200), [self.events]

    def render(self, url, marker=None, **kw):
        return SimpleNamespace(html="<card>", status=200)


def run_collect(tmp_path, monkeypatch, events, sc):
    monkeypatch.setattr(crex_scorecard, "parse_scorecard", lambda html: sc)
    store = Store(tmp_path)
    url = "https://crex.com/cricket-live-score/x-vs-y-match-updates-13W5"
    return collect(FakeBrowser(events), store, [("crex-x", "2026-10-13", url)], verbose=False), store


def test_collect_saves_a_proven_match(tmp_path, monkeypatch):
    res, store = run_collect(tmp_path, monkeypatch, FIXTURE["events"], card())
    assert (res["saved"], res["rejected"], res["no_feed"]) == (1, 0, 0) and res["warnings"] == 2
    assert len(store.read("balls", "2026-10")) == 215


def test_collect_rejects_a_match_that_does_not_reconcile(tmp_path, monkeypatch):
    sc = card()
    sc.innings[1].batters[0].runs += 7  # the card disagrees with the deliveries
    res, store = run_collect(tmp_path, monkeypatch, FIXTURE["events"], sc)
    assert res["rejected"] == 1 and res["saved"] == 0 and store.read("balls", "2026-10") == []
    assert "hard mismatch" in res["problems"][0]


def test_collect_reports_a_match_without_a_feed(tmp_path, monkeypatch):
    texts = [e for e in FIXTURE["events"] if e["type"] == "w"][:3]
    res, _ = run_collect(tmp_path, monkeypatch, texts, card())
    assert res["no_feed"] == 1 and res["saved"] == 0


def test_match_key_and_feed_events_cover_every_endpoint_version():
    assert crex_balls.match_key("https://crex.com/cricket-live-score/a-vs-b-match-updates-13W5/") == "13W5"
    html = ('<script id="app-root-state" type="application/json">{&q;https://content.crickapi.com/commentary/v2/'
            'getBallFeeds&q;:[{&q;id&q;:1,&q;type&q;:&q;t&q;}]}</script>')
    assert crex_balls.feed_events(html, [[{"id": 2}], {"not": "a list"}]) == [{"id": 1, "type": "t"}, {"id": 2}]


def test_over_summary_overrides_a_corrected_ball():
    events = [dict(e) for e in FIXTURE["events"]]
    over = [e for e in events if e["type"] == "b" and e["inning"] == 1 and e["on"] == 3]
    over.sort(key=lambda e: e["delivery"])
    tokens = [e["b"] for e in over]
    victim = next(i for i, t in enumerate(tokens) if t == "0")
    tokens[victim] = "2"  # the scorer fixed this ball in the over summary only
    summary = {"id": over[-1]["id"] + 1, "type": "o", "inning": 1, "on": 3, "rb": ".".join(tokens)}
    base = parse_balls(events, "13W5", card())
    fixed = parse_balls(events + [summary], "13W5", card())
    assert sum(b.bat_runs for b in fixed) == sum(b.bat_runs for b in base) + 2
    # a summary with a different number of balls is ignored rather than guessed at
    summary["rb"] = ".".join(tokens[:-1])
    assert [b.row() for b in parse_balls(events + [summary], "13W5", card())] == [b.row() for b in base]


def test_prune_balls_keeps_only_live_matches_and_removes_empty_files(tmp_path):
    store = Store(tmp_path)
    rows = crex_balls.rows_for("crex-a", "2026-10-13", parse_balls(FIXTURE["events"], "13W5", card()))
    store.upsert_balls("crex-a", "2026-10-13", rows)
    store.upsert_balls("crex-b", "2026-10-14", rows[:7])
    store.upsert_balls("crex-c", "2026-09-30", rows[:3])
    assert store.prune_balls({"crex-b"}) == len(rows) + 3
    assert store.balls_match_ids() == {"crex-b"} and store.months("balls") == ["2026-10"]
    assert store.prune_balls({"crex-b"}) == 0  # idempotent
    assert len(store.read("balls", "2026-10")) == 7
