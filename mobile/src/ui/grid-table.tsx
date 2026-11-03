import { push } from "@/lib/nav";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
import { TeamBadge } from "@/ui/team-badge";
import { cap, color, control, font, num, numLg, radius, space, type, tonal } from "@/ui/tokens";

export const STAT_ITEMS: [string, string][] = Object.entries(STATS).map(([k, v]: any) => [k, v.label as string]);
export const GAMES = [5, 10, 15, 20, 30];
export const HITS: [number, string][] = [[0.5, "50%+"], [0.6, "60%+"], [0.7, "70%+"], [0.8, "80%+"]];
const DEFAULT_LINE = 0.5;
const DEFAULT_GAMES = 10;
const DEFAULT_HIT = 0.6;

/** A stat value on a tint that says how far it sits from the line: +2 comfortably over, +1 over, 0 on the line, -1 under, -2 well under. */
const HEAT = {
  2: ["rgba(39,218,142,0.45)", color.primary], 1: ["rgba(39,218,142,0.2)", color.primary], 0: ["rgba(245,165,36,0.25)", color.amber], [-1]: ["rgba(255,0,0,0.2)", color.miss], [-2]: ["rgba(255,0,0,0.45)", color.miss],
} as Record<number, [string, string]>;

/** Stat chips + Filters button (Props / Fancy pattern) for Grid and Custom line. Line, games window and (on Custom line) the hit-rate floor sit in a sheet. */
export function GridFilters({ stat, line, games, hit, onStat, onLine, onGames, onHit }: { stat: string; line: number; games: number; hit?: number; onStat: (s: string) => void; onLine: (l: number) => void; onGames: (n: number) => void; onHit?: (h: number) => void }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [draftLine, setDraftLine] = useState(line);
  const [draftGames, setDraftGames] = useState(games);
  const [draftHit, setDraftHit] = useState(hit ?? DEFAULT_HIT);
  useEffect(() => { if (open) { setDraftLine(line); setDraftGames(games); setDraftHit(hit ?? DEFAULT_HIT); } }, [open, line, games, hit]);
  const withHit = hit !== undefined && !!onHit;
  const activeN = (line !== DEFAULT_LINE ? 1 : 0) + (games !== DEFAULT_GAMES ? 1 : 0) + (withHit && hit !== DEFAULT_HIT ? 1 : 0);
  const apply = () => { onLine(draftLine); onGames(draftGames); if (withHit) onHit!(draftHit); setOpen(false); };
  return (
    <View style={styles.filters}>
      <View style={styles.filterRow}>
        <View style={styles.chipFlex}><CapsuleTabs label="Stat" items={STAT_ITEMS.map(([k, l]) => [k, l, false] as [string, string, boolean])} value={stat} onChange={onStat} /></View>
        <Press scale={1} onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Filters${activeN ? `, ${activeN} active` : ""}`} style={styles.filterBtn}>
          <Ionicons name="options-outline" size={16} color={color.foreground} />
          <Text style={styles.filterLbl}>L{games}</Text>
          {activeN > 0 ? <View style={styles.filterBadge}><Text style={styles.filterBadgeTxt}>{activeN}</Text></View> : null}
        </Press>
      </View>
      {activeN > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeRow} accessibilityLabel="Active filters">
          {line !== DEFAULT_LINE ? <Press scale={1} onPress={() => onLine(DEFAULT_LINE)} accessibilityRole="button" style={styles.activeChip}><Text style={styles.activeChipTxt}>Line O {line}</Text><Ionicons name="close" size={12} color={color.primary} /></Press> : null}
          {games !== DEFAULT_GAMES ? <Press scale={1} onPress={() => onGames(DEFAULT_GAMES)} accessibilityRole="button" style={styles.activeChip}><Text style={styles.activeChipTxt}>Window L{games}</Text><Ionicons name="close" size={12} color={color.primary} /></Press> : null}
          {withHit && hit !== DEFAULT_HIT ? <Press scale={1} onPress={() => onHit!(DEFAULT_HIT)} accessibilityRole="button" style={styles.activeChip}><Text style={styles.activeChipTxt}>Hit {HITS.find(([v]) => v === hit)?.[1] ?? hit}</Text><Ionicons name="close" size={12} color={color.primary} /></Press> : null}
          <Press scale={1} onPress={() => { onLine(DEFAULT_LINE); onGames(DEFAULT_GAMES); if (withHit) onHit!(DEFAULT_HIT); }} accessibilityRole="button"><Text style={styles.clearAll}>Clear all</Text></Press>
        </ScrollView>
      ) : null}
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close filters" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.stack) }]} accessibilityViewIsModal>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>Filters</Text>
            <Press scale={1} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close" style={styles.round}><Ionicons name="close" size={20} color={color.foreground} /></Press>
          </View>
          <Text style={styles.sheetSec}>Custom line</Text>
          <LineStepper value={draftLine} label="O" min={0} onStep={(d) => setDraftLine(Math.max(0, Math.round((draftLine + d) * 2) / 2))} />
          <Text style={styles.sheetSec}>Hit-rate window</Text>
          <View style={styles.sheetChips}>{GAMES.map((n) => (
            <Press key={n} scale={1} onPress={() => setDraftGames(n)} accessibilityRole="button" style={[styles.sheetChip, draftGames === n && styles.sheetChipOn]}>
              <Text style={[styles.sheetChipTxt, draftGames === n && styles.sheetChipTxtOn]}>L{n}</Text>
            </Press>
          ))}</View>
          {withHit ? (
            <>
              <Text style={styles.sheetSec}>Minimum hit rate</Text>
              <View style={styles.sheetChips}>{HITS.map(([v, l]) => (
                <Press key={v} scale={1} onPress={() => setDraftHit(v)} accessibilityRole="button" style={[styles.sheetChip, draftHit === v && styles.sheetChipOn]}>
                  <Text style={[styles.sheetChipTxt, draftHit === v && styles.sheetChipTxtOn]}>{l}</Text>
                </Press>
              ))}</View>
            </>
          ) : null}
          <View style={styles.sheetFoot}>
            <Press scale={1} onPress={() => { setDraftLine(DEFAULT_LINE); setDraftGames(DEFAULT_GAMES); setDraftHit(DEFAULT_HIT); }} accessibilityRole="button" style={styles.sheetClear}><Text style={styles.sheetClearTxt}>Clear</Text></Press>
            <Press scale={1} onPress={apply} accessibilityRole="button" style={styles.sheetApply}><Text style={styles.sheetApplyTxt}>Apply</Text></Press>
          </View>
        </View>
      </Modal>
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
  filterRow: { flexDirection: "row", alignItems: "center", gap: space.snug },
  chipFlex: { flex: 1, minWidth: 0, marginHorizontal: -space.gutter },
  filterBtn: { height: control, flexDirection: "row", alignItems: "center", gap: space.tight, paddingHorizontal: space.snug, borderRadius: radius.chip, backgroundColor: color.card },
  filterLbl: { ...type.callout, color: color.foreground },
  filterBadge: { position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: color.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  filterBadgeTxt: { ...type.caption, fontFamily: font.bold, color: color.background },
  activeRow: { gap: space.snug, paddingVertical: space.tight },
  activeChip: { height: control, flexDirection: "row", alignItems: "center", gap: space.hair, paddingLeft: space.snug, paddingRight: space.tight, borderRadius: radius.chip, backgroundColor: "rgba(39,218,142,0.15)" },
  activeChipTxt: { ...type.callout, color: color.primary },
  clearAll: { ...type.callout, fontFamily: font.medium, color: color["muted-foreground"], paddingHorizontal: space.snug, lineHeight: control },
  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { marginTop: "auto", backgroundColor: color.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: space.gutter, paddingTop: space.stack, gap: space.snug },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.tight },
  sheetTitle: { ...type.title, color: color.foreground },
  sheetSec: { ...type.body, fontFamily: font.medium, color: color.foreground, marginTop: space.snug },
  sheetChips: { flexDirection: "row", flexWrap: "wrap", gap: space.snug },
  sheetChip: { height: control, paddingHorizontal: space.snug, borderRadius: radius.chip, backgroundColor: color.card, alignItems: "center", justifyContent: "center" },
  sheetChipOn: { backgroundColor: color.foreground },
  sheetChipTxt: { ...type.callout, color: color.foreground },
  sheetChipTxtOn: { color: color.background },
  sheetFoot: { flexDirection: "row", gap: space.snug, marginTop: space.stack },
  sheetClear: { flex: 1, height: 48, borderRadius: 999, backgroundColor: color.secondary, alignItems: "center", justifyContent: "center" },
  sheetClearTxt: { ...type.body, color: color.foreground },
  sheetApply: { flex: 2, height: 48, borderRadius: 999, backgroundColor: color.primary, alignItems: "center", justifyContent: "center" },
  sheetApplyTxt: { ...type.body, fontFamily: font.medium, color: color.background },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.secondary, alignItems: "center", justifyContent: "center" },
  bleed: { marginHorizontal: -space.gutter },
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
