"""A polite HTTP fetcher for custom sources: obeys robots.txt, rate-limits, identifies itself.

Use it inside your own source plugin. It refuses URLs that robots.txt disallows for our
user agent, so a site that bans bots (``Disallow: /``) simply cannot be fetched with it.
Only fetch sites whose terms allow automated access.
"""
from __future__ import annotations

import time
import urllib.error
import urllib.request
import urllib.robotparser
from urllib.parse import urlsplit

USER_AGENT = "cricket-data/0.1 (open-source dataset updater)"


class RobotsDisallowed(PermissionError):
    """robots.txt (or an unreachable robots.txt we cannot confirm) forbids this fetch."""


class PoliteFetcher:
    def __init__(self, min_interval: float = 5.0, user_agent: str = USER_AGENT, timeout: float = 30.0):
        self.min_interval, self.user_agent, self.timeout = min_interval, user_agent, timeout
        self._robots: dict[str, urllib.robotparser.RobotFileParser] = {}
        self._last = 0.0

    def _parser(self, url: str) -> urllib.robotparser.RobotFileParser:
        parts = urlsplit(url)
        base = f"{parts.scheme}://{parts.netloc}"
        if base not in self._robots:
            rp = urllib.robotparser.RobotFileParser()
            try:
                req = urllib.request.Request(base + "/robots.txt", headers={"User-Agent": self.user_agent})
                with urllib.request.urlopen(req, timeout=self.timeout) as r:
                    rp.parse(r.read().decode("utf-8", "replace").splitlines())
            except urllib.error.HTTPError as exc:
                # 404 = no robots.txt = allowed; 401/403 = access denied = treat as disallowed
                rp.parse([] if exc.code == 404 else ["User-agent: *", "Disallow: /"])
            except OSError:
                rp.parse(["User-agent: *", "Disallow: /"])  # cannot verify: do not fetch
            self._robots[base] = rp
        return self._robots[base]

    def allowed(self, url: str) -> bool:
        return self._parser(url).can_fetch(self.user_agent, url)

    def get(self, url: str) -> str:
        if not self.allowed(url):
            raise RobotsDisallowed(f"robots.txt disallows {url} for {self.user_agent}")
        wait = self.min_interval - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        req = urllib.request.Request(url, headers={"User-Agent": self.user_agent})
        with urllib.request.urlopen(req, timeout=self.timeout) as r:
            self._last = time.monotonic()
            return r.read().decode("utf-8", "replace")
