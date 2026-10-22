"""Keep our own copy of CREX player photos / team logos (Supabase Storage) plus the id maps (Postgres), so the site survives CREX
changing or removing them.

    python -m cricket_site.assets_sync --photos site/public/data/photos.json --index site/public/data/crex_index.json --url "$SUPABASE_URL"

Needs the *service role* key in the environment (SUPABASE_SERVICE_KEY): a GitHub secret, never committed or printed. Runs resumably: only
images we do not hold yet are downloaded (at most --limit per run, politely), uploaded to the public `avatars` bucket and recorded in
`assets`. At the end photos.json gets `base` + `s` (which ids we hold) so the browser tries our copy first and CREX second.
Everything is best effort: a CREX or network error skips that image, a bad key aborts without touching photos.json.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

CREX_CDN = "https://cricketvectors.akamaized.net"
UA = "Mozilla/5.0 (compatible; cricket-props-hub/0.1; +https://github.com/dheerajgoel17/cricket-data)"  # for CREX
API_UA = "cricket-props-hub-sync/0.1 (server)"  # Supabase rejects secret keys sent with a browser-like User-Agent
MAX_BYTES = 200_000


def _req(method: str, url: str, key: str, data: bytes | None = None, headers: dict | None = None, timeout: int = 60):
    h = {"apikey": key, "User-Agent": API_UA, **(headers or {})}
    if not key.startswith("sb_"):  # new-style secret keys (sb_secret_...) go only in `apikey`; legacy service_role JWTs also go in Authorization
        h["Authorization"] = f"Bearer {key}"
    r = urllib.request.Request(url, data=data, method=method, headers=h)
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        return resp.status, resp.headers.get("Content-Type", ""), resp.read()


def describe_key(key: str) -> str:
    """What kind of key this is (never the key itself): helps diagnose a wrong secret."""
    import base64

    if key.startswith("sb_publishable_"):
        return "a PUBLISHABLE key (read-only: use the secret / service_role key)"
    if key.startswith("sb_secret_"):
        return f"a secret key (length {len(key)})"
    parts = key.split(".")
    if len(parts) == 3:
        try:
            pad = parts[1] + "=" * (-len(parts[1]) % 4)
            claims = json.loads(base64.urlsafe_b64decode(pad))
            return f"a JWT with role={claims.get('role')!r} for project {claims.get('ref')!r}"
        except (ValueError, UnicodeDecodeError):
            return "a malformed JWT"
    return f"an unrecognised format (length {len(key)}, expected sb_secret_... or a JWT starting eyJ)"


def stored_ids(base: str, key: str, http=_req) -> dict[str, set[str]]:
    """{'player': {ids}, 'team': {ids}} already in the assets table (paged)."""
    out: dict[str, set[str]] = {"player": set(), "team": set()}
    start = 0
    while True:
        _, _, body = http("GET", f"{base}/rest/v1/assets?select=kind,ref&order=ref&limit=1000&offset={start}", key)
        rows = json.loads(body)
        for r in rows:
            out.setdefault(r["kind"], set()).add(r["ref"])
        if len(rows) < 1000:
            return out
        start += 1000


def download(kind: str, cid: str, fetch=None) -> tuple[bytes, str] | None:
    """One image from the CREX CDN, or None if it is missing / not an image / suspiciously large."""
    url = f"{CREX_CDN}/{'players/org' if kind == 'player' else 'Teams'}/{cid}.png"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with (fetch or urllib.request.urlopen)(req, timeout=30) as r:
            ct = r.headers.get("Content-Type", "")
            body = r.read(MAX_BYTES + 1)
    except (urllib.error.URLError, TimeoutError, OSError):
        return None
    if not ct.startswith("image/") or not (200 < len(body) <= MAX_BYTES):
        return None
    return body, ct


def upload(base: str, key: str, kind: str, cid: str, body: bytes, ct: str, http=_req) -> dict:
    path = f"{'players' if kind == 'player' else 'teams'}/{cid}.png"
    http("POST", f"{base}/storage/v1/object/avatars/{path}", key, body, {"Content-Type": ct, "x-upsert": "true", "Cache-Control": "max-age=31536000"})
    return {"kind": kind, "ref": cid, "path": path, "content_type": ct, "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest(),
            "source_url": f"{CREX_CDN}/{'players/org' if kind == 'player' else 'Teams'}/{cid}.png"}


def upsert(base: str, key: str, table: str, rows: list[dict], http=_req) -> None:
    for i in range(0, len(rows), 500):
        http("POST", f"{base}/rest/v1/{table}", key, json.dumps(rows[i:i + 500]).encode(),
             {"Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"})


def sync(photos_path: str, index_path: str | None, base: str, key: str, limit: int = 1500, pause: float = 0.05,
         http=_req, fetch=None, workers: int = 6) -> dict:
    ph = json.load(open(photos_path, encoding="utf-8"))
    want = {"player": sorted({v[2:] for v in ph.get("p", {}).values() if v.startswith("c:")}),
            "team": sorted(set(ph.get("t", {}).values()))}
    have = stored_ids(base, key, http)  # a bad key / unreachable project raises here, before anything is changed
    stats = {"downloaded": 0, "missing_at_crex": 0, "already": sum(len(v) for v in have.values()), "pending": 0}
    todo: list[tuple[str, str]] = []
    for kind in ("team", "player"):  # logos first: few and the most visible
        for cid in want[kind]:
            if cid not in have.get(kind, set()):
                todo.append((kind, cid))
    stats["pending"] = max(0, len(todo) - limit)
    todo = todo[:limit]

    def work(item: tuple[str, str]):
        kind, cid = item
        got = download(kind, cid, fetch)
        if got is None:
            return item, "missing"
        try:
            row = upload(base, key, kind, cid, got[0], got[1], http)
        except (urllib.error.URLError, OSError) as exc:
            print(f"upload {kind}/{cid} failed: {exc}", file=sys.stderr)
            return item, "failed"
        time.sleep(pause)
        return item, row

    pending_rows: list[dict] = []
    with ThreadPoolExecutor(max_workers=workers) as ex:  # a few at a time: polite to CREX, ~8x faster than one by one
        for (kind, cid), res in ex.map(work, todo):
            if res == "missing":
                stats["missing_at_crex"] += 1
            elif res == "failed":
                continue
            else:
                have.setdefault(kind, set()).add(cid)
                stats["downloaded"] += 1
                pending_rows.append(res)
                if len(pending_rows) >= 200:  # persist progress as we go: a cancelled or timed-out run keeps what it copied
                    upsert(base, key, "assets", pending_rows, http)
                    pending_rows = []
    if pending_rows:
        upsert(base, key, "assets", pending_rows, http)
    if index_path and os.path.exists(index_path):
        idx = json.load(open(index_path, encoding="utf-8"))
        upsert(base, key, "crex_players", [{"crex_id": c, "name": n, "cricsheet_id": p or None} for c, n, p in idx.get("players", [])], http)
        upsert(base, key, "crex_teams", [{"crex_id": c, "name": n, "folded_name": f} for c, n, f in idx.get("teams", [])], http)
    ph["base"] = f"{base}/storage/v1/object/public/avatars"
    ph["s"] = {"p": sorted(have.get("player", set())), "t": sorted(have.get("team", set()))}
    json.dump(ph, open(photos_path, "w", encoding="utf-8"), separators=(",", ":"))
    return stats


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--photos", required=True)
    ap.add_argument("--index", default="")
    ap.add_argument("--url", default=os.environ.get("SUPABASE_URL", ""))
    ap.add_argument("--limit", type=int, default=int(os.environ.get("SYNC_LIMIT", "1500")))
    a = ap.parse_args(argv)
    key = os.environ.get("SUPABASE_SERVICE_KEY", "").strip()
    if not a.url or not key:
        print("assets_sync: SUPABASE_URL / SUPABASE_SERVICE_KEY not set, skipping")
        return 0
    try:
        print(json.dumps(sync(a.photos, a.index or None, a.url.rstrip("/"), key, a.limit)))
    except (urllib.error.URLError, OSError, ValueError) as exc:
        detail = ""
        if isinstance(exc, urllib.error.HTTPError):
            try:
                detail = f" body={exc.read(300).decode('utf-8', 'replace')!r}"
            except OSError:
                pass
        print(f"assets_sync: failed ({exc}){detail}; SUPABASE_SERVICE_KEY is {describe_key(key)}; the site keeps using CREX images", file=sys.stderr)
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
