"""Free weather from Open-Meteo (no key): geocoding, ERA5 archive (backtests) and forecast (live).

Venues are geocoded once (`mappings/venue_geo.csv`, editable). Daily match-day weather for historical venues is cached in
`mappings/venue_weather_daily.csv.gz` so weekly refits don't re-download history. Base has no start times, so
history uses daily aggregates; live uses the same daily aggregates for the model and hourly rain probability around the
scheduled start for the rain-risk flag.
"""
import csv
import gzip
import json
import math
import time
import urllib.parse
import urllib.request

from . import config
from .context import norm_venue

GEO_FILE = config.MAPPINGS / "venue_geo.csv"
DAILY_FILE = config.MAPPINGS / "venue_weather_daily.csv.gz"
DAILY_VARS = ["precipitation_sum", "temperature_2m_max", "relative_humidity_2m_mean", "dew_point_2m_mean",
              "wind_speed_10m_max", "cloud_cover_mean"]
UA = {"User-Agent": "cricket-data value_bets (open-source)"}


def _get(url, tries=4):
    last = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return json.load(r)
        except Exception as e:  # 429 / transient
            last = e
            time.sleep(5 * (i + 1) * (6 if "429" in str(e) else 1))
    raise last


# ---------------------------------------------------------------- geocoding
def load_geo():
    out = {}
    if GEO_FILE.exists():
        with open(GEO_FILE) as f:
            for r in csv.DictReader(f):
                out[r["venue_key"]] = (float(r["lat"]), float(r["lon"])) if r["lat"] else None
    return out


def save_geo(geo, meta):
    GEO_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(GEO_FILE, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["venue_key", "query", "country", "lat", "lon"])
        for k in sorted(geo):
            v = geo[k]
            q, cc = meta.get(k, ("", ""))
            w.writerow([k, q, cc, *((f"{v[0]:.4f}", f"{v[1]:.4f}") if v else ("", ""))])


GENERIC = {"cricket", "ground", "grounds", "stadium", "club", "oval", "park", "international", "turf", "the", "of",
           "academy", "association", "sports", "complex", "centre", "center", "no", "field", "arena", "county", "ministry"}

