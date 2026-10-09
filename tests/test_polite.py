import pytest

from cricket_data import polite
from cricket_data.polite import PoliteFetcher, RobotsDisallowed


class FakeResp:
    def __init__(self, body):
        self.body = body

    def read(self):
        return self.body.encode()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def fetcher_with(monkeypatch, robots, page="<html>ok</html>"):
    def fake_urlopen(req, timeout=0):
        if req.full_url.endswith("/robots.txt"):
            if robots is None:
                raise polite.urllib.error.HTTPError(req.full_url, 404, "nf", {}, None)
            return FakeResp(robots)
        return FakeResp(page)
    monkeypatch.setattr(polite.urllib.request, "urlopen", fake_urlopen)
    return PoliteFetcher(min_interval=0)


def test_blanket_disallow_is_respected(monkeypatch):
    f = fetcher_with(monkeypatch, "User-agent: *\nDisallow: /\n")
    assert not f.allowed("https://site.test/match/1")
    with pytest.raises(RobotsDisallowed):
        f.get("https://site.test/match/1")


def test_allowed_and_missing_robots(monkeypatch):
    assert fetcher_with(monkeypatch, "User-agent: *\nDisallow: /private\n").get("https://s.test/a") == "<html>ok</html>"
    assert fetcher_with(monkeypatch, None).get("https://s.test/a") == "<html>ok</html>"


def test_unverifiable_robots_means_no_fetch(monkeypatch):
    def boom(req, timeout=0):
        raise OSError("network down")
    monkeypatch.setattr(polite.urllib.request, "urlopen", boom)
    assert not PoliteFetcher(min_interval=0).allowed("https://s.test/a")
