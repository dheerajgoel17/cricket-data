/* eslint-disable @typescript-eslint/no-explicit-any */
// The Home rail's order, built from the shared pieces: engine matching (`live.js`, `lines.js`) and the ranking in site/src/lib/priority.ts.
// The composition below mirrors `usePricedFixtures` (site/src/hooks/useEngine.ts) and `useHomeRail` (site/src/hooks/useHomeRail.ts), which are
// React hooks and cannot be imported. Phase 1 moves it into the engine so there is one copy; until then a change to those two files needs the same change here.
import { fixtureInBooks, bookFixtures, liveForFixture } from "@cricket/engine/live.js";
import { keepMsFor } from "@cricket/engine/lines.js";
import { arrangeFixtures, DEFAULT_RAIL, rankFixtures, type RailConfig, type RailState } from "@site/lib/priority";

/** How far ahead an unpriced game still shows (flagged `noProps`). */
export const NO_PROPS_DAYS = 10;
const NO_PROPS_LIMIT = 24;
/** Upcoming priced matches this far ahead stay on the rail. */
export const SHOW_AHEAD_MS = 10 * 86400e3;
/** Display-only extra: on a quiet day, finished limited-overs matches stay up to 4 days so the rail is not bare. */
const QUIET_FILL_MS = 96 * 3600e3;

export const fixtureStart = (f: { start: string }) => (f.start.length > 10 ? new Date(f.start) : new Date(`${f.start}T12:00:00`));

const startedSince = (f: any, ms: number, now: number) => (f.start.length > 10 ? f.start : `${f.start}T23:59Z`) >= new Date(now - ms).toISOString();

/** A multi-day match the schedule calls "Completed" at the close of a day, with no result yet, is still on. */
const betweenDays = (f: any, now: number) => (f.fmt === "Test" || f.fmt === "FC") && f.status === "Completed" && !String(f.result || "").trim() && startedSince(f, keepMsFor(f.fmt), now);

/** A fixture's state: the live feed's word for it when it has one, else what the schedule file says. */
export const fixtureState = (f: any, live?: string, now = Date.now()): RailState =>
  live === "live" || live === "final" ? live : f.status === "Completed" ? (betweenDays(f, now) ? "live" : "final") : f.status === "Live" ? "live" : "upcoming";

export function shownFixtures(fx: any[], stateOf: (f: any) => string, inBooks: (f: any) => boolean = () => true, now = Date.now()) {
  const active = fx.filter((f) => stateOf(f) !== "final" && (startedSince(f, 12 * 3600e3, now) || (stateOf(f) === "live" && startedSince(f, keepMsFor(f.fmt), now))) && inBooks(f));
  const window = active.length >= 3 ? keepMsFor("T20") : QUIET_FILL_MS;
  const finished = fx.filter((f) => stateOf(f) === "final" && startedSince(f, Math.max(window, keepMsFor(f.fmt)), now));
  return [...active, ...finished].sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : 0));
}

/** Finished matches the rail still shows: 24 hours from the start (6 days for a Test). Newest first. */
export const keepFinished = (finished: any[], now = Date.now()) =>
  finished.filter((f) => Date.parse(f.start) > now - keepMsFor(f.fmt)).sort((a, b) => Date.parse(b.start) - Date.parse(a.start));

export interface RailItem { fixture: any; state: RailState; live: any | null; noProps: boolean }

/**
 * The rail in display order: matches in play, then those starting within 24 hours, then later games up to 10 days, then finished ones (`rankFixtures` / `arrangeFixtures`);
 * games the books price first, the unpriced ones after.
 */
export function buildRail({ fixtures, lines, live, rail = DEFAULT_RAIL, home = null, now = Date.now() }: { fixtures: any[]; lines: any; live: any; rail?: RailConfig; home?: string | null; now?: number }): RailItem[] {
  const feed = bookFixtures(lines);
  const stateOf = (f: any) => fixtureState(f, liveForFixture(live, f)?.status, now);
  const soon = (f: any) => fixtureStart(f).getTime() < now + NO_PROPS_DAYS * 86400e3;
  const list = feed.length
    ? shownFixtures(fixtures, stateOf, (f) => fixtureInBooks(feed, f) || soon(f), now).map((f) => (fixtureInBooks(feed, f) ? f : { ...f, noProps: true }))
    : shownFixtures(fixtures, stateOf, () => true, now);
  const ranked = rankFixtures(list, home, stateOf, rail);
  const priced = ranked.filter((f) => !f.noProps);
  const arranged = arrangeFixtures(keepFinished(priced.filter((f) => stateOf(f) === "final"), now).concat(priced.filter((f) => stateOf(f) !== "final")), stateOf, home, rail, now);
  const upcoming = new Set(arranged.filter((f) => stateOf(f) === "upcoming" && Date.parse(f.start) < now + SHOW_AHEAD_MS));
  const shown = arranged.filter((f) => stateOf(f) !== "upcoming" || upcoming.has(f));
  return [...shown, ...ranked.filter((f) => f.noProps).slice(0, NO_PROPS_LIMIT)].map((f) => ({ fixture: f, state: stateOf(f), live: liveForFixture(live, f), noProps: !!f.noProps }));
}
