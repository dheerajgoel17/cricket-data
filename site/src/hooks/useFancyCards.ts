/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { fancyFor, fixtureBooks } from "@/engine/lines.js";
import { MATCH_MARKETS, selectMatches } from "@/engine/markets.js";
import { FORMATS } from "@/engine/util.js";
import { useData } from "@/lib/data";
import { fixtureStart } from "@/lib/format";
import { usePricedFixtures } from "@/hooks/useEngine";
import { MATCH_KEYS, buildOverview } from "@/components/app/match-fancy";

const WINDOW = 20; // the sides' last matches the lines are scored on

/** Every priced match that has fancy lines, with the matches its lines are scored on and its market rows (best edge first, see `buildOverview`). */
export function useFancyCards() {
  const { store } = useData();
  const { fixtures, ready, doc } = usePricedFixtures();
  const cards = useMemo(() => fixtures.filter((f: any) => !f.noProps && fixtureBooks(doc, f).fancy).map((f: any) => {
    const fx = { a: f.a, b: f.b, fmt: f.fmt, startMs: fixtureStart(f).getTime() };
    const fmtIdx = FORMATS.indexOf(f.fmt);
    const ms = [...new Set([f.a_ix, f.b_ix].filter((i: number) => i >= 0).flatMap((i: number) => selectMatches(store, { fmt: fmtIdx, team: i, lastN: WINDOW }) as number[]))].sort((x, y) => x - y);
    const keys = MATCH_KEYS.filter(([k]) => fancyFor(doc, fx, k).length > 0);
    return { f, ms, rows: buildOverview({ store, doc, fxInfo: fx, ms, scope: -1, teamName: null, keys, label: (k) => (MATCH_MARKETS as any)[k]?.label ?? k }) };
  }), [fixtures, doc, store]);
  return { ready, cards };
}
