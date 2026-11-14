import { mark } from "@/lib/perf";
import { lazyTab } from "@/ui/lazy-tab";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Platform, RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { hotDayLabels, matchChipId } from "@site/lib/hot-lines";
import { abbr } from "@site/lib/format";
import {
  DEFAULTS, WIN_LABEL, activeFilters, clearFilter, enoughHistory, narrow, options, order, type Screener,
} from "@site/lib/screener";
import { MAX_ROWS } from "@/lib/hot";
import { useHotView } from "@/lib/use-hot";
import { AppHeader } from "@/ui/brand";
import { Chips } from "@/ui/chips";
import { EmptyState } from "@/ui/empty-state";
import { InfoButton } from "@/ui/info-button";
import { useScreenInsets } from "@/ui/insets";
import { Working } from "@/ui/motion";
import { Press } from "@/ui/press";
import { PropRow } from "@/ui/prop-row";
import { ScreenerFilters } from "@/ui/screener-filters";
import { Text } from "@/ui/text";
import { color, control, font, radius, space, type } from "@/ui/tokens";
import { TabFade } from "@/ui/tab-fade";

const WINS = Object.entries(WIN_LABEL) as [string, string][];
const NEED: Record<string, number> = { l5: 3, l10: 5, season: 5, h2h: 3, ven: 3 };

