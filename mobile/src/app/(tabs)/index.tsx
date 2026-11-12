import { Profiler, useMemo, useState } from "react";
import { mark, onRender } from "@/lib/perf";
import { FlatList, Platform, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { layoutWidth } from "@/lib/fit";
import type { HomePhase } from "@site/lib/home-phase";
import { EMPTY_PHASE, phaseView, type RailItem } from "@/lib/rail";
import { useNow } from "@/lib/use-now";
import { useRail } from "@/lib/use-rail";
import { AppHeader } from "@/ui/brand";
import { EmptyState } from "@/ui/empty-state";
import { FixtureCard } from "@/ui/fixture-card";
import { HotHome, HotHomeSkeleton } from "@/ui/hot-home";
import { useScreenInsets } from "@/ui/insets";
import { CardSkeleton } from "@/ui/motion";
import { PhaseBar } from "@/ui/phase-bar";
import { color, FIXTURE_CARD_SHARE, space } from "@/ui/tokens";
import { TabFade } from "@/ui/tab-fade";

export default function Fixtures() {
  mark("render:Fixtures");
  const { ready, items, error, refetch } = useRail();
  // the pull-to-refresh spinner follows only a pull: the 15 s live poll refetches on its own and must not open it
  const [pulling, setPulling] = useState(false);
  const pull = () => { setPulling(true); void refetch().finally(() => setPulling(false)); };
  const inset = useScreenInsets();
  const width = layoutWidth(useWindowDimensions().width, Platform.OS);
  const [asked, setAsked] = useState<HomePhase>();

  const { counts, phase, shown } = useMemo(() => phaseView(items, asked), [items, asked]);

  const cardW = Math.round(width * FIXTURE_CARD_SHARE);
  const gap = space.snug;

  return (
    <View style={[styles.root, { paddingTop: inset.top }]}>
      <AppHeader />
      <ScrollView
        contentContainerStyle={{ paddingBottom: inset.bottom + 96 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={pull} tintColor={color.foreground} colors={[color.primary]} progressBackgroundColor={color.card} />}
        showsVerticalScrollIndicator={false}>
        {!ready ? (
          error ? <View style={styles.emptyPad}><EmptyState title="Could not load fixtures" body="Pull to retry." /></View> : <RailSkeleton width={cardW} />
        ) : shown.length === 0 ? (
          <View style={styles.emptyPad}><EmptyState title={EMPTY_PHASE[phase].title} body={EMPTY_PHASE[phase].body} /></View>
        ) : (
          <FlatList<RailItem>
            key={phase}
            horizontal
            data={shown}
            keyExtractor={(i) => `${i.fixture.id}${i.fixture.a}${i.fixture.b}`}
            renderItem={({ item }) => <View style={{ width: cardW }}><TimedFixtureCard item={item} /></View>}
            ItemSeparatorComponent={() => <View style={{ width: gap }} />}
            getItemLayout={(_, index) => ({ length: cardW + gap, offset: (cardW + gap) * index, index })}
            initialNumToRender={2}
            windowSize={3}
            maxToRenderPerBatch={2}
            snapToInterval={cardW + gap}
            snapToAlignment="start"
            decelerationRate="fast"
            contentContainerStyle={{ paddingLeft: space.gutter, paddingRight: Math.max(space.gutter, width - cardW - space.gutter), paddingTop: space.stack }}
            showsHorizontalScrollIndicator={false}
          />
        )}
        {ready ? <Profiler id="hothome" onRender={onRender}><HotHome phase={phase} /></Profiler> : error ? null : <HotHomeSkeleton />}
      </ScrollView>
      <TabFade />
      <PhaseBar value={phase} counts={counts} onChange={setAsked} />
    </View>
  );
}

function TimedFixtureCard({ item }: { item: RailItem }) {
  // Stumps · Day N countdown goes to mm:ss under one hour — tick every second then.
  const stumps = /stumps|close of (?:play|day)|end of (?:the )?day/i.test(String(item.live?.summary || item.live?.session || ""));
  const now = useNow(stumps ? 1000 : 30_000);
  return <FixtureCard item={item} now={now} />;
}

function RailSkeleton({ width }: { width: number }) {
  return (
    <View style={styles.skeletonRow}>
      <CardSkeleton width={width} />
      <CardSkeleton width={width} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  emptyPad: { paddingVertical: space.stack, paddingHorizontal: space.gutter },
  skeletonRow: { overflow: "hidden", flexDirection: "row", gap: space.snug, paddingTop: space.stack, paddingHorizontal: space.gutter },
});
