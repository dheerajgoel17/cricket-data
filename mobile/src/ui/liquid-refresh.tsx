// Liquid refresh: pull to refresh as a drop of liquid. Pull the list down and a drop stretches from the top edge, its neck thinning the further you pull; past the line (a haptic tick,
// "Release to refresh") let go and the neck snaps back up while the drop falls into a ring; when the refresh finishes it turns into a check and the list springs back. A short pull
// just springs back.
//
// From Cue's mobile "Liquid pull to refresh" (Expo / React Native), converted to this app: colours, type and springs come from the tokens (`ui/tokens`, `ui/curves`), the app is dark
// only so there is no light palette, the demo and the web touch handlers are gone, and a phone with reduce motion on gets the system's plain pull-to-refresh instead.
//
//   <LiquidRefresh onRefresh={() => refetch()} contentContainerStyle={{ paddingBottom }}>{rows}</LiquidRefresh>
import { forwardRef, useMemo, useRef, useState, type ComponentRef } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps } from "react-native";
import Animated, { Easing, cancelAnimation, interpolate, runOnJS, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Circle, Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { bounce, easeOutCubic } from "@/ui/curves";
import { AnimatedText } from "@/ui/text";
import { color, type } from "@/ui/tokens";

type ScrollRef = ComponentRef<typeof ScrollView>;
type RefreshState = "idle" | "pulling" | "refreshing" | "done";

export type LiquidRefreshProps = ScrollViewProps & {
  /** The drop spins until this settles (a rejected promise leaves the list as it was). */
  onRefresh: () => Promise<unknown> | void;
  /** How far (after the rubber band) to pull before it refreshes. */
  threshold?: number;
  /** The most the list ever moves. */
  maxPull?: number;
  /** Where the list waits while refreshing. */
  holdAt?: number;
  /** How long the check shows before the list springs back. */
  doneMs?: number;
};

const LABELS = { pull: "Pull to refresh", release: "Release to refresh", refreshing: "Refreshing…", done: "Updated just now" };
const APath = Animated.createAnimatedComponent(Path);
const ACircle = Animated.createAnimatedComponent(Circle);

/**
 * A ScrollView with the liquid pull-to-refresh. Use it in place of `ScrollView`, or hand it to a FlashList as `renderScrollComponent` (the list's scroll events are passed through, so
 * its recycling keeps working). Every scrolling tab uses this one control.
 */
export const LiquidScroll = forwardRef<ScrollRef, LiquidRefreshProps>(function LiquidScroll(props, ref) {
  const calm = useReducedMotion();
  return calm ? <PlainRefresh {...props} ref={ref} /> : <Liquid {...props} ref={ref} />;
});

/** Reduce motion: the system control, with the same props. */
/**
 * For a FlashList: `const Scroller = useLiquidList(refetch)` then `<FlashList renderScrollComponent={Scroller} … />`. The component is created once (a new one per render would remount the list's
 * scroll view); the latest `onRefresh` is read when a refresh starts.
 */
export function useLiquidList(onRefresh: () => Promise<unknown> | void) {
  const latest = useRef(onRefresh);
  latest.current = onRefresh;
  return useMemo(() => forwardRef<ScrollRef, ScrollViewProps>(function LiquidList(props, ref) {
    return <LiquidScroll {...props} ref={ref} onRefresh={() => latest.current()} />;
  }), []);
}

const PlainRefresh = forwardRef<ScrollRef, LiquidRefreshProps>(function PlainRefresh({ onRefresh, threshold, maxPull, holdAt, doneMs, ...rest }, ref) {
  void threshold; void maxPull; void holdAt; void doneMs;
  const [busy, setBusy] = useState(false);
  const go = () => { setBusy(true); void Promise.resolve(onRefresh()).catch(() => {}).finally(() => setBusy(false)); };
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      {...rest}
      ref={ref}
      refreshControl={<RefreshControl refreshing={busy} onRefresh={go} tintColor={color.foreground} colors={[color.primary]} progressBackgroundColor={color.card} />} />
  );
});

