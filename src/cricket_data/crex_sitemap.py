"""CREX sitemap index: every published match and series, with dates, from public sitemaps.

CREX's robots.txt allows crawlers to read its sitemaps:

* ``/crex_sitemap/cricket-live-score.xml`` lists ~18.5k match pages. Each ``<lastmod>`` is the
  match's start time (IST), which lets us find candidate matches for a date without rendering
  anything.
* ``/crex_sitemap/series.xml`` lists ~760 series (plus ``/matches`` etc. sub-pages, ignored here).

The index is pure data (no browser). Anything it returns is only a *candidate*: callers must
confirm the date, teams and format on the rendered page (see ``crex_lookup``).
"""
from __future__ import annotations

import json
import re
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path

from .polite import PoliteFetcher

BASE = "https://crex.com"
MATCH_SITEMAP = f"{BASE}/crex_sitemap/cricket-live-score.xml"
SERIES_SITEMAP = f"{BASE}/crex_sitemap/series.xml"
CACHE_MAX_AGE = 24 * 3600  # refresh the sitemaps at most once a day
_NS = {"ns": "http://www.sitemaps.org/schemas/sitemap/0.9"}

# "<a>-vs-<rest>-match-updates-<ID>"; the id is CREX's short base-36-ish match key.
_MATCH_RE = re.compile(r"^(?P<a>.+?)-vs-(?P<rest>.+?)(?:-match-updates)?-(?P<id>[0-9A-Z]{2,5})$")
_SERIES_RE = re.compile(r"^(?P<name>.+)-(?P<id>[0-9A-Za-z]{2,4})$")
# The match label (what follows team B) is an ordinal match, a knockout stage, or a numbered one.
_LABEL_RE = re.compile(
    r"-(?P<label>"
    r"(?:\d+(?:st|nd|rd|th)-(?:t20i?|odi|test|t10|match|semi-final|quarter-final|qualifier|eliminator|"
    r"play-?off|final|super-?\d*|practice-match|warm-up-match))"
    r"|only-(?:t20i?|odi|test)"
    r"|(?:final|semi-final|quarter-final|eliminator|qualifier|play-?off|challenger|super-?\d*)(?:-\d+)?"
    r"|(?:warm-up|practice)-match(?:-\d+)?"
    r")(?=-|$)"
)
_YEARS_RE = re.compile(r"(?<!\d)((?:19|20)\d{2})(?:-(\d{2}))?(?!\d)")


def ist_date(lastmod: str | None) -> date | None:
    """The calendar date in a sitemap ``<lastmod>`` timestamp (kept in CREX's own +05:30 clock)."""
    if not lastmod:
        return None
    try:
        return date.fromisoformat(lastmod[:10])
    except ValueError:
        return None


