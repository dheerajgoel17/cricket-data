"""Team / player name matching between odds sources and the cricket-data history (Cricsheet names)."""
import csv
import re
import unicodedata

from rapidfuzz import fuzz, process

from . import config

WOMEN = re.compile(r"\(w\)|\bwomen'?s?\b|\bladies\b", re.I)
SUFFIX = re.compile(r"\b(t20i?|odi|cricket|cc|xi|men)\b", re.I)


def strip_accents(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def norm_team(s):
    """-> (normalized base name, gender or None)."""
    if not s:
        return "", None
    g = "female" if WOMEN.search(s) else None
    t = WOMEN.sub(" ", s)
    t = SUFFIX.sub(" ", t)
    t = strip_accents(t).lower().replace("&", " and ")
    t = re.sub(r"[^a-z0-9 ]", " ", t)
    return re.sub(r"\s+", " ", t).strip(), g


def _load_map(fname, ncols):
    p = config.MAPPINGS / fname
    out = {}
    if p.exists():
        with open(p) as f:
            for r in csv.reader(f):
                if not r or r[0].startswith("#") or len(r) < ncols:
                    continue
                out[r[0].strip().lower()] = [x.strip() for x in r[1:]]
    return out


class TeamResolver:
    def __init__(self, teams_by_gender):
        """teams_by_gender: {'male': {name: recent_count}, 'female': {...}}"""
        self.teams = teams_by_gender
        self.norm = {g: {norm_team(t)[0]: t for t in ts} for g, ts in teams_by_gender.items()}
        self.map = _load_map("teams.csv", 2)  # raw_name, canonical_name
        self.cache = {}

    def resolve(self, raw, gender="male"):
        if not raw:
            return None
        key = (raw, gender)
        if key in self.cache:
            return self.cache[key]
        res = self._resolve(raw, gender)
        self.cache[key] = res
        return res

    def _resolve(self, raw, gender):
        m = self.map.get(raw.lower())
        if m:
            return m[0]
        base, _ = norm_team(raw)
        cands = self.norm.get(gender, {})
        if base in cands:
            return cands[base]
        # token containment: "queensland bulls" -> "queensland", "boland" -> "boland"
        toks = set(base.split())
        sub = [(n, t) for n, t in cands.items() if n and (set(n.split()) <= toks or toks <= set(n.split()))]
        if len(sub) == 1:
            return sub[0][1]
        if len(sub) > 1:  # prefer the most active team
            sub.sort(key=lambda x: -self.teams[gender].get(x[1], 0))
            if self.teams[gender].get(sub[0][1], 0) >= 3 * max(1, self.teams[gender].get(sub[1][1], 0)):
                return sub[0][1]
            return None
        best = process.extract(base, list(cands), scorer=fuzz.token_set_ratio, limit=2)
        if best and best[0][1] >= 92 and (len(best) < 2 or best[1][1] < best[0][1] - 4):
            return cands[best[0][0]]
        return None


def _tokens(name):
    t = strip_accents(name).replace(".", " ").replace("-", " ")
    return [x for x in re.split(r"\s+", t.strip()) if x]


def _is_initials(tok):
    return tok.isupper() and len(tok) <= 4 and tok.isalpha()


class PlayerResolver:
    def __init__(self, rosters):
        """rosters: {team: [(name, player_id, last_date_str, n_apps)]} (recent players for each canonical team)."""
        self.rosters = rosters
        self.map = _load_map("players.csv", 2)  # raw_name, player_id
        self.cache = {}

    def resolve(self, raw, teams):
        """-> dict(player_id, name, team, score) or None. teams: candidate canonical teams."""
        if not raw:
            return None
        key = (raw, tuple(teams))
        if key not in self.cache:
            self.cache[key] = self._resolve(raw, [t for t in teams if t])
        return self.cache[key]

    def _resolve(self, raw, teams):
        best = self._resolve1(raw, teams)
        if best:
            return best
        rt = _tokens(raw)
        if len(rt) >= 3:  # 'Tanzid Hasan Tamin' -> 'Tanzid Hasan', 'Nurul Hasan Sohan' -> 'Nurul Hasan'
            return self._resolve1(" ".join(rt[:-1]), teams)
        return None

    def _resolve1(self, raw, teams):
        cands = [(t, *p) for t in teams for p in self.rosters.get(t, [])]
        if not cands:
            return None
        m = self.map.get(raw.lower())
        if m:
            for t, name, pid, last, n in cands:
                if pid == m[0]:
                    return dict(player_id=pid, name=name, team=t, score=100)
        rt = _tokens(raw)
        if not rt:
            return None
        rsur = rt[-1].lower()
        scored = []
        for t, name, pid, last, n in cands:
            ct = _tokens(name)
            if not ct:
                continue
            s = 0
            sur_ok = ct[-1].lower() == rsur or (len(rsur) >= 5 and fuzz.ratio(ct[-1].lower(), rsur) >= 88)
            if sur_ok:
                s = 50 if ct[-1].lower() == rsur else 45
                rf, cf = rt[0], ct[0]
                if len(rt) == 1 or len(ct) == 1:
                    s += 0  # surname only: below the accept bar unless mapped in players.csv
                elif rf.lower() == cf.lower():
                    s += 45
                elif _is_initials(rf) and _is_initials(cf):
                    s += 40 if rf == cf else (25 if rf[0] == cf[0] else -30)
                elif _is_initials(rf) or _is_initials(cf):
                    s += 30 if rf[0].upper() == cf[0].upper() else -30
                elif rf[0].lower() == cf[0].lower():
                    s += 15
                else:
                    s -= 30
                if len(rt) > 2 or len(ct) > 2:  # middle names: small fuzzy bonus
                    s += fuzz.token_set_ratio(raw.lower(), name.lower()) / 20
            else:
                f = fuzz.token_sort_ratio(strip_accents(raw).lower(), strip_accents(name).lower())
                if f >= 88:
                    s = f - 30
            if s > 0:
                scored.append((s, n, t, name, pid))
        if not scored:
            return None
        scored.sort(key=lambda x: (-x[0], -x[1]))
        top = scored[0]
        if top[0] < 55:
            return None
        rt0 = rt[0]
        if _is_initials(rt0) and len(rt) >= 2:
            # 'S Verma': an initial + surname is ambiguous if any other roster player shares surname and initial
            same = {pid for t, name, pid, last, n in cands
                    if _tokens(name) and _tokens(name)[-1].lower() == rsur and _tokens(name)[0][0].upper() == rt0[0].upper()}
            if len(same) > 1:
                return None
        if len(scored) > 1 and scored[1][0] >= top[0] - 5 and scored[1][4] != top[4]:
            # same name, two registry ids: accept only a clearly dominant, active one
            if not (scored[1][0] <= top[0] and top[1] >= 5 * max(1, scored[1][1])):
                return None  # ambiguous
        return dict(player_id=top[4], name=top[3], team=top[2], score=round(top[0], 1))
