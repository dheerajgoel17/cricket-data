import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import * as Haptics from "expo-haptics";
import { ChevronRight } from "@/ui/icons";
import { cap, color, font, radius, space, type, tonal } from "@/ui/tokens";

/** A titled group of rows in a rounded container (the site's Saved sections): small-caps title with its count, then the rows, or a line saying what goes here when there are none. */
export function Section({ title, count, empty, children }: { title: string; count?: number; empty?: string; children?: ReactNode }) {
  const none = count === 0;
  return (
    <View style={styles.section}>
      <View style={styles.head}><Text style={styles.title}>{title}</Text>{count ? <Text style={styles.count}>{count}</Text> : null}</View>
      {none ? <Text style={styles.empty}>{empty}</Text> : <View style={styles.box}>{children}</View>}
    </View>
  );
}

/** One row: something at the left (a badge), the title and a line under it, something at the right (a value, a button) and a chevron when it opens something. */
export function ListRow({ left, title, sub, right, onPress, first, chevron = true, label }: { left?: ReactNode; title: string; sub?: ReactNode; right?: ReactNode; onPress?: () => void; first?: boolean; chevron?: boolean; label?: string }) {
  const body = (
    <>
      {left}
      <View style={styles.text}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {right}
      {onPress && chevron ? <ChevronRight color={color["muted-foreground"]} /> : null}
    </>
  );
  if (!onPress) return <View style={[styles.row, !first && styles.sep]}>{body}</View>;
  return (
    <Press scale={1} onPress={() => { void Haptics.selectionAsync(); onPress(); }} accessibilityRole="button" accessibilityLabel={label ?? title} style={({ pressed }) => [styles.row, !first && styles.sep, pressed && { backgroundColor: "rgba(58,58,60,0.45)" }]}>
      {body}
    </Press>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.snug },
  head: { flexDirection: "row", alignItems: "center", gap: space.snug },
  title: { ...type.footnote, ...cap, color: color["muted-foreground"] },
  count: { ...type.footnote, color: color["muted-foreground"], fontVariant: ["tabular-nums"] },
  box: { ...tonal, borderRadius: radius.card, overflow: "hidden" },
  empty: { ...type.callout, color: color["muted-foreground"], ...tonal, borderRadius: radius.card, padding: space.stack },
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.stack, paddingVertical: space.snug },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  text: { flex: 1, minWidth: 0, gap: 1 },
  rowTitle: { ...type.body, fontFamily: font.medium, color: color.foreground },
  sub: { ...type.callout, color: color["muted-foreground"] },
});
