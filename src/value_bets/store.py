"""Odds snapshots (gzip JSONL, rotated) and alert de-duplication state."""
import gzip
import hashlib
import json
import shutil
import time

from . import config
from .util import ist, now_utc, parse_ts


def save_snapshot(rows, raws, stamp):
    day = config.SNAPSHOTS / stamp[:10]
    day.mkdir(parents=True, exist_ok=True)
    p = day / f"odds_{stamp.replace(':', '').replace('-', '')}.jsonl.gz"
    with gzip.open(p, "wt") as f:
        for r in rows:
            f.write(json.dumps(r, default=str) + "\n")
    rp = day / f"raw_{stamp.replace(':', '').replace('-', '')}.json.gz"
    with gzip.open(rp, "wt") as f:
        json.dump(raws, f, default=str)
    rotate()
    try:
        return str(p.relative_to(config.ROOT))
    except ValueError:
        return p.name


def rotate():
    keep = config.get("SNAPSHOT_KEEP_DAYS")
    cutoff = time.time() - keep * 86400
    days = sorted(d for d in config.SNAPSHOTS.iterdir() if d.is_dir())
    for d in days:
        if d.stat().st_mtime < cutoff:
            shutil.rmtree(d, ignore_errors=True)
    # size cap: drop raw files first (oldest first), then whole days
    def total():
        return sum(f.stat().st_size for f in config.SNAPSHOTS.rglob("*") if f.is_file())
    cap = config.get("SNAPSHOT_MAX_MB") * 1024 * 1024
    if total() > cap:
        for f in sorted(config.SNAPSHOTS.rglob("raw_*.json.gz")):
            f.unlink()
            if total() <= cap:
                return
        for d in sorted(d for d in config.SNAPSHOTS.iterdir() if d.is_dir())[:-1]:
            shutil.rmtree(d, ignore_errors=True)
            if total() <= cap:
                return


ALERTS = config.STATE / "alerted.json"


def alert_key(v):
    return "|".join(str(v.get(k) or "") for k in ("event_key", "market_type", "team_scope", "selection", "line", "side"))


def new_alerts(values):
    try:
        seen = json.loads(ALERTS.read_text())
    except Exception:
        seen = {}
    now = now_utc()
    seen = {k: v for k, v in seen.items() if parse_ts(v["start_utc"]) and parse_ts(v["start_utc"]) > now}
    out = []
    delta = config.get("REALERT_EDGE_DELTA")
    for v in values:
        k = alert_key(v)
        prev = seen.get(k)
        if prev is None or v["edge"] >= prev["edge"] + delta:
            aid = hashlib.sha1(f"{k}|{now.isoformat()}".encode()).hexdigest()[:16]
            out.append({**v, "alert_id": aid, "alert_key": k, "alerted_at_ist": ist(now),
                        "realert": prev is not None, "previous_edge": prev["edge"] if prev else None})
            seen[k] = {"edge": v["edge"], "start_utc": v["start_utc"], "alerted_at": now.isoformat()}
    ALERTS.write_text(json.dumps(seen, indent=1))
    _append_history(out)
    return out


def _append_history(alerts, keep=3000):
    """out/alerts_history.jsonl: one line per alert ever sent (stable alert_id), newest last, capped."""
    p = config.OUT / "alerts_history.jsonl"
    lines = p.read_text().splitlines() if p.exists() else []
    lines += [json.dumps({k: a.get(k) for k in ("alert_id", "alert_key", "alerted_at_ist", "match", "start_ist",
                                                 "market", "selection", "best_odds", "best_source", "fair_odds",
                                                 "edge_pct", "kelly_quarter_stake_pct", "why", "realert")}, default=str)
              for a in alerts]
    p.write_text("\n".join(lines[-keep:]) + ("\n" if lines else ""))
