import { useMemo, useState } from "react";
import { FlatList, Platform, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Text } from "@/ui/text";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import type { HomePhase } from "@site/lib/home-phase";
import { seriesName, shortSeries } from "@/lib/format";
import { EMPTY_PHASE, phaseView, type RailItem } from "@/lib/rail";
import { useNow } from "@/lib/use-now";
import { useRail } from "@/lib/use-rail";
import { AppHeader } from "@/ui/brand";
import { Chips } from "@/ui/chips";
import { FixtureCard } from "@/ui/fixture-card";
import { HotHome } from "@/ui/hot-home";
import { RailCard } from "@/ui/rail-card";
import { useScreenInsets } from "@/ui/insets";
import { enter, Skeleton } from "@/ui/motion";
import { PhaseBar } from "@/ui/phase-bar";
import { color, FIXTURE_CARD_SHARE, radius, space, type } from "@/ui/tokens";

export default function Fixtures() {
  const { ready, items, error, refetch, refreshing } = useRail();
  const now = useNow();
  const inset = useScreenInsets();
  const { width } = useWindowDimensions();
  const [asked, setAsked] = useState<HomePhase>();
  const [series, setSeries] = useState("all");

  const { counts, phase, shown: inPhase } = useMemo(() => phaseView(items, asked), [items, asked]);
  const seriesCounts = useMemo(() => {
    const c = new Map<string, number>();
    inPhase.forEach((i) => c.set(seriesName(i.fixture), (c.get(seriesName(i.fixture)) || 0) + 1));
    return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); // every series in the rail, the biggest first
  }, [inPhase]);
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
        refreshControl={Platform.OS !== "ios" ? undefined : <RefreshControl refreshing={refreshing && ready} onRefresh={() => void refetch()} tintColor={color.foreground} />}
        showsVerticalScrollIndicator={false}>
        {ready && inPhase.length > 0 ? <Chips items={chips} value={sel} onChange={setSeries} /> : null}
        {!ready ? (
          error ? <Text style={styles.empty}>Could not load fixtures. Pull to retry.</Text> : <RailSkeleton width={cardW} />
        ) : shown.length === 0 ? (
          <Text style={styles.empty}>{EMPTY_PHASE[phase]}</Text>
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
        {ready ? <HotHome phase={phase} /> : null}
      </ScrollView>
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
  empty: { ...type.callout, color: color["muted-foreground"], textAlign: "center", paddingVertical: space.section, paddingHorizontal: space.gutter },
  skeletonRow: { flexDirection: "row", gap: space.snug, paddingTop: space.snug, paddingHorizontal: space.gutter },
  skeleton: { height: 190, borderRadius: radius.card },
});
