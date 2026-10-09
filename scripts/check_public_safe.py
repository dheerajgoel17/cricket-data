#!/usr/bin/env python3
"""Fail if the tree contains things that should never be in a public repo.

Generic checks only (private keys, cloud/API tokens, absolute home paths, .env files).
Run locally or in CI:  python scripts/check_public_safe.py
"""
import re
import sys
from pathlib import Path

PATTERNS = {
    "private key": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    "AWS access key": re.compile(r"AKIA[0-9A-Z]{16}"),
    "GitHub token": re.compile(r"gh[pousr]_[A-Za-z0-9]{30,}"),
    "generic secret assignment": re.compile(r"(?i)(api[_-]?key|secret|passwd|password|token)\s*[:=]\s*['\"][A-Za-z0-9_\-/+=]{16,}['\"]"),
    "absolute home path": re.compile(r"(/Users/[A-Za-z0-9._-]+|/home/[A-Za-z0-9._-]+|C:\\Users\\[A-Za-z0-9._-]+)"),
    "cloud account id / worker url": re.compile(r"[a-z0-9-]+\.workers\.dev|\.supabase\.co|\.vercel\.app"),
}
SKIP_DIRS = {".git", "__pycache__", ".pytest_cache", ".ruff_cache", "matches", "players", "node_modules"}
SKIP_FILES = {"check_public_safe.py"}


def main() -> int:
    bad = []
    for p in Path(".").rglob("*"):
        if not p.is_file() or SKIP_DIRS & set(p.parts) or p.name in SKIP_FILES:
            continue
        if p.name == ".env" or p.name.startswith(".env."):
            bad.append(f"{p}: env file must not be committed")
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for label, rx in PATTERNS.items():
            m = rx.search(text)
            if m:
                bad.append(f"{p}: {label}: {m.group(0)[:40]}")
    for line in bad:
        print(line, file=sys.stderr)
    print("public-safety check:", "FAILED" if bad else "ok")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
