// The Match Fancy edge as plain functions of the data (no DOM, no clock of its own): one definition for the site (Match Fancy tab, /fancy cards) and for the server step that picks
// the pre-match edges worth announcing (site/scripts/fancy-alerts.mjs). Every number is the history of the two sides over a line the books list, through `sideEdge` (stats.js).
import { fancyByLine, fancyFor, fancyHeadline, fixtureBooks, lineProb } from "./lines.js";
import { marketReport, oversN, selectMatches, teamOversReport, teamTotalReport, venueIndices } from "./markets.js";
import { shrunkProb, sideEdge } from "./stats.js";
import { FORMATS } from "./util.js";

/** [market key, short label] of the whole-match and team-total markets the Match Fancy tab shows, in its order (a key a book prices that is not here is not scored). */
export const MATCH_KEYS = [["match_runs", "Total runs"], ["first_innings_runs", "1st innings"], ["first_over", "1st over"], ["overs_5", "5 overs"], ["overs_6", "6 overs"], ["overs_10", "10 overs"], ["overs_15", "15 overs"],
  ["match_sixes", "Sixes"], ["match_fours", "Fours"], ["match_boundaries", "Boundaries"], ["match_wickets", "Wickets"], ["match_50s", "50s"], ["match_30s", "30s"],
  ["match_extras", "Extras"], ["match_runouts", "Run outs"], ["match_ducks", "Ducks"], ["highest_over", "Top over"], ["max_wickets", "Most wickets"], ["top_score", "Top score"], ["top_batter", "Top batter"]];
export const TEAM_KEYS = [["team_total_runs", "Runs"], ["overs_1", "1st over"], ["overs_5", "5 overs"], ["overs_6", "6 overs"], ["overs_10", "10 overs"], ["overs_15", "15 overs"],
  ["team_total_sixes", "Sixes"], ["team_total_fours", "Fours"], ["team_total_boundaries", "Boundaries"], ["team_total_wickets", "Wickets lost"],
  ["team_total_extras", "Extras"], ["team_total_runouts", "Run outs"], ["team_total_ducks", "Ducks"], ["team_total_highest_over", "Top over"], ["top_batter", "Top batter"]];
export const FANCY_INNS = [0, 1, 2]; // 0 = the whole match (or the side's match total); 1 / 2 = that side's own 1st / 2nd innings (a Test)
/** Each side's last matches a market is scored on, and the last matches at the ground. */
export const WINDOW = 20, GROUND_WINDOW = 10;
/** Fewest matches at the ground the "at the ground" figure says anything about. */
export const GROUND_MIN = 3;

/** What to announce (an alert is stricter than the site's list, which shows every edge from ten played games): at least `MIN_EDGE` and at most `MAX_EDGE` (an edge that large nearly always means a stale line or rules the history was not scored on), from `MIN_GAMES` played, `PER_MATCH` at most. */
export const ALERT = { MIN_EDGE: 0.15, MAX_EDGE: 0.6, MIN_GAMES: 15, PER_MATCH: 3 };

/** A market scored over matches `ms` at `line`: `scope` -1 is the whole match, a team index that side's total (a session of overs, or one innings with `inn`). */
export function scoreMarket(store, ms, scope, k, line, inn = 0) {
  const n = oversN(k);
  if (n && scope >= 0) return teamOversReport(store, ms, scope, n, line, inn);
  return scope < 0 ? marketReport(store, ms, k, line) : teamTotalReport(store, ms, scope, k, line, inn);
}
/** True when every book line of a team's match total is one that voids if that side bowls first: then only the matches where it batted first count. */
export const batFirstBooked = (entries, inn, scope) => inn === 0 && scope >= 0 && entries.length > 0 && entries.every((e) => e.bat_first);
export const firstInnsMs = (store, ms, scope) => ms.filter((m) => store.M.fi[m] === scope);

/**
 * One market's row: the book's line(s) and best prices, each side's edge (`sideEdge` of its hit rate over `ms` pulled toward the market's no-vig chance) and the better side, the same line at
 * the ground, and the last ten results against the line. `hits` / `played` / `chance` are that better side's record and shrunk chance. Null when the books list nothing or no match is scored.
 */
