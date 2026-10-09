# Getting started (any IDE)

```bash
git clone https://github.com/<you>/cricket-data && cd cricket-data
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -e ".[dev]"

cricket-data stats                              # what's in the dataset
cricket-data query "Kohli" --since 2026-01-01   # a player's recent matches and points
cricket-data query "Renshaw" --format ODI
cricket-data export-sqlite --out cricket.db     # open in any SQL tool
```
Python without installing the CLI:
```python
import csv, gzip
rows = list(csv.DictReader(gzip.open("data/players/2026-09.csv.gz", "rt")))
```
SQL example (after `export-sqlite`):
```sql
SELECT date, player, runs, wickets, points FROM players WHERE player LIKE '%Renshaw%' ORDER BY date DESC LIMIT 10;
```
**VS Code / Codespaces**: open the folder, choose "Reopen in Container". Recommended extensions are listed in
`.vscode/extensions.json`. Debug configurations are in `.vscode/launch.json`.
**PyCharm / IntelliJ**: create a virtualenv, `pip install -e ".[dev]"`, mark `src` as Sources Root, run `pytest`.
