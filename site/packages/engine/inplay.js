// "What happened before from here": the history of innings that were in the same spot as the live one. Pure functions of the data, no DOM, no clock.
// Every number is a count over past matches (never a model): given 60 runs after 6 overs, in how many of the n similar innings did the side go past 150?
// Team innings only read the per-over run tape the data keeps (`ov`, cumulative runs at the end of each completed over); a player's progression is in `player-inplay.js`.
import { selectMatches } from "./markets.js";
import { oversToBalls, teamKey } from "./live.js";
import { suggestLines, summarize } from "./stats.js";

const IT = 0, IR = 1, IW = 2, IB = 3; // innings array layout (see markets.js)
/** Formats with six-ball overs and a tape worth reading: T20, ODI, T10, O60 (index in `FORMATS`). A Test has no over limit, The Hundred counts five-ball sets. */
export const INPLAY_FORMATS = [0, 1, 4, 5];
/** Fewest similar innings a figure is shown without a "small sample" note. */
export const MIN_SAMPLE = 8;
/** How far a past innings' runs at the same point may sit from the live ones to count as "the same spot": 10% of the live runs, at least 4. */
export const BAND = { pct: 0.1, min: 4 };
const MAX_OVERS = { 0: 20, 1: 50, 4: 10, 5: 60 };
/** Each side's last matches in the format that make up the team scope, and how far back the wide scope (every side in the format) reaches. */
export const TEAM_WINDOW = 40, WIDE_YEARS = 3;

/** The runs band for a live score: `[lo, hi]` whole runs. */
export function runsBand(runs, { pct, min } = BAND) {
  const w = Math.max(min, Math.round(runs * pct));
  return [Math.max(0, runs - w), runs + w];
}

/** Checkpoints of an innings: [balls, cumulative runs], from the over tape plus the innings' end. Null when the match kept no tape. */
export function checkpoints(ov, inn) {
  const tape = Array.isArray(ov) ? ov : [];
  if (!tape.length || !inn) return null;
  const pts = [[0, 0], ...tape.map((r, i) => [6 * (i + 1), r])];
  const balls = inn[IB];
  if (balls > pts[pts.length - 1][0] && inn[IR] != null) pts.push([balls, inn[IR]]);
  return pts;
}

/** Runs after `balls` balls, read between checkpoints (a straight line inside an over). Null past the innings' end. */
export function runsAtBalls(pts, balls) {
  if (!pts || !(balls >= 0)) return null;
  const last = pts[pts.length - 1];
  if (balls > last[0]) return null;
  for (let i = 1; i < pts.length; i++) {
    const [b1, r1] = pts[i], [b0, r0] = pts[i - 1];
    if (balls <= b1) return b1 === b0 ? r1 : r0 + ((r1 - r0) * (balls - b0)) / (b1 - b0);
  }
  return last[1];
}

/**
 * Past innings of `ms` that were still batting at `balls` with `runs` within the band at that point. `innNo` 1 or 2 is the innings of the match (batting first or chasing); `team` limits it to
 * that side's own innings (null: whoever batted). Each row is `{ m, k, pts, total, wkts, balls, at }`. An innings that ended before `balls` is not in the spot the live one is in, so it is left out.
 */
export function similarInnings(store, ms, { team = null, innNo = 1, balls, runs, band = runsBand(runs) }) {
  const M = store.M, out = [];
  for (const m of ms) {
    const inn = M.inn?.[m]?.[innNo - 1];
    if (!inn || (team != null && inn[IT] !== team)) continue;
    const pts = checkpoints(M.ov?.[m]?.[innNo - 1], inn);
    const at = runsAtBalls(pts, balls);
    if (at == null || at < band[0] || at > band[1]) continue;
    out.push({ m, k: innNo - 1, pts, total: inn[IR], wkts: inn[IW], balls: inn[IB], at });
  }
  return out;
}

