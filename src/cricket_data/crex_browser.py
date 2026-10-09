"""One headless-Chromium session for CREX pages (they render with JavaScript).

A single ``CREXBrowser`` is created per process and passed to everything that needs a rendered
page, so Playwright's sync API is started exactly once and always stopped by ``close()`` (use it as
a context manager). Starting several ``sync_playwright()`` instances, or tearing one down from
``__del__``, is what produced the "Playwright Sync API inside the asyncio loop" crash in Actions.

CREX pages are also server-rendered, so ``render`` first tries a plain HTTP GET (about 2 s, no
browser) and only falls back to Chromium when the expected content is missing from the response.
That keeps runs fast and still works if CREX stops serving the content to plain requests.

Politeness: robots.txt is checked for every URL, requests are spaced by ``min_interval`` seconds and
429 / 5xx responses are retried with a growing back-off.
"""
from __future__ import annotations

import os
import re
import time
import urllib.request
from dataclasses import dataclass

from .polite import USER_AGENT, PoliteFetcher, RobotsDisallowed

RETRY_STATUSES = {429, 500, 502, 503, 504}
BACKOFF_SECONDS = (30.0, 60.0, 120.0)


class BrowserError(RuntimeError):
    """The page could not be rendered (network, timeout, repeated 429/5xx)."""


@dataclass
class RenderedPage:
    url: str
    status: int
    html: str
    text: str
    title: str


class CREXBrowser:
    def __init__(self, fetcher: PoliteFetcher | None = None, min_interval: float = 3.0,
                 backoff: tuple[float, ...] = BACKOFF_SECONDS):
        self.fetcher = fetcher or PoliteFetcher(min_interval=min_interval)
        self.min_interval = min_interval
        self.backoff = backoff
        self._pw = None
        self._browser = None
        self._context = None
        self._last = 0.0

    # ---- lifecycle ---------------------------------------------------------------------------
    def start(self) -> CREXBrowser:
        if self._context is not None:
            return self
        try:
            from playwright.sync_api import sync_playwright
        except ImportError as exc:
            raise BrowserError("Playwright not installed: pip install playwright && "
                               "python -m playwright install --with-deps chromium") from exc
        try:
            self._pw = sync_playwright().start()
            kwargs = {"headless": True}
            exe = os.environ.get("CRICKET_CHROMIUM_PATH")  # local override; CI uses Playwright's own
            if exe:
                kwargs["executable_path"] = exe
            self._browser = self._pw.chromium.launch(**kwargs)
            self._context = self._browser.new_context(user_agent=USER_AGENT)
        except Exception as exc:
            self.close()
            raise BrowserError(f"could not start Chromium: {exc}") from exc
        return self

    def close(self) -> None:
        for obj, method in ((self._context, "close"), (self._browser, "close"), (self._pw, "stop")):
            if obj is not None:
                try:
                    getattr(obj, method)()
                except Exception:
                    pass  # best-effort teardown
        self._context = self._browser = self._pw = None

    def __enter__(self) -> CREXBrowser:
        return self.start()

    def __exit__(self, *exc) -> None:
        self.close()

    # ---- rendering ---------------------------------------------------------------------------
    def _http(self, url: str, marker: str) -> RenderedPage | None:
        """Plain GET; the page only counts if it contains ``marker`` (None -> use the browser)."""
        wait = self.min_interval - (time.monotonic() - self._last)
        if wait > 0:
            time.sleep(wait)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=30) as r:
                status, html = r.status, r.read().decode("utf-8", "replace")
        except Exception:
            return None
        finally:
            self._last = time.monotonic()
        if status >= 400 or marker not in html:
            return None
        text = re.sub(r"\n\s*\n+", "\n", re.sub(r"<[^>]+>", "\n", re.sub(r"<(script|style)\b.*?</\1>", "", html, flags=re.S)))
        title = re.search(r"<title[^>]*>(.*?)</title>", html, re.S)
        return RenderedPage(url=url, status=status, html=html, text=text.strip(),
                            title=re.sub(r"\s+", " ", title.group(1)).strip() if title else "")

    def render(self, url: str, wait_selector: str | None = None, timeout_ms: int = 45000,
               force_browser: bool = False) -> RenderedPage:
        """Return the page's HTML/text: plain HTTP first, Chromium if the content is not in it.

        Raises RobotsDisallowed / BrowserError.
        """
        if not self.fetcher.allowed(url):
            raise RobotsDisallowed(f"robots.txt disallows {url}")
        marker = None
        if wait_selector == "script#sports-event-schema":
            marker = 'id="sports-event-schema"'
        elif wait_selector and wait_selector.startswith('a[href*="'):
            marker = f'href="{wait_selector[9:-2]}'
        if marker and not force_browser:
            page = self._http(url, marker)
            if page is not None:
                return page
        self.start()
        last_err = "unknown error"
        for attempt in range(len(self.backoff) + 1):
            wait = self.min_interval - (time.monotonic() - self._last)
            if wait > 0:
                time.sleep(wait)
            page = self._context.new_page()
            try:
                resp = page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                status = resp.status if resp else 0
                if status not in RETRY_STATUSES and status < 400:
                    try:
                        if wait_selector:
                            page.wait_for_selector(wait_selector, state="attached", timeout=timeout_ms)
                        else:
                            page.wait_for_load_state("networkidle", timeout=timeout_ms)
                    except Exception:
                        pass  # judged by the caller from what actually rendered
                    page.wait_for_timeout(1500)  # let the Angular app settle
                    return RenderedPage(url=url, status=status, html=page.content(),
                                        text=page.inner_text("body"), title=page.title())
                last_err = f"HTTP {status}"
                if status not in RETRY_STATUSES:
                    return RenderedPage(url=url, status=status, html="", text="", title="")
            except Exception as exc:
                last_err = str(exc).splitlines()[0][:200]
            finally:
                self._last = time.monotonic()
                try:
                    page.close()
                except Exception:
                    pass
            if attempt < len(self.backoff):
                time.sleep(self.backoff[attempt])
        raise BrowserError(f"{url}: {last_err} after {len(self.backoff) + 1} attempts")

    def links(self, url: str, href_contains: str, timeout_ms: int = 45000) -> tuple[RenderedPage, list[dict]]:
        """Render ``url`` and also return ``[{href, text}]`` for anchors containing ``href_contains``."""
        page_obj = self.render(url, wait_selector=f'a[href*="{href_contains}"]', timeout_ms=timeout_ms)
        return page_obj, extract_links(page_obj.html, href_contains)


def extract_links(html: str, href_contains: str) -> list[dict]:
    """Anchors whose href contains ``href_contains`` from rendered HTML (no browser needed)."""
    import re
    out = []
    for m in re.finditer(r'<a\b[^>]*?href="([^"]*)"[^>]*>(.*?)</a>', html, re.S):
        href, inner = m.group(1), m.group(2)
        if href_contains in href:
            text = re.sub(r"<[^>]+>", "\n", inner)
            text = re.sub(r"\n\s*", "\n", text).strip()
            out.append({"href": href, "text": text})
    return out
