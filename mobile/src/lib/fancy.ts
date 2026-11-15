/* eslint-disable @typescript-eslint/no-explicit-any */
// The Fancy tab's data, as the site's `useFancyCards` works it out (site/src/hooks/useFancyCards.ts, a React hook): every priced match that has fancy lines, with its market rows
// (best edge first), scored one match at a time with the main thread given back in between. Live so-far is laid over the rows from the 15 s poll, never baked into the scored ones.
import { useMemo } from "react";
import { Platform } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { collectOverview, fancyInputs } from "@cricket/engine/fancy-edge.js";
import { fancyStanding } from "@cricket/engine/live.js";
import { fixtureBooks } from "@cricket/engine/lines.js";
import { span, timed } from "@/lib/perf";
import { FEED_GC_MS, linesQuery } from "@/lib/queries";
import { fixtureStart, liveMatchFor } from "@/lib/rail";
import { useLive } from "@/lib/use-live";
import { useRail } from "@/lib/use-rail";
import { useStore } from "@/lib/use-store";

const YIELD_MS = Platform.OS === "android" ? 16 : 0;
/** While the cards are still being scored, the ones done so far are shown at most this often. */
const PUBLISH_MS = 400;
const yieldToMain = () => new Promise<void>((r) => setTimeout(r, YIELD_MS));
const idOf = (f: any) => f.id || `${f.a}${f.b}${f.start}`;

export interface FancyCard { f: any; ms: number[]; rows: any[]; match?: any }

/** What a fixture's own lines are scored on: the sides' last matches and the ground's, the same ones the alerts use (`engine/fancy-edge.js`). */
export const fxInfoOf = (f: any) => ({ a: f.a, b: f.b, fmt: f.fmt, startMs: fixtureStart(f).getTime() });

/** The cards follow the home rail: matches in play first, then standing. A finished match has nothing left to bet on, so it is not listed. */
export function useFancyCards(enabled = true) {
  // linesQuery only — not useLinesLive (that path used to pull matches.json via merge). Store deferred so the Fancy tab chrome paints first.
  const qc = useQueryClient();
  const stats = useStore({ enabled }), lines = useQuery(linesQuery), live = useLive({ defer: !enabled });
  const { items, ready: railReady } = useRail();
  const store = stats.data?.store;
  const matchesReady = stats.matchesReady;
  const fixtures = useMemo(() => !enabled ? [] : items.filter((i) => !i.noProps && i.state !== "final" && fixtureBooks(lines.data, i.fixture).fancy).map((i) => i.fixture), [enabled, items, lines.data]);
  const ids = fixtures.map(idOf).join("|");
  const key = ["fancy-cards", lines.data?.generated_at_utc ?? "", ids];
  const q = useQuery({
    queryKey: key,
    // Same as the site's HistoryGate: fancy scoring needs matches.json (`store.M`).
    enabled: enabled && !!store && matchesReady && railReady && !!lines.data,
    staleTime: 10 * 60_000,
    gcTime: FEED_GC_MS,
    placeholderData: (prev: FancyCard[] | undefined) => prev,
    queryFn: async (): Promise<FancyCard[]> => {
      const out: FancyCard[] = [];
      let shown = 0, at = 0;
      for (const f of fixtures) {
        const t = Date.now();
        const { ms, ground, teams } = fancyInputs(store, f);
        out.push({ f, ms, rows: collectOverview({ store, doc: lines.data, fxInfo: fxInfoOf(f), ms, teams, ground }) });
        span("fancy card", t);
        // the first card with rows paints at once; after that the list is handed over a few cards at a time (a re-render per card, thirty in a row, was the tab's own stutter)
        const withRows = out.filter((c) => c.rows.length).length;
        if (withRows > shown && (shown === 0 || Date.now() - at >= PUBLISH_MS)) { shown = withRows; at = Date.now(); qc.setQueryData(key, [...out]); }
        await yieldToMain();
      }
      return out;
    },
  });
  const cards = useMemo(() => timed("fancy cards overlay", () => (enabled ? q.data ?? [] : []).map((c) => {
    const match = liveMatchFor(live.data, lines.data, c.f);
    return { ...c, match, rows: c.rows.map((r: any) => ({ ...r, venue: c.f.venue, standing: fancyStanding(match, r) })) };
  })), [enabled, q.data, live.data, lines.data]);
  return { ready: railReady && !!store && matchesReady && !q.isLoading && !!q.data, cards, error: q.isError || stats.isError };
}
