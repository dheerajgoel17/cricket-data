import { useEffect, type ReactNode } from "react";
import { useChoice } from "@/lib/use-choice";
import { HScroll } from "@/ui/h-scroll";
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Press } from "@/ui/press";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { AnimatedText, Text } from "@/ui/text";
import { color, control, radius, space, type, font, tint, duration, t, d, state, icon } from "@/ui/tokens";

/** The site's series chips: one row that scrolls sideways, the chosen one filled with the accent colour (the fill fades between chips); each carries how many matches it holds. */
export function Chips({ items, value: valueProp, onChange: onChangeProp }: { items: [id: string, label: string, count?: number | string, muted?: boolean][]; value: string; onChange: (id: string) => void }) {
  const [value, onChange] = useChoice(valueProp, onChangeProp);
  return (
    <HScroll contentContainerStyle={styles.row} accessibilityRole="tablist">
      {items.map(([id, label, count, muted]) => (
        <Chip key={id} label={label} count={count} muted={muted} on={id === value} onPress={() => { if (id !== value) { void Haptics.selectionAsync(); onChange(id); } }} />
      ))}
    </HScroll>
  );
}

function Chip({ label, count, on, muted, onPress }: { label: string; count?: number | string; on: boolean; muted?: boolean; onPress: () => void }) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => { p.value = withTiming(on ? 1 : 0, { duration: duration.fast }); }, [on, p]);
  const box = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], [color.card, color.primary]) }));
  const text = useAnimatedStyle(() => ({ color: interpolateColor(p.value, [0, 1], [color.foreground, color["primary-foreground"]]) }));
  const countColor = useAnimatedStyle(() => ({ color: interpolateColor(p.value, [0, 1], [color["muted-foreground"], color["primary-foreground"]]) }));
  return (
    <Press accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={onPress}>
      <Animated.View style={[styles.chip, box, muted && !on && state.dim]}>
        <AnimatedText style={[styles.label, text]}>{label}</AnimatedText>
        {count != null ? <AnimatedText style={[styles.count, countColor]}>{count}</AnimatedText> : null}
      </Animated.View>
    </Press>
  );
}

/** The one "open the filters" button (Props, Fancy, Grid, Home): options icon, a label, and the number of active filters as a badge on the corner (the site's `Filters` button). */
export function FilterButton({ label = "Filters", count = 0, onPress, style }: { label?: string; count?: number; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Press scale={1} onPress={() => { void Haptics.selectionAsync(); onPress(); }} accessibilityRole="button" accessibilityLabel={`Filters${count ? `, ${count} active` : ""}`} style={[styles.filterBtn, style]}>
      <Ionicons name="options-outline" size={icon.sm} color={color.foreground} />
      <Text style={styles.filterLbl}>{label}</Text>
      {count > 0 ? <View style={styles.filterBadge}><Text style={styles.filterBadgeTxt}>{count}</Text></View> : null}
    </Press>
  );
}

/** Dismissible active-filter chip (Props / Fancy / Grid sheets). */
export function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Press scale={1} onPress={onClear} accessibilityRole="button" style={styles.active}>
      <Text style={styles.activeTxt}>{label}</Text>
      <Ionicons name="close" size={icon.xs} color={color.primary} />
    </Press>
  );
}

/** Sheet / accordion choice chip (on = the accent fill, as the site's `Chip`). */
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
  label: { ...t.calloutLabel },
  count: { ...d.footnote },
  active: { height: control, flexDirection: "row", alignItems: "center", gap: space.hair, paddingLeft: space.snug, paddingRight: space.tight, borderRadius: radius.chip, backgroundColor: tint.primary(0.15) },
  activeTxt: { ...type.callout, color: color.primary },
  choice: { height: control, paddingHorizontal: space.snug, borderRadius: radius.chip, backgroundColor: color.card, alignItems: "center", justifyContent: "center" },
  choiceOn: { backgroundColor: color.primary },
  choiceTxt: { ...type.callout, color: color.foreground },
  choiceTxtOn: { color: color["primary-foreground"] },
  filterBtn: { height: control, flexDirection: "row", alignItems: "center", gap: space.tight, paddingHorizontal: space.snug, borderRadius: radius.chip, backgroundColor: color.card },
  filterLbl: { ...t.callout, color: color.foreground },
  filterBadge: { position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: color.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 3 },
  filterBadgeTxt: { ...t.captionStrong, color: color.background },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: space.snug },
});