const Liquid = forwardRef<ScrollRef, LiquidRefreshProps>(function Liquid({ onRefresh, threshold = 96, maxPull = 170, holdAt = 78, doneMs = 650, style, onScroll: onScrollProp, ...rest }, ref) {
  const [w, setW] = useState(360);
  const [state, setState] = useState<RefreshState>("idle");
  const [label, setLabel] = useState(LABELS.pull);
  const busy = useRef(false);

  // y: how far the list is down; neck: how far the drop's neck reaches (it snaps back up when the drop breaks)
  const y = useSharedValue(0), neck = useSharedValue(0), spin = useSharedValue(0), mark = useSharedValue(0);
  const scrollY = useSharedValue(0), armed = useSharedValue(0), loading = useSharedValue(0);
  // a plain handler (not a worklet) so a FlashList's own onScroll keeps receiving every event it recycles rows from
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => { scrollY.value = e.nativeEvent.contentOffset.y; onScrollProp?.(e); };
  const resist = (d: number) => { "worklet"; return maxPull * (1 - Math.exp(-Math.max(0, d) / (maxPull * 1.15))); };

  const tick = () => { void Haptics.selectionAsync().catch(() => {}); };
  const setPullLabel = (over: boolean) => { setState("pulling"); setLabel(over ? LABELS.release : LABELS.pull); };

  const refresh = async () => {
    if (busy.current) return;
    busy.current = true;
    setState("refreshing"); setLabel(LABELS.refreshing);
    loading.value = 1; mark.value = 0;
    y.value = withSpring(holdAt, bounce.liquid);
    neck.value = withTiming(0, { duration: 260, easing: easeOutCubic });
    spin.value = 0; spin.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.linear }), -1);
    try { await onRefresh(); } catch { /* the list stays as it was */ }
    cancelAnimation(spin); loading.value = 0;
    setState("done"); setLabel(LABELS.done);
    mark.value = withTiming(1, { duration: 320, easing: easeOutCubic });
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    // the label and the state go back to "pull" only once the list has sprung back, so "Updated just now" stays with the check
    const rest = () => { setState("idle"); setLabel(LABELS.pull); busy.current = false; };
    setTimeout(() => {
      y.value = withSpring(0, bounce.liquid, (fin) => { if (fin) { mark.value = 0; runOnJS(rest)(); } });
    }, doneMs);
  };

  const pan = Gesture.Pan()
    .activeOffsetY(6)
    .onUpdate((e) => {
      if (loading.value || scrollY.value > 1) return; // only when the list is at the top, never while loading
      const v = resist(e.translationY);
      y.value = v; neck.value = v;
      const over = v >= threshold ? 1 : 0;
      if (over !== armed.value) { armed.value = over; if (over) runOnJS(tick)(); }
      runOnJS(setPullLabel)(!!over);
    })
    .onEnd(() => {
      if (loading.value) return;
      if (y.value >= threshold) runOnJS(refresh)();
      else { y.value = withSpring(0, bounce.liquid); neck.value = withTiming(0, { duration: 200 }); runOnJS(setState)("idle"); }
      armed.value = 0;
    });

  // ---- the drop, drawn from y and neck ----
  const CX = w / 2;
  const dropProps = useAnimatedProps(() => {
    const v = y.value, p = Math.min(1, v / threshold);
    const ballY = Math.max(12, v - 26), r = 8 + 6 * Math.min(1, v / 60);
    const base = 13 + 7 * (1 - p), thin = Math.max(2.4, 6 - 3.6 * p);
    const n = Math.min(neck.value, ballY), pool = Math.min(10, 3 + v * 0.12);
    if (n < 3) return { d: "" };
    // a pool along the top, a neck that pinches in fast and stays thin, flaring into the top of the ball
    const top = ballY - r * 0.75;
    const d = `M ${CX - base - 16} -2 L ${CX + base + 16} -2`
      + ` C ${CX + base} 0, ${CX + thin} ${Math.min(n * 0.3, pool + 14)}, ${CX + thin} ${Math.min(n, top) * 0.7}`
      + ` C ${CX + thin} ${top - 2}, ${CX + r * 0.7} ${top}, ${CX + r * 0.55} ${top + 1}`
      + ` L ${CX - r * 0.55} ${top + 1}`
      + ` C ${CX - r * 0.7} ${top}, ${CX - thin} ${top - 2}, ${CX - thin} ${Math.min(n, top) * 0.7}`
      + ` C ${CX - thin} ${Math.min(n * 0.3, pool + 14)}, ${CX - base} 0, ${CX - base - 16} -2 Z`;
    return { d: n >= top * 0.85 ? d : `M ${CX - base} -2 L ${CX + base} -2 C ${CX + base * 0.4} ${n * 0.5}, ${CX + thin} ${n}, ${CX} ${n} C ${CX - thin} ${n}, ${CX - base * 0.4} ${n * 0.5}, ${CX - base} -2 Z` };
  });
  const ballProps = useAnimatedProps(() => {
    const v = y.value;
    return { cx: CX, cy: Math.max(12, v - 26), r: v > 4 ? 8 + 6 * Math.min(1, v / 60) : 0 };
  });
  const ringProps = useAnimatedProps(() => {
    const v = y.value, cy = Math.max(12, v - 26), r = Math.max(0, 8 + 6 * Math.min(1, v / 60) - 5);
    return { cx: CX, cy, r, opacity: loading.value, strokeDashoffset: -spin.value * 2 * Math.PI * r };
  });
  const markProps = useAnimatedProps(() => {
    const cy = Math.max(12, y.value - 26);
    return { d: `M ${CX - 5} ${cy} l 3.6 3.8 l 6.8 -7.6`, strokeDashoffset: 24 * (1 - mark.value), opacity: mark.value > 0 ? 1 : 0 };
  });
  const listStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const labelStyle = useAnimatedStyle(() => {
    const v = y.value, r = 8 + 6 * Math.min(1, v / 60);
    return { opacity: interpolate(v, [10, 30], [0, 1], "clamp"), transform: [{ translateX: CX + r + 14 }, { translateY: Math.max(12, v - 26) - 9 }] };
  });

  return (
    <View style={[{ flex: 1, backgroundColor: color.background }, style]} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={w} height={260}>
          <APath animatedProps={dropProps} fill={color.primary} />
          <ACircle animatedProps={ballProps} fill={color.primary} />
          <ACircle animatedProps={ringProps} fill="none" stroke={color["primary-foreground"]} strokeWidth={2.6} strokeLinecap="round" strokeDasharray="22 60" />
          <APath animatedProps={markProps} fill="none" stroke={color["primary-foreground"]} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="24" />
        </Svg>
        <AnimatedText style={[styles.label, labelStyle]} numberOfLines={1}>{label}</AnimatedText>
      </View>
      <GestureDetector gesture={Gesture.Simultaneous(pan, Gesture.Native())}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          accessibilityHint={state === "idle" ? LABELS.pull : label}
          {...rest}
          ref={ref}
          onScroll={onScroll}
          scrollEventThrottle={16}
          style={[{ flex: 1, backgroundColor: color.background }, listStyle]} />
      </GestureDetector>
    </View>
  );
});

const styles = StyleSheet.create({
  label: { ...type.footnote, position: "absolute", left: 0, top: 0, color: color["muted-foreground"] },
});
