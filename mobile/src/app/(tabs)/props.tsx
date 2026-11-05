import { mark } from "@/lib/perf";
import { lazyTab } from "@/ui/lazy-tab";
import { useMemo, useState } from "react";
import { Platform, RefreshControl, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQueryClient } from "@tanstack/react-query";
import { hotDayLabels } from "@site/lib/hot-lines";
import { MAX_ROWS } from "@/lib/hot";
import { useHotView } from "@/lib/use-hot";
import { AppHeader } from "@/ui/brand";
import { Chips } from "@/ui/chips";
import { EmptyState } from "@/ui/empty-state";
import { InfoButton } from "@/ui/info-button";
import { useScreenInsets } from "@/ui/insets";
import { Working } from "@/ui/motion";
import { PropRow } from "@/ui/prop-row";
import { color, space } from "@/ui/tokens";
import { TabFade } from "@/ui/tab-fade";

/** Player props: every line the books price for a day, scored against the player's history and ranked (matches in play, hit rate, edge). Today by default; the chips pick another of the next ten days. */
function PlayerProps() {
  mark("render:PlayerProps");
  const inset = useScreenInsets();
  const [day, setDay] = useState("0");
  const [pulling, setPulling] = useState(false);
  const days = useMemo(() => (hotDayLabels() as [string, string][]).map(([id, label]) => [id, label] as [string, string]), []);
  const { rows, isLoading, scoring, error, otherDay, soFarOf, outOf, refetch } = useHotViewWithRefetch(Number(day));
  const shown = rows.slice(0, MAX_ROWS);
  const pull = () => { setPulling(true); void refetch().finally(() => setPulling(false)); };
  const header = (
    <View>
      <Chips items={days} value={day} onChange={setDay} />
    </View>
  );
  // FlashList recycles off-screen rows. Tighter drawDistance on Android; RefreshControl on both (iOS bounce + Material spinner).
  return (
    <View style={[styles.root, { paddingTop: inset.top }]}>
      <AppHeader title="Player props" info={<InfoButton topic="player-props" />} />
      <FlashList
        data={isLoading ? [] : shown}
        keyExtractor={(r) => `${r.idx}${r.stat}${r.start}${r.inn}`}
        renderItem={({ item, index }) => <PropRow r={item} i={index} soFar={soFarOf(item)} out={outOf(item)} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          isLoading || (scoring && !shown.length) ? <Working label="Scoring the day's lines…" rows={5} />
            : error ? <View style={styles.emptyPad}><EmptyState title="Could not score the lines" body="Try again in a moment." /></View>
            : (
              <View style={styles.emptyPad}>
                <EmptyState
                  title={day === "0" ? "No props priced today" : "No props for this day"}
                  body={otherDay ? `${otherDay} lines are priced on other days — pick another chip above.` : "Lines usually land a few hours before the toss."}
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
      <TabFade />
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
  emptyPad: { paddingVertical: space.stack, paddingHorizontal: space.gutter },
});

export default lazyTab(PlayerProps);
