"""Where each data source lives. Hosts are deployment configuration (environment variables), never code, so the repo names no source.

  LIVE_SOURCE_BASE   live / schedule / scorecard / ball-by-ball source, e.g. https://host (no trailing slash)
  LIVE_SITEMAP_DIR   its sitemap directory name
  IMG_CDN_BASE       its image host
  BASE_DATA_URL      the base ball-by-ball dataset root
  PRICE_FEED_URL     Book A mirror odds URL (pre-match; e.g. …/odds?sport=cricket)
  PRICE_FEED_KEY     free API key for that mirror (X-API-Key; hourly pre-match only — keep off in-play)
  EXCHANGE_API_URL   the exchange API root
  FEEDK_URL          the root of the shared sportsbook feed behind Feed K      FEEDK_BOOKS   its books, "id=Name,id=Name" (account id, published name)
  FEEDE_BOOKS        Feed E's books, "id=Name@root,id=Name@root" (short id, published name, feed root)
  FEEDH_URL          Feed H's sportsbook root      FEEDH_NAME   the name its prices are published under
  FEEDH_RELAY        Cloudflare Worker relay (or reuse FEEDG_RELAY); Feed H never runs on a laptop
  FEEDI_URL          Feed I's sportsbook root      FEEDI_NAME   the name its prices are published under
  FEEDI_PARTNER      optional partner id (unused by the current Feed I guest calls; Chrome TLS direct, not the Mumbai relay)
  FEEDJ_API          Feed J's public feed root (ends in /api)      FEEDJ_BRAND  its account id      FEEDJ_ORIGIN  the sportsbook page origin it expects      FEEDJ_NAME  the name its prices are published under
  SRC_B_BASE, SRC_C_BASE, SRC_D_BASE, SRC_E_BASE   the optional scrapers / key-gated APIs that are not enabled by default
  BOARD_IN_BASE + BOARD_IN_FEED   India board JSON (optional; default feed /feed/v1/matches/live)
  BOARD_EN_BASE + BOARD_EN_FEED   England board JSON (optional; default /api/v2/matches.json)
  BOARD_ZA_BASE + BOARD_ZA_FEED   South Africa board JSON (optional; CSA has no public free feed yet)
  BOARD_AU_BASE + BOARD_AU_FEED   Australia board JSON (optional)
  SRC_D_BASE + CRICKETDATA_API_KEY  free Source D currentMatches — primary gap filler (CSA T20 etc.)

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
