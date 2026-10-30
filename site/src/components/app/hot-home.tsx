/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { sideEdge } from "@/engine/stats.js";
import { liveForFixture } from "@/engine/live.js";
import { useFancyCards } from "@/hooks/useFancyCards";
import { fixtureState } from "@/hooks/useEngine";
import { useLiveDoc } from "@/hooks/useLive";
import { EMPTY_PHASE } from "./home-phase-bar";
import { OverviewRow } from "./match-fancy";
import { HotProps, PropRow, useHotRows } from "./hot-props";
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
  const { data, isLoading } = useHotRows(undefined, undefined, 0);
  const { cards, ready } = useFancyCards();
  const props = useMemo(() => (data || []).map((r) => ({ ...r, edge: sideEdge(r.l10.hits, r.l10.played, r.prior, r.over) })).filter((r) => r.day === 0 && r.l10.played >= 6 && (!phase || lineHomePhase(r, live.data) === phase))
    .sort((x, y) => hotOrder({ live: false, p: x.l10.p, edge: x.edge }, { live: false, p: y.l10.p, edge: y.edge })).slice(0, SHOWN), [data, live.data, phase]);
  const fancy = useMemo(() => cards.flatMap(({ f, rows }: any) => rows.map((r: any) => ({ r, f }))).filter(({ f }: any) => !phase || phaseOf(fixtureState(f, liveForFixture(live.data, f)?.status)) === phase).sort((x: any, y: any) => (y.r.edge ?? -9) - (x.r.edge ?? -9)).slice(0, SHOWN), [cards, live.data, phase]);
  return (
    <>
      <section aria-label="Hot props" className="flex flex-col gap-section lg:hidden">
        <h1 className="text-display font-bold">Hot props</h1>
        <div className="flex flex-col gap-section">
        <div className="flex flex-col gap-snug">
          <Head title="Player props" to="/props" />
          {isLoading ? <RowsSkeleton /> : props.length ? <ul className="-mx-gutter">{props.map((r, i) => <PropRow key={`${r.idx}${r.stat}${r.start}${r.inn}`} r={r} win="l10" wl="L10" bars i={i} soFar={null} out={false} />)}</ul>
            : <p className="text-callout text-muted-foreground">{phase ? EMPTY_PHASE[phase] : "No player props are priced for today yet."}</p>}
        </div>
        <div className="flex flex-col gap-snug">
          <Head title="Fancy" to="/fancy" />
          {!ready ? <RowsSkeleton /> : fancy.length ? <ul className="-mx-gutter">{fancy.map(({ r, f }: any) => (
            <li key={`${f.id}${r.key}`} className="border-t border-hairline first:border-t-0"><OverviewRow r={r} sub={`${f.a} v ${f.b}`} onOpen={() => nav(`/fixture/${f.id}?tab=fancy&fm=${r.key}`)} /></li>))}</ul>
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
