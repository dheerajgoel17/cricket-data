import type { ReactNode } from "react";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";

/**
 * A card in a snapping rail: the one at the left edge is full size and sharp; as it leaves, and as the next arrives, each tilts back a little along an arc (smaller, lower, dimmer, a
 * few degrees turned). Driven by the rail's scroll offset on the UI thread. `step` is one card plus its gap.
 */
export function RailCard({ x, index, step, children }: { x: SharedValue<number>; index: number; step: number; children: ReactNode }) {
  const style = useAnimatedStyle(() => {
    const d = (x.value - index * step) / step; // -1 .. 1 either side of this card's place
    const a = Math.min(Math.abs(d), 1);
    return { opacity: 1 - a * 0.4, transform: [{ translateY: a * 12 }, { rotate: `${-d * 3}deg` }, { scale: 1 - a * 0.07 }] };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}
