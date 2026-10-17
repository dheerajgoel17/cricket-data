import importlib.util

# The value-bet tests need the optional `value-bets` extra (pip install -e ".[value-bets]").
_DEPS = ("numpy", "pandas", "scipy", "rapidfuzz")
collect_ignore_glob = [] if all(importlib.util.find_spec(m) for m in _DEPS) else ["test_*.py"]
