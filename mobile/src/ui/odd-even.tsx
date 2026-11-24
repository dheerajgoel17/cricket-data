/* eslint-disable @typescript-eslint/no-explicit-any */
/* Odd / Even tab: each side's score after N overs, odd or even, from the history (engine parity.js; twin of the site's `pages/OddEven.tsx`). History only: no book prices it. */
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { parityBlocks, parityOvers } from "@cricket/engine/parity.js";
import { venueIndices } from "@cricket/engine/markets.js";
import { FORMATS } from "@cricket/engine/util.js";
import { abbr, shortVenue } from "@site/lib/format";
import { useStore } from "@/lib/use-store";
import { ChoiceChip, ChoiceRow, Chips, ChipsEdge, FilterButton, filterBar } from "@/ui/chips";
import { EmptyState } from "@/ui/empty-state";
import { MarkRow, MarkSection, markStyles, type MarkData } from "@/ui/mark-rows";
import { FilterSection, FilterSheet } from "@/ui/sheet";
import { TeamBadge } from "@/ui/team-badge";
import { Text } from "@/ui/text";
import { color, icon } from "@/ui/tokens";
import { Working } from "@/ui/motion";

const WINDOWS = [5, 10, 20, 30];
const SMALL = 5;
const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });

type Slice = { n: number; odd: number; even: number; typical: number | null; marks: any[] } | null;

function Row({ title, sub, slice, vsName, extra }: { title: string; sub: string; slice: Slice; vsName: (i: number) => string; extra?: string }) {
  if (!slice?.n) return null;
  const marks: MarkData[] = slice.marks.map((x) => ({
    on: x.odd, letter: x.odd ? "O" : "E", label: `${x.odd ? "Odd" : "Even"}, ${x.score} v ${vsName(x.vs)}, ${day(x.date)}`,
    detail: `${x.score} · ${x.odd ? "odd" : "even"} · v ${vsName(x.vs)} · ${day(x.date)}`,
  }));
  return <MarkRow title={title} sub={sub} headline={`${Math.round((slice.odd / slice.n) * 100)}% odd`} headlineSub={`${slice.odd} odd · ${slice.even} even`} marks={marks}
    note={slice.n < SMALL ? `Only ${slice.n} match${slice.n === 1 ? "" : "es"}` : extra} />;
}

export function OddEven({ fx }: { fx: any }) {
  const stats = useStore();
  const store: any = stats.data?.store;
  const ready = !!store && stats.matchesReady; // the store object is the same before and after matches.json joins: memos must key on this
  const fmtIdx = FORMATS.indexOf(fx.fmt), cuts: number[] = parityOvers(fx.fmt);
  const [over, setOver] = useState(String(cuts[0] ?? 5));
  const [win, setWin] = useState(10), [draftWin, setDraftWin] = useState(10), [open, setOpen] = useState(false);
  const gender = fx.gender === "female" ? 1 : 0;
  const venue = useMemo(() => (ready ? ((venueIndices as any)(store, fx.venue) as number[]) : []), [ready, store, fx.venue]);
  const overs = cuts.includes(Number(over)) ? Number(over) : cuts[0];
  const sides = useMemo(() => (ready ? [[fx.a, fx.a_ix, fx.b_ix], [fx.b, fx.b_ix, fx.a_ix]].map(([name, ix, opp]: any) => ({
    name, blocks: ix >= 0 ? (parityBlocks as any)(store, { fmt: fmtIdx, gender, team: ix, opp, venue, overs, lastN: win }) : null,
  })) : []), [ready, store, fx.a, fx.b, fx.a_ix, fx.b_ix, fmtIdx, gender, venue, overs, win]) as { name: string; blocks: any }[];
  if (!ready) return <Working label="Loading…" shape="rows" />;
  if (!cuts.length) return <EmptyState title="Not offered for this format" body="Odd / Even is read at 5-over steps in T20, T10 and ODI matches." />;
  const vsName = (i: number) => abbr(store.teamName(i, true));
  const ground = shortVenue(fx.venue);
  const g = sides.find((s) => s.blocks)?.blocks;
  const empty = !sides.some((s) => s.blocks && [s.blocks.first, s.blocks.second, s.blocks.here, s.blocks.vs].some((x: Slice) => x?.n)) && !g?.ground1?.n && !g?.ground2?.n;
  return (
    <View>
      <View style={filterBar.row}>
        <ChipsEdge><Chips flush items={cuts.map((n) => [String(n), `${n} ov`] as [string, string])} value={String(overs)} onChange={setOver} /></ChipsEdge>
        <FilterButton label={`L${win}`} count={win !== 10 ? 1 : 0} onPress={() => { setDraftWin(win); setOpen(true); }} />
      </View>
      <FilterSheet visible={open} onClose={() => setOpen(false)} onClear={() => setDraftWin(10)} onApply={() => { setWin(draftWin); setOpen(false); }}>
        <FilterSection label="Window">
          <ChoiceRow>{WINDOWS.map((n) => <ChoiceChip key={n} label={`L${n}`} on={draftWin === n} onPress={() => setDraftWin(n)} />)}</ChoiceRow>
        </FilterSection>
      </FilterSheet>
      {empty ? <EmptyState title="No history yet" body={`No ${fx.fmt} matches with an over-by-over score to read.`} /> : (
        <View>
          {sides.map((s) => {
            const b = s.blocks, theirs = abbr(s.name === fx.a ? fx.b : fx.a);
            return (
              <MarkSection key={s.name} label={s.name} head={<><TeamBadge name={s.name} size={icon.lg} /><Text style={markStyles.name} numberOfLines={1}>{s.name}</Text><Text style={markStyles.muted}>after {overs} ov</Text></>}>
                {b ? <>
                  <Row title="Batting 1st" sub={`Last ${win}`} slice={b.first} vsName={vsName} />
                  <Row title="Batting 2nd" sub={`Last ${win}`} slice={b.second} vsName={vsName} />
                  <Row title="At this ground" sub={`${ground} · last ${win}`} slice={b.here} vsName={vsName} />
                  <Row title={`v ${theirs}`} sub="Head to head · last 5" slice={b.vs} vsName={vsName} />
                </> : null}
              </MarkSection>);
          })}
          {g?.ground1?.n || g?.ground2?.n ? (
            <MarkSection label="The ground" head={<><Ionicons name="location-outline" size={icon.lg} color={color["muted-foreground"]} /><Text style={markStyles.name} numberOfLines={1}>{ground}</Text><Text style={markStyles.muted}>every side</Text></>}>
              <Row title="1st innings" sub={`Last ${win}`} slice={g.ground1} vsName={vsName} extra={g.ground1?.typical != null ? `Typical score ${g.ground1.typical}` : undefined} />
              <Row title="2nd innings" sub={`Last ${win}`} slice={g.ground2} vsName={vsName} extra={g.ground2?.typical != null ? `Typical score ${g.ground2.typical}` : undefined} />
            </MarkSection>) : null}
        </View>)}
    </View>
  );
}
