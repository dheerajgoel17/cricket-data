// Bookmaker / exchange lines for a player (value_bets/out/book_lines.json): which line is "the" line and how the market prices it.
// All prices are decimal back prices as published; nothing here is computed by a model. Pure functions, unit-tested.
import { SAME_SIDE, canonFmt } from "./util.js";

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
export const SCOPE_LABEL = ["Both innings", "1st innings", "2nd innings"]; // a Test: his two innings combined (the match total), his first, his second

/**
 * Each book's own line and over price for one player and stat, from `bookLinesFor(...).lines`: [{ source, name, line, over, under, best }], one per book, so a row can show who
 * quotes what (books rarely agree on the line). A book that lists several lines gives the one its own prices put closest to evens (a tie goes to the lower line); a book with no
 * over price is left out. Sorted by line, then the higher over price, then name. With 2+ books `best` marks the friendliest quote for the over: the lowest line and, at that line, the
 * highest price (every book tied on both); a lower line at a worse price is still marked, the row shows both numbers.
 */
export function bookQuotes(lines) {
  const far = (q) => Math.abs((overProb(q.over, q.under) ?? 0.5) - 0.5);
  const mine = new Map(), unders = new Map();
  for (const l of lines || []) for (const b of l.books || []) {
    if (!(b.over > 1)) {
      // an exchange's No sits on its own line (under L - 0.5 where its Yes is over L' - 0.5): the friendliest under (the highest line) is shown beside the over
      if (b.under > 1 && !(unders.get(b.source)?.line >= l.line)) unders.set(b.source, { line: l.line, price: b.under });
      continue;
    }
    const q = { source: b.source, name: bookName(b.source), line: l.line, over: b.over, under: b.under > 1 ? b.under : null };
    const cur = mine.get(b.source);
    if (!cur || far(q) < far(cur) - 1e-9 || (Math.abs(far(q) - far(cur)) <= 1e-9 && q.line < cur.line)) mine.set(b.source, q);
  }
  for (const [source, u] of unders) {
    const q = mine.get(source);
    if (q && q.under == null) q.underAt = u;
    else if (!q) mine.set(source, { source, name: bookName(source), line: u.line, over: null, under: u.price, underOnly: true });
  }
  const out = [...mine.values()].sort((a, b) => (a.over == null) - (b.over == null) || a.line - b.line || (b.over ?? 0) - (a.over ?? 0) || a.name.localeCompare(b.name)); // under-only quotes last
  return out.map((q) => ({ ...q, best: out.length > 1 && q.over != null && q.line === out[0].line && q.over === out[0].over }));
}

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
  const scored = mine.filter((l) => l.prob != null), withOver = mine.filter((l) => l.books.some((b) => b.over > 1)); // a line is "the" line by its over: an under-only line (an exchange's No) is never the main one while an over is priced
  const main = (scored.length ? scored : withOver.length ? withOver : mine).reduce((best, l) => (best == null || Math.abs((l.prob ?? 0.5) - 0.5) < Math.abs((best.prob ?? 0.5) - 0.5) - 1e-9 ? l : best), null);
  return { match: ref.match, competition: ref.competition, start_utc: ref.start_utc, team: ref.team, inn, lines: mine, main }; // `team`: the side the book files him under for this match (his profile team can be his country)
}

const startOf = (l) => (l.start_utc ? Date.parse(l.start_utc) : Infinity);

/** The player's lines that are still open (the match has not started more than `graceMs` ago) in this format, every stat and scope. */
function openPlayerLines(doc, pid, fmt, now, graceMs) {
  return (doc?.lines || []).filter((l) => l.pid === pid && l.fmt === fmt && l.books?.length && (!l.start_utc || Date.parse(l.start_utc) > now - graceMs));
}

/** The player's lines that are still open for this stat and format, in every scope. */
function openLines(doc, pid, stat, fmt, now, graceMs) {
  return openPlayerLines(doc, pid, fmt, now, graceMs).filter((l) => l.stat === stat);
}

/**
 * Stats a book prices for this player in this format, on the same match `bookLinesFor` picks. Empty when none
 * (the player page then hides the prop-category chips instead of offering a median line as if it were listed).
 */
