/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { bookFixtures, fixtureInBooks, liveForFixture } from "@/engine/live.js";
import { runPlan } from "@/engine/plan.js";
import { useData } from "@/lib/data";
import { loadLines } from "@/lib/feeds";
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

const startedSince = (f: any, ms: number, now: number) => (f.start.length > 10 ? f.start : `${f.start}T23:59Z`) >= new Date(now - ms).toISOString();

/** Fixtures that have not finished yet (4 h grace after the start). */
export const upcomingOnly = (fx: any[], now = Date.now()) => fx.filter((f) => startedSince(f, 4 * 3600e3, now));

/** A fixture's state: the live feed's word for it when it has one, else what the schedule file says (a match that has dropped off the source's page is stored as Completed). */
export const fixtureState = (f: any, live?: string): "live" | "final" | "upcoming" => (live === "live" || live === "final" ? live : f.status === "Completed" ? "final" : f.status === "Live" ? "live" : "upcoming");

/**
 * What the home list keeps. Upcoming matches, matches in the first 4 hours and matches being played (up to 6 days, for a Test) that the books price; and finished matches,
 * priced or not: for 36 hours from the start (a day after the end, at least), and while fewer than 3 matches are lined up, up to 4 days, so the page never goes bare.
 */
export function shownFixtures(fx: any[], stateOf: (f: any) => string, inBooks: (f: any) => boolean = () => true, now = Date.now()) {
  const active = fx.filter((f) => stateOf(f) !== "final" && (startedSince(f, 4 * 3600e3, now) || (stateOf(f) === "live" && startedSince(f, 6 * 24 * 3600e3, now))) && inBooks(f));
  const window = active.length >= 3 ? 36 * 3600e3 : 96 * 3600e3;
  const finished = fx.filter((f) => stateOf(f) === "final" && startedSince(f, window, now));
  return [...active, ...finished].sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : 0));
}

/** Upcoming fixtures the books price (player props, event markets, or fancy). Unpriced games stay off the rail.
 *  A fixture matches a feed match when both team names agree (ignoring "(W)"/"Women") and the starts are within 14 h.
 *  With no book feed it falls back to every upcoming fixture (`priced: false`) rather than an empty home page. */
export function usePricedFixtures() {
  const fx = useFixtures();
  const lines = useQuery({ queryKey: ["lines"], queryFn: loadLines, staleTime: 10 * 60_000 });
  const live = useLiveDoc();
  return useMemo(() => {
    const feed = bookFixtures(lines.data), haveBooks = feed.length > 0;
    const stateOf = (f: any) => fixtureState(f, liveForFixture(live.data, f)?.status);
    const all = shownFixtures(fx.data || [], stateOf);
    const fixtures = haveBooks ? shownFixtures(fx.data || [], stateOf, (f) => fixtureInBooks(feed, f)) : all;
    const priced = all.filter((f) => fixtureInBooks(feed, f));
    const last = priced.length ? Math.max(...priced.map((f) => fixtureStart(f).getTime())) : 0;
    return { loading: fx.isLoading, ready: !fx.isLoading && !lines.isLoading, all, fixtures, priced: haveBooks, through: priced.length ? new Date(last) : null, feedMatches: feed.length, doc: lines.data };
  }, [fx.data, fx.isLoading, lines.isLoading, lines.data, live.data]);
}
