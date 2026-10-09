"""Find one historical match on CREX and *strictly* confirm it is the right one.

The sitemap index (``crex_sitemap``) proposes candidates by date; this module renders each
candidate page and only accepts it when all of these agree with the task:

* **date**: the page's own ``startDate`` is within one day of the task date (CREX stamps IST, a
  venue-local date can differ by a day) *and* agrees with the sitemap's ``lastmod``;
* **teams**: both teams named on the page match the task's two teams (names, not slug codes);
* **format**: T20 / 50-over / multi-day, from the slug, the competition name, or overs played;
* **gender**: men's vs women's.

Anything else is rejected, so a 2026 Test can never satisfy a 2024 ODI task. ``not_found`` is only
returned after every candidate on that date has actually been rendered and rejected, or when the
sitemap has no plausible candidate at all.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import date, datetime

from .crex_sitemap import CREXSitemapIndex, MatchEntry
from .models import MatchRecord

# ---- team names / codes --------------------------------------------------------------------------
NATIONS: dict[str, str] = {  # CREX slug code -> team name
    "afg": "Afghanistan", "aus": "Australia", "ban": "Bangladesh", "eng": "England", "ind": "India",
    "ire": "Ireland", "nz": "New Zealand", "pak": "Pakistan", "sa": "South Africa", "sl": "Sri Lanka",
    "wi": "West Indies", "zim": "Zimbabwe", "uae": "United Arab Emirates", "nep": "Nepal",
    "ned": "Netherlands", "sco": "Scotland", "oma": "Oman", "can": "Canada", "usa": "United States of America",
    "png": "Papua New Guinea", "nam": "Namibia", "hk": "Hong Kong", "jpn": "Japan", "qat": "Qatar",
    "kuw": "Kuwait", "sau": "Saudi Arabia", "ken": "Kenya", "uga": "Uganda", "ugn": "Uganda", "ita": "Italy",
    "ger": "Germany", "den": "Denmark", "nor": "Norway", "sin": "Singapore", "mas": "Malaysia",
    "tha": "Thailand", "bhr": "Bahrain", "jer": "Jersey", "gsy": "Guernsey", "bmu": "Bermuda",
}
_QUALIFIERS = {"w", "a", "u19", "u23", "s", "wu19", "emerging"}
_STOP = {"cricket", "club", "cc", "sc", "the", "xi", "men", "mens", "women", "womens", "and", "of", "association"}
_ALIASES = {  # extra spellings seen on Cricsheet / CREX
    "usa": {"united states of america", "united states", "usa"},
    "uae": {"united arab emirates", "uae"},
    "uga": {"uganda"}, "ugn": {"uganda"},
    "windies": {"west indies"},
}


def norm_name(name: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", name.lower())).strip()


def name_tokens(name: str) -> set[str]:
    return {t for t in norm_name(name).split() if t not in _STOP}


def names_match(task_name: str, crex_name: str) -> bool:
    """Same team? Exact, token-subset ('Haryana' in 'Haryana Cricket Team'), or a known alias."""
    a, b = norm_name(task_name), norm_name(crex_name)
    if not a or not b:
        return False
    if a == b:
        return True
    ta, tb = name_tokens(task_name), name_tokens(crex_name)
    if ta and tb and (ta <= tb or tb <= ta):
        return True
    for variants in _ALIASES.values():
        if a in variants and b in variants:
            return True
    return False


def _strip_qualifiers(code: str) -> str:
    parts = code.split("-")
    while len(parts) > 1 and (parts[-1] in _QUALIFIERS or re.fullmatch(r"\d+(?:st|nd|rd|th)|qtr|only|place|\d+", parts[-1])):
        parts.pop()
    return "-".join(parts)


def code_is(code: str, base: str) -> bool:
    """Is this slug code the plain senior side ``base`` (not 'afg-w', 'afg-u19', 'afg-a')?"""
    if code == base:
        return True
    if not code.startswith(base + "-"):
        return False
    rest = code[len(base) + 1:].split("-")
    return all(re.fullmatch(r"\d+(?:st|nd|rd|th)|qtr|only|place|\d+", r) for r in rest)


def code_plausible(code: str, team: str) -> bool:
    """Could slug ``code`` abbreviate ``team``? Deliberately loose: it only ranks candidates, the
    rendered page decides."""
    code = _strip_qualifiers(code).replace("-", "")
    letters = norm_name(team).replace(" ", "")
    if not code or not letters:
        return False
    for k, v in NATIONS.items():
        if v.lower() == norm_name(team) and k == code:
            return True
    words = [w for w in norm_name(team).split()]
    if code == "".join(w[0] for w in words):
        return True
    if len(code) < 2 or code[0] != letters[0]:
        return False
    it = iter(letters)
    return all(ch in it for ch in code)  # subsequence: jhkd ~ jharkhand, har ~ haryana


# ---- format / gender -----------------------------------------------------------------------------
def task_family(match_type: str) -> str | None:
    t = (match_type or "").lower().replace(" ", "")
    if t in ("t20", "t20i", "it20", "twenty20"):
        return "t20"
    if t in ("odi", "odm", "lista", "list-a"):
        return "50"
    if t in ("test", "mdm", "fc", "firstclass"):
        return "multi"
    return None


_COMPETITION_FAMILY = (
    ("multi", r"ranji|duleep|irani|county|sheffield|plunket|four-day|first-class|championship-division|"
              r"quaid|logan-cup|shield"),
    ("50", r"vijay-hazare|deodhar|one-day|ford-trophy|royal-london|metro-bank|marsh|jlt|list-a|"
           r"50-over|dolphins-?cup|cwc|world-cup-league"),
    ("t20", r"t20|t-20|20-20|syed-mushtaq|big-bash|premier-league|super-smash|blast|hundred|league-t20|"
            r"super-league|csa|sa20|ilt20|mlc|cpl|bpl"),
)


def entry_family(entry: MatchEntry) -> str | None:
    """T20 / 50-over / multi-day, from the slug when it says so (strict), else None."""
    h = entry.format_hint
    if h == "T20":
        return "t20"
    if h == "ODI":
        return "50"
    if h == "Test":
        return "multi"
    s = entry.match_id
    if re.search(r"(?:^|-)t10(?:-|$)", s):
        return "t20"  # ten-over leagues: close enough to reject 50-over / multi-day tasks
    for fam, pat in _COMPETITION_FAMILY:
        if re.search(pat, s):
            return fam
    return None


def family_from_overs(max_overs: float | None) -> str | None:
    if max_overs is None:
        return None
    return "t20" if max_overs <= 20.0 else "50" if max_overs <= 50.0 else "multi"


# ---- rendered page -------------------------------------------------------------------------------
_LD_EVENT = re.compile(r'<script[^>]*id="sports-event-schema"[^>]*>(.*?)</script>', re.S)
_TITLE = re.compile(r"<title[^>]*>(.*?)</title>", re.S)
_OVERS = re.compile(r"\((\d{1,3}(?:\.\d)?)\)")
_TOSS = re.compile(r"&q;toss_team&q;:&q;([A-Za-z0-9]+)&q;,&q;chose_to&q;:(\d)")
_STATE_TS = re.compile(r"&q;ts&q;:&q;[0-9/]+\((\d{1,3}(?:\.\d)?)\)&q;")
_MM = re.compile(r"&q;mm&q;:&q;([A-Za-z0-9]+)\^")
_WON = re.compile(r"^(?P<w>.+?)\s+won\s+(?P<m>(?:by|in)\s+.+?)\s*(?:🏆.*)?$", re.I)


@dataclass
class PageFacts:
    url: str
    start: datetime | None
    team_a: str
    team_b: str
    venue: str
    status: str  # 'Finished', 'Live', 'Scheduled'...
    title: str
    winner: str = ""
    margin: str = ""
    result: str = ""  # win | tie | draw | no result | ""
    max_overs: float | None = None
    scores: str = ""
    toss_winner: str = ""
    toss_decision: str = ""  # bat | field
    potm_id: str = ""  # CREX player id of the player of the match

    @property
    def start_date(self) -> date | None:
        return self.start.date() if self.start else None

    @property
    def finished(self) -> bool:
        return self.status.lower() in ("finished", "eventcompleted", "completed", "result")


def _cricsheet_margin(text: str) -> str:
    """'by an innings and 9 runs' -> 'innings 9 runs'; 'by 8 wickets (DLS method)' -> '8 wickets'."""
    t = re.sub(r"\(.*?\)", "", text).strip()
    t = re.sub(r"^(?:by|in)\s+", "", t, flags=re.I)
    t = re.sub(r"^an\s+innings\s+and\s+", "innings ", t, flags=re.I)
    return re.sub(r"\s+", " ", t).strip()


def parse_result(headline: str) -> tuple[str, str, str]:
    """(winner, margin, result) as Cricsheet records them: ('India', '6 wickets', 'win').

    Ties (including ones settled by a super over), draws and no-results have no winner or margin.
    """
    h = (headline or "").strip()
    low = h.lower()
    if "super over" in low or "superover" in low or "tied" in low or low.startswith("tie"):
        return "", "", "tie"
    m = _WON.match(h)
    if m:
        return m.group("w").strip(), _cricsheet_margin(m.group("m")), "win"
    if "drawn" in low or low.startswith("draw"):
        return "", "", "draw"
    if "no result" in low or "abandon" in low or "washed" in low:
        return "", "", "no result"
    return "", "", ""


def _potm_id(html: str) -> str:
    m = _MM.search(html or "")
    return m.group(1) if m else ""


def parse_match_page(html: str, text: str = "", title: str = "", url: str = "") -> PageFacts | None:
    """Pull the verifiable facts out of a rendered CREX match page. None if it does not look like one."""
    m = _LD_EVENT.search(html or "")
    if not m:
        return None
    try:
        ld = json.loads(m.group(1))
    except ValueError:
        return None
    comps = [c.get("name", "") for c in ld.get("competitor", []) if isinstance(c, dict)]
    if len(comps) < 2:
        return None
    start = None
    try:
        start = datetime.fromisoformat(ld["startDate"])
    except (KeyError, ValueError, TypeError):
        pass
    if not title:
        tm = _TITLE.search(html)
        title = re.sub(r"\s+", " ", tm.group(1)).strip() if tm else ld.get("name", "")
    headline = (ld.get("name") or title).split(", ")[0]
    winner, margin, result = parse_result(headline)
    max_overs = None
    toss_winner = toss_decision = ""
    tm = _TOSS.search(html)  # the page's embedded match data: toss team id and 0=bat / 1=field
    if tm:
        toss_decision = "bat" if tm.group(2) == "0" else "field"
        for c in ld.get("competitor", []):
            if isinstance(c, dict) and str(c.get("url", "")).rsplit("-", 1)[-1] == tm.group(1):
                toss_winner = c.get("name", "")
        window = _STATE_TS.findall(html[max(0, tm.start() - 2500):tm.start()])
        if window:
            max_overs = max(float(v) for v in window)
    if text and max_overs is None:
        a = text.find("Match Details")
        b = text.find("Match info", a if a >= 0 else 0)
        seg = text[(a if a >= 0 else 0):(b if b > 0 else 600)][:700]
        vals = [float(v) for v in _OVERS.findall(seg)]
        max_overs = max(vals) if vals else None
        scores = " ".join(seg.split())[:160]
    else:
        scores = ""
    return PageFacts(
        url=ld.get("url") or url, start=start, team_a=comps[0], team_b=comps[1],
        venue=(ld.get("location") or {}).get("name", ""), status=str(ld.get("eventStatus", "")),
        title=title, winner=winner, margin=margin, result=result, max_overs=max_overs, scores=scores,
        toss_winner=toss_winner, toss_decision=toss_decision, potm_id=_potm_id(html))


# ---- strict confirmation -------------------------------------------------------------------------
@dataclass
class Verdict:
    ok: bool
    reasons: list[str] = field(default_factory=list)


def confirm(task, entry: MatchEntry, facts: PageFacts | None, date_window: int = 1) -> Verdict:
    """Strictly decide whether the rendered page ``facts`` is the match ``task`` describes."""
    if facts is None:
        return Verdict(False, ["page did not render a match (no event schema)"])
    why: list[str] = []
    want = date.fromisoformat(task.date)
    if facts.start_date is None:
        why.append("page has no start date")
    elif abs((facts.start_date - want).days) > date_window:
        why.append(f"date {facts.start_date} != {want}")
    if entry.start_date and facts.start_date and entry.start_date != facts.start_date:
        why.append(f"sitemap date {entry.start_date} != page date {facts.start_date}")
    direct = names_match(task.team_a, facts.team_a) and names_match(task.team_b, facts.team_b)
    swapped = names_match(task.team_a, facts.team_b) and names_match(task.team_b, facts.team_a)
    if not (direct or swapped):
        why.append(f"teams '{facts.team_a} v {facts.team_b}' != '{task.team_a} v {task.team_b}'")
    want_fam = task_family(task.match_type)
    if want_fam:
        slug_fam = entry_family(entry)
        if slug_fam and slug_fam != want_fam:
            why.append(f"format {slug_fam} (from slug) != {want_fam} ({task.match_type})")
        elif not slug_fam:
            page_fam = family_from_overs(facts.max_overs)
            # overs are only a hard signal one way: >20 overs is never T20, >50 never a one-dayer,
            # and a short all-out innings cannot prove a one-day match was T20.
            if want_fam == "t20" and facts.max_overs is not None and facts.max_overs > 20.0:
                why.append(f"{facts.max_overs} overs played, not a T20")
            elif want_fam == "50" and page_fam == "multi":
                why.append(f"{facts.max_overs} overs played, not a one-day match")
    if (task.gender == "female") != entry.is_women:
        why.append(f"gender {'women' if entry.is_women else 'men'} != {task.gender}")
    if facts.status and not facts.finished:
        why.append(f"match status is '{facts.status}', not finished")
    return Verdict(not why, why)


# ---- candidate search ----------------------------------------------------------------------------
@dataclass
class LookupResult:
    status: str  # found | not_found | inconclusive
    entry: MatchEntry | None = None
    facts: PageFacts | None = None
    reason: str = ""
    checked: list[str] = field(default_factory=list)  # crex ids rendered and rejected


def candidates_for(task, index: CREXSitemapIndex, skip_ids: set[str] | None = None) -> list[MatchEntry]:
    """Ranked sitemap candidates for ``task``: right day(s), gender, format, plausible teams."""
    want = date.fromisoformat(task.date)
    want_fam = task_family(task.match_type)
    scored: list[tuple[int, int, str, MatchEntry]] = []
    for e in index.matches_on(want, window=1):
        if skip_ids and e.crex_id in skip_ids:
            continue
        if (task.gender == "female") != e.is_women:
            continue
        fam = entry_family(e)
        if want_fam and fam and fam != want_fam:
            continue
        a, b = e.codes
        s_direct = code_plausible(a, task.team_a) + code_plausible(b, task.team_b)
        s_swap = code_plausible(a, task.team_b) + code_plausible(b, task.team_a)
        score = max(s_direct, s_swap)
        if score == 0:
            continue
        day_off = abs(((e.start_date or want) - want).days)
        scored.append((-score, day_off, e.match_id, e))
    scored.sort(key=lambda t: t[:3])
    return [t[3] for t in scored]


def find_match(task, index: CREXSitemapIndex, browser, max_pages: int = 6,
               skip_ids: set[str] | None = None) -> LookupResult:
    """Look ``task`` up on CREX. See module docstring for what 'found' and 'not_found' guarantee."""
    cands = candidates_for(task, index, skip_ids)
    if not cands:
        lo, hi = index.coverage()
        return LookupResult("not_found", reason=f"no CREX match within a day of {task.date} with plausible "
                                                f"teams (sitemap covers {lo}..{hi})")
    confirmed: list[tuple[MatchEntry, PageFacts]] = []
    checked: list[str] = []
    errors: list[str] = []
    for entry in cands[:max_pages]:
        try:
            page = browser.render(entry.url, wait_selector="script#sports-event-schema")
        except Exception as exc:  # network trouble is not evidence the match is absent
            errors.append(f"{entry.crex_id}: {exc}")
            continue
        facts = parse_match_page(page.html, page.text, page.title, entry.url) if page.status < 400 else None
        verdict = confirm(task, entry, facts)
        if verdict.ok:
            confirmed.append((entry, facts))
            break  # first fully confirmed candidate in rank order wins
        checked.append(entry.crex_id)
    if len(confirmed) == 1:
        return LookupResult("found", confirmed[0][0], confirmed[0][1], checked=checked)
    if errors:
        return LookupResult("inconclusive", reason="; ".join(errors)[:300], checked=checked)
    if len(cands) > max_pages:
        return LookupResult("inconclusive", reason=f"{len(cands) - max_pages} candidates left to check",
                            checked=checked)
    return LookupResult("not_found", checked=checked,
                        reason=f"rendered {len(checked)} candidate page(s) for {task.date}; none confirmed")


# ---- facts -> MatchRecord ------------------------------------------------------------------------
def humanize(slug_name: str) -> str:
    return " ".join(w.upper() if w in {"ipl", "icc", "uae", "bbl", "psl", "cpl", "wpl"} else w.capitalize()
                    for w in slug_name.split("-"))


_CRICSHEET_TYPE = {"t20": "T20", "t20i": "T20", "it20": "T20", "odi": "ODI", "odm": "ODM", "lista": "ODM",
                   "test": "Test", "mdm": "MDM", "fc": "MDM", "firstclass": "MDM"}


def cricsheet_match_type(match_type: str, fam: str, international: bool) -> str:
    """Use Cricsheet's own match_type vocabulary: T20, ODI, ODM (domestic one-day), Test, MDM (domestic multi-day)."""
    key = (match_type or "").lower().replace(" ", "").replace("-", "")
    mt = _CRICSHEET_TYPE.get(key) or {"t20": "T20", "50": "ODI", "multi": "Test"}[fam]
    if mt == "ODI" and not international:
        mt = "ODM"
    if mt == "Test" and not international:
        mt = "MDM"
    return mt