export function bookStatsFor(doc, pid, fmt, now = Date.now(), graceMs = 3 * 3600e3) {
  const all = openPlayerLines(doc, pid, fmt, now, graceMs);
  if (!all.length) return [];
  const first = Math.min(...all.map(startOf));
  return [...new Set(all.filter((l) => startOf(l) === first).map((l) => l.stat))];
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
  const k = String(n || "").toLowerCase().replace(/\(w\)|women'?s?|\sw$/g, "").replace(/[^a-z0-9]/g, "");
  return SAME_SIDE[k] || k;
};

const BOOK_WINDOW_MS = 14 * 3600e3;
/** How far a book's start may be from a fixture's: 14 h, but a Test is priced day by day (each day's list carries that day's start), so any day of it is the same match. */
export const bookWindow = (fixture) => (fixture?.fmt === "Test" ? 6 * 86400e3 : BOOK_WINDOW_MS);

function startMs(fixture) {
  if (Number.isFinite(fixture?.startMs)) return fixture.startMs;
  return fixture?.start ? Date.parse(fixture.start) : NaN;
}

function fmtFromText(t) {
  const s = String(t || "").toLowerCase();
  if (/\bt10\b/.test(s) || (/\b10[- ]overs?\b/.test(s) && !/t20/.test(s))) return "T10";
  if (/\bthe hundred\b|\b100[- ]?balls?\b/.test(s)) return "Hundred";
  if (/\b60[- ]overs?\b/.test(s)) return "O60";
  if (/\b40[- ]overs?\b/.test(s)) return "O40";
  if (/\btest\b|first class|first-class/.test(s)) return "Test";
  if (/\bt20\b|twenty20/.test(s)) return "T20";
  if (/\bodi\b|one-day|one day|list a|50[- ]over/.test(s)) return "ODI";
  return "";
}

function sidesOf(line) {
  if (line?.home && line?.away) return [teamKey(line.home), teamKey(line.away)];
  const [p, q] = String(line?.match || "").split(/\s+vs\s+/i);
  return q ? [teamKey(p), teamKey(q)] : ["", ""];
}

/** Format on the line, or inferred from competition text / a player-prop on the same kick-off (fancy rows did not always carry fmt). */
export function lineFmt(line, doc) {
  if (line?.fmt) return canonFmt(line.fmt);
  const fromText = fmtFromText(`${line?.competition || ""} ${line?.league || ""} ${line?.match || ""}`);
  if (fromText) return fromText;
  const start = line?.start_utc, [home] = sidesOf(line);
  if (!start || !home) return "";
  const peer = (doc?.lines || []).find((l) => l.fmt && l.start_utc === start && sidesOf(l).includes(home));
  return peer ? canonFmt(peer.fmt) : "";
}

/** Same two sides, same format, starts within the book window. A T20 in a Test series must not price the Test. */
export function sameFixture(line, fixture, doc) {
  const a = teamKey(fixture?.a), b = teamKey(fixture?.b);
  if (!a || !b) return false;
  const [x, y] = sidesOf(line);
  if (!x || !y || !((x === a && y === b) || (x === b && y === a))) return false;
  const lf = lineFmt(line, doc), ff = canonFmt(fixture?.fmt);
  if (lf && ff && lf !== ff) return false;
  const t = startMs(fixture), u = line?.start_utc ? Date.parse(line.start_utc) : NaN;
  if (!Number.isFinite(t) || !Number.isFinite(u)) return true;
  return Math.abs(t - u) < bookWindow(fixture);
}

/** Which bookmaker sections this fixture can show. `props` = two-sided player lines; `fancy` = match/team totals. */
export function fixtureBooks(doc, fixture) {
  const props = (doc?.lines || []).some((l) => l.books?.length && sameFixture(l, fixture, doc));
  const fancy = (doc?.fancy || []).some((l) => sameFixture(l, fixture, doc));
  return { props, fancy };
}

/**
 * The bookmaker's over/under line(s) for a match fancy market (`doc.fancy`, see src/value_bets/fancy.py) on a fixture: same two teams,
 * same format, start times within the book window. `team` picks a team-total market; omit it for whole-match markets. `inn` is 0 for the whole match
 * (the lines a team's match total is charted against) or 1 / 2 for one innings of a Test: a team's first-innings total is not its match total and never appears among them.
 * Returns [{ line, over, under, source }] sorted by line.
 */
export function fancyFor(doc, fixture, key, team = null, inn = 0) {
  return (doc?.fancy || []).filter((l) => {
    if (l.key !== key || lineScope(l) !== inn || (team ? teamKey(l.team) !== teamKey(team) : l.scope !== "match")) return false;
    return sameFixture(l, fixture, doc);
  }).map((l) => ({ line: l.line, over: l.over, under: l.under, source: l.source })).sort((x, y) => x.line - y.line);
}

/** The best price of a side among the books quoting it, or null when none does (an exchange quotes Yes and No on lines a gap apart, so a line can be one-sided). */
const bestPrice = (books, side) => { const p = books.map((b) => b[side]).filter((x) => x > 1); return p.length ? Math.max(...p) : null; };

/** The lines of a market (from `fancyFor`) as {line, books}: every book that prices it, lowest line first, and per line the best over and the best under among them. */
export function fancyByLine(entries) {
  const by = new Map();
  for (const e of entries || []) by.set(e.line, [...(by.get(e.line) || []), e]);
  return [...by.entries()].sort((x, y) => x[0] - y[0]).map(([line, books]) => ({
    line, books: [...books].sort((x, y) => bookName(x.source).localeCompare(bookName(y.source))),
    over: bestPrice(books, "over"), under: bestPrice(books, "under"),
  }));
}

/**
 * The lines a fancy market's headline shows, from `fancyByLine`: the first line priced on both sides; else, where an exchange quotes Yes and No on lines a gap apart, the first line
 * with an over price and the first with an under price, each on its own line. Either can be null.
 */
export function fancyHeadline(lines) {
  const all = lines || [];
  const two = all.find((l) => l.over != null && l.under != null);
  return { over: two ?? all.find((l) => l.over != null) ?? null, under: two ?? all.find((l) => l.under != null) ?? null };
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
