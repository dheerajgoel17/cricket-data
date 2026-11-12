/* eslint-disable @typescript-eslint/no-explicit-any */
// The Fancy tab's data, as the site's `useFancyCards` works it out (site/src/hooks/useFancyCards.ts, a React hook): every priced match that has fancy lines, with its market rows
// (best edge first), scored one match at a time with the main thread given back in between. Live so-far is laid over the rows from the 15 s poll, never baked into the scored ones.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { collectOverview, fancyInputs } from "@cricket/engine/fancy-edge.js";
import { fancyStanding } from "@cricket/engine/live.js";
import { fixtureBooks } from "@cricket/engine/lines.js";
import { span, timed } from "@/lib/perf";
import { storeQuery } from "@/lib/data";
import { liveQuery } from "@/lib/queries";
import { useLinesLive } from "@/lib/use-lines-live";
import { fixtureStart, liveMatchFor } from "@/lib/rail";
import { useRail } from "@/lib/use-rail";

const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0));
const idOf = (f: any) => f.id || `${f.a}${f.b}${f.start}`;

export interface FancyCard { f: any; ms: number[]; rows: any[] }

/** What a fixture's own lines are scored on: the sides' last matches and the ground's, the same ones the alerts use (`engine/fancy-edge.js`). */
export const fxInfoOf = (f: any) => ({ a: f.a, b: f.b, fmt: f.fmt, startMs: fixtureStart(f).getTime() });

/** The cards follow the home rail: matches in play first, then standing. A finished match has nothing left to bet on, so it is not listed. */
export function useFancyCards(enabled = true) {
  const stats = useQuery(storeQuery), lines = useLinesLive(), live = useQuery(liveQuery);
  const { items, ready: railReady } = useRail();
  const store = stats.data?.store;
  const fixtures = useMemo(() => items.filter((i) => !i.noProps && i.state !== "final" && fixtureBooks(lines.data, i.fixture).fancy).map((i) => i.fixture), [items, lines.data]);
  const ids = fixtures.map(idOf).join("|");
  const q = useQuery({
    queryKey: ["fancy-cards", lines.data?.generated_at_utc ?? "", lines.data?.live_sig ?? "", ids],
    enabled: enabled && !!store && railReady && !!lines.data,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<FancyCard[]> => {
      const out: FancyCard[] = [];
      for (const f of fixtures) {
        const t = Date.now();
        const { ms, ground, teams } = fancyInputs(store, f);
        out.push({ f, ms, rows: collectOverview({ store, doc: lines.data, fxInfo: fxInfoOf(f), ms, teams, ground }) });
        span("fancy card", t);
        await yieldToMain();
      }
      return out;
    },
  });
  const cards = useMemo(() => timed("fancy cards overlay", () => (q.data ?? []).map((c) => {
    const match = liveMatchFor(live.data, lines.data, c.f);
    return { ...c, rows: c.rows.map((r: any) => ({ ...r, venue: c.f.venue, standing: fancyStanding(match, r) })) };
  })), [q.data, live.data, lines.data]);
  return { ready: railReady && !!store && !q.isLoading && !!q.data, cards, error: q.isError };
}
