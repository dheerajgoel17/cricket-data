import io
import json

from cricket_site import assets_sync as s

BASE = "https://proj.example"


class FakeDB:
    """Stands in for the Supabase REST + Storage HTTP calls."""

    def __init__(self, have=()):
        self.assets = [{"kind": k, "ref": r} for k, r in have]
        self.objects, self.tables = {}, {}

    def __call__(self, method, url, key, data=None, headers=None, timeout=60):
        assert key == "service-key"
        if method == "GET" and "/rest/v1/assets" in url:
            return 200, "application/json", json.dumps(self.assets).encode()
        if method == "POST" and "/storage/v1/object/avatars/" in url:
            self.objects[url.split("/avatars/")[1]] = (data, headers["Content-Type"])
            return 200, "", b"{}"
        if method == "POST" and "/rest/v1/" in url:
            self.tables.setdefault(url.rsplit("/", 1)[1], []).extend(json.loads(data))
            return 201, "", b""
        raise AssertionError(url)


class Resp(io.BytesIO):
    def __init__(self, body, ct):
        super().__init__(body)
        self.headers = {"Content-Type": ct}

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def fake_fetch(images):
    def f(req, timeout=30):
        url = req.full_url
        body = images.get(url)
        return Resp(body, "image/webp") if body else Resp(b"<html>404</html>", "text/html")
    return f


def write_photos(tmp_path):
    p = tmp_path / "photos.json"
    p.write_text(json.dumps({"p": {"1": "c:AAA", "2": "c:BBB", "3": "w:Some.jpg"}, "t": {"india": "O"}}))
    return str(p)


def test_sync_copies_only_missing_images_and_annotates_photos_json(tmp_path):
    photos = write_photos(tmp_path)
    db = FakeDB(have=[("player", "AAA")])  # AAA already stored
    img = b"x" * 500
    fetch = fake_fetch({f"{s.CREX_CDN}/players/org/BBB.png": img, f"{s.CREX_CDN}/Teams/O.png": img})
    stats = s.sync(photos, None, BASE, "service-key", limit=10, pause=0, http=db, fetch=fetch)
    assert stats["downloaded"] == 2 and stats["already"] == 1 and stats["missing_at_crex"] == 0
    assert set(db.objects) == {"players/BBB.png", "teams/O.png"}
    assert {r["ref"] for r in db.tables["assets"]} == {"BBB", "O"} and db.tables["assets"][0]["sha256"]
    out = json.load(open(photos))
    assert out["base"] == f"{BASE}/storage/v1/object/public/avatars" and out["s"] == {"p": ["AAA", "BBB"], "t": ["O"]}


def test_sync_skips_images_crex_does_not_serve_and_respects_the_limit(tmp_path):
    photos = write_photos(tmp_path)
    db = FakeDB()
    stats = s.sync(photos, None, BASE, "service-key", limit=1, pause=0, http=db, fetch=fake_fetch({}))
    assert stats["downloaded"] == 0 and stats["missing_at_crex"] == 1 and stats["pending"] == 2  # teams first, then players
    assert json.load(open(photos))["s"] == {"p": [], "t": []}


def test_sync_stores_the_id_maps(tmp_path):
    photos = write_photos(tmp_path)
    idx = tmp_path / "idx.json"
    idx.write_text(json.dumps({"players": [["AAA", "harry brook", "4ae1755b"], ["BBB", "someone", None]], "teams": [["O", "india", "india"]]}))
    db = FakeDB()
    s.sync(photos, str(idx), BASE, "service-key", limit=0, pause=0, http=db, fetch=fake_fetch({}))
    assert db.tables["crex_players"][0] == {"crex_id": "AAA", "name": "harry brook", "cricsheet_id": "4ae1755b"}
    assert db.tables["crex_teams"][0]["folded_name"] == "india"


def test_main_without_credentials_is_a_noop(tmp_path, monkeypatch, capsys):
    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)
    assert s.main(["--photos", write_photos(tmp_path), "--url", BASE]) == 0
    assert "skipping" in capsys.readouterr().out
