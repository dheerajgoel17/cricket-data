from cricket_site.build import _toss
from cricket_site.guard import check_toss


def test_toss_columns_name_one_of_the_two_sides_and_what_it_chose():
    m = {"teams": ["India", "New Zealand"], "toss_winner": "New Zealand", "toss_decision": "field"}
    assert _toss(m, (7, 9)) == (9, 0)
    assert _toss({**m, "toss_decision": "bat"}, (7, 9)) == (9, 1)
    assert _toss({**m, "toss_winner": "India Women"}, (7, 9)) == (7, 0)  # the same side under another spelling
    assert _toss({**m, "toss_winner": ""}, (7, 9)) == (-1, -1)  # not recorded
    assert _toss({**m, "toss_winner": "Australia"}, (7, 9)) == (-1, -1)  # names neither side: nothing is guessed
    assert _toss({**m, "toss_decision": ""}, (7, 9)) == (9, -1)


def test_guard_toss_rejects_a_winner_outside_the_match_and_a_decision_without_a_winner():
    M = {"id": ["a", "b", "c"], "a": [1, 1, 1], "b": [2, 2, 2], "tw": [1, 2, -1], "td": [1, 0, -1]}
    assert not check_toss(M).problems
    assert check_toss({**M, "tw": [3, 2, -1]}).problems  # 3 is neither side
    assert check_toss({**M, "td": [1, 0, 1]}).problems  # a decision with no winner
    assert check_toss({k: v for k, v in M.items() if k not in ("tw", "td")}).skipped
