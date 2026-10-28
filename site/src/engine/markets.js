// Match-level "fancy" markets for team and venue pages. Computed from the per-innings aggregates in matches.json.
import { summarize, fairOdds, suggestLines } from "./stats.js";
import { norm, round } from "./util.js";

// innings array layout (see src/cricket_site/parse.py INN_FIELDS)
const [IT, IR, IW, IB, IF4, IF6, I30, I50, I100, I10, ISD, IDK, IHO, IMC, ITS, ITOP] = Array.from({ length: 16 }, (_, i) => i);
const sum = (inn, k) => inn.reduce((s, x) => s + x[k], 0);

export const MATCH_MARKETS = {
  match_runs: { label: "Match total runs", get: (s, m) => sum(s.M.inn[m], IR) },
  match_wickets: { label: "Match wickets", get: (s, m) => sum(s.M.inn[m], IW) },
  match_fours: { label: "Match fours", get: (s, m) => sum(s.M.inn[m], IF4) },
  match_sixes: { label: "Match sixes", get: (s, m) => sum(s.M.inn[m], IF6) },
  match_boundaries: { label: "Match boundaries (4s + 6s)", get: (s, m) => sum(s.M.inn[m], IF4) + sum(s.M.inn[m], IF6) },
  first_innings_runs: { label: "1st innings score", get: (s, m) => s.M.inn[m][0]?.[IR] ?? 0 },
  match_30s: { label: "Match 30s (30-49)", get: (s, m) => sum(s.M.inn[m], I30) },
  match_50s: { label: "Match 50s (50-99)", get: (s, m) => sum(s.M.inn[m], I50) },
  match_100s: { label: "Match 100s", get: (s, m) => sum(s.M.inn[m], I100) },
  match_double_digits: { label: "Double-digit scores (10+)", get: (s, m) => sum(s.M.inn[m], I10) },
  match_single_digits: { label: "Single-digit scores (1-9, no ducks)", get: (s, m) => sum(s.M.inn[m], ISD) },
  match_ducks: { label: "Ducks", get: (s, m) => sum(s.M.inn[m], IDK) },
  highest_over: { label: "Highest single over (runs)", get: (s, m) => s.M.ho[m] },
  max_conceded: { label: "Most runs conceded by a bowler", get: (s, m) => s.M.mc[m] },
  top_score: { label: "Top batter's score", get: (s, m) => s.M.ts[m] },
};

// Team-specific markets: the innings of the team batting first only.
const first = (k) => (s, m) => s.M.inn[m][0][k];
export const TEAM_MARKETS = {
  team_runs: { label: "Team total (batting first)", get: first(IR) },
  team_wickets: { label: "Wickets lost (batting first)", get: first(IW) },
  team_fours: { label: "Team fours (batting first)", get: first(IF4) },
  team_sixes: { label: "Team sixes (batting first)", get: first(IF6) },
  team_30s: { label: "Team 30s (batting first)", get: first(I30) },
  team_50s: { label: "Team 50s (batting first)", get: first(I50) },
  team_double_digits: { label: "Team double-digit scores (batting first)", get: first(I10) },
  team_single_digits: { label: "Team single-digit scores (batting first)", get: first(ISD) },
  team_ducks: { label: "Team ducks (batting first)", get: first(IDK) },
  team_top_score: { label: "Team top batter's score (batting first)", get: first(ITS) },
  team_highest_over: { label: "Team highest over (batting first)", get: first(IHO) },
};

// A team's own innings in the match, whichever side batted first: the basis of the books' "Team total" markets (the TEAM_MARKETS above are
// batting-first only). Test and multi-innings matches add the team's innings together.
export const TEAM_TOTAL_MARKETS = {
  team_total_runs: { label: "Team total runs", keys: [IR] },
  team_total_wickets: { label: "Team wickets lost", keys: [IW] },
  team_total_fours: { label: "Team fours", keys: [IF4] },
  team_total_sixes: { label: "Team sixes", keys: [IF6] },
  team_total_boundaries: { label: "Team boundaries (4s + 6s)", keys: [IF4, IF6] },
};

export const ALL_MARKETS = { ...MATCH_MARKETS, ...TEAM_MARKETS };

/**
 * Matches that pass the filters AND are valid for summary markets (exchange void rules, see rules.js).
 * filters: { fmt (required), gender, team, opp, venue, since, until, intl, event[], lastN, teamFirst (only matches the team batted first) }
 */
