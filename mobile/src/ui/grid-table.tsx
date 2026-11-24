import { push } from "@/lib/nav";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { HScroll } from "@/ui/h-scroll";
import { FilterSection, FilterSheet } from "@/ui/sheet";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { STATS } from "@cricket/engine/rules.js";
import { heatStep } from "@site/lib/heat";
import { odds, pc, shortDate } from "@site/lib/format";
import type { Grid } from "@site/lib/grid";
import { useStore } from "@/lib/use-store";
import { playerLabel } from "@/lib/player-label";
import { ActiveChip, ChoiceChip, ChoiceRow, FilterButton, ChipsEdge, filterBar } from "@/ui/chips";
import { CapsuleTabs } from "@/ui/capsule";
import { EmptyState, ErrorState } from "@/ui/empty-state";
import { Bleed } from "@/ui/bleed";
import { LineStepper } from "@/ui/line-stepper";
import { MiniBars } from "@/ui/mini-bars";
import { PlayerAvatar } from "@/ui/player-avatar";
import { TeamBadge } from "@/ui/team-badge";
import { cap, color, num, numLg, radius, space, type, tint, fs, surface, t, d, state } from "@/ui/tokens";

export const STAT_ITEMS: [string, string][] = Object.entries(STATS).map(([k, v]: any) => [k, v.label as string]);
export const GAMES = [5, 10, 15, 20, 30];
export const HITS: [number, string][] = [[0.5, "50%+"], [0.6, "60%+"], [0.7, "70%+"], [0.8, "80%+"]];
const DEFAULT_LINE = 0.5;
const DEFAULT_GAMES = 10;
const DEFAULT_HIT = 0.6;

/** A stat value on a tint that says how far it sits from the line: +2 comfortably over, +1 over, 0 on the line, -1 under, -2 well under. */
const HEAT = {
  2: [tint.primary(0.45), color.primary], 1: [tint.primary(0.2), color.primary], 0: [tint.amber(0.25), color.amber], [-1]: [tint.miss(0.2), color.miss], [-2]: [tint.miss(0.45), color.miss],
} as Record<number, [string, string]>;

/** Stat chips + Filters button (Props / Fancy pattern) for Grid and Custom line. Line, games window and (on Custom line) the hit-rate floor sit in a sheet. */
export function GridFilters({ stat, line, games, hit, onStat, onLine, onGames, onHit }: { stat: string; line: number; games: number; hit?: number; onStat: (s: string) => void; onLine: (l: number) => void; onGames: (n: number) => void; onHit?: (h: number) => void }) {
  const [open, setOpen] = useState(false);
  const [draftLine, setDraftLine] = useState(line);
  const [draftGames, setDraftGames] = useState(games);
  const [draftHit, setDraftHit] = useState(hit ?? DEFAULT_HIT);
  useEffect(() => { if (open) { setDraftLine(line); setDraftGames(games); setDraftHit(hit ?? DEFAULT_HIT); } }, [open, line, games, hit]);
  const withHit = hit !== undefined && !!onHit;
  const activeN = (line !== DEFAULT_LINE ? 1 : 0) + (games !== DEFAULT_GAMES ? 1 : 0) + (withHit && hit !== DEFAULT_HIT ? 1 : 0);
  const apply = () => { onLine(draftLine); onGames(draftGames); if (withHit) onHit!(draftHit); setOpen(false); };
  return (
    <View style={styles.filterBleed}>
      <View style={filterBar.row}>
        <ChipsEdge><CapsuleTabs flush label="Stat" items={STAT_ITEMS.map(([k, l]) => [k, l, false] as [string, string, boolean])} value={stat} onChange={onStat} /></ChipsEdge>
        <FilterButton label={`L${games}`} count={activeN} onPress={() => setOpen(true)} />
      </View>
      {activeN > 0 ? (
        <HScroll contentContainerStyle={filterBar.active} accessibilityLabel="Active filters">
          {line !== DEFAULT_LINE ? <ActiveChip label={`Line O ${line}`} onClear={() => onLine(DEFAULT_LINE)} /> : null}
          {games !== DEFAULT_GAMES ? <ActiveChip label={`Window L${games}`} onClear={() => onGames(DEFAULT_GAMES)} /> : null}
          {withHit && hit !== DEFAULT_HIT ? <ActiveChip label={`Hit ${HITS.find(([v]) => v === hit)?.[1] ?? hit}`} onClear={() => onHit!(DEFAULT_HIT)} /> : null}
          <Press scale={1} onPress={() => { onLine(DEFAULT_LINE); onGames(DEFAULT_GAMES); if (withHit) onHit!(DEFAULT_HIT); }} accessibilityRole="button"><Text style={filterBar.clear}>Clear all</Text></Press>
        </HScroll>
      ) : null}
      <FilterSheet visible={open} onClose={() => setOpen(false)} onApply={apply}
        onClear={() => { setDraftLine(DEFAULT_LINE); setDraftGames(DEFAULT_GAMES); setDraftHit(DEFAULT_HIT); }}
      >
        <FilterSection label="Custom line">
          <LineStepper value={draftLine} label="O" min={0} onStep={(d) => setDraftLine(Math.max(0, Math.round((draftLine + d) * 2) / 2))} />
        </FilterSection>
        <FilterSection label="Hit-rate window">
          <ChoiceRow>{GAMES.map((n) => <ChoiceChip key={n} label={`L${n}`} on={draftGames === n} onPress={() => setDraftGames(n)} />)}</ChoiceRow>
        </FilterSection>
        {withHit ? (
          <FilterSection label="Minimum hit rate">
            <ChoiceRow>{HITS.map(([v, l]) => <ChoiceChip key={v} label={l} on={draftHit === v} onPress={() => setDraftHit(v)} />)}</ChoiceRow>
          </FilterSection>
        ) : null}
      </FilterSheet>
    </View>
  );
}

