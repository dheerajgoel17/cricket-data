import { useEffect, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedText, Text } from "@/ui/text";
import { color, control, radius, space, type, font, tint } from "@/ui/tokens";

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
  const countColor = useAnimatedStyle(() => ({ color: interpolateColor(p.value, [0, 1], [color["muted-foreground"], color.background]) }));
  return (
    <Press accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={onPress}>
      <Animated.View style={[styles.chip, box, muted && !on && { opacity: 0.7 }]}>
        <AnimatedText style={[styles.label, text]}>{label}</AnimatedText>
        {count != null ? <AnimatedText style={[styles.count, countColor]}>{count}</AnimatedText> : null}
      </Animated.View>
    </Press>
  );
}

/** Dismissible active-filter chip (Props / Fancy / Grid sheets). */
export function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Press scale={1} onPress={onClear} accessibilityRole="button" style={styles.active}>
      <Text style={styles.activeTxt}>{label}</Text>
      <Ionicons name="close" size={12} color={color.primary} />
    </Press>
  );
}

/** Sheet / accordion choice chip (on = filled foreground). */
export function ChoiceChip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Press scale={1} onPress={onPress} accessibilityRole="button" style={[styles.choice, on && styles.choiceOn]}>
      <Text style={[styles.choiceTxt, on && styles.choiceTxtOn]}>{label}</Text>
    </Press>
  );
}

/** Row of ChoiceChips with wrap. */
export function ChoiceRow({ children }: { children: ReactNode }) {
  return <View style={styles.choiceRow}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { gap: space.tight, paddingHorizontal: space.gutter, paddingVertical: space.snug },
  chip: { height: control, paddingHorizontal: space.stack, borderRadius: radius.chip, flexDirection: "row", alignItems: "center", gap: space.tight },
  label: { ...type.body, fontSize: 15 },
  count: { ...type.footnote, fontFamily: font.data, fontVariant: ["tabular-nums"] },
  active: { height: control, flexDirection: "row", alignItems: "center", gap: space.hair, paddingLeft: space.snug, paddingRight: space.tight, borderRadius: radius.chip, backgroundColor: tint.primary(0.15) },
  activeTxt: { ...type.callout, color: color.primary },
  choice: { height: control, paddingHorizontal: space.snug, borderRadius: radius.chip, backgroundColor: color.card, alignItems: "center", justifyContent: "center" },
  choiceOn: { backgroundColor: color.foreground },
  choiceTxt: { ...type.callout, color: color.foreground },
  choiceTxtOn: { color: color.background },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: space.snug },
});
