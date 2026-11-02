import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { propKey, useSaved } from "@/lib/saved";
import { Press } from "@/ui/press";
import { color, control } from "@/ui/tokens";

/** The star: when it fills it squeezes, pops past full size and settles (UI thread), with a light tap on the way in and a softer one on the way out. */
function Star({ on, size }: { on: boolean; size: number }) {
  const k = useSharedValue(1);
  const first = useSharedValue(true);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: k.value }] }));
  useEffect(() => {
    if (first.value) { first.value = false; return; }
    k.value = on ? withSequence(withTiming(0.7, { duration: 80 }), withSpring(1.28, { damping: 6, stiffness: 420 }), withSpring(1, { damping: 12 })) : withSequence(withTiming(0.85, { duration: 80 }), withSpring(1, { damping: 12 }));
  }, [on, k, first]);
  return <Animated.View style={pop}><Ionicons name={on ? "star" : "star-outline"} size={size} color={on ? color.amber : color.foreground} /></Animated.View>;
}

/** Save a player or a team (the site's `StarButton`): a round button, filled amber when saved. */
export function StarButton({ idx, kind = "player", size = 40 }: { idx: number; kind?: "player" | "team"; size?: number }) {
  const { has, toggle } = useSaved();
  const key = `${kind}:${idx}`;
  const on = has(key);
  return (
    <Press accessibilityRole="button" accessibilityLabel={on ? "Remove from Saved" : "Save"} accessibilityState={{ selected: on }} onPress={() => { const now = toggle(key); void (now ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)); }}
      style={({ pressed }) => [styles.round, { width: size, height: size, borderRadius: size / 2 }, pressed && { opacity: 0.6 }]}>
      <Star on={on} size={19} />
    </Press>
  );
}

/** Watchlist star for one priced line (player, stat, line, format): a small button that saves just that line. */
export function PropStar({ idx, stat, line, fmt }: { idx: number; stat: string; line: number; fmt: number }) {
  const { has, toggle } = useSaved();
  const key = propKey(idx, stat, line, fmt);
  const on = has(key);
  return (
    <Press accessibilityRole="button" accessibilityLabel={on ? "Remove from watchlist" : "Add to watchlist"} accessibilityState={{ selected: on }} onPress={() => { const now = toggle(key); void (now ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)); }}
      style={({ pressed }) => [styles.prop, pressed && { opacity: 0.6 }]}>
      <Star on={on} size={18} />
    </Press>
  );
}

const styles = StyleSheet.create({
  round: { backgroundColor: "rgba(255,255,255,0.10)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  prop: { width: control, height: control, borderRadius: control / 2, backgroundColor: color.card, alignItems: "center", justifyContent: "center" },
});
