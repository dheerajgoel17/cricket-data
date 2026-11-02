/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { bookFixtures, fixtureInBooks, liveForFixture } from "@cricket/engine/live.js";
import { archiveFixture, fixtureBooks, keepMsFor, keepUntil, sameFixtureId, teamKey, withArchive } from "@cricket/engine/lines.js";
import { runPlan } from "@cricket/engine/plan.js";
import { matchEnd } from "@cricket/engine/state.js";
import { useData } from "@/lib/data";
import { loadArchive } from "@/lib/feeds";
import { linesQuery } from "@/lib/queries";
import { useLiveDoc, useStateDoc } from "@/hooks/useLive";
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
  const lines = useQuery(linesQuery);
  const listed = (fixtures.data || []).find((f) => f.id === id) ?? (fixtures.data || []).find((f) => sameFixtureId(f.id, id));
  const books = listed ? fixtureBooks(lines.data, listed) : { props: false, fancy: false };
  const need = !fixtures.isLoading && !lines.isLoading && (!listed || (!books.props && !books.fancy));
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

const startMs = (f: any) => Date.parse(f.start.length > 10 ? f.start : `${f.start}T23:59Z`);
const startedSince = (f: any, ms: number, now: number) => (f.start.length > 10 ? f.start : `${f.start}T23:59Z`) >= new Date(now - ms).toISOString();
const multiDay = (f: any) => f.fmt === "Test" || f.fmt === "FC";

/** Fixtures that have not finished yet (4 h grace after the start). */
export const upcomingOnly = (fx: any[], now = Date.now()) => fx.filter((f) => startedSince(f, 4 * 3600e3, now));

/** A fixture's state: the live feed's word for it when it has one, else what the schedule file says (a match that has dropped off the source's page is stored as Completed). */
/** A multi-day match the schedule calls "Completed" at the close of a day, with no result yet, is still on: a finished Test has its result ("won by", "drawn") in the row. */
const betweenDays = (f: any, now: number) => multiDay(f) && f.status === "Completed" && !String(f.result || "").trim() && now < keepUntil(f.fmt, startMs(f));
export const fixtureState = (f: any, live?: string, now = Date.now()): "live" | "final" | "upcoming" => (live === "live" || live === "final" ? live : f.status === "Completed" ? (betweenDays(f, now) ? "live" : "final") : f.status === "Live" ? "live" : "upcoming");

/** Display-only extra: on a quiet day, finished limited-overs matches stay up to 4 days so the rail is not bare (a finished Test is not padded: it goes 24 h after its result). Priced keep is `keepUntil` (24 h / 6 days, a Test with a result 24 h after it ended). */
const QUIET_FILL_MS = 96 * 3600e3;

/**
 * What the home list keeps. Upcoming matches, matches in the first 12 hours (a delay can be long) and matches being played (up to 6 days, for a Test) that the books price; and finished matches,
 * priced or not: 24 hours from the start (a Test with a result: 24 hours after it turned final, `finalAtOf`, 6 days from the start when that is not known), and while fewer than 3 matches are
 * lined up, finished limited-overs matches up to 4 days, so the page never goes bare.
 */
export function shownFixtures(fx: any[], stateOf: (f: any) => string, inBooks: (f: any) => boolean = () => true, now = Date.now(), finalAtOf: (f: any) => string | number | undefined = () => undefined) {
  const active = fx.filter((f) => stateOf(f) !== "final" && (startedSince(f, 12 * 3600e3, now) || (stateOf(f) === "live" && now < keepUntil(f.fmt, startMs(f)))) && inBooks(f));
  const window = active.length >= 3 ? keepMsFor("T20") : QUIET_FILL_MS;
  const finished = fx.filter((f) => stateOf(f) === "final" && ((!multiDay(f) && startedSince(f, window, now)) || now < keepUntil(f.fmt, startMs(f), { final: true, finalAt: finalAtOf(f) })));
  return [...active, ...finished].sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : 0));
}

/** How far ahead an unpriced game still shows (flagged `noProps`). */
export const NO_PROPS_DAYS = 10;

/** Upcoming fixtures: the ones the books price (player props, event markets, or fancy) and, up to `NO_PROPS_DAYS` ahead, the ones they do not (`noProps`).
 *  A fixture matches a feed match when both team names agree (ignoring "(W)"/"Women") and the starts are within 14 h.
 *  With no book feed it falls back to every upcoming fixture (`priced: false`) rather than an empty home page, but only once the feed has been read or given up on:
 *  until then `fixtures` is empty (`ready` false), so the list never shows games the books turn out not to price. */
export function usePricedFixtures() {
  const fx = useFixtures();
  const lines = useQuery(linesQuery);
  const live = useLiveDoc();
  const stateDoc = useStateDoc();
  return useMemo(() => {
    const feed = bookFixtures(lines.data), haveBooks = feed.length > 0;
    const stateOf = (f: any) => fixtureState(f, liveForFixture(live.data, f)?.status);
    const finalAtOf = (f: any) => matchEnd(f, live.data, stateDoc).finalAt; // when the match-state table says a finished match turned final
    const all = shownFixtures(fx.data || [], stateOf, undefined, undefined, finalAtOf);
    const ready = !fx.isLoading && !lines.isLoading;
    const now = Date.now();
    const soon = (f: any) => fixtureStart(f).getTime() < now + NO_PROPS_DAYS * 86400e3;
    // priced games first-class; the unpriced ones in the next days stay on the list, flagged `noProps` ("No props live yet"), as they may be priced later
    const fixtures = !ready ? [] : haveBooks ? shownFixtures(fx.data || [], stateOf, (f) => fixtureInBooks(feed, f) || soon(f), now, finalAtOf).map((f) => (fixtureInBooks(feed, f) ? f : { ...f, noProps: true })) : all;
    const priced = all.filter((f) => fixtureInBooks(feed, f));
    const last = priced.length ? Math.max(...priced.map((f) => fixtureStart(f).getTime())) : 0;
    return { loading: fx.isLoading, ready, all, fixtures, priced: haveBooks, through: priced.length ? new Date(last) : null, feedMatches: feed.length, doc: lines.data };
  }, [fx.data, fx.isLoading, lines.isLoading, lines.data, live.data, stateDoc]);
}
