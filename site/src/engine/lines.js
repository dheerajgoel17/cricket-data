// Bookmaker / exchange lines for a player (value_bets/out/book_lines.json): which line is "the" line and how the market prices it.
// All prices are decimal back prices as published; nothing here is computed by a model. Pure functions, unit-tested.
import { canonFmt } from "./util.js";

export const BOOK_NAMES = { moviodds_bet365: "bet365", smarkets: "Smarkets", betfair: "Betfair", matchbook: "Matchbook", polymarket: "Polymarket" };
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

/**
 * The lines on offer for this player and stat in this format, for the nearest match that has not started more than `graceMs` ago.
 * Returns null when there are none, else { match, competition, start_utc, lines: [{line, books, prob}], main } where `main` is the line
 * priced closest to evens (the line a book hangs as "the" line), ties going to the lower line.
 */
export function bookLinesFor(doc, pid, stat, fmt, now = Date.now(), graceMs = 3 * 3600e3) {
  const all = (doc?.lines || []).filter((l) => l.pid === pid && l.stat === stat && l.fmt === fmt && l.books?.length
    && (!l.start_utc || Date.parse(l.start_utc) > now - graceMs));
  if (!all.length) return null;
  const startOf = (l) => (l.start_utc ? Date.parse(l.start_utc) : Infinity);
  const first = Math.min(...all.map(startOf));
  const mine = all.filter((l) => startOf(l) === first).map((l) => ({ line: l.line, books: l.books, prob: lineProb(l.books) }))
    .sort((a, b) => a.line - b.line);
  const ref = all.find((l) => startOf(l) === first);
  const scored = mine.filter((l) => l.prob != null);
  const main = (scored.length ? scored : mine).reduce((best, l) => (best == null || Math.abs((l.prob ?? 0.5) - 0.5) < Math.abs((best.prob ?? 0.5) - 0.5) - 1e-9 ? l : best), null);
  return { match: ref.match, competition: ref.competition, start_utc: ref.start_utc, lines: mine, main };
}

/** Team-name key shared by the schedule and the bookmaker feed: case, "(W)" / "Women" and punctuation ignored. */
export const teamKey = (n) => String(n || "").toLowerCase().replace(/\(w\)|women'?s?/g, "").replace(/[^a-z0-9]/g, "");

const BOOK_WINDOW_MS = 14 * 3600e3;

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

/** Same two sides, same format, starts within 14 h. Missing times or a format clash never match — a T20 in a Test series must not price the Test. */
function sameFixture(line, fixture, doc) {
  const a = teamKey(fixture?.a), b = teamKey(fixture?.b);
  if (!a || !b) return false;
  const [x, y] = sidesOf(line);
  if (!x || !y || !((x === a && y === b) || (x === b && y === a))) return false;
  const lf = lineFmt(line, doc), ff = canonFmt(fixture?.fmt);
  if (lf && ff && lf !== ff) return false;
  const t = startMs(fixture), u = line?.start_utc ? Date.parse(line.start_utc) : NaN;
  if (!Number.isFinite(t) || !Number.isFinite(u)) return false;
  return Math.abs(t - u) < BOOK_WINDOW_MS;
}

/** Which bookmaker sections this fixture can show. `props` = two-sided player lines; `fancy` = match/team totals. */
export function fixtureBooks(doc, fixture) {
  const props = (doc?.lines || []).some((l) => l.books?.length && sameFixture(l, fixture, doc));
  const fancy = (doc?.fancy || []).some((l) => sameFixture(l, fixture, doc));
  return { props, fancy };
}

/**
 * The bookmaker's over/under line(s) for a match fancy market (`doc.fancy`, see src/value_bets/fancy.py) on a fixture: same two teams,
 * same format, start times within 14 h (books and the schedule disagree on kick-off). `team` picks a team-total market; omit it for
 * whole-match markets. Returns [{ line, over, under, source }] sorted by line.
 */
export function fancyFor(doc, fixture, key, team = null) {
  return (doc?.fancy || []).filter((l) => {
    if (l.key !== key || (team ? teamKey(l.team) !== teamKey(team) : l.scope !== "match")) return false;
    return sameFixture(l, fixture, doc);
  }).map((l) => ({ line: l.line, over: l.over, under: l.under, source: l.source })).sort((x, y) => x.line - y.line);
}