def record_from_facts(entry: MatchEntry, facts: PageFacts, match_date: str, match_type: str = "",
                      status: str = "provisional", scorecard=None) -> MatchRecord:
    from .crex_scorecard import event_name, player_rows

    a, b = entry.codes
    intl = _strip_qualifiers(a) in NATIONS and _strip_qualifiers(b) in NATIONS
    fam = entry_family(entry) or family_from_overs(facts.max_overs) or "t20"
    event = humanize(entry.series_name) if entry.series_name else ""
    potm, players = "", []
    match_id = f"crex-{entry.match_id}"
    if scorecard is not None:
        event = event_name(scorecard.series_name) or event
        potm = scorecard.names.get(facts.potm_id, "")
        players = player_rows(scorecard, match_id, match_date)
        canon = {n: next((t for t in (facts.team_a, facts.team_b) if names_match(n, t)), n) for n in scorecard.teams.values()}
        for pl in players:  # use the match page's team names everywhere ('United States' vs 'United States of America')
            pl.team, pl.opponent = canon.get(pl.team, pl.team), canon.get(pl.opponent, pl.opponent)
    return MatchRecord(
        match_id=match_id, date=match_date, match_type=cricsheet_match_type(match_type, fam, intl),
        team_type="international" if intl else "club",
        gender="female" if entry.is_women else "male",
        event=event, venue=facts.venue, team_a=facts.team_a, team_b=facts.team_b,
        toss_winner=facts.toss_winner, toss_decision=facts.toss_decision,
        winner=facts.winner, result=facts.result, result_margin=facts.margin,
        player_of_match=potm, status=status, source="crex", players=players)


def fetch_record(browser, entry: MatchEntry, facts: PageFacts, match_date: str, match_type: str = "",
                 status: str = "provisional") -> MatchRecord:
    """The full Cricsheet-shaped record: match fields plus every player's row from the scorecard page.

    If the scorecard page cannot be read the match is still returned (without players), and the
    next run of Cricsheet's own data replaces it anyway.
    """
    from .crex_scorecard import parse_scorecard

    sc = None
    try:
        page = browser.render(entry.url + "/match-scorecard", marker="getSC4")
        sc = parse_scorecard(page.html) if page.status < 400 else None
    except Exception:
        sc = None
    return record_from_facts(entry, facts, match_date, match_type, status, scorecard=sc)