# team / competition -> ISO country codes, used only to disambiguate geocoder hits ("Richmond" UK vs USA)
_WI = {"JM", "TT", "BB", "GY", "AG", "LC", "KN", "VC", "GD", "DM"}
TEAM_CC = {
    "india": {"IN"}, "england": {"GB"}, "scotland": {"GB"}, "wales": {"GB"}, "ireland": {"IE", "GB"},
    "australia": {"AU"}, "new zealand": {"NZ"}, "south africa": {"ZA"}, "pakistan": {"PK"}, "sri lanka": {"LK"},
    "bangladesh": {"BD"}, "west indies": _WI, "zimbabwe": {"ZW"}, "afghanistan": {"AF", "AE", "IN"},
    "netherlands": {"NL"}, "namibia": {"NA"}, "nepal": {"NP"}, "oman": {"OM"}, "united arab emirates": {"AE"},
    "uae": {"AE"}, "united states of america": {"US"}, "usa": {"US"}, "canada": {"CA"}, "kenya": {"KE"},
    "uganda": {"UG"}, "papua new guinea": {"PG"}, "hong kong": {"HK"}, "singapore": {"SG"}, "malaysia": {"MY"},
    "thailand": {"TH"}, "qatar": {"QA"}, "kuwait": {"KW"}, "bahrain": {"BH"}, "saudi arabia": {"SA"},
    "jersey": {"JE"}, "guernsey": {"GG"}, "germany": {"DE"}, "italy": {"IT"}, "denmark": {"DK"}, "spain": {"ES"},
    "france": {"FR"}, "austria": {"AT"}, "belgium": {"BE"}, "czech republic": {"CZ"}, "hungary": {"HU"},
    "romania": {"RO"}, "bulgaria": {"BG"}, "portugal": {"PT"}, "sweden": {"SE"}, "norway": {"NO"}, "finland": {"FI"},
    "isle of man": {"IM"}, "gibraltar": {"GI"}, "malta": {"MT"}, "cyprus": {"CY"}, "greece": {"GR"},
    "luxembourg": {"LU"}, "switzerland": {"CH"}, "serbia": {"RS"}, "croatia": {"HR"}, "estonia": {"EE"},
    "nigeria": {"NG"}, "rwanda": {"RW"}, "tanzania": {"TZ"}, "botswana": {"BW"}, "malawi": {"MW"},
    "mozambique": {"MZ"}, "ghana": {"GH"}, "sierra leone": {"SL"}, "cameroon": {"CM"}, "argentina": {"AR"},
    "brazil": {"BR"}, "mexico": {"MX"}, "chile": {"CL"}, "peru": {"PE"}, "bermuda": {"BM"}, "cayman islands": {"KY"},
    "bhutan": {"BT"}, "maldives": {"MV"}, "myanmar": {"MM"}, "china": {"CN"}, "japan": {"JP"}, "south korea": {"KR"},
    "indonesia": {"ID"}, "philippines": {"PH"}, "vanuatu": {"VU"}, "samoa": {"WS"}, "fiji": {"FJ"},
    "cook islands": {"CK"}, "mongolia": {"MN"}, "iran": {"IR"}, "turkey": {"TR"}, "israel": {"IL"},
}
EVENT_CC = {
    "indian premier league": {"IN"}, "big bash": {"AU"}, "pakistan super league": {"PK", "AE"},
    "caribbean premier league": _WI | {"US"}, "the hundred": {"GB"}, "vitality blast": {"GB"},
    "t20 blast": {"GB"}, "sa20": {"ZA"}, "csa t20": {"ZA"}, "bangladesh premier league": {"BD"},
    "lanka premier league": {"LK"}, "international league t20": {"AE"}, "major league cricket": {"US"},
    "super smash": {"NZ"}, "women's premier league": {"IN"}, "syed mushtaq ali": {"IN"}, "vijay hazare": {"IN"},
    "royal london": {"GB"}, "marsh cup": {"AU"}, "ford trophy": {"NZ"}, "nepal premier league": {"NP"},
}


def venue_country_hints(matches):
    """venue_key -> Counter of plausible ISO country codes (from 'X tour of Y', competitions, national sides),
    weighted so the host country (tour of / domestic competition) dominates touring sides."""
    import re
    from collections import Counter
    out = {}
    for v, ev, a, b in zip(matches.venue, matches.event, matches.team_a, matches.team_b, strict=True):
        if not isinstance(v, str):
            continue
        hs = out.setdefault(norm_venue(v), Counter())
        e = str(ev).lower() if isinstance(ev, str) else ""
        mt = re.search(r"tour of ([a-z ]+)", e)
        if mt and mt.group(1).strip() in TEAM_CC:
            hs.update({c: 3 for c in TEAM_CC[mt.group(1).strip()]})
        for name, cc in EVENT_CC.items():
            if name in e:
                hs.update({c: 3 for c in cc})
        for t in (a, b):
            t = str(t).lower().replace(" women", "").strip()
            if t in TEAM_CC:
                hs.update({c: 1 for c in TEAM_CC[t]})
    return out


def geocode(raw_venue, hints=None):
    """'Queens Sports Club, Bulawayo' -> (query, (lat, lon), country_code). Tries the city part, the ground name,
    then the ground name without generic words. With country hints, only accepts a hit in one of those countries;
    without hints, word-fragment fallbacks are not trusted (returns None rather than guess)."""
    import re
    parts = [p.strip() for p in str(raw_venue).split(",") if p.strip()]
    if not parts:
        return "", None, ""
    cands = ([(parts[-1], True)] if len(parts) > 1 else []) + [(parts[0], True)]
    words = [w for w in re.sub(r"\(.*?\)|[^A-Za-z ]", " ", parts[0]).split() if w.lower() not in GENERIC]
    if words:
        cands += [(" ".join(words[:2]), False), (words[0], False)]
    seen = []
    for q, trusted in cands:
        if q in seen or len(q) < 3:
            continue
        seen.append(q)
        d = _get("https://geocoding-api.open-meteo.com/v1/search?" + urllib.parse.urlencode({"name": q, "count": 10}))
        res = [r for r in (d or {}).get("results") or []  # drop country/state/region centroids
               if not str(r.get("feature_code", "")).startswith(("PCL", "ADM", "CONT", "RGN", "AREA"))]
        if hints:
            w = hints if isinstance(hints, dict) else dict.fromkeys(hints, 1)
            top = max(w.values())
            # word fragments ('Rangiri', 'Shere') only count when they land in the venue's main (host) country
            res = [r for r in res if r.get("country_code") in w and (trusted or w[r["country_code"]] == top)]
            res.sort(key=lambda r: -w[r["country_code"]])  # stable: geocoder order within the same weight
        elif not trusted:
            res = []
        if res:
            return q, (res[0]["latitude"], res[0]["longitude"]), res[0].get("country_code", "")
    return cands[0][0], None, ""