/** The value a target takes in one similar innings: `{kind: "total"}` the innings' final runs, `{kind: "overs", n}` its runs after n overs (the total if it was bowled out sooner). Null if unknown. */
export function targetValue(row, target) {
  if (!target || target.kind === "total") return row.total ?? null;
  const nb = target.n * 6, v = runsAtBalls(row.pts, nb);
  if (v != null) return Math.round(v);
  return (row.wkts || 0) >= 10 ? row.total : null;
}

/**
 * The conditional report for one live innings: `state` is `{ balls, runs }` (balls faced so far and the runs), `target` what the line is on, `line` an optional line to score.
 * `{ n, band, values, summary, ladder, low }`: `summary` has over / under / push counts at `line`, `ladder` the same at five lines around the middle, `low` is true under `MIN_SAMPLE`.
 */
export function conditionalReport(store, ms, { team = null, innNo = 1, state, target = { kind: "total" }, line = null }) {
  const band = runsBand(state.runs);
  const rows = similarInnings(store, ms, { team, innNo, balls: state.balls, runs: state.runs, band });
  const values = rows.map((r) => targetValue(r, target)).filter((v) => v != null);
  const step = target.kind === "overs" ? 2 : 5;
  const lines = suggestLines(values, step, 5);
  return { n: values.length, band, target, state, innNo, values, summary: summarize(values, line), ladder: lines.map((l) => summarize(values, l)), low: values.length < MIN_SAMPLE };
}

/** The most common level (international or not) of a side's recent matches in the format: the wide scope compares like with like. */
export function levelOf(store, team, fmt, gender, last = 10) {
  const ms = selectMatches(store, { fmt, gender, team, lastN: last });
  if (!ms.length) return null;
  const intl = ms.filter((m) => store.M.i[m] === 1).length;
  return intl * 2 >= ms.length ? 1 : 0;
}

/**
 * The two history scopes a live innings is read against: `team` is that side's own last `TEAM_WINDOW` matches in the format, `wide` every match of the format and gender from the last
 * `WIDE_YEARS` years at the side's level. `now` is the clock (ms), given so the function is pure.
 */
export function inplayScopes(store, { fmt, gender, team, now }) {
  const since = new Date(now - WIDE_YEARS * 365.25 * 864e5).toISOString().slice(0, 10);
  const intl = team != null ? levelOf(store, team, fmt, gender) : null;
  return {
    team: team != null ? selectMatches(store, { fmt, gender, team, lastN: TEAM_WINDOW }) : [],
    wide: selectMatches(store, { fmt, gender, since, ...(intl != null ? { intl } : {}) }),
  };
}

/**
 * The innings of a live match that is being batted right now, `{ team, innNo, balls, runs, wkts, overs, max }`, or null: the match is not live, the innings is over (all out, overs used, the other
 * side has begun) or the format has no over limit. Read from the 15 s snapshot (`match.innings`).
 */
export function liveInnings(match, fmtIndex) {
  if (!match || match.status !== "live" || !INPLAY_FORMATS.includes(fmtIndex)) return null;
  const inns = (match.innings || []).filter((i) => i.runs != null);
  if (!inns.length) return null;
  const cur = inns.reduce((a, i) => (i.n > a.n ? i : a), inns[0]);
  const balls = oversToBalls(cur.overs), max = MAX_OVERS[fmtIndex];
  if (balls == null || balls <= 0 || (cur.wkts || 0) >= 10 || cur.overs >= max) return null;
  return { team: cur.team, innNo: Math.min(cur.n, 2), balls, runs: cur.runs, wkts: cur.wkts || 0, overs: cur.overs, max };
}

/** `teamKey` match of the live batting side against the fixture's two sides: its index in `store.teams`, or -1. `sides` is `[[name, index]]`. */
export function sideIndex(sides, name) {
  const hit = (sides || []).find(([n]) => teamKey(n) === teamKey(name));
  return hit ? hit[1] : -1;
}
