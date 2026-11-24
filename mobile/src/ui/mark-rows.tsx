/* A heading over hairline rows of tap-for-detail marks: the layout of the Odd / Even and Toss tabs (twin of the site's `components/app/mark-rows.tsx`). Rows run edge to edge; copy keeps the gutter. */
import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { color, radius, space, type, t, d, w } from "@/ui/tokens";

export interface MarkData { on: boolean; letter: string; label: string; detail: string }

/** One row: title and what it covers on the left, the headline figure on the right, the marks (newest on the right) under them; tapping a mark shows its detail line. */
export function MarkRow({ title, sub, headline, headlineSub, marks, note, hideWhenEmpty = true }: {
  title: string; sub: string; headline: string; headlineSub?: ReactNode; marks: MarkData[]; note?: string; hideWhenEmpty?: boolean;
}) {
  const [pick, setPick] = useState<number | null>(null);
  if (hideWhenEmpty && !marks.length) return null;
  const sel = pick != null ? marks[pick] : null;
  return (
    <View style={styles.row}>
      <View style={styles.top}>
        <View style={styles.titleCol}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.muted} numberOfLines={1}>{sub}</Text>
        </View>
        <View style={styles.figure}>
          <Text style={styles.headline}>{headline}</Text>
          {headlineSub ? (typeof headlineSub === "string" ? <Text style={styles.muted}>{headlineSub}</Text> : headlineSub) : null}
        </View>
      </View>
      {marks.length ? (
        <View style={styles.marks} accessibilityLabel={title}>
          {marks.map((x, i) => (
            <Press key={i} scale={0.92} accessibilityRole="button" accessibilityLabel={x.label} accessibilityState={{ selected: pick === i }} onPress={() => setPick(pick === i ? null : i)}
              style={[styles.mark, { backgroundColor: x.on ? color.primary : color.secondary }, pick === i && styles.picked]}>
              <Text style={[styles.letter, { color: x.on ? color["primary-foreground"] : color["muted-foreground"] }]}>{x.letter}</Text>
            </Press>
          ))}
        </View>
      ) : null}
      {sel || note ? <Text style={styles.muted}>{sel ? sel.detail : note}</Text> : null}
    </View>
  );
}

/** A heading (crest and name, or the ground) over its rows: the same head as a Form team. */
export function MarkSection({ head, children, label }: { head: ReactNode; children: ReactNode; label: string }) {
  return (
    <View accessibilityLabel={label}>
      <View style={styles.head}>{head}</View>
      {children}
    </View>
  );
}

export const markStyles = { name: { ...t.calloutLabel, color: color.foreground, flex: 1 } as const, muted: { ...type.footnote, color: color["muted-foreground"] } as const };

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.gutter, paddingVertical: space.snug },
  row: { gap: space.snug, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, paddingHorizontal: space.gutter, paddingVertical: space.snug },
  top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.snug },
  titleCol: { flex: 1, minWidth: 0 },
  title: { ...t.calloutLabel, color: color.foreground },
  muted: { ...type.footnote, color: color["muted-foreground"] },
  figure: { alignItems: "flex-end" },
  headline: { ...d.callout, color: color.foreground },
  marks: { flexDirection: "row", alignItems: "center", gap: 4 },
  mark: { width: 28, height: 28, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  picked: { borderWidth: 2, borderColor: color.foreground },
  letter: { ...w.strong },
});
