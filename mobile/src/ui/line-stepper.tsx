import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import * as Haptics from "expo-haptics";
import { Minus, Plus } from "@/ui/icons";
import { color, control, radius, type } from "@/ui/tokens";

/** The site's line stepper: one rounded capsule, minus at the left, the line in the middle ("O 19.5"), plus at the right. The same control on every page that has a line. */
export function LineStepper({ value, onStep, label, min = 0.5 }: { value: number; onStep: (delta: number) => void; label: string; min?: number }) {
  const step = (d: number) => { void Haptics.selectionAsync(); onStep(d); };
  const low = value <= min;
  return (
    <View style={styles.pill}>
      <Press accessibilityRole="button" accessibilityLabel="Lower the line" disabled={low} hitSlop={6} onPress={() => step(-0.5)} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
        <Minus size={18} color={low ? "rgba(142,142,147,0.4)" : color["muted-foreground"]} />
      </Press>
      <Text style={styles.value} accessibilityLiveRegion="polite">{label} {value}</Text>
      <Press accessibilityRole="button" accessibilityLabel="Raise the line" hitSlop={6} onPress={() => step(0.5)} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
        <Plus size={18} color={color["muted-foreground"]} />
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { height: control, flexDirection: "row", alignItems: "center", backgroundColor: color.card, borderRadius: radius.chip },
  btn: { width: control, height: control, alignItems: "center", justifyContent: "center", borderRadius: radius.chip },
  pressed: { backgroundColor: "rgba(255,255,255,0.08)" },
  value: { ...type.callout, minWidth: 64, textAlign: "center", color: color.foreground, fontVariant: ["tabular-nums"] },
});
