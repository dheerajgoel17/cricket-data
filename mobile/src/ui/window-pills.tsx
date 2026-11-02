import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { cap, color, font, radius, type } from "@/ui/tokens";

export interface WindowItem { n: number; label: string; p: number | null }

const band = (p: number | null) => (p == null ? color["muted-foreground"] : p >= 0.6 ? color.primary : p >= 0.4 ? color.amber : color.miss);

/** The look-back windows as one segmented track: each cell is the window's name over its hit rate, coloured by how good it is, the chosen one lifted (the site's "Games" pills). */
export function WindowPills({ items, value, onChange }: { items: WindowItem[]; value: number; onChange: (n: number) => void }) {
  return (
    <View style={styles.track} accessibilityRole="tablist" accessibilityLabel="Games">
      {items.map((w) => <Cell key={w.n} w={w} on={w.n === value} onPress={() => { if (w.n !== value) { void Haptics.selectionAsync(); onChange(w.n); } }} />)}
    </View>
  );
}

function Cell({ w, on, onPress }: { w: WindowItem; on: boolean; onPress: () => void }) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => { p.value = withTiming(on ? 1 : 0, { duration: 180 }); }, [on, p]);
  const fill = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], ["rgba(44,44,46,0)", color.secondary]) }));
  return (
    <Press onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }} style={styles.hit}>
      <Animated.View style={[styles.cell, fill]}>
        <Text style={styles.label}>{w.label}</Text>
        <Text style={[styles.value, { color: band(w.p) }]}>{w.p == null ? "–" : `${Math.round(w.p * 100)}%`}</Text>
      </Animated.View>
    </Press>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", backgroundColor: color.card, borderRadius: radius.chip, padding: 2 },
  hit: { flex: 1 },
  cell: { alignItems: "center", justifyContent: "center", borderRadius: radius.chip, paddingVertical: 6 },
  label: { ...type.footnote, color: color["muted-foreground"], ...cap },
  value: { fontSize: 18, lineHeight: 22, fontFamily: font.cond, fontVariant: ["tabular-nums"] },
});
