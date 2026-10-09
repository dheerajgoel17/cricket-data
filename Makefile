.PHONY: install test lint update backfill sqlite
install:
	pip install -e ".[dev]"
test:
	pytest -q
lint:
	ruff check src tests
update:
	cricket-data update
backfill:
	cricket-data backfill
sqlite:
	cricket-data export-sqlite --out cricket.db
