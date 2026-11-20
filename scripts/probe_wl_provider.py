"""Probe a white-label sportsbook origin for engine class + non-paid scrape feasibility.

Inputs (env; never commit hosts or demo creds):
  WL_PROBE_ORIGIN   sportsbook page origin (https://…)
  WL_PROBE_API      optional feed/API root if already known
  WL_PROBE_HTML     optional path to saved HTML/network dump (offline classify)
  WL_PROBE_DEMO_USER / WL_PROBE_DEMO_PASS  optional demo login (secrets only)
  WL_PROBE_TRANSPORT  urllib | curl_cffi | skip  (default urllib; skip = classify-only)

Prints fingerprint + scorecard. Redacts origins. Dispatch: .github/workflows/wl-provider-probe.yml
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from value_bets.wl_fingerprint import classify, redact, score  # noqa: E402

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

# Common public endpoints to poke once the origin is known (shapes only; 404 is fine).
PROBES = (
    "/api/v4/prematch/brand/0/en/0",
    "/service-api/LineFeed/GetSportsZip?lng=en&gr=70",
    "/xapi/rest/events?eventPathIds=0&includeMarkets=false",
    "/sportsbook/getSports",
    "/api/sportsbook/v1/sports",
    "/sapi/sports",
)


def _get(url: str, transport: str, origin: str) -> tuple[int, str, str]:
    """-> (status, body_text, how)."""
    headers = {"User-Agent": UA, "Accept": "text/html,application/json,*/*", "Origin": origin, "Referer": origin + "/"}
    if transport == "curl_cffi":
        from curl_cffi import requests

        r = requests.get(url, headers=headers, timeout=30, impersonate="chrome131")
        return r.status_code, r.text[:200_000], "curl_cffi"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.read()[:200_000].decode("utf-8", "replace"), "urllib"
    except urllib.error.HTTPError as e:
        body = e.read()[:8000].decode("utf-8", "replace") if e.fp else ""
        return e.code, body, "urllib"


def _market_kinds(blob: str) -> dict[str, int]:
    low = blob.lower()
    return {
        "runs": len(re.findall(r"total runs|batsman runs|batter runs|player.?runs|over/under \d", low)),
        "fours": len(re.findall(r"fours?", low)),
        "sixes": len(re.findall(r"sixes?", low)),
        "wickets": len(re.findall(r"wickets?", low)),
        "to_score": len(re.findall(r"to score|half[- ]century|century|milestone", low)),
        "top": len(re.findall(r"top bat|top bowl|top scorer", low)),
        "points": len(re.findall(r"player performance|fantasy points|player points", low)),
        "fancy": len(re.findall(r"first \d+ overs|session|team total|match total|innings runs|highest over", low)),
    }


def main() -> int:
    origin = os.environ.get("WL_PROBE_ORIGIN", "").strip().rstrip("/")
    api = os.environ.get("WL_PROBE_API", "").strip().rstrip("/")
    html_path = os.environ.get("WL_PROBE_HTML", "").strip()
    transport = os.environ.get("WL_PROBE_TRANSPORT", "urllib").strip().lower() or "urllib"
    demo_user = os.environ.get("WL_PROBE_DEMO_USER", "").strip()
    origins = [o for o in (origin, api) if o]

    chunks: list[str] = []
    transport_ok: bool | None = None
    access_mode = "unknown"

    if html_path:
        chunks.append(open(html_path, encoding="utf-8", errors="replace").read()[:200_000])
        access_mode = "guest"  # offline dump assumed public

    if transport == "skip":
        if not chunks and not origin and not api:
            print("set WL_PROBE_HTML and/or WL_PROBE_ORIGIN (or WL_PROBE_TRANSPORT=skip with HTML)")
            return 2
    elif origin or api:
        roots = [u for u in (origin, api) if u]
        any_ok = False
        for root in roots:
            for path in ("",) + (PROBES if root == origin else (PROBES[0],)):
                url = root if path == "" else root + path
                try:
                    code, body, how = _get(url, transport, origin or root)
                except Exception as e:
                    print(f"fetch_error {type(e).__name__}: {redact(str(e)[:120], origins)}")
                    continue
                print(f"GET {redact(path or '/', origins)} -> {code} via {how} bytes={len(body)}")
                chunks.append(f"{url}\n{body}")
                if code < 500 and body:
                    any_ok = True
                if code == 200 and len(body) > 200:
                    break
            if any_ok:
                break
        transport_ok = any_ok
        if demo_user:
            access_mode = "demo"
            print("demo_creds: set (not printed); login step is manual/follow-up — classify assumes demo OK if page loads")
        elif any_ok:
            access_mode = "guest"

    blob = "\n".join(chunks)
    if not blob:
        print("no content to classify")
        return 1

    fp = classify(blob)
    kinds = _market_kinds(blob)
    # Player-name heuristic: Latin name-like tokens near market text
    names = bool(re.search(r"[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}", blob))
    sc = score(
        fp,
        access_mode=access_mode,
        transport_ok=transport_ok,
        demo_refresh_ok=True if access_mode == "demo" else None,
        player_names_present=names if kinds["runs"] or fp.cricket_hits else None,
        market_kinds=kinds,
    )

    out = {
        "fingerprint": fp.as_dict(),
        "market_kinds": kinds,
        "score": sc.as_dict(),
        "access_mode": access_mode,
        "transport_ok": transport_ok,
    }
    print(json.dumps(out, indent=2))
    print(f"\nVERDICT: {sc.verdict}  total={sc.total}  class={fp.engine_class}  dup={fp.duplicate_feed}")
    return 0 if sc.verdict != "No-go" or fp.duplicate_feed else 0


if __name__ == "__main__":
    raise SystemExit(main())
