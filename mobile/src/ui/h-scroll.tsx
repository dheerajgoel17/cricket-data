import { forwardRef } from "react";
import { StyleSheet, View, type ScrollView, type ScrollViewProps } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { color, tint } from "@/ui/tokens";

/** How far the fade reaches into the row (pt). */
const FADE = 24;
const CLEAR = tint.hex(color.background, 0);

type Props = Omit<ScrollViewProps, "horizontal" | "onScroll"> & {
  /** Colour the content dissolves into (the page behind the row); the app canvas by default. */
  edge?: string;
};

/**
 * The app's one horizontally scrolling row (chips, tabs, active filters): its content dissolves at an edge that has more behind it instead of being cut off, and the fade goes
 * away at the start / end. A gradient (never a live blur: blur costs frames on a mid-range Android) whose opacity follows the scroll on the UI thread, so JavaScript is not involved while
 * it scrolls. Use it instead of a bare horizontal `ScrollView`.
 */
export const HScroll = forwardRef<ScrollView, Props>(function HScroll({ edge = color.background, style, onLayout, onContentSizeChange, children, ...rest }, ref) {
  const x = useSharedValue(0), view = useSharedValue(0), content = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { x.value = e.contentOffset.x; });
  const left = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, x.value / FADE)) }));
  const right = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, (content.value - view.value - x.value) / FADE)) }));
  const to = edge === color.background ? CLEAR : tint.hex(edge, 0);
  return (
    <View style={style}>
      <Animated.ScrollView
        ref={ref as never}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onLayout={(e) => { view.value = e.nativeEvent.layout.width; onLayout?.(e); }}
        onContentSizeChange={(w, h) => { content.value = w; onContentSizeChange?.(w, h); }}
        {...rest}>
        {children}
      </Animated.ScrollView>
      <Animated.View pointerEvents="none" style={[styles.fade, styles.left, left]}>
        <LinearGradient colors={[edge, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.fade, styles.right, right]}>
        <LinearGradient colors={[to, edge]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  fade: { position: "absolute", top: 0, bottom: 0, width: FADE },
  left: { left: 0 },
  right: { right: 0 },
});
