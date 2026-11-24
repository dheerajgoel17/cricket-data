import { useChoice } from "@/lib/use-choice";
import { HScroll } from "@/ui/h-scroll";
import { StyleSheet, View } from "react-native";
import { chipFillTransition, chipTextTransition } from "@/ui/chips";
import { Press } from "@/ui/press";
import { AnimatedText } from "@/ui/text";
import Animated, { useReducedMotion } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { color, control, radius, space, t } from "@/ui/tokens";
import { CHIP_SLOP } from "@/ui/platform";

/**
 * A row of chips, the chosen one filled with the accent colour (the site's `PillGroup` / `Chip`: the stat switch on a player, the sections of a match). Scrolls sideways when there
 * are more than fit; each chip fades its fill in and out on the UI thread (150 ms, instant with Reduce Motion). `muted` items are shown but quieter (a stat no book lists).
 */
export function CapsuleTabs({ items, value: valueProp, onChange: onChangeProp, label, flush }: { items: [id: string, label: string, muted?: boolean][]; value: string; onChange: (id: string) => void; label: string; /** Drop the page gutters when the tabs sit inside another bar. */ flush?: boolean }) {
  const [value, onChange] = useChoice(valueProp, onChangeProp);
  const calm = useReducedMotion();
  return (
    <View style={[styles.track, flush && styles.flush]}>
      <HScroll contentContainerStyle={styles.row} accessibilityRole="tablist" accessibilityLabel={label}>
        {items.map(([id, text, muted]) => <Tab key={id} calm={calm} text={text} muted={muted} on={id === value} onPress={() => { if (id !== value) { void Haptics.selectionAsync(); onChange(id); } }} />)}
      </HScroll>
    </View>
  );
}

function Tab({ text, on, muted, onPress, calm }: { calm: boolean; text: string; on: boolean; muted?: boolean; onPress: () => void }) {
  return (
    <Press onPress={onPress} hitSlop={CHIP_SLOP} accessibilityRole="tab" accessibilityState={{ selected: on }}>
      <Animated.View style={[styles.tab, { backgroundColor: on ? color.primary : color.card }, !calm && chipFillTransition]}>
        <AnimatedText style={[styles.text, on ? styles.textOn : muted && styles.textMuted, !calm && chipTextTransition]} numberOfLines={1}>{text}</AnimatedText>
      </Animated.View>
    </Press>
  );
}

const styles = StyleSheet.create({
  track: { marginHorizontal: space.gutter, marginVertical: space.snug },
  flush: { marginHorizontal: 0, marginVertical: 0 },
  row: { alignItems: "center", gap: space.tight },
  tab: { height: control, paddingHorizontal: space.stack, borderRadius: radius.chip, alignItems: "center", justifyContent: "center" },
  text: { ...t.calloutLabel, color: color.foreground },
  textOn: { color: color["primary-foreground"] },
  textMuted: { color: color["muted-foreground"] },
});
