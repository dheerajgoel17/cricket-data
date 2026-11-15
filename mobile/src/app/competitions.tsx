import { push } from "@/lib/nav";
/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { EmptyState } from "@/ui/empty-state";
import { ListRow } from "@/ui/list";
import { Working } from "@/ui/motion";
import { PageHeader } from "@/ui/page-header";
import { PageAtmosphere } from "@/ui/page-atmosphere";
import { LeagueBadge } from "@/ui/team-badge";
import { color, font, space, type, tonal, radius } from "@/ui/tokens";
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
      <View style={styles.field}>
        <Ionicons name="search" size={18} color={color["muted-foreground"]} />
        <TextInput value={text} onChangeText={setText} autoCorrect={false} autoCapitalize="none" clearButtonMode="while-editing" placeholder="Search competitions" placeholderTextColor={color["muted-foreground"]} style={styles.input} accessibilityLabel="Search competitions" />
      </View>
      {stats.isError && !matchesReady ? <EmptyState title="Could not load history" body="Check your connection and reopen this page to retry." /> : !store || !matchesReady ? <Working label="Loading…" fill shape="comps" /> : (
        <FlashList
          data={rows}
          keyExtractor={([e]) => String(e)}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.list, { paddingBottom: inset.bottom + 24 }]}
          renderItem={({ item: [e, c], index }) => <ListRow first={index === 0} left={<LeagueBadge name={store.events[e]} size={40} />} title={store.events[e]} sub={`${c} matches`} onPress={() => push(`/league/${e}`)} />}
          ListEmptyComponent={<EmptyState compact title="No matches" body={t ? `No competition matches “${text.trim()}”.` : "No competitions with enough matches yet."} />}
        />
      )}
      <TabFade withTabBar={false} />
    </PageAtmosphere>
  );
}

const styles = StyleSheet.create({
  field: { height: 40, marginHorizontal: space.gutter, marginVertical: space.snug, flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.snug + 2, borderRadius: 12, backgroundColor: color.secondary },
  input: { flex: 1, ...type.body, fontFamily: font.regular, color: color.foreground, paddingVertical: 0 },
  list: { paddingHorizontal: space.gutter },
  box: { ...tonal, borderRadius: radius.card, overflow: "hidden" },
  empty: { ...type.callout, color: color["muted-foreground"], paddingTop: space.stack },
});