/** Player props: day's lines with screener filters (site Props / ScreenerFilters). */
function PlayerProps() {
  mark("render:PlayerProps");
  const inset = useScreenInsets();
  const [sc, setSc] = useState<Screener>({ ...DEFAULTS });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pulling, setPulling] = useState(false);
  const days = useMemo(() => (hotDayLabels() as [string, string][]).map(([id, label]) => [id, label] as [string, string]), []);
  const { rows: raw, isLoading, scoring, error, otherDay, soFarOf, outOf, refetch } = useHotViewWithRefetch(Number(sc.day));
  const dayRows = useMemo(() => raw.map((r) => ({ ...r, live: r.quotes?.some((q: any) => q.live), out: outOf(r) })), [raw, outOf]);
  const matchChips = useMemo(() => {
    const m = new Map<string, { id: string; a: string; b: string }>();
    for (const r of dayRows) {
      const id = matchChipId(r.match, r.start, r.fmt);
      if (!m.has(id)) {
        const [a, b] = String(r.match).split(/\s+vs\s+/i);
        m.set(id, { id, a: a || "", b: b || "" });
      }
    }
    return [...m.values()];
  }, [dayRows]);
  const pick = matchChips.some((c) => c.id === sc.match) ? sc.match : "all";
  const scored = useMemo(() => dayRows
    .filter((r) => r.day === Number(sc.day) && (pick === "all" || matchChipId(r.match, r.start, r.fmt) === pick)
      && (sc.stat === "all" || r.stat === sc.stat) && enoughHistory(r, sc.win, NEED[sc.win] ?? 5)), [dayRows, sc.day, sc.stat, sc.win, pick]);
  const shown = useMemo(() => order(narrow(scored as any, { ...sc, match: pick }), { ...sc, match: pick }).slice(0, MAX_ROWS), [scored, sc, pick]);
  const choices = useMemo(() => ({
    days, matches: matchChips.map((c) => ({ id: c.id, label: `${abbr(c.a)} v ${abbr(c.b)}` })),
    teams: options(dayRows as any, "team"), formats: options(dayRows as any, "fmt"), comps: options(dayRows as any, "comp"),
    winLabel: Object.fromEntries(WINS),
  }), [days, matchChips, dayRows]);
  const active = useMemo(() => activeFilters({ ...sc, match: pick }, {
    day: (d) => days.find(([k]) => k === d)?.[1] ?? d,
    match: (id) => choices.matches.find((m) => m.id === id)?.label ?? id,
  }), [sc, pick, days, choices.matches]);
  const pull = () => { setPulling(true); void refetch().finally(() => setPulling(false)); };
  const header = (
    <View>
      <View style={styles.toolbar}>
        <View style={{ flex: 1 }}><Chips items={days} value={sc.day} onChange={(day) => setSc((s) => ({ ...s, day, match: "all" }))} /></View>
        <Press accessibilityRole="button" accessibilityLabel={`Filters${active.length ? `, ${active.length} active` : ""}`} onPress={() => setFiltersOpen(true)} style={[styles.filterBtn, active.length > 0 && styles.filterOn]}>
          <Ionicons name="options-outline" size={18} color={active.length ? color.primary : color.foreground} />
          <Text style={[styles.filterTxt, active.length > 0 && { color: color.primary }]}>{active.length ? `L${sc.win === "l5" ? 5 : sc.win === "l10" ? 10 : ""}` : "Filters"}{active.length ? ` · ${active.length}` : ""}</Text>
        </Press>
      </View>
      {active.length ? (
        <View style={styles.activeRow}>
          {active.map((f) => (
            <Press key={f.key} accessibilityRole="button" accessibilityLabel={`Remove ${f.label}`} onPress={() => setSc((s) => clearFilter(s, f.key))} style={styles.activeChip}>
              <Text style={styles.activeChipTxt}>{f.label} {f.value}</Text>
              <Ionicons name="close" size={12} color={color.primary} />
            </Press>
          ))}
          <Press accessibilityRole="button" onPress={() => setSc({ ...DEFAULTS })}><Text style={styles.clearAll}>Clear all</Text></Press>
        </View>
      ) : null}
    </View>
  );
  return (
    <View style={[styles.root, { paddingTop: inset.top }]}>
      <AppHeader title="Player props" info={<InfoButton topic="player-props" />} />
      <FlashList
        data={isLoading ? [] : (shown as any[])}
        keyExtractor={(r: any) => `${r.idx}${r.stat}${r.start}${r.inn}${r.quotes?.some((q: any) => q.live) ? "L" : ""}`}
        renderItem={({ item, index }: { item: any; index: number }) => <PropRow r={item} i={index} soFar={soFarOf(item)} out={outOf(item)} bars={sc.bars} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          isLoading || (scoring && !shown.length) ? <Working label="Scoring the day's lines…" rows={5} />
            : error ? <View style={styles.emptyPad}><EmptyState title="Could not score the lines" body="Try again in a moment." /></View>
            : (
              <View style={styles.emptyPad}>
                <EmptyState
                  title={sc.day === "0" ? "No props priced today" : "No props for this day"}
                  body={active.length
                    ? "Nothing matches these filters — clear one above."
                    : otherDay ? `${otherDay} lines are priced on other days — pick another chip above.` : "Lines usually land a few hours before the toss."}
                  action={active.length ? <Press onPress={() => setSc({ ...DEFAULTS })}><Text style={styles.link}>Clear filters</Text></Press> : undefined}
                />
              </View>
            )
        }
        ListFooterComponent={scoring && shown.length ? <Working label="Scoring more lines…" rows={2} /> : null}
        contentContainerStyle={{ paddingBottom: inset.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        drawDistance={Platform.OS === "android" ? 280 : 480}
        removeClippedSubviews={Platform.OS === "android"}
        maintainVisibleContentPosition={{ disabled: true }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={pull} tintColor={color.foreground} colors={[color.primary]} progressBackgroundColor={color.card} />}
      />
      <ScreenerFilters open={filtersOpen} onOpenChange={setFiltersOpen} state={{ ...sc, match: pick }} onApply={setSc} choices={choices} />
      <TabFade />
    </View>
  );
}

function useHotViewWithRefetch(day: number) {
  const view = useHotView({ day });
  const qc = useQueryClient();
  return { ...view, refetch: () => qc.invalidateQueries({ queryKey: ["hot-rows", day] }) };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  emptyPad: { paddingVertical: space.stack, paddingHorizontal: space.gutter },
  toolbar: { flexDirection: "row", alignItems: "center", gap: space.tight },
  filterBtn: { height: control, flexDirection: "row", alignItems: "center", gap: space.tight, paddingHorizontal: space.snug, borderRadius: radius.chip, backgroundColor: color.card, marginRight: space.gutter },
  filterOn: { backgroundColor: "rgba(39,218,142,0.15)" },
  filterTxt: { ...type.callout, fontFamily: font.medium, color: color.foreground },
  activeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.tight, paddingHorizontal: space.gutter, paddingBottom: space.snug },
  activeChip: { height: control, flexDirection: "row", alignItems: "center", gap: space.hair, paddingHorizontal: space.snug, borderRadius: radius.chip, backgroundColor: "rgba(39,218,142,0.15)" },
  activeChipTxt: { ...type.callout, color: color.primary },
  clearAll: { ...type.callout, fontFamily: font.medium, color: color["muted-foreground"], paddingHorizontal: space.snug },
  link: { ...type.callout, fontFamily: font.medium, color: color.primary },
});

export default lazyTab(PlayerProps);
