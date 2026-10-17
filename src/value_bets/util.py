import datetime as dt
import json
import time
import urllib.error
import urllib.request

from . import config

UTC = dt.timezone.utc
IST = dt.timezone(dt.timedelta(hours=5, minutes=30), "IST")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"


def now_utc():
    return dt.datetime.now(UTC)


def parse_ts(s):
    """Parse many ISO-ish timestamps to aware UTC datetime."""
    if s is None or s == "":
        return None
    if isinstance(s, dt.datetime):
        return s if s.tzinfo else s.replace(tzinfo=UTC)
    s = str(s).strip().replace(" ", "T")
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    if len(s) >= 3 and (s[-3] in "+-") and s[-3:].lstrip("+-").isdigit():  # '+00'
        s = s + ":00"
    # trim nanoseconds
    if "." in s:
        head, tail = s.split(".", 1)
        frac = "".join(ch for ch in tail if ch.isdigit())
        rest = tail[len(frac):]
        s = head + "." + frac[:6] + rest
    d = dt.datetime.fromisoformat(s)
    return d if d.tzinfo else d.replace(tzinfo=UTC)


def iso(d):
    return d.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ") if d else None


def ist(d):
    return d.astimezone(IST).strftime("%Y-%m-%d %H:%M IST") if d else None


def http_json(url, method="GET", headers=None, data=None, timeout=None, retries=1):
    h = {"User-Agent": UA, "Accept": "application/json"}
    h.update(headers or {})
    body = None
    if data is not None:
        if isinstance(data, (dict, list)) and h.get("Content-Type", "application/json") == "application/json":
            body = json.dumps(data).encode()
            h.setdefault("Content-Type", "application/json")
        elif isinstance(data, dict):
            body = urllib.parse.urlencode(data).encode()
        else:
            body = data if isinstance(data, bytes) else str(data).encode()
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=body, headers=h, method=method)
            with urllib.request.urlopen(req, timeout=timeout or config.get("HTTP_TIMEOUT")) as r:
                raw = r.read()
                return json.loads(raw), dict(r.headers)
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (400, 401, 403, 404, 451):
                raise
        except Exception as e:  # noqa
            last = e
        time.sleep(1.5 * (attempt + 1))
    raise last


import urllib.parse  # noqa: E402


def decimal_ok(x):
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    return round(x, 4) if 1.0 < x < 1000 else None
