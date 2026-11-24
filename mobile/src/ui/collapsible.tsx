import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { ChevronRight } from "@/ui/icons";
import { color, duration } from "@/ui/tokens";
import { easeOutExpo } from "@/ui/curves";

const DURATION = duration.base;
const EASE = easeOutExpo;

/**
 * Content that opens and closes under a row: its height and fade are animated on the UI thread (the way `Accordion` does for its sections), so "+3 books" slides open instead of jumping.
 * Nothing is mounted until it is first opened (a list of fifty rows was building fifty hidden book tables); from then on the content stays mounted so it can be measured, and closed
 * it is clipped to nothing. Static when the phone's reduce motion is on.
 */
export function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  // null: never opened yet (nothing mounted). false: open from the first render (shown at once). true: opened later (starts closed, is measured, slides open).
  const [late, setLate] = useState<boolean | null>(open ? false : null);
  if (open && late === null) setLate(true);
  return late === null ? null : <Body open={open} slide={late}>{children}</Body>;
}

function Body({ open, slide, children }: { open: boolean; slide: boolean; children: ReactNode }) {
  const calm = useReducedMotion();
  const [h, setH] = useState(0);
  const p = useSharedValue(open && !slide ? 1 : 0);
  useEffect(() => {
    if (!h) return; // not measured yet: there is no height to go to
    p.value = calm ? (open ? 1 : 0) : withTiming(open ? 1 : 0, { duration: DURATION, easing: EASE });
  }, [open, calm, p, h]);
  const body = useAnimatedStyle(() => ({ height: interpolate(p.value, [0, 1], [0, h]), opacity: p.value }));
  const unmeasured = slide ? { height: 0 } : { height: open ? undefined : 0 };
  return (
    <Animated.View style={[styles.clip, h > 0 ? body : unmeasured]} pointerEvents={open ? "auto" : "none"}>
      <View onLayout={(e) => { const next = Math.round(e.nativeEvent.layout.height); if (next && next !== h) setH(next); }} style={h > 0 || slide ? styles.measured : undefined}>{children}</View>
    </Animated.View>
  );
}

const TURN = { transitionProperty: "transform", transitionDuration: `${DURATION}ms`, transitionTimingFunction: "ease-out" } as const;
const SHUT = { transform: [{ rotate: "90deg" }] }, OPEN = { transform: [{ rotate: "-90deg" }] };

/**
 * The chevron that turns as its section opens (pointing down when closed, up when open), in step with `Collapsible`. A plain view until its section is first toggled, then a CSS
 * transition on the rotation: a list of closed rows mounts nothing animated for it.
 */
export function TurnChevron({ open }: { open: boolean }) {
  const calm = useReducedMotion();
  const [first] = useState(open);
  const [moved, setMoved] = useState(false);
  if (open !== first && !moved) setMoved(true);
  const icon = <ChevronRight color={color["muted-foreground"]} />;
  if (!moved || calm) return <View style={open ? OPEN : SHUT}>{icon}</View>;
  return <Turning open={open} from={first}>{icon}</Turning>;
}

/** Mounts at the angle it had, then turns: the first toggle is animated like every later one. */
function Turning({ open, from, children }: { open: boolean; from: boolean; children: ReactNode }) {
  const [at, setAt] = useState(from);
  useEffect(() => { setAt(open); }, [open]);
  return <Animated.View style={[TURN, at ? OPEN : SHUT]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  measured: { position: "absolute", left: 0, right: 0, top: 0 },
});