def wx_key(raw_venue):
    """Location key for weather: the full venue string incl. city ('County Ground, Hove' != 'County Ground, Bristol')."""
    import re
    return re.sub(r"[^a-z0-9]+", " ", str(raw_venue).lower()).strip()


def ensure_geo(raw_venues, log=print, hints=None, redo=False):
    """Geocode venues (keyed by wx_key) not yet in GEO_FILE (all of them when redo=True).
    hints: norm_venue key -> {ISO codes}. A city-less venue name ('Gaddafi Stadium') borrows the city from another
    spelling of the same ground when exactly one city is known for it."""
    geo = {} if redo else load_geo()
    meta = {}
    if GEO_FILE.exists() and not redo:
        with open(GEO_FILE) as f:
            meta = {r["venue_key"]: (r["query"], r.get("country", "")) for r in csv.DictReader(f)}
    cities = {}
    for v in raw_venues:
        if "," in str(v):
            cities.setdefault(norm_venue(v), set()).add(str(v).split(",")[-1].strip())
    todo = {}
    for v in raw_venues:
        k = wx_key(v)
        if k and k not in geo and k not in todo:
            c = cities.get(norm_venue(v), set())
            todo[k] = v if "," in str(v) or len(c) != 1 else f"{v}, {next(iter(c))}"
    for i, (k, v) in enumerate(todo.items()):
        try:
            q, ll, cc = geocode(v, (hints or {}).get(norm_venue(v)))
        except Exception as e:
            log(f"geocode failed {v}: {e}")
            continue
        geo[k], meta[k] = ll, (q, cc)
        if i % 50 == 49:
            save_geo(geo, meta)
        time.sleep(0.15)
    if todo:
        save_geo(geo, meta)
    return geo


# ---------------------------------------------------------------- daily history
def load_daily():
    out = {}
    if DAILY_FILE.exists():
        with gzip.open(DAILY_FILE, "rt") as f:
            for r in csv.DictReader(f):
                out[(r["lat"], r["lon"], r["date"])] = {k: (float(r[k]) if r[k] not in ("", "None") else None)
                                                        for k in DAILY_VARS}
    return out


def save_daily(d):
    with gzip.open(DAILY_FILE, "wt", newline="") as f:
        w = csv.writer(f)
        w.writerow(["lat", "lon", "date"] + DAILY_VARS)
        for (la, lo, dt_), v in sorted(d.items()):
            w.writerow([la, lo, dt_] + [("" if v[k] is None else round(v[k], 2)) for k in DAILY_VARS])


def _key(ll):
    return (f"{ll[0]:.2f}", f"{ll[1]:.2f}")


def fetch_archive(ll, start, end):
    q = {"latitude": f"{ll[0]:.2f}", "longitude": f"{ll[1]:.2f}", "start_date": start, "end_date": end,
         "daily": ",".join(DAILY_VARS), "timezone": "auto"}
    d = _get("https://archive-api.open-meteo.com/v1/archive?" + urllib.parse.urlencode(q))
    D = d.get("daily") or {}
    return {t: {k: (D.get(k) or [None] * len(D["time"]))[i] for k in DAILY_VARS} for i, t in enumerate(D.get("time", []))}


