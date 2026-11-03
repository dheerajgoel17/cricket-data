import { push } from "@/lib/nav";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ScrollView, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { router } from "expo-router";
import { Pressable } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { STATS } from "@cricket/engine/rules.js";
import { heatStep } from "@site/lib/heat";
import { odds, pc, shortDate } from "@site/lib/format";
import type { Grid } from "@site/lib/grid";
import { storeQuery } from "@/lib/data";
import { CapsuleTabs } from "@/ui/capsule";
import { LineStepper } from "@/ui/line-stepper";
import { MiniBars } from "@/ui/mini-bars";
import { PlayerAvatar } from "@/ui/player-avatar";
import { Segmented } from "@/ui/segmented";
import { TeamBadge } from "@/ui/team-badge";
import { cap, color, font, num, numLg, radius, space, type, tonal } from "@/ui/tokens";

export const STAT_ITEMS: [string, string][] = Object.entries(STATS).map(([k, v]: any) => [k, v.label as string]);
export const GAMES = [5, 10, 15, 20, 30];
export const HITS: [number, string][] = [[0.5, "50%+"], [0.6, "60%+"], [0.7, "70%+"], [0.8, "80%+"]];

/** A stat value on a tint that says how far it sits from the line: +2 comfortably over, +1 over, 0 on the line, -1 under, -2 well under. */
const HEAT = {
  2: ["rgba(39,218,142,0.45)", color.primary], 1: ["rgba(39,218,142,0.2)", color.primary], 0: ["rgba(245,165,36,0.25)", color.amber], [-1]: ["rgba(255,0,0,0.2)", color.miss], [-2]: ["rgba(255,0,0,0.45)", color.miss],
} as Record<number, [string, string]>;

/** Stat, line and games window (and, for Trends, the hit-rate floor): the controls of the Grid and Trends tabs. */
export function GridFilters({ stat, line, games, hit, onStat, onLine, onGames, onHit }: { stat: string; line: number; games: number; hit?: number; onStat: (s: string) => void; onLine: (l: number) => void; onGames: (n: number) => void; onHit?: (h: number) => void }) {
  return (
    <View style={styles.filters}>
      <View style={styles.bleed}><CapsuleTabs label="Stat" items={STAT_ITEMS.map(([k, l]) => [k, l, false] as [string, string, boolean])} value={stat} onChange={onStat} /></View>
      <View style={styles.row}>
        <LineStepper value={line} label="O" min={0} onStep={(d) => onLine(Math.max(0, Math.round((line + d) * 2) / 2))} />
        <View style={{ flex: 1 }}><Segmented<string> items={GAMES.map((n) => [String(n), `L${n}`] as [string, string])} value={String(games)} onChange={(v) => onGames(Number(v))} label="Games" /></View>
      </View>
      {hit !== undefined && onHit ? <Segmented<string> items={HITS.map(([v, l]) => [String(v), l] as [string, string])} value={String(hit)} onChange={(v) => onHit(Number(v))} label="Minimum hit rate" /> : null}
    </View>
  );
}

const NAME_W = 132, HIT_W = 44, CELL_W = 46, ROW_H = 46;

