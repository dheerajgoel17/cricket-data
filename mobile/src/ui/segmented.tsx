import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Text } from "@/ui/text";
import { color, font, type } from "@/ui/tokens";

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
 * A segmented control drawn like iOS's: a dark track, a raised thumb that slides to the chosen segment on the UI thread. iOS has the system's own (`segmented.ios.tsx`: a SwiftUI
 * `Picker`); Android and the browser preview use this one, so the two look the same.
 */
export function Segmented<T extends string>({ items, value, onChange, label, width, height = 36 }: SegmentedProps<T>) {
  const [w, setW] = useState(0);
  const index = Math.max(0, items.findIndex(([id]) => id === value));
  const x = useSharedValue(index);
  useEffect(() => { x.value = withTiming(index, { duration: 220, easing: Easing.out(Easing.cubic) }); }, [index, x]);
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
  track: { flexDirection: "row", backgroundColor: "rgba(44,44,46,0.7)", borderRadius: 999, padding: 2, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.16)" },
  thumb: { position: "absolute", top: 2, bottom: 2, left: 2, borderRadius: 999, backgroundColor: "#58585c", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  hit: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  text: { ...type.callout, fontFamily: font.regular, color: color.foreground },
  textOn: { fontFamily: font.semibold },
});
