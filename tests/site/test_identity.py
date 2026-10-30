from cricket_site import identity as I


def test_csv_aliases_carry_gender_and_folded_team(tmp_path):
    (tmp_path / "mappings").mkdir()
    (tmp_path / "mappings" / "player_aliases.csv").write_text(
        "raw_name,team,player_id\nAthapaththu,Sri Lanka,ac56b5a7\nChamari Athapaththu,Sri Lanka,ac56b5a7\n", encoding="utf-8")
    rows = I.from_csv(tmp_path, {"ac56b5a7": {"g": 1}})
    assert {r["f"] for r in rows} == {"athapaththu", "chamari athapaththu"}
    assert all(r["id"] == "ac56b5a7" and r["g"] == 1 and r["t"] == "sri lanka" for r in rows)


def test_merge_csv_wins_over_db_on_the_same_key():
    csv = [{"f": "athapaththu", "r": "Athapaththu", "id": "ac56b5a7", "g": 1, "t": "sri lanka", "src": "csv"}]
    db = [{"f": "athapaththu", "r": "Wrong", "id": "ac56b5a7", "g": 1, "t": "sri lanka", "src": "db"},
          {"f": "chamari", "r": "Chamari", "id": "ac56b5a7", "g": 1, "t": "", "src": "db"}]
    byf = {r["f"]: r for r in I.merge_players(csv, db)}
    assert byf["athapaththu"]["r"] == "Athapaththu" and byf["athapaththu"]["src"] == "csv"
    assert byf["chamari"]["src"] == "db"


def test_fixtures_keep_format_and_skip_first_class():
    fx = I.from_fixtures([
        {"id": "a", "a": "Afghanistan", "b": "Zimbabwe", "fmt": "Test", "gender": "male", "start": "2026-11-05T06:00Z", "source": "crex"},
        {"id": "b", "a": "A", "b": "B", "fmt": "FC", "gender": "male", "start": "2026-11-05T06:00Z"},
        {"id": "c", "a": "X", "b": "Y", "fmt": "T10", "start": "2026-11-01T13:30Z"},
        {"id": "d", "a": "P", "b": "Q", "fmt": "O60", "start": "2026-11-02T09:00Z"},
    ])
    assert [r["fmt"] for r in fx] == ["Test", "FC", "T10", "O60"]
    assert fx[0]["start"] == "2026-11-05T06:00:00Z" and fx[0]["ak"] == "afghanistan"
