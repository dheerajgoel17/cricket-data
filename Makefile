.PHONY: install test lint update backfill sqlite site-data site-test site-serve safe
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
site-data:
	python -m cricket_site.build --zip all_json.zip --data data --out site/public/data
site-test:
	cd site && npm test
site-serve:
	cd site && node scripts/serve.mjs 4173
safe:
	python scripts/check_public_safe.py
