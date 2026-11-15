import { memo, Profiler, useMemo, useState } from "react";
import { mark, onRender } from "@/lib/perf";
import { FlatList, Platform, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { layoutWidth } from "@/lib/fit";
import type { HomePhase } from "@site/lib/home-phase";
import { EMPTY_PHASE, phaseView, type RailItem } from "@/lib/rail";
import { useLater } from "@/lib/use-later";
import { useNow } from "@/lib/use-now";
import { useRail } from "@/lib/use-rail";
import { AppHeader } from "@/ui/brand";
import { EmptyState } from "@/ui/empty-state";
import { FixtureCard } from "@/ui/fixture-card";
import { HotHome, HotHomeSkeleton } from "@/ui/hot-home";
import { useScreenInsets } from "@/ui/insets";
import { keptTab } from "@/ui/lazy-tab";
import { Appear, CardSkeleton, Rise, SkeletonGroup } from "@/ui/motion";
import { PhaseBar } from "@/ui/phase-bar";
import { color, FIXTURE_CARD_SHARE, space } from "@/ui/tokens";
import { TabFade } from "@/ui/tab-fade";

/** Fallback until the first card reports height — enough for meta + two sides + foot. */
const RAIL_MIN_H = 168;

/**
 * Home, top to bottom, as the site's phone Home: the brand header, the phase tabs, the horizontal fixture rail, then the props (the only part that scrolls). The rail is a
 * **sibling** of the props ScrollView so FlatList virtualization runs. Its band is as tall as the tallest card drawn so far: a cell takes its card's own height (`alignSelf`), reports
 * it, and every cell is then held to that height so the cards are equal (the site's `h-full`). The first cards of a phase spring up into place, one after another (`Rise`).
 */
function Fixtures() {
  mark("render:Fixtures");
  const { ready, items, error, refetch } = useRail();
  const [pulling, setPulling] = useState(false);
  const pull = () => { setPulling(true); void refetch().finally(() => setPulling(false)); };
  const inset = useScreenInsets();
  const width = layoutWidth(useWindowDimensions().width, Platform.OS);
  const [asked, setAsked] = useState<HomePhase>();
  const [railH, setRailH] = useState(0);
  // the rail paints first; the props block (the tape, the chips, the rows) mounts after it as a transition, in slices
  const propsReady = useLater(ready);

  const { counts, phase, shown } = useMemo(() => phaseView(items, asked), [items, asked]);

  const cardW = Math.round(width * FIXTURE_CARD_SHARE);
  const gap = space.snug;
  // when this phase's rail was put up: only the cards mounted in its first moments rise in; one that scrolls back into the window later is simply there
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const born = useMemo(() => Date.now(), [phase, ready]);
  const bandH = Math.max(railH, RAIL_MIN_H) + space.stack;

  return (
    <View style={[styles.root, { paddingTop: inset.top }]}>
      <AppHeader />
      <PhaseBar value={phase} counts={counts} onChange={setAsked} />
      <View style={styles.propsScroll}>
      <ScrollView
        style={styles.propsScroll}
        contentContainerStyle={{ paddingBottom: inset.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={pull} tintColor={color.foreground} colors={[color.primary]} progressBackgroundColor={color.card} />}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === "android"}
      >
        <View style={{ height: bandH }}>
          <Profiler id="rail" onRender={onRender}>
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
              renderItem={({ item, index }) => (
                <Rise
                  i={index}
                  on={Date.now() - born < 900}
                  style={{ width: cardW, minHeight: railH || undefined, alignSelf: "flex-start" }}
                >
                  <View
                    style={styles.cell}
                    onLayout={(e) => {
                      const h = Math.ceil(e.nativeEvent.layout.height);
                      if (h > railH) setRailH((prev) => Math.max(prev, h));
                    }}
                  >
                    <RailCard item={item} />
                  </View>
                </Rise>
              )}
              ItemSeparatorComponent={() => <View style={{ width: gap }} />}
              getItemLayout={(_, index) => ({ length: cardW + gap, offset: (cardW + gap) * index, index })}
              initialNumToRender={2}
              windowSize={5}
              maxToRenderPerBatch={2}
              removeClippedSubviews={Platform.OS === "android"}
              snapToInterval={cardW + gap}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={{ paddingLeft: space.gutter, paddingRight: Math.max(space.gutter, width - cardW - space.gutter), paddingTop: space.stack }}
              showsHorizontalScrollIndicator={false}
            />
          )}
          </Profiler>
        </View>
        {ready && propsReady ? <Profiler id="hothome" onRender={onRender}><Appear><HotHome phase={phase} /></Appear></Profiler> : error ? null : <HotHomeSkeleton />}
      </ScrollView>
      <TabFade />
      </View>
    </View>
  );
}

/** One rail card with its own clock. Memoized on its item: the rail re-renders its cells when the band's height is measured and on every poll, and a card whose match did not move stays as it is. */
const RailCard = memo(function RailCard({ item }: { item: RailItem }) {
  const stumps = /stumps|close of (?:play|day)|end of (?:the )?day/i.test(String(item.live?.summary || item.live?.session || ""));
  const now = useNow(stumps ? 1000 : 30_000);
  return <FixtureCard item={item} now={now} />;
});

export default keptTab(Fixtures);

function RailSkeleton({ width }: { width: number }) {
  return (
    <SkeletonGroup style={styles.skeletonRow}>
      <CardSkeleton width={width} />
      <CardSkeleton width={width} />
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  cell: { flexGrow: 1 },
  propsScroll: { flex: 1 },
  emptyPad: { paddingVertical: space.stack, paddingHorizontal: space.gutter },
  skeletonRow: { overflow: "hidden", flexDirection: "row", gap: space.snug, paddingTop: space.stack, paddingHorizontal: space.gutter },
});
