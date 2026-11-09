// The in-play line log as plain functions (no fetch, no clock, no DOM): which lines of a round are worth a row, and what a row holds. DATA ONLY: nothing here feeds settlement, the archive or the site.
// A row is written when a line (one book, market, subject, innings and line) FIRST APPEARS or its prices MOVE, and when a line comes back after a round in which its book was listed without it
// (the main line often moves away and back); a repeated identical read writes nothing. Every market the feed gives is kept, including the ones the site hides.
// Each row carries the match's score at that moment (from /api/live: the batting side, innings, runs / wickets / overs, and for a batter line his own runs and balls). Writes live in site/scripts/inplay-log.mjs.
import { namesMatch, oversToBalls, teamKey } from "./live.js";
import { FEED_BOOK, sameTeam } from "./inplay-lines.js";

const HOURS_3 = 3 * 3600e3;
const clean = (s) => String(s ?? "").trim().replace(/\s+/g, " ");
const low = (s) => clean(s).toLowerCase();
const num = (v) => (v == null || v === "" || !Number.isFinite(+v) ? null : +v);

/** The two sides as one key, whichever way round: "australia|india". */
export const pairOf = (a, b) => [teamKey(a), teamKey(b)].filter(Boolean).sort().join("|");
/** The market's name as the book lists it (a batter's and a side's innings markets are rebuilt from the parts the reader split). */
export const marketName = (l) => (l.kind === "player_runs" ? `${l.player} Innings Runs` : l.kind === "team_runs" ? `${l.team} ${l.inn}${["st", "nd", "rd"][l.inn - 1] || "th"} Inns Runs` : String(l.market || ""));
const subjectOf = (l) => (l.kind === "player_runs" ? l.player : l.kind === "team_runs" ? l.team : null);

/** What a line says, for change detection: both prices, or every outcome with its price. Two reads with the same text are the same read. */
export function sigOf(l) {
  if (l.kind === "pick") return (l.outcomes || []).map((o) => `${o.label}~${o.sub || ""}~${o.price}`).join(";");
  return `${num(l.over ?? l.over_price) ?? ""}|${num(l.under ?? l.under_price) ?? ""}`;
}

/** The identity of a line, whatever its price: book, kind, market (or subject), innings scope and line. */
export const lineKeyOf = (l, inn) => [low(l.book || FEED_BOOK), l.kind, low(subjectOf(l) || l.market), inn || 0, l.line ?? ""].join("|");

// ---------- the score at that moment ----------

/** The live match (a `/api/live` match) for a feed match: the same two sides, and a start within 3 hours when both have one. The one that is live wins. */
export function liveMatchOf(liveDoc, m) {
  const near = (s) => { const x = Date.parse(s), y = Date.parse(m.kickoff); return !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x - y) <= HOURS_3; };
  const hits = (liveDoc?.matches || []).filter((x) => {
    const [a, b] = (x.teams || []).map((t) => t.name);
    return a && b && ((sameTeam(a, m.home) && sameTeam(b, m.away)) || (sameTeam(a, m.away) && sameTeam(b, m.home))) && near(x.start);
  });
  return hits.find((x) => x.status === "live") || hits[0] || null;
}

/** The innings being played: the last one that has a score, of the batting side when the page says which side that is. */
function currentInnings(lm) {
  const inns = (lm.innings || []).filter((i) => i.runs != null);
  const bat = (lm.teams || []).find((t) => t.batting);
  const mine = bat ? inns.filter((i) => sameTeam(i.team, bat.name)) : [];
  const pool = mine.length ? mine : inns;
  return pool[pool.length - 1] || null;
}

/**
 * A batter in the card, latest innings first: where he is listed (batting, or yet to bat), his side, and his own row when he has batted. Falls back to the match page's not-out pair when the card is not there.
 * `inn` is his side's own innings number (1, or 1 / 2 in a Test): the position of that innings among the side's innings on the card.
 */
export function batterOf(lm, name) {
  const card = lm.card || [];
  for (let k = card.length - 1; k >= 0; k--) {
    const ci = card[k];
    const row = (ci.batters || []).find((p) => namesMatch(p.name, name));
    if (row || (ci.yetToBat || []).some((n) => namesMatch(n, name))) {
      const inn = card.filter((x) => sameTeam(x.team, ci.team)).indexOf(ci) + 1;
      return { side: ci.team, inn: inn || 1, runs: row ? num(row.runs) : 0, balls: row ? num(row.balls) : 0 };
    }
  }
  const p = (lm.players || []).find((x) => x.runs != null && namesMatch(x.name, name));
  if (!p) return null;
  const begun = (lm.innings || []).filter((i) => i.runs != null && sameTeam(i.team, p.team)).length;
  return { side: p.team, inn: begun || 1, runs: num(p.runs), balls: num(p.balls) };
}

/**
 * The score state a line is logged with, from the live match (null when it has none): `{ inn, score }`.
 * `inn` is the line's innings scope (a team_runs line carries its own; a batter's is his side's current innings), `score` the columns of the row.
 */
export function scoreState(lm, l, asOf = null) {
  const none = { inn: l.kind === "team_runs" ? l.inn : null, score: {} };
  if (!lm) return none;
  const cur = currentInnings(lm), bat = (lm.teams || []).find((t) => t.batting);
  const ctx = {};
  for (const [k, v] of Object.entries({ status: lm.status, display: bat?.display, summary: lm.summary, crr: lm.crr, rrr: lm.rrr, partnership: lm.partnership })) if (v != null && v !== "") ctx[k] = v;
  const score = {
    score_at: asOf, cur_inn: cur?.n ?? null, bat_team: bat?.name ?? cur?.team ?? null,
    runs: num(cur?.runs), wkts: num(cur?.wkts), overs: num(cur?.overs), inn_balls: cur?.overs != null ? oversToBalls(cur.overs) : null,
    b_runs: null, b_balls: null, session: lm.session || null, ctx: Object.keys(ctx).length ? ctx : null,
  };
  let inn = none.inn;
  if (l.kind === "player_runs") {
    const b = batterOf(lm, l.player);
    if (b) { inn = b.inn; score.b_runs = b.runs; score.b_balls = b.balls; }
  }
  return { inn, score, fmt: lm.fmt || null };
}

