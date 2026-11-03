import { useEffect } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Press } from "@/ui/press";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { AnimatedText } from "@/ui/text";
import { color, control, radius, space, type, font } from "@/ui/tokens";

/** The site's series chips: one row that scrolls sideways, the chosen one filled (the fill fades between chips); each carries how many matches it holds. */
export function Chips({ items, value, onChange }: { items: [id: string, label: string, count?: number | string, muted?: boolean][]; value: string; onChange: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="tablist">
      {items.map(([id, label, count, muted]) => (
        <Chip key={id} label={label} count={count} muted={muted} on={id === value} onPress={() => { if (id !== value) { void Haptics.selectionAsync(); onChange(id); } }} />
      ))}
    </ScrollView>
  );
}

function Chip({ label, count, on, muted, onPress }: { label: string; count?: number | string; on: boolean; muted?: boolean; onPress: () => void }) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => { p.value = withTiming(on ? 1 : 0, { duration: 200 }); }, [on, p]);
  const box = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], [color.card, color.foreground]) }));
  const text = useAnimatedStyle(() => ({ color: interpolateColor(p.value, [0, 1], [color.foreground, color.background]) }));
  return (
    <Press accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={onPress}>
      <Animated.View style={[styles.chip, box, muted && !on && { opacity: 0.7 }]}>
        <AnimatedText style={[styles.label, text]}>{label}</AnimatedText>
        {count != null ? <AnimatedText style={styles.count}>{count}</AnimatedText> : null}
      </Animated.View>
    </Press>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.tight, paddingHorizontal: space.gutter, paddingVertical: space.snug },
  chip: { height: control, paddingHorizontal: space.stack, borderRadius: radius.chip, flexDirection: "row", alignItems: "center", gap: space.tight },
  label: { ...type.body, fontSize: 15 },
  count: { ...type.footnote, color: color["muted-foreground"], fontFamily: font.data, fontVariant: ["tabular-nums"] },
});
