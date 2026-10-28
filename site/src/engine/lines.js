// Bookmaker / exchange lines for a player (value_bets/out/book_lines.json): which line is "the" line and how the market prices it.
// All prices are decimal back prices as published; nothing here is computed by a model. Pure functions, unit-tested.
import { SAME_SIDE } from "./util.js";

export const BOOK_NAMES = { bet365: "bet365", smarkets: "Smarkets", betfair: "Betfair", matchbook: "Matchbook", polymarket: "Polymarket" };
export const bookName = (src) => BOOK_NAMES[src] || src;

/** The market's no-vig probability of the over, from one book's two prices (null if either is missing). */
export function overProb(over, under) {
  if (!(over > 1) || !(under > 1)) return null;
  const a = 1 / over, b = 1 / under;
  return a / (a + b);
}

/** Average no-vig over-probability across the books pricing a line. */
export function lineProb(books) {
  const ps = books.map((b) => overProb(b.over, b.under)).filter((p) => p != null);
  return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null;
}

/** The scope of a line: 0 for the whole match (every line published before innings lines existed), 1 or 2 for the player's own side's first or second innings (a Test only). */
export const lineScope = (l) => l?.inn || 0;
export const SCOPE_LABEL = ["Match", "1st innings", "2nd innings"];

/**
 * The lines on offer for this player and stat in this format, for the nearest match that has not started more than `graceMs` ago, in one scope. `inn` is 0 for the
 * whole match's lines (the default: what every caller that does not chart one innings wants), 1 or 2 for a Test's first or second innings: a first-innings line is a
 * different bet from a match total and is never mixed into it. The match is the nearest one any scope prices, so the scopes of one page are always one match's.
 * Returns null when there are none, else { match, competition, start_utc, lines: [{line, books, prob}], main } where `main` is the line priced closest to evens
 * (the line a book hangs as "the" line), ties going to the lower line.
 */
export function bookLinesFor(doc, pid, stat, fmt, now = Date.now(), graceMs = 3 * 3600e3, inn = 0) {
  const all = openLines(doc, pid, stat, fmt, now, graceMs);
  if (!all.length) return null;
  const first = Math.min(...all.map(startOf));
  const here = all.filter((l) => startOf(l) === first && lineScope(l) === inn);
  if (!here.length) return null;
  const mine = here.map((l) => ({ line: l.line, books: l.books, prob: lineProb(l.books) })).sort((a, b) => a.line - b.line);
  const ref = here[0];
  const scored = mine.filter((l) => l.prob != null);
  const main = (scored.length ? scored : mine).reduce((best, l) => (best == null || Math.abs((l.prob ?? 0.5) - 0.5) < Math.abs((best.prob ?? 0.5) - 0.5) - 1e-9 ? l : best), null);
  return { match: ref.match, competition: ref.competition, start_utc: ref.start_utc, inn, lines: mine, main };
}

const startOf = (l) => (l.start_utc ? Date.parse(l.start_utc) : Infinity);

/** The player's lines that are still open (the match has not started more than `graceMs` ago) for this stat and format, in every scope. */
function openLines(doc, pid, stat, fmt, now, graceMs) {
  return (doc?.lines || []).filter((l) => l.pid === pid && l.stat === stat && l.fmt === fmt && l.books?.length && (!l.start_utc || Date.parse(l.start_utc) > now - graceMs));
}

/**
 * The scopes the books price this player's stat in, for the same match `bookLinesFor` picks: a sorted list of 0 (the whole match), 1 and 2 (a Test's first and second
 * innings). Empty when there are no lines. The player page offers a switch between them.
 */
export function bookScopesFor(doc, pid, stat, fmt, now = Date.now(), graceMs = 3 * 3600e3) {
  const all = openLines(doc, pid, stat, fmt, now, graceMs);
  if (!all.length) return [];
  const first = Math.min(...all.map(startOf));
  return [...new Set(all.filter((l) => startOf(l) === first).map(lineScope))].sort((a, b) => a - b);
}

/**
 * The format the books have a line out for this player in (the nearest match that has not started more than `graceMs` ago; lines for `stat` first), or null.
 * A player page with no format in its link opens on this one, so a Test-priced batter is not shown in T20 where no book has a line.
 */
export function bookFormatFor(doc, pid, stat = "", now = Date.now(), graceMs = 3 * 3600e3) {
  const open = (doc?.lines || []).filter((l) => l.pid === pid && l.books?.length && (!l.start_utc || Date.parse(l.start_utc) > now - graceMs));
  const pool = stat && open.some((l) => l.stat === stat) ? open.filter((l) => l.stat === stat) : open;
  if (!pool.length) return null;
  return pool.reduce((a, l) => (startOf(l) < startOf(a) ? l : a)).fmt;
}

