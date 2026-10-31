/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { sideEdge } from "@/engine/stats.js";
import { liveForFixture, lineNotIn, lineStanding } from "@/engine/live.js";
import { useFancyCards } from "@/hooks/useFancyCards";
import { fixtureState } from "@/hooks/useEngine";
import { useLiveDoc } from "@/hooks/useLive";
import { useData } from "@/lib/data";
import { EMPTY_PHASE } from "./home-phase-bar";
import { OverviewRow } from "./match-fancy";
import { HotProps, PropRow, useHotRows } from "./hot-props";
import { MarketTape } from "./market-tape";
import { hotOrder } from "@/lib/hot-lines";
import { lineHomePhase, phaseOf, type HomePhase } from "@/lib/home-phase";
import { RowsSkeleton } from "./skeletons";

const SHOWN = 4; // rows of each kind on the home page; the dedicated tabs carry the rest

const Head = ({ title, to }: { title: string; to: string }) => (
  <div className="flex items-baseline justify-between gap-snug">
    <h2 className="text-title font-bold tracking-tight">{title}</h2>
    <Link to={to} className="inline-flex items-center text-footnote font-semibold text-primary">See all<ChevronRightIcon className="size-4" aria-hidden /></Link>
  </div>
);

/** The home page's hot props: a four-row teaser on phones; on desktop the full lines table (match chips above filter it). `phase` is the floating bar's bucket. */
export function HotHome({ phase }: { phase?: HomePhase } = {}) {
  const nav = useNavigate();
  const live = useLiveDoc();
  const { identity } = useData();
  const { data, isLoading } = useHotRows(undefined, undefined, 0);
  const { cards, ready } = useFancyCards();
  const matchOf = (r: any) => { const [a, b] = String(r.match).split(/\s+vs\s+/i); return liveForFixture(live.data, { a, b, start: r.start, fmt: r.fmt }); };
  const asLine = (r: any) => ({ pid: r.pid, player: r.name, book_name: r.bookName, team: r.team, stat: r.stat, line: r.line, inn: r.inn });
  const soFarOf = (r: any) => lineStanding(matchOf(r), asLine(r), identity, { stored: r.stored, settled: r.settled });
  const outOf = (r: any) => lineNotIn(matchOf(r), asLine(r), identity);
  const liveOfFx = (f: any) => fixtureState(f, liveForFixture(live.data, f)?.status) === "live";
  const props = useMemo(() => (data || []).map((r) => ({ ...r, edge: sideEdge(r.l10.hits, r.l10.played, r.prior, r.over) })).filter((r) => r.day === 0 && r.l10.played >= 6 && (!phase || lineHomePhase(r, live.data) === phase))
    .sort((x, y) => hotOrder({ live: matchOf(x)?.status === "live", p: x.l10.p, edge: x.edge }, { live: matchOf(y)?.status === "live", p: y.l10.p, edge: y.edge })).slice(0, SHOWN), [data, live.data, phase]);
  const fancy = useMemo(() => cards.flatMap(({ f, rows }: any) => rows.map((r: any) => ({ r, f }))).filter(({ f }: any) => !phase || phaseOf(fixtureState(f, liveForFixture(live.data, f)?.status)) === phase)
    .sort((x: any, y: any) => hotOrder({ live: liveOfFx(x.f), p: 0, edge: x.r.edge }, { live: liveOfFx(y.f), p: 0, edge: y.r.edge })).slice(0, SHOWN), [cards, live.data, phase]);
  const tapeRows = useMemo(() => (data || []).filter((r) => r.day === 0 && (!phase || lineHomePhase(r, live.data) === phase)).map((r) => {
    const s = soFarOf(r);
    return { idx: r.idx, name: r.name, stat: r.stat, line: r.line, over: r.over, fmt: r.fmt, inn: r.inn, verdict: s?.verdict ?? null, v: s?.v };
  }), [data, live.data, identity, phase]);
  return (
    <>
      <div className="empty:hidden lg:hidden">{!isLoading ? <MarketTape rows={tapeRows} /> : null}</div>
      <section aria-label="Hot props" className="flex flex-col gap-section lg:hidden">
        <h1 className="text-display font-bold">Hot props</h1>
        <div className="flex flex-col gap-section">
        <div className="flex flex-col gap-snug">
          <Head title="Player props" to="/props" />
          {isLoading ? <RowsSkeleton /> : props.length ? <ul className="-mx-gutter">{props.map((r, i) => <PropRow key={`${r.idx}${r.stat}${r.start}${r.inn}`} r={r} win="l10" wl="L10" bars i={i} soFar={soFarOf(r)} out={outOf(r)} />)}</ul>
            : <p className="text-callout text-muted-foreground">{phase ? EMPTY_PHASE[phase] : "No player props are priced for today yet."}</p>}
        </div>
        <div className="flex flex-col gap-snug">
          <Head title="Fancy" to="/fancy" />
          {!ready ? <RowsSkeleton /> : fancy.length ? <ul className="-mx-gutter">{fancy.map(({ r, f }: any) => (
            <li key={`${f.id}${r.id || r.key}`} className="border-t border-hairline first:border-t-0"><OverviewRow r={r} sub={`${f.a} v ${f.b}`} onOpen={() => nav(`/fixture/${f.id}?tab=fancy&fm=${r.inn ? `${r.key}:${r.inn}` : r.key}${r.scope >= 0 ? `&sc=${r.scope}` : ""}`)} /></li>))}</ul>
            : <p className="text-callout text-muted-foreground">{phase ? EMPTY_PHASE[phase] : "No fancy lines are live yet."}</p>}
        </div>
        </div>
      </section>
      <div className="hidden lg:block">
        <HotProps heading="Player props" phase={phase} />
      </div>
    </>
  );
}
