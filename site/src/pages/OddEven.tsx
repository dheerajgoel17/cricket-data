/* eslint-disable @typescript-eslint/no-explicit-any */
/* Odd / Even tab: each side's score after N overs, odd or even, from the history (engine/parity.js). Laid out like Form (a heading per side, hairline rows) under Ground's control row (chips + one filter button). */
import { useMemo, useState } from "react";
import { MapPinIcon } from "@heroicons/react/24/outline";
import { PillGroup } from "@/components/app/pill-group";
import { Crumbs } from "@/components/app/page";
import { TeamBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/empty-state";
import { FilterButton } from "@/components/app/chip";
import { FancyFilters } from "@/components/app/fancy-filters";
import { useData } from "@/lib/data";
import { abbr, shortVenue } from "@/lib/format";
import { MarkRow, MarkSection, type MarkData } from "@/components/app/mark-rows";
import { parityBlocks, parityOvers } from "@cricket/engine/parity.js";
import { venueIndices } from "@cricket/engine/markets.js";
import { FORMATS } from "@cricket/engine/util.js";

type Slice = { n: number; odd: number; even: number; pOdd: number | null; typical: number | null; marks: any[] } | null;
const WINDOWS = [5, 10, 20, 30];
const SMALL = 5;
const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });

/** One Odd / Even row over a slice of results. */
function Row({ title, sub, slice, vsName, extra }: { title: string; sub: string; slice: Slice; vsName: (i: number) => string; extra?: string }) {
  if (!slice?.n) return null;
  const marks: MarkData[] = slice.marks.map((x) => ({
    on: x.odd, letter: x.odd ? "O" : "E", label: `${x.odd ? "Odd" : "Even"}, ${x.score} v ${vsName(x.vs)}, ${fmtDate(x.date)}`,
    detail: `${x.score} · ${x.odd ? "odd" : "even"} · v ${vsName(x.vs)} · ${fmtDate(x.date)}`,
  }));
  return <MarkRow title={title} sub={sub} headline={`${Math.round((slice.odd / slice.n) * 100)}% odd`} headlineSub={`${slice.odd} odd · ${slice.even} even`} marks={marks}
    note={slice.n < SMALL ? `Only ${slice.n} match${slice.n === 1 ? "" : "es"}` : extra} />;
}

const Section = MarkSection;

export function OddEven({ fx, q = {}, setQ, embedded = false }: { fx: any; q?: Record<string, string>; setQ?: (p: Record<string, unknown>) => void; embedded?: boolean }) {
  const { store } = useData();
  const fmtIdx = FORMATS.indexOf(fx.fmt), cuts: number[] = parityOvers(fx.fmt);
  const [over, setOver] = useState(String(cuts[0] ?? 5));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const win = WINDOWS.includes(Number(q.mw)) ? Number(q.mw) : 10; // the same window as Match Fancy
  const gender = fx.gender === "female" ? 1 : 0;
  const venue = useMemo(() => venueIndices(store, fx.venue) as number[], [store, fx.venue]);
  const overs = cuts.includes(Number(over)) ? Number(over) : cuts[0];
  const sides = useMemo(() => [[fx.a, fx.a_ix, fx.b_ix], [fx.b, fx.b_ix, fx.a_ix]].map(([name, ix, opp]: any) => ({
    name, ix, blocks: ix >= 0 ? parityBlocks(store, { fmt: fmtIdx, gender, team: ix, opp, venue: venue as any, overs, lastN: win }) : null,
  })), [store, fx.a, fx.b, fx.a_ix, fx.b_ix, fmtIdx, gender, venue, overs, win]) as any[];
  const vsName = (i: number) => abbr(store.teamName(i, true));
  const ground = shortVenue(fx.venue);
  const g = sides.find((s) => s.blocks)?.blocks;
  if (!cuts.length) return <EmptyState title="Not offered for this format" body="Odd / Even is read at 5-over steps in T20, T10 and ODI matches." />;
  const empty = !sides.some((s) => s.blocks && [s.blocks.first, s.blocks.second, s.blocks.here, s.blocks.vs].some((x: Slice) => x?.n)) && !g?.ground1?.n && !g?.ground2?.n;
  return (
    <div className="flex min-w-0 flex-col gap-snug">
      {!embedded && <div className="hidden pt-stack lg:block"><Crumbs items={[[`${abbr(fx.a)} v ${abbr(fx.b)}`, "#"], ["Match Fancy", "#"], ["Odd / Even"]]} /></div>}
      {/* one control row, as on Ground: the choice as chips, the one filter button at the right */}
      <div className="-mx-gutter flex min-w-0 items-center gap-snug px-gutter">
        <PillGroup chips layoutId="oe-over" label="Overs" value={String(overs)} onChange={setOver} className="min-w-0 flex-1" items={cuts.map((n) => [String(n), `${n} ov`] as [string, string])} />
        <FilterButton label={`L${win}`} count={win !== 10 ? 1 : 0} onClick={() => setFiltersOpen(true)} />
      </div>
      <FancyFilters open={filtersOpen} onOpenChange={setFiltersOpen} win={win} here={false} venueName={ground} hasVenue={false} onApply={({ win: w }) => setQ?.({ mw: w === 10 ? "" : String(w) })} />
      {empty ? <EmptyState title="No history yet" body={`No ${fx.fmt} matches with an over-by-over score to read.`} /> : (
        <div className="grid gap-stack lg:grid-cols-2 lg:items-start">
          {sides.map((s) => {
            const mine = abbr(s.name), theirs = abbr(s.name === fx.a ? fx.b : fx.a), b = s.blocks;
            return (
              <Section key={s.name} label={s.name} head={<><TeamBadge name={s.name} size="sm" /><span className="min-w-0 flex-1 truncate text-callout font-label">{s.name}</span><span className="text-footnote text-muted-foreground">after {overs} ov</span></>}>
                {b && <>
                  <Row title="Batting 1st" sub={`Last ${win}`} slice={b.first} vsName={vsName} />
                  <Row title="Batting 2nd" sub={`Last ${win}`} slice={b.second} vsName={vsName} />
                  <Row title="At this ground" sub={`${ground} · last ${win}`} slice={b.here} vsName={vsName} />
                  <Row title={`v ${theirs}`} sub="Head to head · last 5" slice={b.vs} vsName={vsName} />
                </>}
                {!b?.first?.n && !b?.second?.n && !b?.here?.n && !b?.vs?.n && <li className="border-t border-hairline px-gutter py-snug text-callout text-muted-foreground lg:px-0">No {fx.fmt} history for {mine}.</li>}
              </Section>);
          })}
          {(g?.ground1?.n || g?.ground2?.n) ? (
            <Section label="The ground" head={<><MapPinIcon className="size-7 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate text-callout font-label">{ground}</span><span className="text-footnote text-muted-foreground">every side</span></>}>
              <Row title="1st innings" sub={`Last ${win}`} slice={g.ground1} vsName={vsName} extra={g.ground1?.typical != null ? `Typical score ${g.ground1.typical}` : undefined} />
              <Row title="2nd innings" sub={`Last ${win}`} slice={g.ground2} vsName={vsName} extra={g.ground2?.typical != null ? `Typical score ${g.ground2.typical}` : undefined} />
            </Section>) : null}
        </div>)}
    </div>
  );
}
