import { Profiler, useMemo, useState } from "react";
import { mark, onRender } from "@/lib/perf";
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import type { HomePhase } from "@site/lib/home-phase";
import { seriesName, shortSeries } from "@/lib/format";
import { EMPTY_PHASE, phaseView, seriesChips, type RailItem } from "@/lib/rail";
import { useNow } from "@/lib/use-now";
import { useRail } from "@/lib/use-rail";
import { AppHeader } from "@/ui/brand";
import { Chips } from "@/ui/chips";
import { EmptyState } from "@/ui/empty-state";
import { FixtureCard } from "@/ui/fixture-card";
import { HotHome } from "@/ui/hot-home";
import { RailCard } from "@/ui/rail-card";
import { useScreenInsets } from "@/ui/insets";
import { enter, Skeleton } from "@/ui/motion";
import { PhaseBar } from "@/ui/phase-bar";
import { color, FIXTURE_CARD_SHARE, radius, space } from "@/ui/tokens";
import { TabFade } from "@/ui/tab-fade";

export default function Fixtures() {
  mark("render:Fixtures");
  const { ready, items, error, refetch } = useRail();
  // the pull-to-refresh spinner follows only a pull: the 15 s live poll refetches on its own and must not open it
  const [pulling, setPulling] = useState(false);
  const pull = () => { setPulling(true); void refetch().finally(() => setPulling(false)); };
  const now = useNow();
  const inset = useScreenInsets();
  const { width } = useWindowDimensions();
  const [asked, setAsked] = useState<HomePhase>();
  const [series, setSeries] = useState("all");

  const { counts, phase, shown: inPhase } = useMemo(() => phaseView(items, asked), [items, asked]);
  const seriesCounts = useMemo(() => seriesChips(inPhase, seriesName), [inPhase]); // every series in the bucket: those with props first, then the biggest
  const sel = seriesCounts.some(([n]) => n === series) ? series : "all";
  const shown = useMemo(() => (sel === "all" ? inPhase : inPhase.filter((i) => seriesName(i.fixture) === sel)), [inPhase, sel]);
  const chips = useMemo<[string, string, number][]>(() => [["all", "All", inPhase.length], ...seriesCounts.map(([n, k]) => [n, shortSeries(n), k] as [string, string, number])], [inPhase, seriesCounts]);

  const cardW = Math.round(width * FIXTURE_CARD_SHARE);
  const railX = useSharedValue(0);
  const onRail = useAnimatedScrollHandler((e) => { railX.value = e.contentOffset.x; });
  const gap = space.snug;

  return (
    <View style={[styles.root, { paddingTop: inset.top }]}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={{ paddingBottom: inset.bottom + 96 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={pull} tintColor={color.foreground} colors={[color.primary]} progressBackgroundColor={color.card} />}
        showsVerticalScrollIndicator={false}>
        {ready && inPhase.length > 0 ? <Chips items={chips} value={sel} onChange={setSeries} /> : null}
        {!ready ? (
          error ? <View style={styles.emptyPad}><EmptyState title="Could not load fixtures" body="Pull to retry." /></View> : <RailSkeleton width={cardW} />
        ) : shown.length === 0 ? (
          <View style={styles.emptyPad}><EmptyState title={EMPTY_PHASE[phase].title} body={EMPTY_PHASE[phase].body} /></View>
        ) : (
          <Animated.FlatList<RailItem>
            key={`${phase}|${sel}`}
            horizontal
            data={shown}
            keyExtractor={(i) => `${i.fixture.id}${i.fixture.a}${i.fixture.b}`}
            renderItem={({ item, index }) => <Animated.View entering={enter(index)} style={{ width: cardW }}><RailCard x={railX} index={index} step={cardW + gap}><FixtureCard item={item} now={now} /></RailCard></Animated.View>}
            onScroll={onRail}
            scrollEventThrottle={16}
            ItemSeparatorComponent={() => <View style={{ width: gap }} />}
            getItemLayout={(_, index) => ({ length: cardW + gap, offset: (cardW + gap) * index, index })}
            initialNumToRender={2}
            windowSize={3}
            maxToRenderPerBatch={2}
            removeClippedSubviews
            snapToInterval={cardW + gap}
            snapToAlignment="start"
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space.snug }}
            showsHorizontalScrollIndicator={false}
          />
        )}
        {ready ? <Profiler id="hothome" onRender={onRender}><HotHome phase={phase} /></Profiler> : null}
      </ScrollView>
      <TabFade />
      <PhaseBar value={phase} counts={counts} onChange={setAsked} />
    </View>
  );
}

function RailSkeleton({ width }: { width: number }) {
  return (
    <View style={styles.skeletonRow}>
      <Skeleton style={[styles.skeleton, { width }]} />
      <Skeleton style={[styles.skeleton, { width }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  emptyPad: { paddingVertical: space.stack, paddingHorizontal: space.gutter },
  skeletonRow: { flexDirection: "row", gap: space.snug, paddingTop: space.snug, paddingHorizontal: space.gutter },
  skeleton: { height: 190, borderRadius: radius.card },
});