/** Players down, the team's last fixtures across (the site's `GridTable`). A cell is the stat value, tinted by how far it sits from the line; the player names stay put while the fixtures scroll sideways. */
export function GridTable({ g, teamIdx, line }: { g: Grid; teamIdx: number; line: number }) {
  const stats = useQuery(storeQuery);
  const store: any = stats.data?.store;
  if (!store) return null;
  if (!g.fx.length) return <Text style={styles.note}>No fixtures for this format.</Text>;
  const M = store.M;
  return (
    <View style={styles.table}>
      <View>
        <View style={[styles.cell, { width: NAME_W + HIT_W, height: 52, flexDirection: "row", alignItems: "center" }]}><Text style={[styles.th, { width: NAME_W }]}>Player</Text><Text style={[styles.th, { width: HIT_W, textAlign: "center" }]}>Hit</Text></View>
        {g.body.map(({ p, map }) => {
          const vals = g.fx.filter((m) => map.has(m)).map((m) => map.get(m)[g.def.key] as number);
          const k = vals.filter((v) => v > line).length;
          return (
            <Press scale={1} key={p} onPress={() => push(`/player/${p}`)} accessibilityRole="button" accessibilityLabel={store.playerName(p)} style={({ pressed }) => [styles.cell, styles.rowStart, pressed && { opacity: 0.6 }]}>
              <View style={{ width: NAME_W, flexDirection: "row", alignItems: "center", gap: space.tight }}>
                <PlayerAvatar pid={store.P.id[p]} team={store.teamName(teamIdx)} size={28} />
                <Text style={styles.name} numberOfLines={1}>{store.playerName(p)}</Text>
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
  const stats = useQuery(storeQuery);
  const store: any = stats.data?.store;
  if (!store) return null;
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
  if (!list.length) return <Text style={styles.note}>No player clears that hit rate in the last games. Lower the hit-rate filter or line.</Text>;
  const label = (STATS as any)[stat].label;
  return (
    <View style={styles.bleed}>
      {list.map((i, n) => (
        <Press scale={1} key={`${i.p}-${i.team}`} onPress={() => push(`/player/${i.p}`)} accessibilityRole="button" style={({ pressed }) => [styles.trend, n > 0 && styles.sep, pressed && { backgroundColor: color.card }]}>
          <PlayerAvatar pid={store.P.id[i.p]} team={store.teamName(i.team)} size={44} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={styles.name} numberOfLines={1}>{store.playerName(i.p)}</Text>
            <Text style={styles.desc} numberOfLines={1}><Text style={{ color: color.primary }}>O {line} {label}</Text> · {i.k}/{i.vals.length}</Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 2 }}>
            <Text style={styles.rate}>{pc(i.rate)}</Text>
            <Text style={styles.fairText}>fair {odds(i.rate ? 1 / i.rate : null)}</Text>
          </View>
          <MiniBars last={i.vals.slice(-10).map((v: number) => ({ v, s: v > line ? "hit" : v < line ? "miss" : "push" }))} line={line} />
        </Press>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { gap: space.snug },
  bleed: { marginHorizontal: -space.gutter },
  row: { flexDirection: "row", alignItems: "center", gap: space.snug },
  note: { ...type.footnote, color: color["muted-foreground"] },
  table: { flexDirection: "row", ...tonal, borderRadius: radius.card, overflow: "hidden" },
  cell: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline, paddingHorizontal: space.tight },
  rowStart: { height: ROW_H, flexDirection: "row", alignItems: "center" },
  th: { ...type.caption, ...cap, color: color["muted-foreground"] },
  name: { ...type.callout, fontFamily: font.medium, color: color.foreground, flexShrink: 1 },
  hit: { ...num, fontSize: 15, textAlign: "center", color: color.primary },
  date: { ...type.caption, fontSize: 10, color: color["muted-foreground"], fontFamily: font.data, fontVariant: ["tabular-nums"] },
  value: { minWidth: 32, height: 28, borderRadius: 7, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" },
  valueText: { ...num, fontSize: 15 },
  void: { ...type.caption, fontSize: 9, color: color.amber, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(245,165,36,0.6)", borderRadius: 5, paddingHorizontal: 3, paddingVertical: 1 },
  dash: { ...type.callout, color: color["muted-foreground"] },
  trend: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.gutter, paddingVertical: space.snug + 2 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  desc: { ...type.footnote, color: color["muted-foreground"] },
  rate: { ...numLg, fontSize: 22, letterSpacing: -0.44, lineHeight: 24, color: color.primary },
  fairText: { ...type.caption, color: color["muted-foreground"] },
});
