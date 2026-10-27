"""Where each data source lives. Hosts are deployment configuration (environment variables), never code, so the repo names no source.

  LIVE_SOURCE_BASE   live / schedule / scorecard / ball-by-ball source, e.g. https://host (no trailing slash)
  LIVE_SITEMAP_DIR   its sitemap directory name
  IMG_CDN_BASE       its image host
  BASE_DATA_URL      the base ball-by-ball dataset root
  PRICE_FEED_URL     the price feed page      EXCHANGE_API_URL   the exchange API root
  SRC_B_BASE, SRC_C_BASE, SRC_D_BASE, SRC_E_BASE   the optional scrapers / key-gated APIs that are not enabled by default

Set them as repository variables for the workflows, as deployment variables for the site, and in a git-ignored env file locally (docs/OPERATIONS.md).
"""
from __future__ import annotations

import os
import re


def host(name: str) -> str:
    v = os.environ.get(name, "").strip().rstrip("/")
    if not v:
        raise RuntimeError(f"{name} is not set (see docs/OPERATIONS.md)")
    return v


def rel(url: str | None) -> str | None:
    """Stored links are host-relative ("/path"), so committed data names no host; callers prefix host("...") when they need a full URL."""
    return re.sub(r"^https?://[^/]+", "", url) if url else url


def state_at(state: dict | None, suffix: str):
    """Page state is keyed by endpoint URL; match by the trailing path so no host has to be written down."""
    for k, v in (state or {}).items():
        if k.endswith(suffix):
            return v
    return None
