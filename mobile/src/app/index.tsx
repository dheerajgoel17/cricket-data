import { useMemo, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { countPhases, pickHomePhase, phaseOf, type HomePhase } from "@site/lib/home-phase";
import { useRail } from "@/lib/use-rail";
import type { RailItem } from "@/lib/rail";
import { FixtureCard } from "@/ui/fixture-card";
import { useScreenInsets } from "@/ui/insets";
import { PhasePills } from "@/ui/phase-pills";
import { color, radius, space, type } from "@/ui/tokens";

export default function Fixtures() {
  const { ready, items, error, refetch, refreshing } = useRail();
  const inset = useScreenInsets();
  const [asked, setAsked] = useState<HomePhase>();
  const counts = useMemo(() => countPhases(items, (i) => phaseOf(i.state)), [items]);
  const phase = pickHomePhase(counts, asked);
  const shown = useMemo(() => items.filter((i) => phaseOf(i.state) === phase), [items, phase]);

  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>Fixtures</Text>
      <PhasePills phase={phase} counts={counts} onChange={setAsked} />
    </View>
  );

  return (
    <FlashList<RailItem>
      data={ready ? shown : []}
      keyExtractor={(i) => i.fixture.id}
      renderItem={({ item }) => <FixtureCard item={item} />}
      ItemSeparatorComponent={() => <View style={{ height: space.snug }} />}
      ListHeaderComponent={header}
      ListEmptyComponent={ready ? <Text style={styles.empty}>Nothing here right now.</Text> : error ? <Text style={styles.empty}>Could not load fixtures. Pull to retry.</Text> : <Skeleton />}
      refreshControl={<RefreshControl refreshing={refreshing && ready} onRefresh={() => void refetch()} tintColor={color.foreground} />}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingTop: inset.top, paddingBottom: inset.bottom, paddingHorizontal: space.inset }}
      style={styles.list}
    />
  );
}

function Skeleton() {
  return <View style={{ gap: space.snug }}>{[0, 1, 2].map((k) => <View key={k} style={styles.skeleton} />)}</View>;
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: color.background },
  header: { gap: space.stack, paddingTop: space.stack, paddingBottom: space.stack },
  title: { ...type.display, color: color.foreground },
  empty: { ...type.callout, color: color["muted-foreground"], textAlign: "center", paddingVertical: space.section },
  skeleton: { height: 118, borderRadius: radius.card, backgroundColor: color.card },
});