/** Team-name key shared by the schedule and the bookmaker feed: case, "(W)" / "Women" and punctuation ignored. */
export const teamKey = (n) => {
  const k = String(n || "").toLowerCase().replace(/\(w\)|women'?s?/g, "").replace(/[^a-z0-9]/g, "");
  return SAME_SIDE[k] || k;
};

const BOOK_WINDOW_MS = 14 * 3600e3;

function startMs(fixture) {
  if (Number.isFinite(fixture?.startMs)) return fixture.startMs;
  return fixture?.start ? Date.parse(fixture.start) : NaN;
}

/** Same two sides, starts within 14 h. Player lines use `match`; fancy uses home/away. */
export function sameFixture(line, fixture) {
  const a = teamKey(fixture?.a), b = teamKey(fixture?.b);
  if (!a || !b) return false;
  let x = "", y = "";
  if (line?.home && line?.away) { x = teamKey(line.home); y = teamKey(line.away); }
  else {
    const [p, q] = String(line?.match || "").split(/\s+vs\s+/i);
    if (!q) return false;
    x = teamKey(p); y = teamKey(q);
  }
  if (!((x === a && y === b) || (x === b && y === a))) return false;
  const t = startMs(fixture), u = line?.start_utc ? Date.parse(line.start_utc) : NaN;
  if (!Number.isFinite(t) || !Number.isFinite(u)) return true;
  return Math.abs(t - u) < BOOK_WINDOW_MS;
}

/** Which bookmaker sections this fixture can show. `props` = two-sided player lines; `fancy` = match/team totals. */
export function fixtureBooks(doc, fixture) {
  const props = (doc?.lines || []).some((l) => l.books?.length && sameFixture(l, fixture));
  const fancy = (doc?.fancy || []).some((l) => sameFixture(l, fixture));
  return { props, fancy };
}

/**
 * The bookmaker's over/under line(s) for a match fancy market (`doc.fancy`, see src/value_bets/fancy.py) on a fixture: same two teams, start
 * times within 14 h (books and the schedule disagree on kick-off). `team` picks a team-total market; omit it for whole-match markets. `inn` is 0 for the whole match
 * (the lines a team's match total is charted against) or 1 / 2 for one innings of a Test: a team's first-innings total is not its match total and never appears among them.
 * Returns [{ line, over, under, source }] sorted by line.
 */
export function fancyFor(doc, fixture, key, team = null, inn = 0) {
  const a = teamKey(fixture.a), b = teamKey(fixture.b);
  return (doc?.fancy || []).filter((l) => {
    if (l.key !== key || lineScope(l) !== inn || (team ? teamKey(l.team) !== teamKey(team) : l.scope !== "match")) return false;
    const h = teamKey(l.home), w = teamKey(l.away);
    if (!((h === a && w === b) || (h === b && w === a))) return false;
    return !l.start_utc || !fixture.startMs || Math.abs(Date.parse(l.start_utc) - fixture.startMs) < 14 * 3600e3;
  }).map((l) => ({ line: l.line, over: l.over, under: l.under, source: l.source })).sort((x, y) => x.line - y.line);
}

/** The lines of a market (from `fancyFor`) as {line, books}: every book that prices it, lowest line first, and per line the best over and the best under among them. */
export function fancyByLine(entries) {
  const by = new Map();
  for (const e of entries || []) by.set(e.line, [...(by.get(e.line) || []), e]);
  return [...by.entries()].sort((x, y) => x[0] - y[0]).map(([line, books]) => ({
    line, books: [...books].sort((x, y) => bookName(x.source).localeCompare(bookName(y.source))),
    over: Math.max(...books.map((b) => b.over)), under: Math.max(...books.map((b) => b.under)),
  }));
}

/** A fixture id as the schedule makes it (start date + team slugs): the only thing the archive is asked for, so a link cannot name another path. */
export const isFixtureId = (id) => /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/.test(String(id));

/**
 * The fixture an archive file (value_bets/archive, see src/value_bets/archive.py) stands for: the schedule row it was filed with, else one made from the books' own names.
 * `teamIx(name, gender)` gives the data's index for a team (-1 if unknown). A match that began long ago (12 h; 6 days for a Test) is Completed.
 */
export function archiveFixture(entry, teamIx, now = Date.now()) {
  if (!entry?.id) return null;
  const [pa, pb] = String(entry.match || "").split(/\s+vs\s+/i);
  const f = entry.fixture || { start: entry.start_utc, fmt: entry.lines?.[0]?.fmt || "", gender: /\(w\)|women/i.test(entry.match || "") ? "female" : "male", a: pa, b: pb, venue: "", series: entry.competition || "" };
  const age = now - Date.parse(f.start);
  return { ...f, id: entry.id, a_ix: teamIx?.(f.a, f.gender) ?? -1, b_ix: teamIx?.(f.b, f.gender) ?? -1, status: age > (f.fmt === "Test" ? 6 * 86400e3 : 12 * 3600e3) ? "Completed" : "", result: "", source: "archive" };
}

/**
 * The book doc with an archived match's lines and fancy lines added, for the sections that match has none of in the doc (the live file lets a match go a day and a half
 * after the start; the archive keeps it for good). Lines come back with the match, competition and start the file holds once, and with `result` when the file stored what
 * the player did (`results`, written by the server once the match was over): an old fixture page then needs no live feed and no name matching. `events` are left out: they
 * decide which fixtures the home page lists, and an old match must not come back there.
 */
export function withArchive(doc, entry) {
  const fx = archiveFixture(entry);
  if (!fx) return doc;
  const have = fixtureBooks(doc, fx), shared = { match: entry.match, competition: entry.competition, start_utc: entry.start_utc };
  const rkey = (x) => `${x.pid}|${x.stat}|${lineScope(x)}`; // a first-innings result is not the match total's
  const done = new Map((entry.results || []).map((r) => [rkey(r), r.value]));
  const archived = (l) => (done.has(rkey(l)) ? { ...l, ...shared, result: done.get(rkey(l)) } : { ...l, ...shared });
  return { ...doc, lines: have.props ? doc?.lines : [...(doc?.lines || []), ...(entry.lines || []).map(archived)], fancy: have.fancy ? doc?.fancy : [...(doc?.fancy || []), ...(entry.fancy || [])] };
}