const NAME_W = 132, HIT_W = 44, CELL_W = 46, ROW_H = 46;

/** Players down, the team's last fixtures across (the site's `GridTable`). A cell is the stat value, tinted by how far it sits from the line; the player names stay put while the fixtures scroll sideways. */
export function GridTable({ g, teamIdx, line }: { g: Grid; teamIdx: number; line: number }) {
  const stats = useStore();
  const store: any = stats.data?.store, names = stats.data?.names;
  if (!store || !stats.matchesReady || !store.M) return <ErrorState compact title="Could not load grid" body="The stats data is not ready yet." onRetry={() => void stats.refetch()} />;
  if (!g.fx.length) return <EmptyState compact title="No fixtures" body="No fixtures for this format." />;
  const M = store.M;
  const label = (i: number) => playerLabel(store, names, i);
  return (
    <View style={styles.table}>
      <View>
        <View style={[styles.cell, { width: NAME_W + HIT_W, height: 52, flexDirection: "row", alignItems: "center" }]}><Text style={[styles.th, { width: NAME_W }]}>Player</Text><Text style={[styles.th, { width: HIT_W, textAlign: "center" }]}>Hit</Text></View>
        {g.body.map(({ p, map }) => {
          const vals = g.fx.filter((m) => map.has(m)).map((m) => map.get(m)[g.def.key] as number);
          const k = vals.filter((v) => v > line).length;
          return (
            <Press scale={1} key={p} onPress={() => push(`/player/${p}`)} accessibilityRole="button" accessibilityLabel={label(p)} style={({ pressed }) => [styles.cell, styles.rowStart, pressed && state.pressed]}>
              <View style={{ width: NAME_W, flexDirection: "row", alignItems: "center", gap: space.tight }}>
                <PlayerAvatar pid={store.P.id[p]} team={store.teamName(teamIdx)} size={28} />
                <Text style={styles.name} numberOfLines={1}>{label(p)}</Text>
              </View>
              <Text style={[styles.hit, { width: HIT_W }]}>{vals.length ? `${k}/${vals.length}` : "–"}</Text>
            </Press>
          );
        })}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        <View>
          <View style={[styles.cell, { height: 52, flexDirection: "row" }]}>
            {g.fx.map((m) => {
              const opp = M.a[m] === teamIdx ? M.b[m] : M.a[m];
              return <View key={m} style={{ width: CELL_W, alignItems: "center", justifyContent: "center", gap: 2 }}><TeamBadge name={store.teamName(opp, true)} size={20} /><Text style={styles.date}>{shortDate(M.d[m])}</Text></View>;
            })}
          </View>
          {g.body.map(({ p, map, xi }) => (
            <View key={p} style={[styles.cell, styles.rowStart]}>
              {g.fx.map((m) => {
                const x = map.get(m);
                const [bg, fg] = x ? HEAT[heatStep(x[g.def.key], line)] : ["transparent", color["muted-foreground"]];
                return (
                  <View key={m} style={{ width: CELL_W, alignItems: "center" }}>
                    {x ? <View style={[styles.value, { backgroundColor: bg }]}><Text style={[styles.valueText, { color: fg }]}>{x[g.def.key]}</Text></View>
                      : xi?.has(m) && store.M.xq?.[m] !== 0 ? <Text style={styles.void}>VOID</Text> : <Text style={styles.dash}>–</Text>}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/** Players whose recent games clear the line most often, as list rows (picture, line and record, hit rate, last-10 bars) (the site's `TrendCards`). */
export function TrendList({ grids, line, minHit, stat }: { grids: { g: Grid; team: number }[]; line: number; minHit: number; stat: string }) {
  const stats = useStore();
  const store: any = stats.data?.store, names = stats.data?.names;
  if (!store || !stats.matchesReady) return <ErrorState compact title="Could not load trends" body="The stats data is not ready yet." onRetry={() => void stats.refetch()} />;
  const items: any[] = [];
  for (const { g, team } of grids) for (const r of g.body) {
    const played = g.fx.filter((m) => r.map.has(m));
    const vals = played.map((m) => r.map.get(m)[g.def.key] as number);
    if (vals.length < 5) continue;
    const k = vals.filter((v) => v > line).length;
    items.push({ p: r.p, team, vals, k, rate: k / vals.length });
  }
  items.sort((a, b) => b.rate - a.rate || b.vals.length - a.vals.length);
  const list = items.filter((i) => i.rate >= minHit).slice(0, 24);
  if (!list.length) return <EmptyState compact title="No one clears that bar" body="Lower the hit-rate filter or the line to see more players." />;
  const label = (STATS as any)[stat].label;
  const who = (i: number) => playerLabel(store, names, i);
  return (
    <Bleed style={{ paddingHorizontal: 0 }}>
      {list.map((i, n) => (
        <Press scale={1} key={`${i.p}-${i.team}`} onPress={() => push(`/player/${i.p}`)} accessibilityRole="button" style={({ pressed }) => [styles.trend, n > 0 && styles.sep, pressed && { backgroundColor: color.card }]}>
          <PlayerAvatar pid={store.P.id[i.p]} team={store.teamName(i.team)} size={44} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={styles.name} numberOfLines={1}>{who(i.p)}</Text>
            <Text style={styles.desc} numberOfLines={1}><Text style={{ color: color.primary }}>O {line} {label}</Text> · {i.k}/{i.vals.length}</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Text style={styles.rate}>{pc(i.rate)}</Text>
            <Text style={styles.fairText}>fair {odds(i.rate ? 1 / i.rate : null)}</Text>
          </View>
          <MiniBars last={i.vals.slice(-10).map((v: number) => ({ v, s: v > line ? "hit" : v < line ? "miss" : "push" }))} line={line} />
        </Press>
      ))}
    </Bleed>
  );
}

const styles = StyleSheet.create({
  filterBleed: { marginHorizontal: -space.gutter },
  table: { flexDirection: "row", ...surface.card, overflow: "hidden" },
  cell: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline, paddingHorizontal: space.tight },
  rowStart: { height: ROW_H, flexDirection: "row", alignItems: "center" },
  th: { ...type.footnote, ...cap, color: color["muted-foreground"] },
  name: { ...t.calloutLabel, color: color.foreground, flexShrink: 1 },
  hit: { ...num, fontSize: fs.body, textAlign: "center", color: color.primary },
  date: { ...d.caption, color: color["muted-foreground"] },
  value: { minWidth: 32, height: 28, borderRadius: radius.sm, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  valueText: { ...num, fontSize: fs.body },
  void: { ...type.caption, color: color.amber, borderWidth: 1, borderStyle: "dashed", borderColor: tint.amber(0.6), borderRadius: 5, paddingHorizontal: 3, paddingVertical: 1 },
  dash: { ...type.callout, color: color["muted-foreground"] },
  trend: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.gutter, paddingVertical: space.snug + 2 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  desc: { ...type.footnote, color: color["muted-foreground"] },
  rate: { ...numLg, fontSize: fs.figure, letterSpacing: -0.44, lineHeight: 24, color: color.primary },
  fairText: { ...type.caption, color: color["muted-foreground"] },
});
