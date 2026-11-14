import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { color, space } from "@/ui/tokens";
import { renderSkeleton, type SkeletonShape } from "@/ui/skeletons";

export { CardSkeleton, RowsSkeleton, Skeleton } from "@/ui/skeletons";
export type { SkeletonShape } from "@/ui/skeletons";

/** How a card or row comes in: a short rise and fade, each a little after the one before (the site's Motion `initial` / `animate` with a stagger, capped at the sixth). */
export const enter = (i = 0) => FadeInDown.delay(Math.min(i, 6) * 40).duration(300);

/** A view whose opacity breathes between 1 and `low`, for the live dot and for placeholders while data loads. */
export function Pulse({ style, low = 0.35, ms = 900, children }: { style?: StyleProp<ViewStyle>; low?: number; ms?: number; children?: React.ReactNode }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withTiming(low, { duration: ms, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [o, low, ms]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** The pulsing dot before LIVE. */
export function LiveDot() {
  return <Pulse style={styles.dot} />;
}

/**
 * What a section shows while it loads: a page-shaped skeleton (never a spinner).
 * `shape` picks the layout (prop rows by default); `label` is for screen readers.
 * `fill` takes the height left on a still-loading page.
 */
export function Working({ label, fill, rows = 3, shape = "rows" }: { label: string; fill?: boolean; rows?: number; shape?: SkeletonShape }) {
  const n = fill && shape === "rows" ? Math.max(rows, 5) : rows;
  return (
    <View style={[styles.working, fill && styles.workingFill]} accessibilityRole="progressbar" accessibilityLabel={label} testID={`working-${shape}`}>
      {renderSkeleton(shape, n)}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.destructive },
  working: { alignSelf: "stretch", paddingVertical: space.stack },
  workingFill: { flex: 1, minHeight: 280 },
});
