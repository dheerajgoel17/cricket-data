from cricket_site.wrap import unwrap, wrap, wrap_dir


def test_wrap_roundtrip_and_skips_matches_json(tmp_path):
    secret = "ci-test-key"
    doc = {"p": [{"f": "athapaththu", "id": "ac56b5a7"}], "fx": []}
    assert unwrap(wrap(doc, secret), secret) == doc
    (tmp_path / "identity.json").write_text('{"p":[],"fx":[]}')
    (tmp_path / "matches.json").write_text('{"id":[]}')
    (tmp_path / "meta.json").write_text('{"matches":1}')
    (tmp_path / "index.json").write_text('{"players":{"id":["aa"]}}')
    done = wrap_dir(tmp_path, secret)
    assert "identity.json" in done
    assert "matches.json" not in done and "meta.json" not in done and "index.json" not in done
    wrapped = __import__("json").loads((tmp_path / "identity.json").read_text())
    assert wrapped["v"] == 1 and unwrap(wrapped, secret) == {"p": [], "fx": []}
    assert unwrap(wrapped, "") is wrapped, "no key: leave the ciphertext, do not throw"