// ---------- change detection ----------

/**
 * Where a run stands: the last logged signature of every line (`last`: match key -> line key -> sig, read back from the log at the start of a run and advanced as rows are written),
 * the lines each book listed in the previous round (`seen`) and the match keys known so far (`known`).
 */
export function createState() {
  return { last: new Map(), seen: new Map(), known: [], loaded: new Set() };
}

/** The sides (pair keys) of these matches that the state has not read back from the log yet. */
export const pairsToLoad = (state, matches) => [...new Set(matches.map((m) => pairOf(m.home, m.away)).filter((p) => p && !state.loaded.has(p)))];

/** Takes the log's latest rows (`inplay_log_latest`) for these pairs into the state. */
export function ingest(state, pairs, rows) {
  for (const p of pairs) state.loaded.add(p);
  for (const r of rows) {
    if (!state.known.some((k) => k.match_key === r.match_key)) state.known.push({ match_key: r.match_key, pair: r.pair, kickoff: r.kickoff || null });
    let m = state.last.get(r.match_key);
    if (!m) state.last.set(r.match_key, (m = new Map()));
    m.set(r.line_key, sigOf(r));
  }
}

/** The match's key: an earlier one of the same two sides (a start within 3 hours, or no start on either side), else a new one that this first row fixes for the match. */
export function matchKeyOf(state, m, at) {
  const pair = pairOf(m.home, m.away), t = Date.parse(m.kickoff);
  const hit = state.known.find((k) => k.pair === pair && (!Number.isFinite(t) || !Number.isFinite(Date.parse(k.kickoff)) || Math.abs(Date.parse(k.kickoff) - t) <= HOURS_3));
  if (hit) return hit.match_key;
  const key = `${pair}@${Number.isFinite(t) ? new Date(t).toISOString() : `seen ${String(at).slice(0, 10)}`}`;
  state.known.push({ match_key: key, pair, kickoff: Number.isFinite(t) ? new Date(t).toISOString() : null });
  return key;
}

/**
 * One round: `matches` as `mergeMatches` gives them (started matches with their lines), `liveDoc` the `/api/live` body (or null), `at` the round's time (ISO).
 * Returns `{ rows, unchanged, skipped, commit, listed }`: the rows to insert, and `commit(n)` that records the first n as the latest values once they are in (a row that did not go in is found as a change again next round).
 * Matches whose pair is not loaded from the log yet (`pairsToLoad`) are skipped: writing them blind would repeat every line.
 */
export function planRound(state, matches, liveDoc, at) {
  const rows = [], pending = [], seenNow = new Map();
  let unchanged = 0, skipped = 0;
  for (const m of matches) {
    const pair = pairOf(m.home, m.away);
    if (!pair || !state.loaded.has(pair)) { skipped++; continue; }
    const key = matchKeyOf(state, m, at), lm = liveMatchOf(liveDoc, m);
    const was = state.last.get(key) || new Map(), prev = state.seen.get(key) || new Map(), now = new Map(), dup = new Set();
    for (const l of m.lines || []) {
      const book = clean(l.book || FEED_BOOK), st = scoreState(lm, l, liveDoc?.asOf || null), lk = lineKeyOf({ ...l, book }, st.inn);
      if (dup.has(lk)) continue;
      dup.add(lk);
      if (!now.has(book)) now.set(book, new Set());
      now.get(book).add(lk);
      const sig = sigOf(l), before = was.get(lk), listed = prev.get(book);
      const back = before !== undefined && listed && listed.size > 0 && !listed.has(lk); // its book was listed last round without it
      if (before === sig && !back) { unchanged++; continue; }
      rows.push({
        at, match_key: key, pair, home: clean(m.home), away: clean(m.away), league: clean(m.league), kickoff: Number.isFinite(Date.parse(m.kickoff)) ? new Date(m.kickoff).toISOString() : null, fmt: st.fmt ?? null,
        book, kind: l.kind, market: clean(marketName(l)), subject: subjectOf(l) ? clean(subjectOf(l)) : null, line_key: lk, inn: st.inn ?? null,
        line: l.kind === "pick" ? null : num(l.line), over_price: l.kind === "pick" ? null : num(l.over), under_price: l.kind === "pick" ? null : num(l.under), outcomes: l.kind === "pick" ? l.outcomes || [] : null,
        score_at: null, cur_inn: null, bat_team: null, runs: null, wkts: null, overs: null, inn_balls: null, b_runs: null, b_balls: null, session: null, ctx: null, ...st.score,
      });
      pending.push([key, lk, sig]);
    }
    seenNow.set(key, now);
  }
  return {
    rows, unchanged, skipped,
    /** Records the first `count` rows (all by default) as the latest values: call it with how many the insert wrote. */
    commit(count = rows.length) {
      for (const [key, lk, sig] of pending.slice(0, count)) {
        let m = state.last.get(key);
        if (!m) state.last.set(key, (m = new Map()));
        m.set(lk, sig);
      }
    },
    /** The lines each book listed this round, kept for the next one (call whether or not the insert worked: it is only about what was listed). */
    listed() { for (const [key, now] of seenNow) state.seen.set(key, now); },
  };
}
