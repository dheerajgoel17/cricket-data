/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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

const teamKey = (n: string) => String(n).toLowerCase().replace(/\(w\)|women'?s?/g, "").replace(/[^a-z0-9]/g, "");
const WINDOW = 14 * 3600e3;

/** Upcoming fixtures that the bookmaker feed (lines.json / live book_lines.json: `events` and `lines`) prices props for.
 *  A fixture matches a feed match when both team names agree (ignoring "(W)"/"Women") and the starts are within 14 h, since books and the schedule disagree on kick-off times.
 *  With no feed or no overlap it falls back to every upcoming fixture (`priced: false`) rather than an empty home page. */
export function usePricedFixtures() {
  const fx = useFixtures();
  const lines = useQuery({ queryKey: ["lines"], queryFn: loadLines, staleTime: 10 * 60_000 });
  return useMemo(() => {
    const all = upcomingOnly(fx.data || []);
    const seen = new Map<string, { a: string; b: string; t: number; n: number }>();
    // events = every match with any prop market; lines = the two-sided player lines (older feeds carry only these)
    for (const l of [...(lines.data?.events || []), ...(lines.data?.lines || [])]) {
      const [a, b] = String(l.match).split(/\s+vs\s+/i);
      if (!b || !l.start_utc) continue;
      const k = `${l.match}|${l.start_utc}`;
      const e = seen.get(k) || { a: teamKey(a), b: teamKey(b), t: Date.parse(l.start_utc), n: 0 };
      e.n++; seen.set(k, e);
    }
    const feed = [...seen.values()];
    const priced = all.filter((f) => { const a = teamKey(f.a), b = teamKey(f.b), t = fixtureStart(f).getTime(); return feed.some((m) => ((m.a === a && m.b === b) || (m.a === b && m.b === a)) && Math.abs(m.t - t) < WINDOW); });
    const ok = priced.length > 0;
    const last = ok ? Math.max(...priced.map((f) => fixtureStart(f).getTime())) : 0;
    return { loading: fx.isLoading, all, fixtures: ok ? priced : all, priced: ok, through: ok ? new Date(last) : null, feedMatches: feed.length };
  }, [fx.data, fx.isLoading, lines.data]);
}
