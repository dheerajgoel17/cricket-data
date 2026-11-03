import { push } from "@/lib/nav";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text, TextInput } from "@/ui/text";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { storeQuery } from "@/lib/data";
import { competitions } from "@/lib/league";
import { useScreenInsets } from "@/ui/insets";
import { ListRow } from "@/ui/list";
import { Working } from "@/ui/motion";
import { PageHeader } from "@/ui/page-header";
import { LeagueBadge } from "@/ui/team-badge";
import { color, font, space, type, tonal } from "@/ui/tokens";
import { TabFade } from "@/ui/tab-fade";

/** Every competition in the data with eight matches or more, the biggest first, with a search over the names. */
export default function Competitions() {
  const inset = useScreenInsets(false);
  const stats = useQuery(storeQuery);
  const store: any = stats.data?.store;
  const [text, setText] = useState("");
  const all = useMemo(() => (store ? competitions(store) : []), [store]);
  const t = text.trim().toLowerCase();
  const rows = all.filter(([e]) => !t || store.events[e].toLowerCase().includes(t)).slice(0, 80);
  return (
    <View style={[styles.root, { paddingTop: inset.top }]}>
      <PageHeader title="Competitions" />
      <View style={styles.field}>
        <Ionicons name="search" size={18} color={color["muted-foreground"]} />
        <TextInput value={text} onChangeText={setText} autoCorrect={false} autoCapitalize="none" clearButtonMode="while-editing" placeholder="Search competitions" placeholderTextColor={color["muted-foreground"]} style={styles.input} accessibilityLabel="Search competitions" />
      </View>
      {!store ? <Working label="Loading…" fill /> : (
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.list, { paddingBottom: inset.bottom + 24 }]}>
          {rows.length ? (
            <View style={styles.box}>
              {rows.map(([e, c], n) => <ListRow key={e} first={n === 0} left={<LeagueBadge name={store.events[e]} size={40} />} title={store.events[e]} sub={`${c} matches`} onPress={() => push(`/league/${e}`)} />)}
            </View>
          ) : <Text style={styles.empty}>No competition matches “{text.trim()}”.</Text>}
        </ScrollView>
      )}
      <TabFade />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  field: { height: 40, marginHorizontal: space.gutter, marginVertical: space.snug, flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.snug + 2, borderRadius: 12, backgroundColor: color.secondary },
  input: { flex: 1, ...type.body, fontFamily: font.regular, color: color.foreground, paddingVertical: 0 },
  list: { paddingHorizontal: space.gutter },
  box: { ...tonal, borderRadius: 18, overflow: "hidden" },
  empty: { ...type.callout, color: color["muted-foreground"], paddingTop: space.stack },
});
