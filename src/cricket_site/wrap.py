"""XOR-SHA256 wrap for the smaller site JSON files so a bare GET of /data/*.json is not usable JSON.

The browser unwraps after ``/api/gate`` hands it the key (stdlib only: hashlib, no extra package).
This is a speed bump, not a secret: anyone who can run the site can recover the bytes. Matches, the player
index and player shards stay plaintext (too large to unwrap on a phone) and are blocked by the cookie gate + scraper UA list.
Set DATA_WRAP_KEY in GitHub (build) and Vercel (gate); without it this is a no-op.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import secrets
from pathlib import Path

# First-paint files stay plaintext: the browser would otherwise SHA-256 every 32 bytes of index.json
# (~1 MB → tens of thousands of awaits) and phones show "Data not found". Cookie gate still blocks scrapers.
SKIP = {"meta.json", "matches.json", "index.json", "crex_index.json"}
MAX_BYTES = 200_000


def _key(secret: str) -> bytes:
    return hashlib.sha256(secret.encode()).digest()


def _stream(key: bytes, iv: bytes, n: int) -> bytes:
    out = bytearray()
    i = 0
    while len(out) < n:
        out.extend(hashlib.sha256(key + iv + i.to_bytes(4, "big")).digest())
        i += 1
    return bytes(out[:n])


def wrap(obj, secret: str) -> dict:
    raw = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode()
    iv = secrets.token_bytes(16)
    ct = bytes(a ^ b for a, b in zip(raw, _stream(_key(secret), iv, len(raw)), strict=True))
    return {"v": 1, "iv": base64.b64encode(iv).decode("ascii"), "ct": base64.b64encode(ct).decode("ascii")}


def unwrap(doc, secret: str):
    if not isinstance(doc, dict) or doc.get("v") != 1 or "ct" not in doc or "iv" not in doc:
        return doc
    iv, ct = base64.b64decode(doc["iv"]), base64.b64decode(doc["ct"])
    raw = bytes(a ^ b for a, b in zip(ct, _stream(_key(secret), iv, len(ct)), strict=True))
    return json.loads(raw)


def wrap_dir(path: Path, secret: str) -> list[str]:
    done = []
    for f in sorted(path.glob("*.json")):
        if f.name in SKIP or f.stat().st_size > MAX_BYTES:
            continue
        doc = json.loads(f.read_text(encoding="utf-8"))
        if isinstance(doc, dict) and doc.get("v") == 1 and "ct" in doc:
            continue
        f.write_text(json.dumps(wrap(doc, secret), separators=(",", ":")), encoding="utf-8")
        done.append(f.name)
    return done


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dir", default="site/public/data")
    a = ap.parse_args(argv)
    secret = os.environ.get("DATA_WRAP_KEY", "").strip()
    if not secret:
        print("wrap: DATA_WRAP_KEY not set, leaving JSON as JSON")
        return 0
    done = wrap_dir(Path(a.dir), secret)
    print("wrap:", ",".join(done) or "nothing")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
