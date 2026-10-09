from conftest import make_match

from cricket_data.cricsheet import parse_match
from cricket_data.store import Store


def test_upsert_and_idempotent(tmp_path):
    s = Store(tmp_path)
    rec = parse_match("1", make_match())
    assert s.upsert([rec])["matches_new"] == 1
    before = {p: p.read_bytes() for p in tmp_path.rglob("*.csv.gz")}
    st = s.upsert([parse_match("1", make_match())])
    assert st["matches_new"] == 0 and st["partitions_changed"] == 0  # no diff on rerun
    assert before == {p: p.read_bytes() for p in tmp_path.rglob("*.csv.gz")}


def test_partitioned_by_month_and_replaced(tmp_path):
    s = Store(tmp_path)
    s.upsert([parse_match("1", make_match(date="2026-09-30")), parse_match("2", make_match(date="2026-10-03"))])
    assert s.months() == ["2026-09", "2026-10"]
    s.upsert([parse_match("1", make_match(date="2026-09-30", winner="South Africa"))])
    assert s.read("matches", "2026-09")[0]["winner"] == "South Africa"
    assert len(s.read("players", "2026-09")) == 4  # replaced, not duplicated
