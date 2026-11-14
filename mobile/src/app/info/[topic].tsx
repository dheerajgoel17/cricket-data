import { ScrollView, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { useLocalSearchParams } from "expo-router";
import { shortDate } from "@site/lib/format";
import { INFO } from "@/lib/info";
import { goBack } from "@/lib/nav";
import { EmptyState } from "@/ui/empty-state";
import { color, space, type } from "@/ui/tokens";

type Params = { topic: string; n?: string; d?: string; o?: string; v?: string; x?: string; l?: string; a?: string; p?: string };

/**
 * A native sheet (an iOS form sheet with a grabber; a Material bottom sheet on Android). Two kinds: what a number means (the small "i" buttons, words in `lib/info.ts`), and
 * one game of a player's (`topic` "game": a tap on a chart bar or a game-log row, the site's game sheet).
 */
export default function InfoSheet() {
  const p = useLocalSearchParams<Params>();
  const info = INFO[p.topic ?? ""];
  const game = p.topic === "game";
  const rows: [string, string][] = game
    ? ([["Date", p.d ?? ""], ["Opponent", p.o ?? ""], p.v ? ["Venue", p.v] : null, [p.l ?? "Value", p.x ?? "–"], p.a ? [p.a.split(": ")[0], p.a.split(": ")[1] ?? "–"] : null, p.p ? ["Batting position", p.p] : null].filter(Boolean) as [string, string][])
    : [];
  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={1}>{game ? `${p.n ?? "Game"} · ${p.d ? shortDate(p.d) : ""}` : info?.title ?? "Info"}</Text>
        <Press onPress={goBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Done"><Text style={styles.done}>Done</Text></Press>
      </View>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {game ? rows.map(([k, v], i) => (
          <View key={k} style={[styles.row, i > 0 && styles.sep]}><Text style={styles.key}>{k}</Text><Text style={styles.val}>{v}</Text></View>
        )) : info ? info.points.map(([term, text]) => (
          <View key={term} style={styles.point}>
            <Text style={styles.term}>{term}</Text>
            <Text style={styles.text}>{text}</Text>
          </View>
        )) : <EmptyState compact title="Nothing to show" body="This topic has no info text." />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.popover, paddingTop: space.stack },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.snug, paddingHorizontal: space.group, paddingBottom: space.snug },
  title: { ...type.title, color: color.foreground, flex: 1 },
  done: { ...type.body, color: color.primary },
  body: { gap: space.stack, paddingHorizontal: space.group, paddingVertical: space.snug, paddingBottom: space.section },
  point: { gap: 2 },
  term: { ...type.callout, color: color.foreground },
  text: { ...type.callout, color: color["muted-foreground"] },
  row: { flexDirection: "row", justifyContent: "space-between", gap: space.snug, paddingVertical: space.snug },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  key: { ...type.body, color: color["muted-foreground"] },
  val: { ...type.body, color: color.foreground, flexShrink: 1, textAlign: "right" },
});
