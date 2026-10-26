"""Smoke tests on the real cricket-data history (uses the cached build in state/)."""
import pytest

from value_bets import config, history
from value_bets.models import PlayerModel

pytestmark = pytest.mark.skipif(not (config.DATA_REPO / "data").exists(), reason="data repo not cloned")


@pytest.fixture(scope="module")
def H():
    return history.load()


def test_winner_symmetric_and_backtest(H):
    p, _ = H.p_team_a("India", "West Indies", "male", "T20")
    q, _ = H.p_team_a("West Indies", "India", "male", "T20")
    assert p is not None and abs(p + q - 1) < 1e-9
    bt = H.backtest["T20"]
    assert bt["model_logloss_brier_acc"][0] < bt["coin_flip_logloss"]  # better than a coin on held-out 2025+


def test_top_batter_probs_reasonable(H):
    pm = PlayerModel(H)
    team = "India"
    # "India" is the men's and women's team alike: take the squad the men's T20 model rates most likely to play,
    # not the most recent names (whichever side played last would fill the list)
    ros = sorted(H.rosters[team], key=lambda x: pm.p_selected(x[1], team, "T20"), reverse=True)[:15]
    ps = [{"key": r[1], "pid": r[1], "team": team} for r in ros]
    res, psel = pm.top_probs(ps, "male", "T20", sims=4000)
    vals = [v for v in res.values() if v is not None]
    assert all(0 <= v <= 1 for v in vals)
    # unconditional share must sum to ~1 (one top batter per sim, dead heats split)
    uncond = sum(res[k] * min(1, psel[k]) for k in res if res[k] is not None)
    assert 0.6 < uncond < 1.6


def test_over_probs_monotone(H):
    pm = PlayerModel(H)
    pid = [r[1] for r in H.rosters["India"] if r[0] == "Abhishek Sharma"][0]
    prof = pm.profile(pid, "male", "T20")
    a, b = pm.p_over(prof, "runs", 9.5, "male", "T20"), pm.p_over(prof, "runs", 29.5, "male", "T20")
    assert 0 < b < a < 1
