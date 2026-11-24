import { push } from "@/lib/nav";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { SearchField } from "@/ui/search-field";
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Text, TextInput } from "@/ui/text";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useStore } from "@/lib/use-store";
import { competitions } from "@/lib/league";
import { useScreenInsets } from "@/ui/insets";
import { EmptyState, ErrorState } from "@/ui/empty-state";
import { ListRow } from "@/ui/list";
import { Working } from "@/ui/motion";
import { PageHeader } from "@/ui/page-header";
import { PageAtmosphere } from "@/ui/page-atmosphere";
import { LeagueBadge } from "@/ui/team-badge";
import { color, font, space, type, radius, surface, w } from "@/ui/tokens";
import { TabFade } from "@/ui/tab-fade";

/** Every competition in the data with eight matches or more, the biggest first, with a search over the names. */
export default function Competitions() {
  const inset = useScreenInsets(false);
  const stats = useStore();
  const store: any = stats.data?.store;
  const matchesReady = stats.matchesReady;
  const [text, setText] = useState("");
  const all = useMemo(() => (store && matchesReady ? competitions(store) : []), [store, matchesReady]);
  const t = text.trim().toLowerCase();
  const rows = all.filter(([e]) => !t || store.events[e].toLowerCase().includes(t)).slice(0, 80);
  return (
    <PageAtmosphere style={{ paddingTop: inset.top }}>
      <PageHeader title="Competitions" />
      <SearchField style={styles.field} value={text} onChangeText={setText} placeholder="Search competitions" />
      {stats.isError && !matchesReady ? <ErrorState title="Could not load history" onRetry={() => void stats.refetch()} /> : !store || !matchesReady ? <Working label="Loading…" fill shape="comps" /> : (
        <FlashList
          data={rows}
          keyExtractor={([e]) => String(e)}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.list, { paddingBottom: inset.bottom + 24 }]}
          renderItem={({ item: [e, c], index }) => <ListRow flat first={index === 0} left={<LeagueBadge name={store.events[e]} size={40} />} title={store.events[e]} sub={`${c} matches`} onPress={() => push(`/league/${e}`)} />}
          ListEmptyComponent={<EmptyState compact title="No matches" body={t ? `No competition matches “${text.trim()}”.` : "No competitions with enough matches yet."} />}
        />
      )}
      <TabFade withTabBar={false} />
    </PageAtmosphere>
  );
}

const styles = StyleSheet.create({
  field: { marginHorizontal: space.gutter, marginVertical: space.snug },
  list: {},
  box: { ...surface.card, overflow: "hidden" },
  empty: { ...type.callout, color: color["muted-foreground"], paddingTop: space.stack },
});
