import { useEffect } from "react";
import { HScroll } from "@/ui/h-scroll";
import { ScrollView, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { color, control, font, radius, space, type, duration } from "@/ui/tokens";

/**
 * A row of chips, the chosen one filled with the accent colour (the site's `PillGroup` / `Chip`: the stat switch on a player, the sections of a match). Scrolls sideways when there
 * are more than fit; each chip fades its fill in and out on the UI thread (150 ms). `muted` items are shown but quieter (a stat no book lists).
 */
export function CapsuleTabs({ items, value, onChange, label, flush }: { items: [id: string, label: string, muted?: boolean][]; value: string; onChange: (id: string) => void; label: string; /** Drop the page gutters when the tabs sit inside another bar. */ flush?: boolean }) {
  return (
    <View style={[styles.track, flush && styles.flush]}>
      <HScroll contentContainerStyle={styles.row} accessibilityRole="tablist" accessibilityLabel={label}>
        {items.map(([id, text, muted]) => <Tab key={id} text={text} muted={muted} on={id === value} onPress={() => { if (id !== value) { void Haptics.selectionAsync(); onChange(id); } }} />)}
      </HScroll>
    </View>
  );
}

function Tab({ text, on, muted, onPress }: { text: string; on: boolean; muted?: boolean; onPress: () => void }) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => { p.value = withTiming(on ? 1 : 0, { duration: duration.fast }); }, [on, p]);
  const fill = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], [color.card, color.primary]) }));
  return (
    <Press onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }}>
      <Animated.View style={[styles.tab, fill]}>
        <Text style={[styles.text, on ? styles.textOn : muted && styles.textMuted]} numberOfLines={1}>{text}</Text>
      </Animated.View>
    </Press>
  );
}

const styles = StyleSheet.create({
  track: { marginHorizontal: space.gutter, marginVertical: space.snug },
  flush: { marginHorizontal: 0, marginVertical: 0 },
  row: { alignItems: "center", gap: space.tight },
  tab: { height: control, paddingHorizontal: space.stack, borderRadius: radius.chip, alignItems: "center", justifyContent: "center" },
  text: { ...type.callout, fontFamily: font.medium, color: color.foreground },
  textOn: { color: color["primary-foreground"] },
  textMuted: { color: color["muted-foreground"] },
});
