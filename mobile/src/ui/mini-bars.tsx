import { StyleSheet, View } from "react-native";
import { color } from "@/ui/tokens";

const BAR: Record<string, string> = { hit: color.hit, miss: color.miss, push: color.amber };
const DNP = "rgba(153,153,153,0.5)";

/** Last-games bars against a dashed line (green hit, red miss, amber push, grey DNP). `last` is oldest to newest; `max` is the bar-height scale (the site's `MiniBars`). */
export function MiniBars({ last, line, max, width = 96 }: { last: { v: number | null; s: string }[]; line: number; max?: number; width?: number }) {
  const top = max ?? Math.max(line * 1.5, ...last.map((x) => x.v ?? 0), 1);
  return (
    <View style={[styles.box, { width }]} accessibilityRole="image" accessibilityLabel={`Last ${last.length}: ${last.map((x) => x.v ?? "DNP").join(", ")} against a line of ${line}`}>
      {last.map((x, i) => <View key={i} style={[styles.bar, { height: `${Math.max(x.v == null ? 8 : (x.v / top) * 100, 8)}%`, backgroundColor: BAR[x.s] || DNP }]} />)}
      <View pointerEvents="none" style={[styles.line, { bottom: `${Math.min(100, (line / top) * 100)}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 96, height: 34, flexDirection: "row", alignItems: "flex-end", gap: 2 },
  bar: { flex: 1, borderRadius: 2 },
  line: { position: "absolute", left: 0, right: 0, borderTopWidth: 1, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.4)" },
});
