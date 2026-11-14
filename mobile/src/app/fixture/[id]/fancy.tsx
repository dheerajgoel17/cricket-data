/* eslint-disable @typescript-eslint/no-explicit-any */
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { liveForFixture } from "@cricket/engine/live.js";
import { FORMATS } from "@cricket/engine/util.js";
import { useFixtureBooks } from "@/lib/archive";
import { storeQuery } from "@/lib/data";
import { liveQuery } from "@/lib/queries";
import { fixtureState, liveMatchFor, type RailItem } from "@/lib/rail";
import { useNow } from "@/lib/use-now";
import { EmptyState } from "@/ui/empty-state";
import { useScreenInsets } from "@/ui/insets";
import { MatchFancy } from "@/ui/match-fancy";
import { MatchHeader } from "@/ui/match-header";
import { Working } from "@/ui/motion";
import { PageHeader } from "@/ui/page-header";
import { color, space } from "@/ui/tokens";

/** One fancy market for a fixture: chart, over/under and ladder (the site's `/fixture/:id/fancy`). */
const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);

export default function FancyMarketPage() {
  const params = useLocalSearchParams<{ id: string; fm?: string; sc?: string; mw?: string; mv?: string; ml?: string }>();
  const id = one(params.id) || "";
  const start = { fm: one(params.fm), sc: one(params.sc), mw: one(params.mw), mv: one(params.mv) };
  const inset = useScreenInsets(false);
  const now = useNow(60_000);
  const live = useQuery(liveQuery);
  const { fx: f, doc, isLoading } = useFixtureBooks(id);
  const stats = useQuery(storeQuery);
  const item: RailItem | null = f ? { fixture: f, state: fixtureState(f, liveForFixture(live.data, f)?.status, now), live: liveMatchFor(live.data, doc, f), noProps: false } : null;
  const fmt = f && FORMATS.includes(f.fmt) ? f.fmt : "T20";
  const teams: [string, number][] = f ? [[f.a, f.a_ix], [f.b, f.b_ix]] : [];
  const known = teams.filter(([, i]) => i >= 0);

  if (isLoading || !stats.data?.store) {
    return (
      <View style={[styles.root, { paddingTop: inset.top }]}>
        <PageHeader title="Fancy" />
        <Working label="Loading…" shape="market" />
      </View>
    );
  }
  if (!f) {
    return (
      <View style={[styles.root, { paddingTop: inset.top }]}>
        <PageHeader title="Fancy" />
        <View style={styles.pad}>
          <EmptyState title="Fixture gone" body="That match is no longer in the schedule." />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.root, { paddingTop: inset.top }]}>
      <PageHeader title={`${f.a} v ${f.b}`} subtitle="Match Fancy" />
      <ScrollView contentContainerStyle={{ paddingBottom: inset.bottom + 24, paddingHorizontal: space.gutter, gap: space.stack }} showsVerticalScrollIndicator={false}>
        {item ? <MatchHeader item={item} /> : null}
        <MatchFancy fx={f} teams={known} fmt={fmt} doc={doc} mode="detail" start={start} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  pad: { paddingHorizontal: space.gutter, paddingTop: space.stack },
});