export function selectMatches(store, f) {
  const M = store.M;
  const out = [];
  const venues = f.venue == null ? null : Array.isArray(f.venue) ? f.venue : [f.venue];
  for (let m = 0; m < store.n; m++) {
    if (M.f[m] !== f.fmt || M.pv[m] || M.q[m] !== 1) continue;
    if (f.gender != null && M.g[m] !== f.gender) continue;
    if (f.since && M.d[m] < f.since) continue;
    if (f.until && M.d[m] > f.until) continue;
    if (f.intl != null && M.i[m] !== f.intl) continue;
    if (f.event && !f.event.includes(M.e[m])) continue;
    if (venues && !venues.includes(M.v[m])) continue;
    if (f.team != null) {
      if (M.a[m] !== f.team && M.b[m] !== f.team) continue;
      if (f.opp != null && (M.a[m] === f.team ? M.b[m] : M.a[m]) !== f.opp) continue;
      if (f.teamFirst && M.fi[m] !== f.team) continue;
      if (f.venueType) {
        if (store.venueType(m, f.team) !== f.venueType) continue;
      }
    } else if (f.opp != null) continue;
    out.push(m);
  }
  return f.lastN > 0 ? out.slice(-f.lastN) : out;
}

/**
 * The store's venue indexes for a fixture's venue name ("Sharjah Cricket Stadium, Sharjah"): the data holds one ground under several spellings (with or without the city,
 * "Cricket Association Stadium"), so venues match on the name before the comma with "association" dropped. [] when the fixture has no venue or the data has no such ground.
 */
export function venueIndices(store, name) {
  const want = venueStem(name);
  if (!want) return [];
  return store.venues.flatMap((v, i) => (venueStem(v) === want ? [i] : []));
}

/** A ground's name for comparing: the part before the comma, "association" dropped, case and punctuation ignored. */
export const venueStem = (v) => norm(String(v ?? "").split(",")[0].replace(/\bassociation\b/i, ""));

export function marketReport(store, ms, key, line = null) {
  const def = ALL_MARKETS[key];
  const values = ms.map((m) => def.get(store, m));
  const sum_ = summarize(values, line);
  const lines = key === "match_runs" || key === "team_runs" ? ladderAround(sum_.median, 10) : suggestLines(values, 1, 5);
  return { key, label: def.label, n: values.length, summary: sum_, ladder: lines.map((l) => summarize(values, l)), values };
}

/** Per-match values of a team-total market for `team` over the matches `ms`. */
export function teamTotalValues(store, ms, team, key) {
  const { keys } = TEAM_TOTAL_MARKETS[key];
  return ms.map((m) => store.M.inn[m].filter((i) => i[IT] === team).reduce((t, i) => t + keys.reduce((a, k) => a + i[k], 0), 0));
}

/** Same shape as marketReport, for a team-total market. */
export function teamTotalReport(store, ms, team, key, line = null) {
  const values = teamTotalValues(store, ms, team, key);
  const sum_ = summarize(values, line);
  const lines = key === "team_total_runs" ? ladderAround(sum_.median, 10) : suggestLines(values, 1, 5);
  return { key, label: TEAM_TOTAL_MARKETS[key].label, n: values.length, summary: sum_, ladder: lines.map((l) => summarize(values, l)), values };
}

function ladderAround(med, step) {
  if (med == null) return [];
  const base = Math.round(med / step) * step + 0.5;
  return [-2, -1, 0, 1, 2].map((i) => round(base + i * step, 1));
}

/**
 * Who tops the batting card: frequency of each player scoring the highest score in (a) the whole match or
 * (b) the team's innings when batting first. Ties are reported separately (dead-heat rules differ by book).
 */
export function topBatters(store, ms, { team = null, scope = "match" } = {}) {
  const tally = new Map();
  let n = 0;
  for (const m of ms) {
    const inns = store.M.inn[m];
    let tops = [];
    if (scope === "team") {
      const i0 = inns[0];
      if (!i0 || (team != null && i0[IT] !== team)) continue;
      tops = i0.slice(ITOP);
    } else {
      const best = store.M.ts[m];
      for (const i of inns) if (i[ITS] === best) tops.push(...i.slice(ITOP));
    }
    n++;
    for (const p of tops) {
      const c = tally.get(p) || { sole: 0, tied: 0 };
      tops.length === 1 ? c.sole++ : c.tied++;
      tally.set(p, c);
    }
  }
  const rows = [...tally.entries()].map(([p, c]) => ({ player: p, name: store.playerName(p), sole: c.sole, tied: c.tied,
    pSole: round(c.sole / n, 4), fairSole: fairOdds(c.sole / n) })).sort((a, b) => b.sole + b.tied - (a.sole + a.tied));
  return { n, rows: rows.slice(0, 15) };
}
