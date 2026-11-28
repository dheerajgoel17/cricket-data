/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { bookFixtures, fixtureInBooks, liveForFixture, teamTotalsPresent } from "@cricket/engine/live.js";
import { archiveFixture, preMatchBooks, keepMsFor, sameFixtureId, teamKey, withArchive } from "@cricket/engine/lines.js";
import { runPlan } from "@cricket/engine/plan.js";
import { useData } from "@/lib/data";
import { loadArchive } from "@/lib/feeds";
import { linesQuery } from "@/lib/queries";
import { useLinesLive } from "@/hooks/useLinesLive";
import { useLiveDoc } from "@/hooks/useLive";
import { fixtureStart } from "@/lib/format";

/** Runs an engine plan (cached by plan + hints). Every number the pages show comes from this, never from an LLM. */
export function useRunPlan(plan: any, hints: any = {}, enabled = true) {
  const { store, rz } = useData();
  return useQuery({ queryKey: ["plan", JSON.stringify(plan), JSON.stringify(hints)], queryFn: () => runPlan(store, rz, plan, hints) as Promise<any>, enabled });
}

export function useFixtures() {
  const { store } = useData();
  return useQuery({ queryKey: ["fixtures"], queryFn: () => store.loadFixtures() as Promise<any[]> });
}

/**
 * A fixture page's fixture and the bookmaker lines it reads. The schedule's fixture and the live book file when they have it; for a match the schedule no longer lists, or
 * whose lines the book file has let go, the permanent archive file for that fixture id (props are never deleted, so the link keeps working). `archived` says the archive was used.
 */
export function useFixtureBooks(id: string) {
  const { store } = useData();
  const fixtures = useFixtures();
  const lines = useLinesLive();
  const listed = (fixtures.data || []).find((f) => f.id === id) ?? (fixtures.data || []).find((f) => sameFixtureId(f.id, id));
  const books = listed ? preMatchBooks(lines.data, listed) : { props: false, fancy: false };
  const need = !fixtures.isLoading && !lines.isLoading && (!listed || !books.props || !books.fancy);
  const fid = listed?.id ?? id;
  const archive = useQuery({ queryKey: ["archive", fid], enabled: need, queryFn: () => loadArchive(fid), staleTime: Infinity });
  const entry = need ? archive.data ?? null : null;
  return useMemo(() => {
    const teamIx = (name: string, g: string) => {
      const ts: any[] = store.teams || [], gi = g === "female" ? 1 : 0, mine = (t: any) => (t.g ?? 0) === gi;
      const i = ts.findIndex((t) => mine(t) && t.n === name);
      return i >= 0 ? i : ts.findIndex((t) => mine(t) && teamKey(t.n) === teamKey(name));
    };
    return { fx: listed ?? (entry ? archiveFixture(entry, teamIx) : null), doc: entry ? withArchive(lines.data, entry) : lines.data, archived: !!entry,
      isLoading: fixtures.isLoading || (need && archive.isLoading) };
  }, [listed, entry, lines.data, fixtures.isLoading, need, archive.isLoading, store]);
}

const startedSince = (f: any, ms: number, now: number) => (f.start.length > 10 ? f.start : `${f.start}T23:59Z`) >= new Date(now - ms).toISOString();

/** Fixtures that have not finished yet (4 h grace after the start). */
export const upcomingOnly = (fx: any[], now = Date.now()) => fx.filter((f) => startedSince(f, 4 * 3600e3, now));

/**
 * A fixture's state: the live feed's word for it when it has one, else what the schedule file says (a match that has dropped off the source's page is stored as Completed).
 * `started` is a match whose start has passed with no result and no word that play is on: the builder publishes it for a priced match neither the schedule nor the live feed lists
 * (`status: "Started"`), and it is shown as started with no score, never as live. Only the live feed or the schedule's own `Live` makes a match `live`.
 */
