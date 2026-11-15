import { useEffect, useState } from "react";
import { useChoice } from "@/lib/use-choice";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Text } from "@/ui/text";
import { color, font, type, tint, duration, w } from "@/ui/tokens";

export interface SegmentedProps<T extends string> {
  items: [id: T, label: string][];
  value: T;
  onChange: (id: T) => void;
  /** What it picks, for screen readers. */
  label: string;
  /** Width in points; the full width of the parent when left out. */
  width?: number;
  height?: number;
}

/**
 * A segmented control drawn like iOS's: a dark track, a raised thumb that slides to the chosen segment on the UI thread.
 * Same control on iOS, Android and the browser preview (no system glass Picker).
 */
export function Segmented<T extends string>({ items, value: valueProp, onChange: onChangeProp, label, width, height = 36 }: SegmentedProps<T>) {
  const [value, onChange] = useChoice(valueProp, onChangeProp);
  const [w, setW] = useState(0);
  const index = Math.max(0, items.findIndex(([id]) => id === value));
  const x = useSharedValue(index);
  useEffect(() => { x.value = withTiming(index, { duration: duration.base, easing: Easing.out(Easing.cubic) }); }, [index, x]);
  const seg = w ? (w - 4) / items.length : 0;
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * seg }] }));
  return (
    <View style={[styles.track, { width: width ?? "100%", height }]} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityRole="tablist" accessibilityLabel={label}>
      {seg ? <Animated.View pointerEvents="none" style={[styles.thumb, { width: seg }, thumb]} /> : null}
      {items.map(([id, text]) => {
        const on = id === value;
        return (
          <Pressable key={id} onPress={() => { if (!on) { void Haptics.selectionAsync(); onChange(id); } }} accessibilityRole="tab" accessibilityState={{ selected: on }} style={styles.hit}>
            <Text style={[styles.text, on && styles.textOn]} numberOfLines={1}>{text}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: "row", backgroundColor: color["segment-track"], borderRadius: 999, padding: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: tint.white(0.16) },
  thumb: { position: "absolute", top: 2, bottom: 2, left: 2, borderRadius: 999, backgroundColor: color["segment-thumb"], shadowColor: tint.black(1), elevation: 1, shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  hit: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  text: { ...type.callout, ...w.copy, color: color.foreground },
  textOn: { ...w.label },
});
