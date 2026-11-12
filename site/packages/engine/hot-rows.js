// Hot props rows: one priced line scored against the player's history (hit rate over the last 5 / 10 games, this year, against the opponent, at the ground). One definition, used by the
// phone's scoring loop (mobile/src/lib/hot.ts), by the build-time script that publishes the result (site/scripts/hot-rows.mjs, docs/PROJECT_GUIDE.md 5.11) and by the phone again to read
// that file back (`seedRow`). Plain ESM, no DOM. Every number is the engine's (`runPlan`, `windowRate`); nothing here is a model.
import { bookLinesFor, bookQuotes, keepMsFor, lineScope, sameFixture } from "./lines.js";
import { venueStem } from "./markets.js";
import { runPlan } from "./plan.js";
import { barState, windowRate } from "./windows.js";

export const norm = (n) => String(n || "").toLowerCase().replace(/\(w\)|women'?s?|\sw$/g, "").replace(/[^a-z0-9]/g, "");

/** One chip per match: a Test's day-by-day book starts share a chip; a limited-overs line groups by UTC date so two books a few minutes apart are one fixture, not two kick-offs. */
export function matchChipId(match, start, fmt) {
  const [a, b] = String(match).split(/\s+vs\s+/i);
  const pair = [norm(a), norm(b)].sort().join("|");
  const day = String(start || "").slice(0, 10);
  return fmt === "Test" || fmt === "FC" ? `${pair}|${fmt}` : `${pair}|${day}`;
}

/** A live line is a row of its own beside the pre-match one (that stays: it is the bet we settle). */
export const isLiveLine = (l) => !!l.books?.some((x) => x.live);

/** One row per player, stat, match, innings scope and kind of line (pre-match or live): the key a scored row is kept under. */
export const lineKey = (l) => `${l.pid}|${l.stat}|${l.fmt}|${matchChipId(l.match, l.start_utc, l.fmt)}|${lineScope(l)}|${isLiveLine(l) ? "live" : ""}`;

/** The lines of a doc grouped by match chip, for `bookLinesFor` (a line is priced against the books of its own match only). */
export function groupByChip(lines) {
  const by = new Map();
  for (const x of lines) { const c = matchChipId(x.match, x.start_utc, x.fmt); (by.get(c) ?? by.set(c, []).get(c)).push(x); }
  return by;
}

/** The books' view of one line (`bookLinesFor`), from only the lines of its own match and kind. Null when no book has it. */
export function booksOf(l, byChip, now) {
  const chip = matchChipId(l.match, l.start_utc, l.fmt);
  return bookLinesFor({ lines: (byChip.get(chip) ?? []).filter((x) => isLiveLine(x) === isLiveLine(l)) }, l.pid, l.stat, l.fmt, now, keepMsFor(l.fmt), lineScope(l));
}

/** The opponent of the line's team in "A vs B". */
export function opponentOf(match, team) {
  const [a, c] = String(match).split(/\s+vs\s+/i);
  return norm(team) === norm(a) ? c : a;
}

/** What the history says about a line: window rates, the last ten bars and, once the match itself is in the data, its result. `entries` are the player's games from the plan's chart. */
export function historyOf({ entries, line, opp, venue, startUtc, year }) {
  const l5 = windowRate(entries, 5, line), l10 = windowRate(entries, 10, line);
  const season = windowRate(entries.filter((e) => String(e.date).startsWith(year)), 0, line);
  const h2h = windowRate(entries.filter((e) => norm(e.opp) === norm(opp)), 0, line);
  const ven = windowRate(venue ? entries.filter((e) => venueStem(e.venueName) === venueStem(venue)) : [], 0, line); // his games at the match's ground (the data spells a ground several ways)
  const last = entries.slice(-10).map((e) => ({ v: e.value, s: barState(e, line) }));
  // once the match itself is in the data its result is his latest game: same opponent, within a day of the start
  const lastE = entries[entries.length - 1];
  const settled = lastE && norm(lastE.opp) === norm(opp) && Math.abs(Date.parse(String(lastE.date)) - Date.parse(String(startUtc).slice(0, 10))) <= 86400e3 ? lastE.value : undefined;
  return { l5, l10, season, h2h, ven, last, max: Math.max(line * 1.5, ...last.map((x) => x.v ?? 0), 1), settled };
}

/** The part of a row that comes from the player's history: what a published file keeps per line, and all a phone needs to skip scoring it. */
export const HISTORY_FIELDS = ["idx", "name", "line", "prior", "opp", "venue", "l5", "l10", "season", "h2h", "ven", "last", "max", "settled"];

/** The venue of a line's fixture, from the schedule. */
export const venueOf = (b, l, fixtures) => String((fixtures || []).find((f) => sameFixture({ match: b.match, start_utc: b.start_utc, fmt: l.fmt }, f))?.venue || "");

/** The row: the line's own fields (book names, quotes, prices) and a history. `day` is the viewer's, so it is not here. */
export function rowOf({ store, l, b, idx, hist, venue, opp }) {
  const main = b.main;
  const over = Math.max(...main.books.map((x) => x.over || 0)), under = Math.max(...main.books.map((x) => x.under || 0));
  return {
    comp: String(b.competition || l.competition || ""), idx, pid: l.pid, inn: lineScope(l),
    name: /^[0-9a-f]{8}$/.test(store.playerName(idx)) ? l.book_name || store.playerName(idx) : store.playerName(idx), bookName: l.book_name || "", team: l.team, opp, stat: l.stat, line: main.line,
    fmt: l.fmt, match: b.match, start: b.start_utc, over, under, quotes: bookQuotes(b.lines), l5: hist.l5, l10: hist.l10, season: hist.season, h2h: hist.h2h, ven: hist.ven, venue, prior: main.prob ?? null, edge: null,
    last: hist.last, settled: hist.settled, stored: l.result ?? null, max: hist.max,
  };
}

/** Score one line from scratch (the player's files must be loaded: `await store.shard(...)`). Null when the player or his games are not in the data. */
export async function scoreLine({ store, rz, l, byChip, fixtures, now, year }) {
  const idx = store.P.id.indexOf(l.pid);
  const b = booksOf(l, byChip, now);
  if (idx < 0 || !b) return null;
  const main = b.main, inn = lineScope(l);
  const r = await runPlan(store, rz, { kind: "player_prop", stat: l.stat, line: main.line, side: "over", filters: { format: l.fmt, team_innings: inn || null, innings: null }, split_by: [] }, { playerIdx: idx });
  const entries = r?.ok ? r.chart?.entries || [] : [];
  if (!entries.length) return null;
  const opp = opponentOf(b.match, l.team), venue = venueOf(b, l, fixtures);
  return rowOf({ store, l, b, idx, venue, opp, hist: historyOf({ entries, line: main.line, opp, venue, startUtc: b.start_utc, year }) });
}

/** The history of a row, as a file keeps it. */
export const historyRecord = (row) => Object.fromEntries(HISTORY_FIELDS.map((k) => [k, row[k]]));

/**
 * A row from a published history and the line's own books, without the player's files or the plan: null when the published line is not the one the books lead with now (the price moved the
 * main line), the player is not in the phone's data or the history is for another build of the data; the caller then scores it from scratch.
 */
export function seedRow({ store, l, b, rec }) {
  if (!rec || !b || rec.line !== b.main.line) return null;
  if (store && store.P.id[rec.idx] !== l.pid) return null;
  return rowOf({ store: store ?? { playerName: () => rec.name }, l, b, idx: rec.idx, venue: rec.venue, opp: rec.opp, hist: rec });
}