export function marketRow({ store, doc, fxInfo, ms, scope, teamName, key: k, ground, inn = 0 }) {
  const booked = fancyFor(doc, fxInfo, k, teamName, inn);
  const all = fancyByLine(booked);
  // the first line both sides are priced on; else (an exchange quotes Yes and No on lines a gap apart) the first line with an over price and the first with an under price, each on its own line
  const { over: lo, under: lu } = fancyHeadline(all), b = lo ?? lu;
  if (!b) return null;
  const batFirst = batFirstBooked(booked, inn, scope);
  const sample = batFirst ? firstInnsMs(store, ms, scope) : ms;
  const groundSample = batFirst && ground ? firstInnsMs(store, ground, scope) : ground;
  const run = (line) => scoreMarket(store, sample, scope, k, line, inn);
  const so = lo ? run(lo.line).summary : null, su = lu ? run(lu.line).summary : null, base = so ?? su;
  if (!base || !base.n) return null;
  const po = lo ? lineProb(lo.books) : null, pu = lu && lineProb(lu.books) != null ? 1 - lineProb(lu.books) : null;
  const eo = lo && so ? sideEdge(so.over, so.over + so.under, po, lo.over) : null;
  const eu = lu && su ? sideEdge(su.under, su.over + su.under, pu, lu.under) : null;
  const side = (eu ?? -9) > (eo ?? -9) ? "under" : "over";
  const src = (l, sd) => (l && l[sd] != null ? l.books.find((x) => x[sd] === l[sd])?.source : undefined);
  const shownBooks = [...new Map([...(lo?.books ?? []), ...(lu?.books ?? [])].map((x) => [x.source, x])).values()];
  const rep = run(b.line);
  // the same line scored on the matches at the ground alone: how the market has gone there (a ground can sit far from the sides' form)
  const gs = groundSample && groundSample.length >= GROUND_MIN ? scoreMarket(store, groundSample, scope, k, b.line, inn).summary : null;
  const at = gs && gs.n >= GROUND_MIN ? { n: gs.n, over: gs.over, under: gs.under, side: gs.under > gs.over ? "under" : "over" } : null;
  const mine = side === "over" ? so : su, hits = mine ? (side === "over" ? mine.over : mine.under) : 0, played = mine ? mine.over + mine.under : 0;
  return { key: k, inn, scope, team: teamName, batFirst, line: b.line, overLine: lo?.line ?? null, underLine: lu?.line ?? null, over: lo?.over ?? null, under: lu?.under ?? null, books: shownBooks,
    overBook: src(lo, "over"), underBook: src(lu, "under"), side, edge: side === "over" ? eo : eu, hits, played, chance: shrunkProb(hits, played, side === "over" ? po : pu),
    at, last: rep.values.slice(-10).map((v) => ({ v, s: v > b.line ? "hit" : v < b.line ? "miss" : "push" })) };
}

/** `marketRow` for each of `keys` (market keys; "top_batter" is a list, not a line), the best edge first. `inn` 1 or 2 is that side's own innings, scored only on that turn, never mixed into the match total. */
export function overviewRows({ store, doc, fxInfo, ms, scope, teamName, keys, ground, inn = 0 }) {
  if (!ms.length || !doc) return [];
  const rows = keys.filter((k) => k !== "top_batter").flatMap((k) => marketRow({ store, doc, fxInfo, ms, scope, teamName, key: k, ground, inn }) ?? []);
  return rows.sort((x, y) => (y.edge ?? -9) - (x.edge ?? -9));
}

