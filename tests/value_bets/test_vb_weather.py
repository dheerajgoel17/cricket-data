import datetime as dt

from value_bets import weather


def test_features_centred_and_none_safe():
    f = weather.features({"precipitation_sum": 0.0, "temperature_2m_max": 30.0, "relative_humidity_2m_mean": 65.0,
                          "dew_point_2m_mean": 18.0, "wind_speed_10m_max": 18.0, "cloud_cover_mean": 45.0})
    assert all(abs(v) < 1e-9 for v in f.values())
    assert weather.features(None) is None
    assert weather.features({"precipitation_sum": None})["wx_rain"] == 0.0


def test_geocode_falls_back_to_ground_words(monkeypatch):
    asked = []

    def fake(url, tries=4):
        asked.append(url)
        if "name=Al+Amerat&" in url:
            return {"results": [{"latitude": 40.0, "longitude": -90.0, "country_code": "US"},
                                {"latitude": 23.6, "longitude": 58.4, "country_code": "OM"}]}
        return {}

    monkeypatch.setattr(weather, "_get", fake)
    venue = "Al Amerat Cricket Ground Oman Cricket (Ministry Turf 1)"
    q, ll, cc = weather.geocode(venue, {"OM"})
    assert ll == (23.6, 58.4) and cc == "OM" and q.startswith("Al Amerat")
    # without a country hint a word-fragment hit is not trusted
    assert weather.geocode(venue)[1] is None


def test_country_hints():
    import pandas as pd
    m = pd.DataFrame({"venue": ["Old Deer Park, Richmond", "Ekana Stadium"],
                      "event": ["Pakistan tour of England", "Indian Premier League"],
                      "team_a": ["Pakistan", "Lucknow Super Giants"], "team_b": ["England", "Delhi Capitals"]})
    h = weather.venue_country_hints(m)
    assert set(h["old deer park"]) == {"GB", "PK"} and set(h["ekana stadium"]) == {"IN"}
    assert h["old deer park"]["GB"] > h["old deer park"]["PK"]  # host ("tour of England") outweighs tourists


def test_forecast_window(monkeypatch):
    times = [f"2026-10-17T{h:02d}:00" for h in range(24)]
    payload = {"daily": {"time": ["2026-10-17"], **{k: [1.0] for k in weather.DAILY_VARS}},
               "hourly": {"time": times, "precipitation_probability": [10] * 14 + [80] + [5] * 9,
                          "precipitation": [0.0] * 14 + [3.0] + [0.0] * 9, "relative_humidity_2m": [70] * 24,
                          "cloud_cover": [90] * 24}}
    monkeypatch.setattr(weather, "_get", lambda *a, **k: payload)
    start = dt.datetime(2026, 10, 17, 13, 30, tzinfo=dt.timezone.utc)
    daily, w = weather.forecast((12.97, 77.59), start, hours=4)
    assert daily["precipitation_sum"] == 1.0
    assert w["rain_prob_max"] == 80 and w["rain_mm"] == 3.0 and w["cloud_mean"] == 90
