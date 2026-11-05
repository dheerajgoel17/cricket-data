/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fixtureBooks } from "@cricket/engine/lines.js";
import { fancyInputs } from "@cricket/engine/fancy-edge.js";
import { useData } from "@/lib/data";
import { fixtureStart } from "@/lib/format";
import { fixtureState, usePricedFixtures } from "@/hooks/useEngine";
import { useLiveDoc } from "@/hooks/useLive";
import { fancyStanding, liveForFixture } from "@cricket/engine/live.js";
import { collectOverview } from "@/components/app/match-fancy";
import { arrangeFixtures, homeTeam } from "@/lib/priority";

const yieldToMain = () => new Promise<void>((r) => { const sc = (globalThis as any).scheduler; if (sc?.yield) sc.yield().then(r); else setTimeout(r, 0); });

/**
 * Every priced match that has fancy lines, with the matches its lines are scored on and its market rows (best edge first, see `collectOverview`).
 * Whole-match markets and each side's team totals, including a Test's own 1st/2nd innings lines. Scoring a match is real work (every market against
 * the last matches of both sides), so it runs one match at a time with the main thread given back in between, and the result is kept: a page that
 * is open while it runs stays responsive (it used to freeze the page change that opened it, which showed as a blank page), and coming back to it is instant.
 * Cards follow the home rail: matches in play first, then standing. Live so-far is overlaid from the 15 s poll (`fancyStanding`), not baked into the 10-minute scored rows.
 */
export function useFancyCards() {
  const { store, matchesReady } = useData();
  const { fixtures: all, ready, doc } = usePricedFixtures();
  const live = useLiveDoc();
  // a finished match has nothing left to bet on: fancy lists the matches in play and to come (a finished match keeps its own page and its archive)
  const fixtures = useMemo(() => all.filter((f: any) => fixtureState(f, liveForFixture(live.data, f)?.status) !== "final"), [all, live.data]);
  const ids = fixtures.map((f: any) => f.id || `${f.a}${f.b}${f.start}`).join("|");
  const q = useQuery({
    queryKey: ["fancy-cards", doc?.generated_at_utc ?? "", ids],
    enabled: ready && !!doc && matchesReady !== false,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const out: any[] = [];
      for (const f of fixtures.filter((x: any) => !x.noProps && fixtureBooks(doc, x).fancy)) {
        const fx = { a: f.a, b: f.b, fmt: f.fmt, startMs: fixtureStart(f).getTime() };
        const { ms, ground, teams } = fancyInputs(store, f); // the sides' last matches and the ground's: the same ones the alerts are scored on (engine/fancy-edge.js)
        out.push({ f, ms, rows: collectOverview({ store, doc, fxInfo: fx, ms, teams: teams as [string, number][], ground }) });
        await yieldToMain();
      }
      return out;
    },
  });
  const cards = useMemo(() => {
    const list = q.data ?? [];
    if (!list.length) return list;
    const stateOf = (f: any) => fixtureState(f, liveForFixture(live.data, f)?.status);
    const idOf = (f: any) => f.id || `${f.a}${f.b}${f.start}`;
    const by = new Map(list.map((c: any) => [idOf(c.f), c]));
    return arrangeFixtures(list.map((c: any) => c.f), stateOf, homeTeam()).map((f: any) => by.get(idOf(f))).filter(Boolean)
      .map((c: any) => {
        const match = liveForFixture(live.data, c.f);
        return { ...c, rows: c.rows.map((r: any) => ({ ...r, venue: c.f.venue, standing: fancyStanding(match, r) })) };
      });
  }, [q.data, live.data]);
  return { ready: ready && !q.isLoading && !!q.data, cards };
}
