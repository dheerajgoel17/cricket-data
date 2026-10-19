# Walk-forward props backtest

Research scripts behind docs/MODEL_BACKTEST.md. Needs pandas, scipy, lightgbm, pyarrow.

```
CRICSHEET_ZIP=all_json.zip python parse.py && python build.py && python bt.py && python bt_match.py && python evalr.py && python eval2.py
```
