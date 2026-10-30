/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { sideEdge } from "@/engine/stats.js";
import { useFancyCards } from "@/hooks/useFancyCards";
import { OverviewRow } from "./match-fancy";
import { PropRow, useHotRows } from "./hot-props";
import { hotOrder } from "@/lib/hot-lines";
import { RowsSkeleton } from "./skeletons";

const SHOWN = 4; // rows of each kind on the home page; the dedicated tabs carry the rest

const Head = ({ title, to }: { title: string; to: string }) => (
  <div className="flex items-baseline justify-between gap-snug">
    <h2 className="text-title font-bold tracking-tight">{title}</h2>
    <Link to={to} className="inline-flex items-center text-footnote font-semibold text-primary">See all<ChevronRightIcon className="size-4" aria-hidden /></Link>
  </div>
);

/** The home page's hot props: the few best player props of today and the few best-edge fancy markets across the matches, each with a link to its own tab. */
export function HotHome() {
  const nav = useNavigate();
  const { data, isLoading } = useHotRows(undefined, undefined, 0);
  const { cards, ready } = useFancyCards();
  const props = useMemo(() => (data || []).map((r) => ({ ...r, edge: sideEdge(r.l10.hits, r.l10.played, r.prior, r.over) })).filter((r) => r.day === 0 && r.l10.played >= 6)
    .sort((x, y) => hotOrder({ live: false, p: x.l10.p, edge: x.edge }, { live: false, p: y.l10.p, edge: y.edge })).slice(0, SHOWN), [data]);
  const fancy = useMemo(() => cards.flatMap(({ f, rows }: any) => rows.map((r: any) => ({ r, f }))).sort((x: any, y: any) => (y.r.edge ?? -9) - (x.r.edge ?? -9)).slice(0, SHOWN), [cards]);
  if (!isLoading && ready && !props.length && !fancy.length) return null;
  return (
    <section aria-label="Hot props" className="flex flex-col gap-section">
      <h1 className="text-display font-bold">Hot props</h1>
      <div className="flex flex-col gap-section lg:grid lg:grid-cols-2 lg:items-start">
      <div className="flex flex-col gap-snug">
        <Head title="Player props" to="/props" />
        {isLoading ? <RowsSkeleton /> : props.length ? <ul className="-mx-gutter lg:mx-0">{props.map((r, i) => <PropRow key={`${r.idx}${r.stat}${r.start}${r.inn}`} r={r} win="l10" wl="L10" bars i={i} soFar={null} out={false} />)}</ul>
          : <p className="text-callout text-muted-foreground">No player props are priced for today yet.</p>}
      </div>
      <div className="flex flex-col gap-snug">
        <Head title="Fancy" to="/fancy" />
        {!ready ? <RowsSkeleton /> : fancy.length ? <ul className="-mx-gutter lg:mx-0">{fancy.map(({ r, f }: any) => (
          <li key={`${f.id}${r.key}`} className="border-t border-hairline first:border-t-0"><OverviewRow r={r} sub={`${f.a} v ${f.b}`} onOpen={() => nav(`/fixture/${f.id}?tab=fancy&fm=${r.key}`)} /></li>))}</ul>
          : <p className="text-callout text-muted-foreground">No fancy lines are live yet.</p>}
      </div>
      </div>
    </section>
  );
}
