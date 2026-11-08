/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChartBarIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { modelSide, sideRate } from "@cricket/engine/props-view.js";
import { sameFixture } from "@cricket/engine/lines.js";
import { liveForFixture, lineNotIn, lineStanding } from "@cricket/engine/live.js";
import { useFancyCards } from "@/hooks/useFancyCards";
import { fixtureState } from "@/hooks/useEngine";
import { useHomeRail } from "@/hooks/useHomeRail";
import { useLiveDoc } from "@/hooks/useLive";
import { useData } from "@/lib/data";
import { EmptyState } from "./empty-state";
import { EMPTY_PHASE } from "./home-phase-bar";
import { MatchChip } from "./fixture-card";
import { OverviewRow } from "./match-fancy";
import { PropRow, useHotRows } from "./hot-props";
import { MarketTape } from "./market-tape";
import { PillGroup } from "./pill-group";
import { mixHomeRows } from "@/lib/hot-lines";
import { fancyMarketPath } from "@/lib/fancy-path";
import { lineHomePhase, phaseOf, type HomePhase } from "@/lib/home-phase";
import { RowsSkeleton, TapeSkeleton } from "./skeletons";

const PER = 6; // mixed player + fancy rows in the selected fixture's card

type MixItem =
  | { kind: "player"; key: string; live: boolean; edge: number | null; p: number; r: any }
  | { kind: "fancy"; key: string; live: boolean; edge: number | null; p: number; r: any; f: any };

type FxBlock = { f: any; items: MixItem[] };

/** Home below the rail: market tape, fixture hashtags, then a flat mixed props list for the chosen match (main fixture first). */
export function HotHome({ phase }: { phase?: HomePhase } = {}) {
  const nav = useNavigate();
  const live = useLiveDoc();
  const { identity } = useData();
  const { fixtures } = useHomeRail();
  // Today + tomorrow: home chips include tomorrow's fixtures (e.g. WBBL); scoring only day 0 left those chips fancy-only.
  const today = useHotRows(undefined, undefined, 0);
  const tomorrow = useHotRows(undefined, undefined, 1);
  const data = useMemo(() => [...(today.data || []), ...(tomorrow.data || [])], [today.data, tomorrow.data]);
  const isLoading = today.isLoading;
  const { cards, ready } = useFancyCards();
  const matchOf = (r: any) => { const [a, b] = String(r.match).split(/\s+vs\s+/i); return liveForFixture(live.data, { a, b, start: r.start, fmt: r.fmt }); };
  const asLine = (r: any) => ({ pid: r.pid, player: r.name, book_name: r.bookName, team: r.team, stat: r.stat, line: r.line, inn: r.inn });
  const soFarOf = (r: any) => lineStanding(matchOf(r), asLine(r), identity, { stored: r.stored, settled: r.settled });
  const outOf = (r: any) => lineNotIn(matchOf(r), asLine(r), identity);
  const stateOf = (f: any) => fixtureState(f, liveForFixture(live.data, f)?.status);

  const props = useMemo(() => data.map((r) => ({ ...r, ...modelSide(r.l10, r.prior, r.over, r.under) })).filter((r) => r.l10.played >= 6 && (!phase || lineHomePhase(r, live.data) === phase)), [data, live.data, phase]);

  const fancyById = useMemo(() => {
    const m = new Map<string, { r: any; f: any }[]>();
    for (const { f, rows } of cards) {
      if (phase && phaseOf(stateOf(f)) !== phase) continue;
      m.set(f.id, rows.map((r: any) => ({ r, f })));
    }
    return m;
  }, [cards, live.data, phase]);

  const blocks = useMemo(() => {
    const priced = fixtures.filter((f) => !f.noProps && (!phase || phaseOf(stateOf(f)) === phase));
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
  }, [fixtures, props, fancyById, live.data, phase]);

  const [pick, setPick] = useState("");
  const sel = blocks.some((b) => b.f.id === pick) ? pick : (blocks[0]?.f.id || "");
  const block = blocks.find((b) => b.f.id === sel) || null;

  const tapeRows = useMemo(() => (today.data || []).filter((r) => (!phase || lineHomePhase(r, live.data) === phase)).map((r) => {
    const s = soFarOf(r);
    return { idx: r.idx, name: r.name, stat: r.stat, line: r.line, over: r.over, fmt: r.fmt, inn: r.inn, verdict: s?.verdict ?? null, v: s?.v };
  }), [today.data, live.data, identity, phase]);

  const loading = isLoading || !ready;
  return (
    <section aria-label="Props" className="flex flex-col gap-stack">
      <div className="empty:hidden">{isLoading ? <TapeSkeleton /> : <MarketTape rows={tapeRows} />}</div>
      <div className="flex flex-wrap items-baseline justify-between gap-snug">
        <h2 className="text-title font-bold tracking-tight">Props</h2>
        <span className="flex items-center gap-stack text-footnote font-medium">
          <Link to="/props" className="inline-flex items-center text-primary">Player props<ChevronRightIcon className="size-4" aria-hidden /></Link>
          <Link to="/fancy" className="inline-flex items-center text-primary">Fancy<ChevronRightIcon className="size-4" aria-hidden /></Link>
        </span>
      </div>
      {loading ? <RowsSkeleton /> : blocks.length ? (
        <div className="flex flex-col gap-stack">
          <PillGroup
            layoutId="home-fx"
            label="Fixture"
            value={sel}
            onChange={setPick}
            items={blocks.map(({ f }) => [f.id, <MatchChip key={f.id} f={f} />] as [string, React.ReactNode])}
          />
          {block ? (
            <ul className="-mx-gutter">
              {block.items.map((item, i) => item.kind === "player"
                ? <PropRow key={item.key} r={item.r} win="l10" wl="L10" i={i} soFar={soFarOf(item.r)} out={outOf(item.r)} hideMatch />
                : (
                  <li key={item.key} className="border-t border-hairline">
                    <OverviewRow
                      r={item.r}
                      onOpen={() => nav(fancyMarketPath(item.f.id, { fm: item.r.inn ? `${item.r.key}:${item.r.inn}` : item.r.key, sc: item.r.scope >= 0 ? item.r.scope : null }))}
                    />
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <EmptyState
          icon={<ChartBarIcon />}
          title={phase ? EMPTY_PHASE[phase].title : "No priced lines yet"}
          body={phase ? EMPTY_PHASE[phase].body : "Player props and fancy for today's fixtures show up here once the books list them."}
        />
      )}
    </section>
  );
}
