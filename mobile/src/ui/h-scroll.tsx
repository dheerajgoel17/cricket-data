import { forwardRef } from "react";
import { I18nManager, Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { color, space, tint } from "@/ui/tokens";

/**
 * The app's one horizontally scrolling row (chips, tabs, active filters): content runs edge to edge, with optional edge fades for chip rails. Use it instead of a bare horizontal `ScrollView` (`tokens.test.ts`). Web twin: `ScrollRow` / `PillGroup`.
 */
export const HScroll = forwardRef<ScrollView, Omit<ScrollViewProps, "horizontal">>(function HScroll(props, ref) {
  return <ScrollView ref={ref as never} horizontal showsHorizontalScrollIndicator={false} {...props} />;
});

type ChipScrollProps = Omit<ScrollViewProps, "horizontal" | "onScroll" | "onLayout" | "onContentSizeChange"> & { fade?: boolean };
const EDGE = space.snug;
const EDGE_COLORS = [tint.hex(color.background, 0.55), tint.hex(color.background, 0.12), tint.hex(color.background, 0)] as const;
const EDGE_STOPS = [0, 0.4, 1] as const;
const START = { x: I18nManager.isRTL ? 1 : 0, y: 0 };
const END = { x: 1 - START.x, y: 0 };

/** Full-width chip rails hint at hidden content. Android draws the fade in the native ScrollView. */
export function ChipScroll({ fade = true, ...props }: ChipScrollProps) {
  if (!fade || Platform.OS === "web") return <HScroll {...props} />;
  if (Platform.OS === "android") return <HScroll {...props} fadingEdgeLength={space.tight} />;
  return <GradientChipScroll {...props} />;
}

function GradientChipScroll({ style, contentOffset, ...props }: ChipScrollProps) {
  const viewport = useSharedValue(0);
  const content = useSharedValue(0);
  const offset = useSharedValue(contentOffset?.x ?? 0);
  const track = useAnimatedScrollHandler((event) => { offset.set(event.contentOffset.x); });
  const start = useAnimatedStyle(() => ({
    opacity: viewport.get() > 0 ? edgeOpacity(Math.min(offset.get(), content.get() - viewport.get()), EDGE) : 0,
  }));
  const end = useAnimatedStyle(() => ({
    opacity: viewport.get() > 0 ? edgeOpacity(content.get() - viewport.get() - Math.max(0, offset.get()), EDGE) : 0,
  }));
  return (
    <View style={style}>
      <Animated.ScrollView
        {...props}
        horizontal
        contentOffset={contentOffset}
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={track}
        onLayout={(event) => viewport.set(event.nativeEvent.layout.width)}
        onContentSizeChange={(width) => content.set(width)}
      />
      <Animated.View pointerEvents="none" accessibilityElementsHidden style={[styles.edge, styles.start, start]}>
        <LinearGradient colors={EDGE_COLORS} locations={EDGE_STOPS} start={START} end={END} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View pointerEvents="none" accessibilityElementsHidden style={[styles.edge, styles.end, end]}>
        <LinearGradient colors={EDGE_COLORS} locations={EDGE_STOPS} start={END} end={START} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
}

export function edgeOpacity(hidden: number, length: number) {
  "worklet";
  return Math.min(1, Math.max(0, hidden / length));
}

const styles = StyleSheet.create({
  edge: { position: "absolute", top: 0, bottom: 0, width: EDGE },
  start: { start: 0 },
  end: { end: 0 },
});
