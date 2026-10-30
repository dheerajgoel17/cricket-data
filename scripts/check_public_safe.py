#!/usr/bin/env python3
"""Fail if the tree contains things that should never be in a public repo.

Generic checks only (private keys, cloud/API tokens, absolute home paths, .env files), plus data-source hosts: those live in
environment variables, never in the tree. Hosts are compared by hash so this file does not list them.
Run locally or in CI:  python scripts/check_public_safe.py
"""
import hashlib
import re
import subprocess
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
# sha256 of host names (and their parent domains) that must not appear in tracked text; see docs/OPERATIONS.md
FORBIDDEN_HOSTS = {
    "522fe8b004d19d5a4ed52172c434010938213fc09ae4aca500d0a9b4c30cde41",
    "f11c292849cb9b924836a8a0b63f219b3144772842c8fde50a9883f51166c612",
    "162f8defa26f5e6ec3594ec0f1a6d2ec659a99241c0bf9d7af6ff2b3e76a3afd",
    "865d47736470e773d6d7bc94de8804703f14fad8d07b458a8d1db39e78452e20",
    "fed23330d378b48ccba25e5eeb59075d052d32876a70b635f2de9f6f6734d190",
    "ef265727aa52351da831b51e3f32c7e9fc09d8ffc1998ed2bd22087cb9424d9c",
    "5b77a303470a04668a5c40d117ba1ea219314fc9e2efc88157e2bce177f5e604",
    "84ad41b192ab8e6db412bac14b82e6f4e825fff40dde7d0fdedfd1299861648f",
    "5fef146411fcc4f2f90e4dbf3b51951faf6e914892235efd9c5c5b692c9edf08",
    "60f1544f9ea311cff8cae2a4b69815ddfd69e49026ceb25cec15896ec189fe3e",
    "dde7649caa155851c403b25297be277c4a56a2014dd1d28054e6a9bb81caf481",
    "5c948026ec7613caf31056f44192f4477d9b752b8db0f876c7cd7a877f1c43d3",
    "c82ee20a97579d1d0b16476cbb500cbe3f3a7a71c51b566cf68feccc14082356",
    "0b583ca765c132f62cc1462057c9aaa28efa159821ac8b27b0a5fed7d98d30fd",
}
HOST = re.compile(r"(?<![A-Za-z0-9@_-])((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})")


def forbidden_host(text: str) -> str | None:
    for m in HOST.finditer(text):
        labels = m.group(1).lower().split(".")
        for i in range(len(labels) - 1):
            h = hashlib.sha256(".".join(labels[i:]).encode()).hexdigest()
            if h in FORBIDDEN_HOSTS:
                return h[:10]
    return None


SKIP_DIRS = {".git", "__pycache__", ".pytest_cache", ".ruff_cache", "matches", "players", "node_modules", "dist", ".vercel"}
SKIP_FILES = {"check_public_safe.py", "package-lock.json"}


def candidates():
    """Tracked files plus untracked ones that are not git-ignored (a git-ignored local env file is fine); every file when not in a git tree."""
    try:
        out = subprocess.run(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], capture_output=True, check=True).stdout
        return [Path(x) for x in out.decode().split("\0") if x]
    except (OSError, subprocess.CalledProcessError):
        return list(Path(".").rglob("*"))


def main() -> int:
    bad = []
    for p in candidates():
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
        h = forbidden_host(text)
        if h:
            bad.append(f"{p}: data-source host in the tree (sha256 {h}...); move it to an environment variable")
    for line in bad:
        print(line, file=sys.stderr)
    print("public-safety check:", "FAILED" if bad else "ok")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
