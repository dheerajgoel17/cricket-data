import { color, tint } from "@/ui/tokens";
import type { ComponentRef, ReactNode, RefObject } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import {
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

/** Kept so the screens that wrap their scrolling content in it need no change: a plain view. */
export const BlurTargetView = View;
export type BlurTarget = RefObject<ComponentRef<typeof View> | null>;

const SOLID = color["chrome-solid"], CLEAR = tint.hex(color.background, 0);

/**
 * Sticky page chrome. With `merge` (or legacy `accent`): clear at rest so the elevated canvas / hero wash shows through —
 * pair with `useChromeScrim` so the bar goes solid elevated once content scrolls under it. Without merge: solid elevated tint
 * on every platform (no blur / liquid glass).
 */
export function BlurBar({
  children,
  style,
  accent,
  merge,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  blurTarget?: BlurTarget | null;
  /** @deprecated Prefer `merge` — any truthy value still clears the bar for entity pages. */
  accent?: string | null;
  /** Clear chrome at rest; caller fades in solid elevated via `useChromeScrim`. */
  merge?: boolean;
}) {
  if (merge || accent) return <View style={style}>{children}</View>;
  return <View style={[style, { backgroundColor: SOLID }]}>{children}</View>;
}

/**
 * Solid elevated scrim for sticky merge chrome. Worklet-safe (`interpolateColor` — never call `tint.hex` here).
 * `threshold` is usually measured hero height (player) or bar height (fixture); opaque once `y` reaches it.
 */
export function useChromeScrim(y: SharedValue<number>, threshold: SharedValue<number>) {
  return useAnimatedStyle(() => {
    const t = Math.max(48, threshold.value);
    return {
      backgroundColor: interpolateColor(y.value, [t * 0.35, t], [CLEAR, SOLID]),
    };
  });
}

/**
 * Scroll-driven collapse for a bar's lower rows: `collapsed` goes to 1 when the list is scrolled down past `after` points and back to 0 on any scroll up or near the top, so
 * the filters tuck away while reading and come straight back when you pull toward them. Runs on the UI thread (worklets), so it stays smooth while JavaScript is busy.
 */
export function useCollapseOnScroll(after = 80) {
  const collapsed = useSharedValue(0);
  const last = useSharedValue(0);
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    const offset = e.contentOffset.y, dy = offset - last.value;
    last.value = offset;
    y.value = offset;
    if (offset < 24 || dy < -4) collapsed.value = withTiming(0, { duration: 220 });
    else if (dy > 4 && offset > after) collapsed.value = withTiming(1, { duration: 220 });
  });
  return { collapsed, onScroll, y };
}
