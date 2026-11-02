// The match-state table: one row per match with ONE phase (upcoming / live / final), written by a single job and read by the site, so the browser stops
// working the phase out again from sources of different ages. Pure helpers only (no I/O): the writer is scripts/state-sync.mjs, the reader api/state.js.
import { teamKey } from "./lines.js";
import { liveForFixture } from "./live.js";
import { matchPhase } from "./next-match.js";

export const PHASES = ["upcoming", "live", "final"];

/** The row for one match of the live feed (`api/live` body `matches[]`), or null when it has no two sides or no start. Same two sides, format and start day = same row. */
export function stateRow(m) {
  const names = (m?.teams || []).map((t) => t?.name).filter(Boolean);
  if (names.length < 2 || !m?.start || !Number.isFinite(Date.parse(m.start))) return null;
  const [a, b] = names;
  const sides = [teamKey(a), teamKey(b)].sort().join("|");
  return {
    match_key: `${sides}|${m.fmt || ""}|${String(m.start).slice(0, 10)}`, a, b, fmt: m.fmt || "", series: String(m.series || ""), venue: String(m.venue || ""),
    start_utc: new Date(m.start).toISOString(), phase: PHASES.includes(m.status) ? m.status : "upcoming", session: String(m.session || ""),
    summary: String(m.summary || "").slice(0, 160), scores: (m.teams || []).map((t) => ({ name: t.name, display: t.display || "" })),
  };
}

/**
 * The phase of a row the feed no longer lists: a match that was on stays in play for the keep window (24 h, 6 days for a Test: no result is known for it, see `keepUntil`) and is
 * then over; one that never started is still to come. A row already final stays final. The database stamps `final_at` the moment a row turns final (here or in an upsert).
 */
export function settlePhase(row, now = Date.now()) {
  if (row.phase === "final") return "final";
  return matchPhase(row.start_utc, now, undefined, row.fmt);
}

/** A row as the reader gives it to the browser: the same shape as one `matches[]` entry of /api/live (so `liveForFixture` finds it), with the phase as `status`. */
export function toLiveShape(row) {
  const names = [row.a, row.b];
  const scores = Array.isArray(row.scores) ? row.scores : [];
  return {
    teams: names.map((name) => ({ name, ...(scores.find((s) => teamKey(s.name) === teamKey(name))?.display ? { display: scores.find((s) => teamKey(s.name) === teamKey(name)).display } : {}) })),
    start: row.start_utc, fmt: row.fmt, status: row.phase, session: row.session || "", summary: row.summary || "", series: row.series || "", venue: row.venue || "",
    ...(row.phase === "final" && row.final_at ? { final_at: row.final_at } : {}), // when the row turned final: a finished Test goes off the lists 24 h after it (`keepUntil`)
  };
}

/**
 * How one match stands for the lists: its phase (the live feed's word first, then the match-state table's) and, from the table, when it turned final. `finalAt` is given only
 * when the table has the match as final; a missing or stale table (pass null) leaves it out, and `keepUntil` then keeps the match for its clock window as before.
 * `fixture` is { a, b, start, fmt }, as `liveForFixture` takes it.
 */
export function matchEnd(fixture, liveDoc, stateDoc) {
  const m = liveForFixture(liveDoc, fixture), s = liveForFixture(stateDoc, fixture);
  const status = m?.status ?? s?.status;
  return { status, final: status === "final", finalAt: status === "final" && s?.status === "final" ? s.final_at : undefined };
}