export type FixtureState = "live" | "started" | "final" | "upcoming";
/** A multi-day match the schedule calls "Completed" at the close of a day, with no result yet, is still on: a finished Test has its result ("won by", "drawn") in the row. */
const betweenDays = (f: any, now: number) => (f.fmt === "Test" || f.fmt === "FC") && f.status === "Completed" && !String(f.result || "").trim() && startedSince(f, keepMsFor(f.fmt), now);
export const fixtureState = (f: any, live?: string, now = Date.now()): FixtureState => (live === "live" || live === "final" ? live : f.status === "Completed" ? (betweenDays(f, now) ? "live" : "final") : f.status === "Live" ? "live" : f.status === "Started" ? "started" : "upcoming");
/** A match that has begun and has no result: it keeps its place among the ones in play (the keep window, the In play bucket, the rail order) whether or not a score is available. */
const begun = (s: string) => s === "live" || s === "started";

/** Display-only extra: on a quiet day, finished limited-overs matches stay up to 4 days so the rail is not bare. Priced keep is `keepMsFor` (24 h / 6 days). */
const QUIET_FILL_MS = 96 * 3600e3;

/**
 * What the home list keeps. Upcoming matches, matches in the first 12 hours (a delay can be long) and matches being played (up to 6 days, for a Test) that the books price; and finished matches,
 * priced or not: 24 hours from the start (6 days for a Test), and while fewer than 3 matches are lined up, up to 4 days, so the page never goes bare.
 */
export function shownFixtures(fx: any[], stateOf: (f: any) => string, inBooks: (f: any) => boolean = () => true, now = Date.now()) {
  const active = fx.filter((f) => stateOf(f) !== "final" && (startedSince(f, 12 * 3600e3, now) || (begun(stateOf(f)) && startedSince(f, keepMsFor(f.fmt), now))) && inBooks(f));
  const window = active.length >= 3 ? keepMsFor("T20") : QUIET_FILL_MS;
  // `inBooks` / showable applies to finished too (priced + scores), not only active rows.
  const finished = fx.filter((f) => stateOf(f) === "final" && startedSince(f, Math.max(window, keepMsFor(f.fmt)), now) && inBooks(f));
  return [...active, ...finished].sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : 0));
}

/** Books-priced fixtures that the front may list.
 *  Source-only rows stay off. A finished match still needs live/board team totals. A live/started row
 *  with a session interruption (toss/rain delay) or still inside the keep window stays without totals
 *  (pre-first-ball toss or a delay before scores). Upcoming priced matches stay. Empty book feed → empty list.
 *  Archive settle still keeps every priced match off-screen. */
export function usePricedFixtures() {
  const fx = useFixtures();
  const lines = useQuery(linesQuery);
  const live = useLiveDoc();
  return useMemo(() => {
    const feed = bookFixtures(lines.data), haveBooks = feed.length > 0;
    const stateOf = (f: any) => fixtureState(f, liveForFixture(live.data, f)?.status);
    const all = shownFixtures(fx.data || [], stateOf);
    const ready = !fx.isLoading && !lines.isLoading;
    const now = Date.now();
    const showable = (f: any) => {
      if (!fixtureInBooks(feed, f)) return false;
      const st = stateOf(f);
      if (st === "upcoming") return true;
      const hit = liveForFixture(live.data, f);
      if (hit?.session || ((st === "live" || st === "started") && startedSince(f, keepMsFor(f.fmt), now))) return true;
      return teamTotalsPresent(hit);
    };
    const fixtures = !ready || !haveBooks ? [] : shownFixtures(fx.data || [], stateOf, showable, now);
    const priced = all.filter((f) => fixtureInBooks(feed, f));
    const last = priced.length ? Math.max(...priced.map((f) => fixtureStart(f).getTime())) : 0;
    return { loading: fx.isLoading, ready, all, fixtures, priced: haveBooks, through: priced.length ? new Date(last) : null, feedMatches: feed.length, doc: lines.data };
  }, [fx.data, fx.isLoading, lines.isLoading, lines.data, live.data]);
}
