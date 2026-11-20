"""Probe Book A (bet365) for a free guest cricket-props scrape from GitHub Actions.

Env (secrets / vars — never printed):
  BOOK_A_ORIGIN     sportsbook origin (https://…), required
  BOOK_A_PATHS      optional comma-separated relative paths (extends defaults)
  BOOK_A_IMPERSONATE  optional single curl_cffi profile (else the ladder)

Prints status / content class / market counts / PASS|FAIL only — never host, URL, cookies, or tokens.
Exit 0 on PASS, 1 on FAIL. Dispatch: .github/workflows/book-a-probe.yml
"""
from __future__ import annotations

import os
import sys
import urllib.parse

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from value_bets.book_a_probe import (  # noqa: E402
    DEFAULT_PATHS,
    IMPERSONATE_LADDER,
    merge_scores,
    score_probe,
)


def _paths() -> list[str]:
    extra = [p.strip() for p in os.environ.get("BOOK_A_PATHS", "").split(",") if p.strip()]
    out: list[str] = []
    for p in list(DEFAULT_PATHS) + extra:
        if not p.startswith("/"):
            p = "/" + p
        if p not in out:
            out.append(p)
    return out


def _ladder() -> list[str]:
    pinned = os.environ.get("BOOK_A_IMPERSONATE", "").strip()
    return [pinned] if pinned else list(IMPERSONATE_LADDER)


def _cffi():
    try:
        from curl_cffi import requests as cffi_requests
    except ImportError:
        print("FAIL curl_cffi_missing")
        raise SystemExit(1)
    return cffi_requests


def _origin() -> str:
    o = os.environ.get("BOOK_A_ORIGIN", "").strip().rstrip("/")
    if not o.startswith("http"):
        print("FAIL book_a_origin_unset")
        raise SystemExit(1)
    # Never print the origin; only confirm shape
    host = urllib.parse.urlparse(o).hostname or ""
    if not host or host.endswith(".invalid"):
        print("FAIL book_a_origin_invalid")
        raise SystemExit(1)
    return o


def _warm_and_get(origin: str, path: str, profile: str):
    cffi = _cffi()
    try:
        sess = cffi.Session(impersonate=profile)
    except Exception as e:
        return None, f"profile_error:{type(e).__name__}"
    headers = {
        "Accept": "application/json, text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "Referer": origin + "/",
    }
    try:
        # Warm the origin root first (cookies / CF)
        root = sess.get(origin + "/", timeout=45, headers={**headers, "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8"})
        if path == "/":
            return root, None
        r = sess.get(origin + path, timeout=45, headers=headers)
        return r, None
    except Exception as e:
        return None, f"request_error:{type(e).__name__}"


def main() -> int:
    if os.environ.get("GITHUB_ACTIONS") != "true" and os.environ.get("BOOK_A_ALLOW_LOCAL") != "1":
        print("FAIL actions_only (set BOOK_A_ALLOW_LOCAL=1 for a deliberate local run)")
        return 1

    origin = _origin()
    paths = _paths()
    ladder = _ladder()
    print(f"probe book_a paths={len(paths)} ladder={ladder[:4]}{'…' if len(ladder) > 4 else ''}")

    scores = []
    # Try each profile until one clears the root; then hit all paths with that session profile
    for profile in ladder:
        path_scores = []
        any_transport = False
        for path in paths:
            r, err = _warm_and_get(origin, path, profile)
            if err or r is None:
                print(f"  path={path} impersonate={profile} error={err or 'none'}")
                path_scores.append(score_probe(status=None, content_type=None, body="", impersonate=profile))
                continue
            body = r.text or ""
            ct = r.headers.get("content-type") if hasattr(r, "headers") else None
            s = score_probe(status=r.status_code, content_type=ct, body=body, impersonate=profile)
            path_scores.append(s)
            print(
                f"  path={path} impersonate={profile} status={s['status']} class={s['content_class']} "
                f"challenge={s['challenge']} login={s['login_wall']} cricket={s['cricket']} "
                f"props={s['prop_keys'] or '-'} groups={list((s['group_counts'] or {}).keys())[:6] or '-'} "
                f"verdict={s['verdict']}"
            )
            if s["status"] is not None and s["status"] < 500 and not s["challenge"]:
                any_transport = True
            if s["verdict"] == "pass":
                scores.extend(path_scores)
                break
        else:
            scores.extend(path_scores)
            # If this profile never cleared transport, try next profile
            if not any_transport:
                continue
            # Profile reached the origin but no props — still try next profile once
            continue
        break

    overall = merge_scores(scores)
    best = overall.get("best") or {}
    print(
        f"RESULT verdict={overall['verdict'].upper()} attempts={overall['attempts']} "
        f"reasons={overall['reasons'] or '-'} "
        f"best_props={best.get('prop_keys') or '-'} best_impersonate={best.get('impersonate') or '-'}"
    )
    return 0 if overall["verdict"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
