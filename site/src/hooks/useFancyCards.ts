/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fancyFor, fixtureBooks } from "@/engine/lines.js";
import { MATCH_MARKETS, selectMatches, venueIndices } from "@/engine/markets.js";
import { FORMATS } from "@/engine/util.js";
import { useData } from "@/lib/data";
import { fixtureStart } from "@/lib/format";
import { fixtureState, usePricedFixtures } from "@/hooks/useEngine";
import { useLiveDoc } from "@/hooks/useLive";
import { liveForFixture } from "@/engine/live.js";
import { MATCH_KEYS, buildOverview } from "@/components/app/match-fancy";

const WINDOW = 20; // the sides' last matches the lines are scored on

const yieldToMain = () => new Promise<void>((r) => { const sc = (globalThis as any).scheduler; if (sc?.yield) sc.yield().then(r); else setTimeout(r, 0); });

/**
 * Every priced match that has fancy lines, with the matches its lines are scored on and its market rows (best edge first, see `buildOverview`). Scoring a match is real work
 * (every market against the last matches of both sides), so it runs one match at a time with the main thread given back in between, and the result is kept: a page that
 * is open while it runs stays responsive (it used to freeze the page change that opened it, which showed as a blank page), and coming back to it is instant.
 */
export function useFancyCards() {
  const { store } = useData();
  const { fixtures: all, ready, doc } = usePricedFixtures();
  const live = useLiveDoc();
  // a finished match has nothing left to bet on: fancy lists the matches in play and to come (a finished match keeps its own page and its archive)
  const fixtures = useMemo(() => all.filter((f: any) => fixtureState(f, liveForFixture(live.data, f)?.status) !== "final"), [all, live.data]);
  const ids = fixtures.map((f: any) => f.id || `${f.a}${f.b}${f.start}`).join("|");
  const q = useQuery({
    queryKey: ["fancy-cards", doc?.generated_at_utc ?? "", ids],
    enabled: ready && !!doc,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const out: any[] = [];
      for (const f of fixtures.filter((x: any) => !x.noProps && fixtureBooks(doc, x).fancy)) {
        const fx = { a: f.a, b: f.b, fmt: f.fmt, startMs: fixtureStart(f).getTime() };
        const fmtIdx = FORMATS.indexOf(f.fmt);
        const ms = [...new Set([f.a_ix, f.b_ix].filter((i: number) => i >= 0).flatMap((i: number) => selectMatches(store, { fmt: fmtIdx, team: i, lastN: WINDOW }) as number[]))].sort((x, y) => x - y);
        const venue = (venueIndices as (s: any, n: string) => number[])(store, f.venue);
        const ground = venue.length ? (selectMatches(store, { fmt: fmtIdx, gender: f.gender === "female" ? 1 : 0, venue, lastN: 10 }) as number[]) : undefined; // the last ten matches at this ground
        const keys = MATCH_KEYS.filter(([k]) => fancyFor(doc, fx, k).length > 0);
        out.push({ f, ms, rows: buildOverview({ store, doc, fxInfo: fx, ms, scope: -1, teamName: null, keys, label: (k) => (MATCH_MARKETS as any)[k]?.label ?? k, ground }) });
        await yieldToMain();
      }
      return out;
    },
  });
  return { ready: ready && !q.isLoading && !!q.data, cards: q.data ?? [] };
}
