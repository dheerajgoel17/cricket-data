/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { HomePhase } from "@site/lib/home-phase";
import { fancyFm } from "@cricket/engine/fancy-edge.js";
import { sameFixture } from "@cricket/engine/lines.js";
import { liveForFixture } from "@cricket/engine/live.js";
import { mixHomeRows } from "@site/lib/hot-lines";
import { phaseOf } from "@site/lib/home-phase";
import { sideRate } from "@cricket/engine/props-view.js";
import { useFancyCards } from "@/lib/fancy";
import { fancyMarketPath } from "@/lib/nav";
import { fixtureState } from "@/lib/rail";
import { liveQuery } from "@/lib/queries";
import { useHotView } from "@/lib/use-hot";
import { useRail } from "@/lib/use-rail";
import type { TapeRow } from "@/ui/market-tape";

const PER = 6;
/** Prefer the site's L10≥6 bar; while the first wave is still thin, show thinner samples so Home is not blank for seconds. */
const HOME_PLAYED = 6;
const HOME_PLAYED_SOFT = 1;

export type MixItem =
  | { kind: "player"; key: string; live: boolean; edge: number | null; p: number; r: any }
  | { kind: "fancy"; key: string; live: boolean; edge: number | null; p: number; r: any; f: any };

type FxBlock = { f: any; items: MixItem[] };

/** Home Props block state: tape, match chips, and the mixed rows for the selected fixture (FlashList data). */
export function useHotHome(phase: HomePhase) {
  const d0 = useHotView({ day: 0 }, phase);
  // Tomorrow's lines only after today has something to show — cold start was scoring both days at once (~2× JS work).
  const d1 = useHotView(d0.rows.length || !d0.isLoading ? { day: 1 } : undefined, phase);
  const rows = useMemo(() => [...d0.rows, ...d1.rows], [d0.rows, d1.rows]);
  const isLoading = d0.isLoading;
  const scoring = d0.scoring || d1.scoring;
  const error = d0.error;
  const soFarOf = d0.soFarOf;
  const outOf = d0.outOf;
  const live = useQuery(liveQuery);
  const { items: rail } = useRail();
  const stateOf = (f: any) => fixtureState(f, liveForFixture(live.data, f)?.status);
  // Fancy scores in parallel with Hot — do not wait for Hot to finish (that alone was the old 6–7 s blank).
  const { cards } = useFancyCards(true);

  const props = useMemo(() => {
    const strict = rows.filter((r) => r.l10.played >= HOME_PLAYED || r.quotes?.some((q: any) => q.live));
    if (strict.length >= 3 || !scoring) return strict;
    return rows.filter((r) => r.l10.played >= HOME_PLAYED_SOFT || r.quotes?.some((q: any) => q.live));
  }, [rows, scoring]);

  const fancyById = useMemo(() => {
    const m = new Map<string, { r: any; f: any }[]>();
    for (const { f, rows: rs } of cards) {
      if (phase && phaseOf(stateOf(f)) !== phase) continue;
      m.set(f.id, rs.map((r: any) => ({ r, f })));
    }
    return m;
  }, [cards, phase, live.data]);

  const blocks = useMemo(() => {
    const priced = rail.filter((i) => !i.noProps && (!phase || phaseOf(i.state) === phase)).map((i) => i.fixture);
    const out: FxBlock[] = [];
    for (const f of priced) {
      const players = props.filter((r) => sameFixture({ match: r.match, start_utc: r.start, fmt: r.fmt }, f));
      const fancy = fancyById.get(f.id) || [];
      const liveNow = stateOf(f) === "live";
      const items = mixHomeRows<MixItem>([
        ...players.map((r) => ({ kind: "player" as const, key: `p:${r.idx}:${r.stat}:${r.start}:${r.inn}`, live: liveNow, edge: r.edge ?? null, p: sideRate(r.l10.p, r.side) ?? 0, r })),
        ...fancy.map(({ r, f: fx }) => ({ kind: "fancy" as const, key: `f:${fx.id}:${r.id || r.key}:${r.inn || 0}`, live: liveNow, edge: r.edge ?? null, p: r.played ? r.hits / r.played : 0, r, f: fx })),
      ], PER);
      if (items.length) out.push({ f, items });
    }
    return out;
  }, [rail, props, fancyById, live.data, phase]);

  const [pick, setPick] = useState("");
  const sel = blocks.some((b) => b.f.id === pick) ? pick : (blocks[0]?.f.id || "");
  const block = blocks.find((b) => b.f.id === sel) || null;

  const tape = useMemo<TapeRow[]>(() => d0.rows.map((r) => {
    const s = soFarOf(r);
    return { idx: r.idx, pid: r.pid, name: r.name, stat: r.stat, line: r.line, over: r.over, fmt: r.fmt, inn: r.inn, verdict: s?.verdict ?? null, v: s?.v };
  }), [d0.rows, soFarOf]);

  // Paint as soon as Hot has any rows (or fancy cards); do not block on fancy finishing.
  const loading = isLoading && !blocks.length;
  const fixtures = blocks.map(({ f }) => f);
  const items = block?.items ?? [];

  const openFancy = (item: Extract<MixItem, { kind: "fancy" }>) =>
    fancyMarketPath(item.f.id, { fm: fancyFm(item.r.key, item.r.inn || 0), sc: item.r.scope >= 0 ? item.r.scope : null });

  return {
    tape, fixtures, items, sel, setPick, block,
    loading, scoring, error, isLoading, soFarOf, outOf, openFancy,
  };
}
