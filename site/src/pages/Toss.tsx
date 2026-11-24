/* eslint-disable @typescript-eslint/no-explicit-any */
/* Toss tab: the toss winner's price (a book's, else the 1.95 default) and each side's toss history, laid out like Odd / Even. Engine: packages/engine/toss.js. History only: a coin flip carries no edge. */
import { useMemo, useState } from "react";
import { MarkRow, MarkSection, type MarkData } from "@/components/app/mark-rows";
import { TeamBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/empty-state";
import { FilterButton } from "@/components/app/chip";
import { FancyFilters } from "@/components/app/fancy-filters";
import { useData } from "@/lib/data";
import { abbr, fixtureStart, shortVenue } from "@/lib/format";
import { tossMarket, tossMarks } from "@cricket/engine/toss.js";
import { venueIndices } from "@cricket/engine/markets.js";
import { FORMATS } from "@cricket/engine/util.js";

const WINDOWS = [5, 10, 20, 30];
const SMALL = 5;
const fmtDate = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" }) : "");

/** A row of one side's tosses: W / L marks, the headline "6 of 10 won". */
function TossRow({ title, sub, marks, vsName }: { title: string; sub: string; marks: any[] | null; vsName: (i: number) => string }) {
  if (!marks?.length) return null;
  const won = marks.filter((x) => x.won).length, bat = marks.filter((x) => x.bat === true).length, chose = marks.filter((x) => x.bat != null).length;
  const data: MarkData[] = marks.map((x) => ({
    on: x.won, letter: x.won ? "W" : "L", label: `${x.won ? "Won" : "Lost"} the toss v ${vsName(x.vs)}, ${fmtDate(x.date)}`,
    detail: `${x.won ? "Won" : "Lost"} the toss${x.bat != null ? `, chose to ${x.bat ? "bat" : "field"}` : ""} · v ${vsName(x.vs)} · ${fmtDate(x.date)}`,
  }));
  return <MarkRow title={title} sub={sub} headline={`${won} of ${marks.length} won`} headlineSub={chose ? `chose to bat ${bat} of ${chose}` : undefined} marks={data}
    note={marks.length < SMALL ? `Only ${marks.length} match${marks.length === 1 ? "" : "es"}` : undefined} />;
}

export function Toss({ fx, doc, q = {}, setQ }: { fx: any; doc: any; q?: Record<string, string>; setQ?: (p: Record<string, unknown>) => void }) {
  const { store } = useData();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const win = WINDOWS.includes(Number(q.mw)) ? Number(q.mw) : 10; // the same window as Match Fancy
  const fmtIdx = FORMATS.indexOf(fx.fmt), gender = fx.gender === "female" ? 1 : 0;
  const venue = useMemo(() => venueIndices(store, fx.venue) as number[], [store, fx.venue]);
  const market = useMemo(() => tossMarket(doc, { a: fx.a, b: fx.b, fmt: fx.fmt, startMs: fixtureStart(fx).getTime() }), [doc, fx]);
  const sides = useMemo(() => [[fx.a, fx.a_ix, fx.b_ix], [fx.b, fx.b_ix, fx.a_ix]].map(([name, ix, opp]: any, i: number) => {
    const base: any = { fmt: fmtIdx, gender };
    return {
      name, ix, side: market.sides[i],
      last: tossMarks(store, ix, { ...base, lastN: win }),
      vs: opp >= 0 ? tossMarks(store, ix, { ...base, opp, lastN: 5 }) : null,
      here: venue.length ? tossMarks(store, ix, { ...base, venue, lastN: win }) : null,
    };
  }), [store, fx.a, fx.b, fx.a_ix, fx.b_ix, fmtIdx, gender, venue, win, market]) as any[];
  const vsName = (i: number) => abbr(store.teamName(i, true));
  const ground = shortVenue(fx.venue);
  const none = !sides.some((s) => s.last?.length);
  return (
    <div className="flex min-w-0 flex-col gap-snug">
      <div className="-mx-gutter flex min-w-0 items-center justify-end gap-snug px-gutter">
        <FilterButton label={`L${win}`} count={win !== 10 ? 1 : 0} onClick={() => setFiltersOpen(true)} />
      </div>
      <FancyFilters open={filtersOpen} onOpenChange={setFiltersOpen} win={win} here={false} venueName={ground} hasVenue={false} onApply={({ win: w }) => setQ?.({ mw: w === 10 ? "" : String(w) })} />
      <div className="grid gap-stack lg:grid-cols-2 lg:items-start">
        {sides.map((s) => (
          <MarkSection key={s.name} label={s.name} head={<><TeamBadge name={s.name} size="sm" /><span className="min-w-0 flex-1 truncate text-callout font-label">{s.name}</span><span className="text-footnote text-muted-foreground">toss winner</span></>}>
            <MarkRow title="Price" sub={market.default ? "Default, no book lists the toss" : `Best of ${market.books.length} book${market.books.length === 1 ? "" : "s"}`} headline={s.side.price.toFixed(2)} headlineSub={s.side.book ?? "default"} marks={[]} hideWhenEmpty={false} />
            <TossRow title="Last tosses" sub={`Last ${win}`} marks={s.last} vsName={vsName} />
            <TossRow title="At this ground" sub={`${ground} · last ${win}`} marks={s.here} vsName={vsName} />
            <TossRow title={`v ${abbr(s.name === fx.a ? fx.b : fx.a)}`} sub="Head to head · last 5" marks={s.vs} vsName={vsName} />
          </MarkSection>
        ))}
      </div>
      {none && <EmptyState title="No toss history yet" body={`No ${fx.fmt} matches with a recorded toss for these sides.`} />}
    </div>
  );
}
