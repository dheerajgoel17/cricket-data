import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { ChevronRight } from "@/ui/icons";
import { color } from "@/ui/tokens";

const DURATION = 240;

/**
 * Content that opens and closes under a row: its height and fade are animated on the UI thread (the way `Accordion` does for its sections), so "+3 books" slides open instead of jumping. The
 * content stays mounted so it can be measured; closed, it is clipped to nothing. Static when the phone's reduce motion is on.
 */
export function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  const calm = useReducedMotion();
  const [h, setH] = useState(0);
  const p = useSharedValue(open ? 1 : 0);
  useEffect(() => { p.value = calm ? (open ? 1 : 0) : withTiming(open ? 1 : 0, { duration: DURATION, easing: Easing.out(Easing.cubic) }); }, [open, calm, p]);
  const body = useAnimatedStyle(() => ({ height: interpolate(p.value, [0, 1], [0, h]), opacity: p.value }));
  return (
    <Animated.View style={[styles.clip, h > 0 ? body : { height: open ? undefined : 0 }]} pointerEvents={open ? "auto" : "none"}>
      <View onLayout={(e) => { const next = Math.round(e.nativeEvent.layout.height); if (next && next !== h) setH(next); }} style={h > 0 ? styles.measured : undefined}>{children}</View>
    </Animated.View>
  );
}

/** The chevron that turns a quarter as its section opens (pointing right when closed, down when open), in step with `Collapsible`. */
export function TurnChevron({ open }: { open: boolean }) {
  const calm = useReducedMotion();
  const p = useSharedValue(open ? 1 : 0);
  useEffect(() => { p.value = calm ? (open ? 1 : 0) : withTiming(open ? 1 : 0, { duration: DURATION, easing: Easing.out(Easing.cubic) }); }, [open, calm, p]);
  const turn = useAnimatedStyle(() => ({ transform: [{ rotate: `${interpolate(p.value, [0, 1], [90, -90])}deg` }] }));
  return <Animated.View style={turn}><ChevronRight color={color["muted-foreground"]} /></Animated.View>;
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  measured: { position: "absolute", left: 0, right: 0, top: 0 },
});