def ensure_daily(pairs, geo, log=print, max_calls=6000, pause=0.3, workers=4):
    """pairs: iterable of (venue_key, 'YYYY-MM-DD'). Fetch missing days in <=14-day chunks per location."""
    have = load_daily()
    need = {}
    for vk, day in pairs:
        ll = geo.get(vk)
        if not ll:
            continue
        k = _key(ll)
        if (k[0], k[1], day) not in have:
            need.setdefault(k, set()).add(day)
    import datetime as _dt
    from concurrent.futures import ThreadPoolExecutor
    jobs = []
    for k, days in need.items():
        days = sorted(days)
        i = 0
        while i < len(days):
            s = _dt.date.fromisoformat(days[i])
            j = i
            while j + 1 < len(days) and (_dt.date.fromisoformat(days[j + 1]) - s).days < 14:
                j += 1
            jobs.append((k, days[i:j + 1]))
            i = j + 1
    jobs = jobs[:max_calls]

    def one(job):
        k, ds = job
        time.sleep(pause)
        try:
            return k, ds, fetch_archive((float(k[0]), float(k[1])), ds[0], ds[-1])
        except Exception as e:
            log(f"archive failed {k} {ds[0]}: {e}")
            return k, ds, {}

    calls = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        for k, ds, got in ex.map(one, jobs):
            for t in ds:
                if t in got:
                    have[(k[0], k[1], t)] = got[t]
            calls += 1
            if calls % 100 == 0:
                save_daily(have)
                log(f"weather: {calls}/{len(jobs)} archive calls")
    if calls:
        save_daily(have)
    return have, calls


def features(v):
    """Model features from daily aggregates (None-safe, centred so 0 = typical)."""
    if not v:
        return None
    g = lambda k, d: v.get(k) if v.get(k) is not None else d  # noqa: E731
    return {"wx_rain": math.log1p(max(g("precipitation_sum", 0.0), 0.0)),
            "wx_humid": (g("relative_humidity_2m_mean", 65.0) - 65.0) / 15.0,
            "wx_dew": (g("dew_point_2m_mean", 18.0) - 18.0) / 5.0,
            "wx_temp": (g("temperature_2m_max", 30.0) - 30.0) / 5.0,
            "wx_wind": (g("wind_speed_10m_max", 18.0) - 18.0) / 8.0,
            "wx_cloud": (g("cloud_cover_mean", 45.0) - 45.0) / 25.0}


WX_FEATURES = ["wx_rain", "wx_humid", "wx_dew", "wx_temp", "wx_wind", "wx_cloud"]


# ---------------------------------------------------------------- live forecast
def forecast(ll, start_utc, hours=4):
    """Daily aggregates for the local match day + max hourly precip probability over the match window."""
    q = {"latitude": f"{ll[0]:.2f}", "longitude": f"{ll[1]:.2f}", "daily": ",".join(DAILY_VARS),
         "hourly": "precipitation_probability,precipitation,relative_humidity_2m,cloud_cover",
         "timezone": "GMT", "forecast_days": 3}
    d = _get("https://api.open-meteo.com/v1/forecast?" + urllib.parse.urlencode(q))
    day = start_utc.strftime("%Y-%m-%d")
    D = d.get("daily") or {}
    daily = None
    if day in D.get("time", []):
        i = D["time"].index(day)
        daily = {k: (D.get(k) or [None] * len(D["time"]))[i] for k in DAILY_VARS}
    Hh = d.get("hourly") or {}
    probs, rain, rh, cc = [], 0.0, [], []
    for i, t in enumerate(Hh.get("time", [])):
        ts = t + ":00+00:00"
        import datetime as _dt
        tt = _dt.datetime.fromisoformat(ts)
        if start_utc <= tt < start_utc + _dt.timedelta(hours=hours):
            probs.append(Hh["precipitation_probability"][i] or 0)
            rain += Hh["precipitation"][i] or 0
            rh.append(Hh["relative_humidity_2m"][i] or 0)
            cc.append(Hh["cloud_cover"][i] or 0)
    window = {"rain_prob_max": max(probs) if probs else None, "rain_mm": round(rain, 1),
              "humidity_mean": round(sum(rh) / len(rh)) if rh else None,
              "cloud_mean": round(sum(cc) / len(cc)) if cc else None}
    return daily, window