/** Whole-match markets plus each side's team totals, including a Test's own 1st/2nd innings lines, best edge first. `teams` is [[name, team index]] of the two sides. */
export function fancyOverview({ store, doc, fxInfo, ms, teams, ground }) {
  const rows = [
    ...overviewRows({ store, doc, fxInfo, ms, scope: -1, teamName: null, keys: MATCH_KEYS.map(([k]) => k), ground }),
    ...teams.filter(([, i]) => i >= 0).flatMap(([name, i]) => FANCY_INNS.flatMap((inn) => overviewRows({ store, doc, fxInfo, ms, scope: i, teamName: name, keys: TEAM_KEYS.map(([k]) => k), ground, inn }))),
  ];
  return rows.sort((x, y) => (y.edge ?? -9) - (x.edge ?? -9));
}

/** The matches a fixture's lines are scored on: each side's last `WINDOW` in the format, and the last `GROUND_WINDOW` at the ground (the data spells one ground several ways). `f` is a schedule row. */
export function fancyInputs(store, f) {
  const fmt = FORMATS.indexOf(f.fmt), gender = f.gender === "female" ? 1 : 0;
  const ms = [...new Set([f.a_ix, f.b_ix].filter((i) => i >= 0).flatMap((i) => selectMatches(store, { fmt, gender, team: i, lastN: WINDOW })))].sort((x, y) => x - y);
  const venue = venueIndices(store, f.venue);
  const ground = venue.length ? selectMatches(store, { fmt, gender, venue, lastN: GROUND_WINDOW }) : undefined;
  return { ms, ground, teams: [[f.a, f.a_ix], [f.b, f.b_ix]] };
}

const r4 = (x) => Math.round(x * 1e4) / 1e4;
/** "2026-11-01 13:40 IST" for a time in ms: the same spelling the pipeline's alert file uses. */
export const istLabel = (ms) => `${new Date(ms + 330 * 60e3).toISOString().slice(0, 16).replace("T", " ")} IST`;

/**
 * The pre-match fancy edges worth announcing, for `fixtures` (schedule rows) against the book file `doc`: for each match that has not started (the schedule gives a time), has both sides in
 * the data and has fancy lines listed, the market rows from `fancyOverview` whose better side clears `ALERT` (edge, played games), best edge first and `ALERT.PER_MATCH` per match.
 * Each carries a stable `alert_id` (the match, the market, the team, the innings and the side, not the line: a line that moves is the same alert) and the side's own line and best price.
 */
export function fancyEdgeAlerts({ store, doc, fixtures, now = Date.now() }) {
  const out = [];
  for (const f of fixtures || []) {
    const start = String(f?.start || "").length > 10 ? Date.parse(f.start) : NaN;
    if (!(start > now) || !(f.a_ix >= 0) || !(f.b_ix >= 0) || f.noProps || !fixtureBooks(doc, f).fancy) continue;
    const fxInfo = { a: f.a, b: f.b, fmt: f.fmt, startMs: start }, id = f.id || `${f.start}|${f.a}|${f.b}`;
    const rows = fancyOverview({ store, doc, fxInfo, ...fancyInputs(store, f) })
      .filter((r) => r.edge != null && r.edge >= ALERT.MIN_EDGE && r.edge <= ALERT.MAX_EDGE && r.played >= ALERT.MIN_GAMES);
    for (const r of rows.slice(0, ALERT.PER_MATCH)) {
      const over = r.side === "over";
      out.push({ alert_id: [id, r.key, r.team || "", r.inn, r.side].join("|"), fixture_id: f.id || null, match: `${f.a} vs ${f.b}`, format: f.fmt, series: f.series || "", start_utc: new Date(start).toISOString().replace(/\.\d+Z$/, "Z"), start_ist: istLabel(start),
        key: r.key, team: r.team, inn: r.inn, side: r.side, line: over ? r.overLine : r.underLine, best_odds: over ? r.over : r.under, best_source: over ? r.overBook : r.underBook,
        hits: r.hits, played: r.played, window: WINDOW, chance: r4(r.chance), edge: r4(r.edge), edge_pct: Math.round(r.edge * 1000) / 10, bat_first: r.batFirst });
    }
  }
  return out.sort((a, b) => b.edge - a.edge || (a.alert_id < b.alert_id ? -1 : a.alert_id > b.alert_id ? 1 : 0));
}
