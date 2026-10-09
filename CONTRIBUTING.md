# Contributing

Thanks for helping! Ground rules: **keep it free to run** (no paid services, no secrets; see
[docs/ZERO_COST.md](docs/ZERO_COST.md)) and **respect data terms** (no scrapers for sites that forbid it).

## Setup (VS Code, JetBrains, anything)
```bash
git clone <your fork> && cd cricket-data
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
make test lint
python scripts/check_public_safe.py   # no secrets / personal paths
```
VS Code / GitHub Codespaces: "Reopen in Container" and everything is installed (`.devcontainer/`).

## Adding a data source
Implement `fetch(since) -> Iterable[MatchRecord]` (see `examples/example_source.py` and
[docs/PROVISIONAL.md](docs/PROVISIONAL.md)). Provisional data must be verifiable against Cricsheet; it is
deleted automatically once the canonical match lands.

## Pull requests
Small and focused, with tests. Run `ruff check src tests` and `pytest -q`. Do not commit large files or archives.
