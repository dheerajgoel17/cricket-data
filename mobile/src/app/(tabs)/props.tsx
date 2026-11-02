import { useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Text } from "@/ui/text";
import { useQueryClient } from "@tanstack/react-query";
import { hotDayLabels } from "@site/lib/hot-lines";
import { MAX_ROWS } from "@/lib/hot";
import { useHotView } from "@/lib/use-hot";
import { AppHeader } from "@/ui/brand";
import { Chips } from "@/ui/chips";
import { InfoButton } from "@/ui/info-button";
import { useScreenInsets } from "@/ui/insets";
import { Working } from "@/ui/motion";
import { PropRow } from "@/ui/prop-row";
import { color, space, type } from "@/ui/tokens";

/** Player props: every line the books price for a day, scored against the player's history and ranked (matches in play, hit rate, edge). Today by default; the chips pick another of the next ten days. */
export default function PlayerProps() {
  const inset = useScreenInsets();
  const [day, setDay] = useState("0");
  const days = useMemo(() => (hotDayLabels() as [string, string][]).map(([id, label]) => [id, label] as [string, string]), []);
  const { rows, isLoading, scoring, error, otherDay, soFarOf, outOf, refetch } = useHotViewWithRefetch(Number(day));
  const shown = rows.slice(0, MAX_ROWS);
  const header = (
    <View>
      <View style={styles.titleBox}>
        <View style={styles.titleRow}><Text style={styles.title}>Player props</Text><InfoButton topic="player-props" /></View>
      </View>
      <Chips items={days} value={day} onChange={setDay} />
    </View>
  );
  // A recycling list (FlashList): only the rows on screen exist, however many there are, and a row scrolled away is reused for the next one.
  return (
    <View style={[styles.root, { paddingTop: inset.top }]}>
      <AppHeader />
      <FlashList
        data={isLoading ? [] : shown}
        keyExtractor={(r) => `${r.idx}${r.stat}${r.start}${r.inn}`}
        renderItem={({ item, index }) => <PropRow r={item} i={index} soFar={soFarOf(item)} out={outOf(item)} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          isLoading || (scoring && !shown.length) ? <Working label="Scoring the day's lines…" rows={5} />
            : error ? <Text style={styles.empty}>Could not score the lines. Try again in a moment.</Text>
            : <Text style={styles.empty}>{day === "0" ? "No player props are priced for today yet." : "No player props are priced for this day yet."}{otherDay ? ` ${otherDay} lines are priced on other days.` : ""}</Text>
        }
        ListFooterComponent={scoring && shown.length ? <Working label="Scoring more lines…" rows={2} /> : null}
        contentContainerStyle={{ paddingBottom: inset.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        maintainVisibleContentPosition={{ disabled: true }}
        refreshing={false}
        onRefresh={Platform.OS === "ios" ? () => void refetch() : undefined}
      />
    </View>
  );
}

// `useHotView` plus a way to ask again, for pull to refresh.
function useHotViewWithRefetch(day: number) {
  const view = useHotView({ day });
  const qc = useQueryClient();
  return { ...view, refetch: () => qc.invalidateQueries({ queryKey: ["hot-rows", day] }) };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  titleBox: { paddingHorizontal: space.gutter, paddingTop: space.stack, gap: space.tight },
  title: { ...type.display, color: color.foreground },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.snug },
  empty: { ...type.callout, color: color["muted-foreground"], paddingVertical: space.section, paddingHorizontal: space.gutter },
});
