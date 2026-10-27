/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { bookFixtures, fixtureInBooks } from "@/engine/live.js";
import { runPlan } from "@/engine/plan.js";
import { useData } from "@/lib/data";
import { loadLines } from "@/lib/feeds";
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

/** Fixtures that have not finished yet (4 h grace after the start). */
export const upcomingOnly = (fx: any[]) => { const cut = new Date(Date.now() - 4 * 3600e3).toISOString(); return fx.filter((f) => (f.start.length > 10 ? f.start : `${f.start}T23:59Z`) >= cut); };

/** Upcoming fixtures the books price (player props, event markets, or fancy). Empty ESPN games stay off the rail.
 *  A fixture matches a feed match when both team names agree (ignoring "(W)"/"Women") and the starts are within 14 h.
 *  With no book feed it falls back to every upcoming fixture (`priced: false`) rather than an empty home page. */
export function usePricedFixtures() {
  const fx = useFixtures();
  const lines = useQuery({ queryKey: ["lines"], queryFn: loadLines, staleTime: 10 * 60_000 });
  return useMemo(() => {
    const all = upcomingOnly(fx.data || []);
    const feed = bookFixtures(lines.data);
    const priced = all.filter((f) => fixtureInBooks(feed, f));
    const haveBooks = feed.length > 0;
    const last = priced.length ? Math.max(...priced.map((f) => fixtureStart(f).getTime())) : 0;
    return { loading: fx.isLoading, ready: !fx.isLoading && !lines.isLoading, all, fixtures: haveBooks ? priced : all, priced: haveBooks, through: priced.length ? new Date(last) : null, feedMatches: feed.length, doc: lines.data };
  }, [fx.data, fx.isLoading, lines.isLoading, lines.data]);
}
