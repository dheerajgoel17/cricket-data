import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { cap, color, font, space, type, tint, fs, radius, d, dStrong, w, icon } from "@/ui/tokens";

/** Stats tables / game logs boxed in the page margin with a hairline on all four sides (mirrors web `TABLE_BLEED`). */
export const TABLE_BLEED = {
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: color.hairline,
  paddingHorizontal: space.snug,
} as const;

/** A table that fits the width it is given: a header row of small caps, hairlines between rows, the first column left and the numbers right. `flex` weighs the columns (the first one wide by default). `bleed` boxes it (`TABLE_BLEED`). */
export function DataTable({ columns, rows, flex, highlight, bleed }: { columns: string[]; rows: ReactNode[][]; flex?: number[]; highlight?: number; bleed?: boolean }) {
  const f = (i: number) => flex?.[i] ?? (i === 0 ? 2 : 1);
  return (
    <View style={bleed ? TABLE_BLEED : undefined}>
      <View style={styles.row}>
        {columns.map((c, i) => <Text key={`${i}${c}`} style={[styles.head, { flex: f(i), textAlign: i === 0 ? "left" : "right" }]} numberOfLines={1}>{c}</Text>)}
      </View>
      {rows.map((r, ri) => (
        <View key={ri} style={[styles.row, styles.sep, ri === highlight && styles.on]}>
          {r.map((cell, i) => (
            <View key={i} style={{ flex: f(i), alignItems: i === 0 ? "flex-start" : "flex-end" }}>
              {typeof cell === "string" || typeof cell === "number" ? <Text style={[styles.cell, i === 0 && styles.first]} numberOfLines={i === 0 ? 2 : 1}>{cell}</Text> : cell}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** A figure in a tinted pill of one width, so a column of them lines up: green from 60%, red to 40%, amber between (the site's hit-rate cell). */
export function Pill({ text, tone, width = 60 }: { text: string; tone: "up" | "down" | "mid" | "none"; width?: number }) {
  const bg = tone === "up" ? tint.primary(0.2) : tone === "down" ? tint.miss(0.2) : tone === "mid" ? tint.amber(0.2) : "transparent";
  const fg = tone === "up" ? color.primary : tone === "down" ? color.miss : tone === "mid" ? color.amber : color["muted-foreground"];
  return <View style={[styles.pill, { width, backgroundColor: bg }]}><Text style={[styles.pillText, { color: fg }]} numberOfLines={1}>{text}</Text></View>;
}

/** A reading note: an info mark, a short title and one point per line, on a quiet rule at the left. For "how these numbers are worked out" (the site's `Note`). */
export function Note({ title, items }: { title: string; items: ReactNode[] }) {
  return (
    <View style={styles.note} accessibilityRole="summary" accessibilityLabel={title}>
      <Ionicons name="information-circle-outline" size={icon.sm} color={color["muted-foreground"]} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: space.tight }}>
        <Text style={styles.noteTitle}>{title}</Text>
        {items.map((t, i) => <Text key={i} style={styles.noteText}>{t}</Text>)}
      </View>
    </View>
  );
}

/** A small-caps label over a value (the site's `Metric`): the strip of numbers at the top of a player page. */
/** One labelled figure. `compact` is the player page's small grid (a 10 pt label over a 16 pt value, as in the reference app). */
export function Metric({ k, children, sub, tone, text, cols = 3, compact }: { k: string; children: ReactNode; /** A quiet line under the value, aligned to its column. */ sub?: string; tone?: "up" | "down"; text?: boolean; cols?: 2 | 3; compact?: boolean }) {
  return (
    <View style={[styles.metric, cols === 2 && { width: "50%" }, compact && styles.metricSm]}>
      <Text style={styles.metricKey} numberOfLines={1}>{k}</Text>
      <View style={[styles.metricValue, compact && { minHeight: 20 }]}>
        {typeof children === "string" || typeof children === "number"
          ? <Text style={[text ? (compact ? styles.metricTextSm : styles.metricText) : compact ? styles.metricNumSm : styles.metricNum, tone === "up" && { color: color.primary }, tone === "down" && { color: color.miss }]} numberOfLines={text ? 2 : 1}>{children}</Text>
          : children}
      </View>
      {sub ? <Text style={styles.metricSub} numberOfLines={1}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", minHeight: 44, gap: space.tight },
  on: { backgroundColor: tint.row, marginHorizontal: -space.tight, paddingHorizontal: space.tight, borderRadius: radius.sm },
  pill: { borderRadius: radius.sm, paddingVertical: 3, alignItems: "center" },
  pillText: { ...w.data, fontSize: fs.body, fontVariant: ["tabular-nums"] },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  /** Web `TABLE_HEAD` twin: footnote + label-cap (not caption / BOARD_HEAD). */
  head: { ...type.footnote, color: color["muted-foreground"], ...cap },
  cell: { ...d.callout, fontSize: fs.body, color: color.foreground },
  first: { ...w.copy, fontSize: fs.callout, lineHeight: 18 },
  note: { flexDirection: "row", gap: space.snug, borderLeftWidth: 2, borderLeftColor: color.hairline, paddingLeft: space.snug },
  noteTitle: { ...type.callout, color: tint.white(0.8), ...cap },
  noteText: { ...type.footnote, lineHeight: 17, color: color["muted-foreground"] },
  metric: { width: "33.33%", gap: 4, paddingRight: space.tight },
  metricSub: { ...type.footnote, color: color["muted-foreground"] },
  metricKey: { ...type.footnote, color: color["muted-foreground"], ...cap },
  metricValue: { minHeight: 24, justifyContent: "center" },
  metricNum: { fontSize: fs.figure, lineHeight: 28, letterSpacing: -0.48, ...w.data, color: color.foreground, fontVariant: ["tabular-nums"] },
  metricText: { ...dStrong.body, fontSize: fs.title, color: color.foreground },
  metricSm: { gap: 2 },
  metricNumSm: { fontSize: fs.body, lineHeight: 20, ...w.dataStrong, color: color.foreground, fontVariant: ["tabular-nums"] },
  metricTextSm: { ...dStrong.callout, fontSize: fs.title, lineHeight: 20, color: color.foreground },
});
