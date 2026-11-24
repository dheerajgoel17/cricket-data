/* eslint-disable @typescript-eslint/no-explicit-any */
/* Toss tab: the toss winner's price (a book's, else the 1.95 default) and each side's toss history (twin of the site's `pages/Toss.tsx`). History only: a coin flip carries no edge. */
import { useMemo, useState } from "react";
import { View } from "react-native";
import { tossMarket, tossMarks } from "@cricket/engine/toss.js";
import { venueIndices } from "@cricket/engine/markets.js";
import { FORMATS } from "@cricket/engine/util.js";
import { abbr, fixtureStart, shortVenue } from "@site/lib/format";
import { useStore } from "@/lib/use-store";
import { ChoiceChip, ChoiceRow, FilterButton, filterBar } from "@/ui/chips";
import { EmptyState } from "@/ui/empty-state";
import { MarkRow, MarkSection, markStyles, type MarkData } from "@/ui/mark-rows";
import { Working } from "@/ui/motion";
import { FilterSection, FilterSheet } from "@/ui/sheet";
import { BookBadge } from "@/ui/book-badge";
import { TeamBadge } from "@/ui/team-badge";
import { Text } from "@/ui/text";

const WINDOWS = [5, 10, 20, 30];
const SMALL = 5;
const day = (d: string | null) => (d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" }) : "");

function TossRow({ title, sub, marks, vsName }: { title: string; sub: string; marks: any[] | null; vsName: (i: number) => string }) {
  if (!marks?.length) return null;
  const won = marks.filter((x) => x.won).length, bat = marks.filter((x) => x.bat === true).length, chose = marks.filter((x) => x.bat != null).length;
  const data: MarkData[] = marks.map((x) => ({
    on: x.won, letter: x.won ? "W" : "L", label: `${x.won ? "Won" : "Lost"} the toss v ${vsName(x.vs)}, ${day(x.date)}`,
    detail: `${x.won ? "Won" : "Lost"} the toss${x.bat != null ? `, chose to ${x.bat ? "bat" : "field"}` : ""} · v ${vsName(x.vs)} · ${day(x.date)}`,
  }));
  return <MarkRow title={title} sub={sub} headline={`${won} of ${marks.length} won`} headlineSub={chose ? `chose to bat ${bat} of ${chose}` : undefined} marks={data}
    note={marks.length < SMALL ? `Only ${marks.length} match${marks.length === 1 ? "" : "es"}` : undefined} />;
}

export function Toss({ fx, doc }: { fx: any; doc: any }) {
  const stats = useStore();
  const store: any = stats.data?.store;
  const ready = !!store && stats.matchesReady; // the store object is the same before and after matches.json joins: memos must key on this
  const [win, setWin] = useState(10), [draftWin, setDraftWin] = useState(10), [open, setOpen] = useState(false);
  const fmtIdx = FORMATS.indexOf(fx.fmt), gender = fx.gender === "female" ? 1 : 0;
  const venue = useMemo(() => (ready ? ((venueIndices as any)(store, fx.venue) as number[]) : []), [ready, store, fx.venue]);
  const market = useMemo(() => (tossMarket as any)(doc, { a: fx.a, b: fx.b, fmt: fx.fmt, startMs: fixtureStart(fx).getTime() }), [doc, fx]);
  const sides = useMemo(() => (ready ? [[fx.a, fx.a_ix, fx.b_ix], [fx.b, fx.b_ix, fx.a_ix]].map(([name, ix, opp]: any, i: number) => {
    const base: any = { fmt: fmtIdx, gender };
    return {
      name, side: market.sides[i], last: (tossMarks as any)(store, ix, { ...base, lastN: win }),
      vs: opp >= 0 ? (tossMarks as any)(store, ix, { ...base, opp, lastN: 5 }) : null,
      here: venue.length ? (tossMarks as any)(store, ix, { ...base, venue, lastN: win }) : null,
    };
  }) : []), [ready, store, fx.a, fx.b, fx.a_ix, fx.b_ix, fmtIdx, gender, venue, win, market]) as any[];
  if (!ready) return <Working label="Loading…" shape="rows" />;
  const vsName = (i: number) => abbr(store.teamName(i, true));
  const ground = shortVenue(fx.venue);
  const none = !sides.some((s) => s.last?.length);
  return (
    <View>
      <View style={[filterBar.row, { justifyContent: "flex-end" }]}>
        <FilterButton label={`L${win}`} count={win !== 10 ? 1 : 0} onPress={() => { setDraftWin(win); setOpen(true); }} />
      </View>
      <FilterSheet visible={open} onClose={() => setOpen(false)} onClear={() => setDraftWin(10)} onApply={() => { setWin(draftWin); setOpen(false); }}>
        <FilterSection label="Window">
          <ChoiceRow>{WINDOWS.map((n) => <ChoiceChip key={n} label={`L${n}`} on={draftWin === n} onPress={() => setDraftWin(n)} />)}</ChoiceRow>
        </FilterSection>
      </FilterSheet>
      {sides.map((s) => (
        <MarkSection key={s.name} label={s.name} head={<><TeamBadge name={s.name} size={28} /><Text style={markStyles.name} numberOfLines={1}>{s.name}</Text><Text style={markStyles.muted}>toss winner</Text></>}>
          <MarkRow title="Price" sub={market.default ? "Default, no book lists the toss" : `Best of ${market.books.length} book${market.books.length === 1 ? "" : "s"}`} headline={s.side.price.toFixed(2)} headlineSub={s.side.book ? <BookBadge source={s.side.book} /> : "default"} marks={[]} hideWhenEmpty={false} />
          <TossRow title="Last tosses" sub={`Last ${win}`} marks={s.last} vsName={vsName} />
          <TossRow title="At this ground" sub={`${ground} · last ${win}`} marks={s.here} vsName={vsName} />
          <TossRow title={`v ${abbr(s.name === fx.a ? fx.b : fx.a)}`} sub="Head to head · last 5" marks={s.vs} vsName={vsName} />
        </MarkSection>
      ))}
      {none ? <EmptyState title="No toss history yet" body={`No ${fx.fmt} matches with a recorded toss for these sides.`} /> : null}
    </View>
  );
}
