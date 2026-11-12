import { useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { color, radius, space, type } from "@/ui/tokens";

/**
 * Tabs in one rounded capsule, the chosen one a raised pill (the reference app's stat switch: Points / Assists / Rebs). Scrolls sideways when there are more than fit; each item
 * fades its fill in and out on the UI thread. `muted` items are shown but quieter (a stat no book lists).
 */
export function CapsuleTabs({ items, value, onChange, label, flush }: { items: [id: string, label: string, muted?: boolean][]; value: string; onChange: (id: string) => void; label: string; /** Drop the page gutters when the tabs sit inside another bar. */ flush?: boolean }) {
  return (
    <View style={[styles.track, flush && styles.flush]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="tablist" accessibilityLabel={label}>
        {items.map(([id, text, muted]) => <Tab key={id} text={text} muted={muted} on={id === value} onPress={() => { if (id !== value) { void Haptics.selectionAsync(); onChange(id); } }} />)}
      </ScrollView>
    </View>
  );
}

function Tab({ text, on, muted, onPress }: { text: string; on: boolean; muted?: boolean; onPress: () => void }) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => { p.value = withTiming(on ? 1 : 0, { duration: 200 }); }, [on, p]);
  const fill = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(p.value, [0, 1], ["rgba(58,58,60,0)", "rgba(72,72,74,1)"]) }));
  return (
    <Press onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: on }}>
      <Animated.View style={[styles.tab, fill]}>
        <Text style={[styles.text, on ? styles.textOn : muted && styles.textMuted]} numberOfLines={1}>{text}</Text>
      </Animated.View>
    </Press>
  );
}

const styles = StyleSheet.create({
  track: { marginHorizontal: space.gutter, marginVertical: space.snug, borderRadius: radius.chip, backgroundColor: "rgba(28,28,30,0.85)", borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, padding: 3 },
  flush: { marginHorizontal: 0, marginVertical: 0 },
  row: { alignItems: "center" },
  tab: { height: 34, paddingHorizontal: space.stack, borderRadius: radius.chip, alignItems: "center", justifyContent: "center" },
  text: { ...type.callout, color: color.foreground },
  textOn: { color: color.foreground },
  textMuted: { color: color["muted-foreground"] },
});