def season_years(name: str) -> tuple[int, int] | None:
    """(first, last) calendar year a series name refers to: ``...-2025-26`` -> (2025, 2026)."""
    found = list(_YEARS_RE.finditer(name))
    if not found:
        return None
    m = found[-1]
    first = int(m.group(1))
    last = first
    if m.group(2):
        last = (first // 100) * 100 + int(m.group(2))
        if last < first:  # 1999-00
            last += 100
    return first, last


@dataclass
class MatchEntry:
    """One match page from the sitemap."""
    url: str
    match_id: str  # the URL slug, e.g. ind-vs-wi-1st-t20-west-indies-tour-of-india-2026-match-updates-11AL
    lastmod: str | None = None
    series_name: str = ""  # filled in by the index (slug of the owning series, without its id)

    @property
    def crex_id(self) -> str:
        m = _MATCH_RE.match(self.match_id)
        return m.group("id") if m else self.match_id.rsplit("-", 1)[-1]

    @property
    def start_date(self) -> date | None:
        return ist_date(self.lastmod)

    def _split(self) -> tuple[str, str, str]:
        """(code_a, code_b, label). Codes can contain hyphens ('n-z', 'ts-w'); best effort."""
        m = _MATCH_RE.match(self.match_id)
        if not m:
            return "", "", ""
        a, rest = m.group("a"), m.group("rest")
        if self.series_name and rest.endswith(self.series_name):
            rest = rest[: -len(self.series_name)].rstrip("-")
        lm = _LABEL_RE.search(rest)
        if lm:
            return a, rest[: lm.start()], lm.group("label")
        return a, "-".join(rest.split("-")[:2]), ""

    @property
    def codes(self) -> tuple[str, str]:
        a, b, _ = self._split()
        return a, b

    @property
    def label(self) -> str:
        return self._split()[2]

    @property
    def is_women(self) -> bool:
        a, b = self.codes
        return bool(re.search(r"women|wu19|wu23", self.match_id)) or a.endswith("-w") or b.endswith("-w")

    @property
    def format_hint(self) -> str | None:
        """'T20', 'ODI', 'Test' when the slug says so (T20 here means any 20-over format)."""
        s = self.match_id
        if re.search(r"(?:^|-)(t20i?|20-20)(?:-|$)", s):
            return "T20"
        if re.search(r"(?:^|-)odi(?:-|$)", s):
            return "ODI"
        if re.search(r"(?:^|-)test(?:-|$)", s):
            return "Test"
        return None

    def to_json(self) -> list:
        return [self.match_id, self.lastmod or ""]


@dataclass
class SeriesEntry:
    """One series from the sitemap."""
    url: str
    slug: str  # e.g. afghanistan-tour-of-india-2024-1H0
    lastmod: str | None = None

    @property
    def name(self) -> str:
        m = _SERIES_RE.match(self.slug)
        return m.group("name") if m else self.slug

    @property
    def years(self) -> tuple[int, int] | None:
        return season_years(self.name)

    def matches_url(self) -> str:
        return f"{BASE}/series/{self.slug}/matches"

    def involves_afghanistan(self) -> bool:
        return "afghanistan" in self.slug.lower() or bool(re.search(r"(?:^|-)afg(?:-|$)", self.slug.lower()))

    def is_multi_team_event(self) -> bool:
        """ICC / continental events in which Afghanistan may play without being named in the slug."""
        s = self.name.lower()
        if re.search(r"u19|under-19|women|womens|-a-|a-tour", s):
            return False
        return bool(re.search(
            r"world-cup|t20-world-cup|champions-trophy|asia-cup|asian-games|world-test-championship|"
            r"world-cup-qualifier|warm-up|icc|tri-series|tri-nation|quadrangular", s))


def _read_urlset(xml: str) -> list[tuple[str, str | None]]:
    out: list[tuple[str, str | None]] = []
    try:
        root = ET.fromstring(xml)
    except ET.ParseError as exc:
        raise ValueError(f"sitemap is not valid XML: {exc}") from exc
    for u in root.findall("ns:url", _NS):
        loc = u.find("ns:loc", _NS)
        lm = u.find("ns:lastmod", _NS)
        if loc is not None and loc.text:
            out.append((loc.text.strip(), lm.text.strip() if lm is not None and lm.text else None))
    return out


def parse_match_sitemap(xml: str) -> list[MatchEntry]:
    out = []
    for loc, lastmod in _read_urlset(xml):
        if "/cricket-live-score/" in loc:
            out.append(MatchEntry(url=loc, match_id=loc.split("/cricket-live-score/", 1)[1].strip("/"), lastmod=lastmod))
    return out


def parse_series_sitemap(xml: str) -> list[SeriesEntry]:
    """Only top-level ``/series/<slug>`` pages (the sitemap also lists /matches, /team-squad...)."""
    out = []
    for loc, lastmod in _read_urlset(xml):
        if "/series/" not in loc:
            continue
        slug = loc.split("/series/", 1)[1].strip("/")
        if slug and "/" not in slug:
            out.append(SeriesEntry(url=loc, slug=slug, lastmod=lastmod))
    return out


@dataclass
class CREXSitemapIndex:
    """Cached index over the match and series sitemaps."""
    fetcher: PoliteFetcher = field(default_factory=lambda: PoliteFetcher(min_interval=2.0, timeout=120.0))
    cache_path: Path | None = None
    matches: list[MatchEntry] = field(default_factory=list)
    series: list[SeriesEntry] = field(default_factory=list)
    _loaded: bool = False

    # ---- loading -----------------------------------------------------------------------------
    def load(self, force_refresh: bool = False) -> None:
        if self._loaded and not force_refresh:
            return
        if not force_refresh and self._load_cache():
            self._finish()
            return
        self.series = parse_series_sitemap(self.fetcher.get(SERIES_SITEMAP))
        self.matches = parse_match_sitemap(self.fetcher.get(MATCH_SITEMAP))
        if not self.matches or not self.series:
            raise RuntimeError("CREX sitemaps parsed to zero entries; refusing to continue")
        self._save_cache()
        self._finish()

    def load_from_xml(self, match_xml: str, series_xml: str) -> None:
        """Build the index from already-fetched XML (tests, fixtures)."""
        self.matches = parse_match_sitemap(match_xml)
        self.series = parse_series_sitemap(series_xml)
        self._finish()

    def _finish(self) -> None:
        names = sorted({s.name for s in self.series}, key=len, reverse=True)
        for m in self.matches:
            base = re.sub(r"(?:-match-updates)?-[0-9A-Z]{2,5}$", "", m.match_id)
            m.series_name = next((n for n in names if base.endswith(f"-{n}")), "")
        self._by_date: dict[date, list[MatchEntry]] = {}
        for m in self.matches:
            d = m.start_date
            if d:
                self._by_date.setdefault(d, []).append(m)
        self._series_by_name = {s.name: s for s in self.series}
        self._by_slug = {m.match_id: m for m in self.matches}
        self._loaded = True

    def _load_cache(self) -> bool:
        p = self.cache_path
        if not p or not p.exists() or time.time() - p.stat().st_mtime > CACHE_MAX_AGE:
            return False
        try:
            doc = json.loads(p.read_text(encoding="utf-8"))
            self.matches = [MatchEntry(url=f"{BASE}/cricket-live-score/{mid}", match_id=mid, lastmod=lm or None)
                            for mid, lm in doc["matches"]]
            self.series = [SeriesEntry(url=f"{BASE}/series/{s}", slug=s) for s in doc["series"]]
            return bool(self.matches and self.series)
        except (OSError, ValueError, KeyError, TypeError):
            return False

    def _save_cache(self) -> None:
        if not self.cache_path:
            return
        try:
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
            self.cache_path.write_text(json.dumps({
                "fetched_at": datetime.now().isoformat(timespec="seconds"),
                "series": [s.slug for s in self.series],
                "matches": [m.to_json() for m in self.matches],
            }, separators=(",", ":")), encoding="utf-8")
        except OSError:
            pass  # the cache is an optimisation only

    # ---- queries -----------------------------------------------------------------------------
    def matches_on(self, day: date, window: int = 1) -> list[MatchEntry]:
        """Matches whose sitemap start time falls within ``window`` days of ``day``."""
        self.load()
        out: list[MatchEntry] = []
        for off in range(-window, window + 1):
            out.extend(self._by_date.get(day + timedelta(days=off), []))
        return out

    def coverage(self) -> tuple[date | None, date | None]:
        self.load()
        ds = sorted(self._by_date)
        return (ds[0], ds[-1]) if ds else (None, None)

    def by_slug(self, slug: str) -> MatchEntry | None:
        self.load()
        return self._by_slug.get(slug)

    def series_for(self, entry: MatchEntry) -> SeriesEntry | None:
        self.load()
        return self._series_by_name.get(entry.series_name)

    def afghanistan_series(self) -> list[SeriesEntry]:
        """Series named for Afghanistan, plus multi-team events where Afghanistan may appear."""
        self.load()
        return [s for s in self.series if s.involves_afghanistan() or s.is_multi_team_event()]
