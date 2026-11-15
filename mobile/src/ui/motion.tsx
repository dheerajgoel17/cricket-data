import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useState } from "react";
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, ReduceMotion, useReducedMotion } from "react-native-reanimated";
import { color, duration, space, spring } from "@/ui/tokens";
import { renderSkeleton, type SkeletonShape } from "@/ui/skeletons";

export { CardSkeleton, RowsSkeleton, Skeleton, SkeletonGroup } from "@/ui/skeletons";
export type { SkeletonShape } from "@/ui/skeletons";

// Entrances are springs (Reanimated layout animations, run on the UI thread): a card settles into place instead of sliding in on a fixed curve. No overshoot (damping ratio 1 is
// critical damping; 0.9 lets it breathe a hair) because nothing was flicked; each a little after the one before, capped at the sixth. Built once per index.
const entrances = new Map<number, ReturnType<typeof FadeInDown.delay>>();
/** How a card or section comes in on first paint: a short rise that springs to rest. */
export const enter = (i = 0) => {
  const k = Math.min(i, 6);
  if (!entrances.has(k)) entrances.set(k, FadeInDown.delay(k * 45).springify(spring.enter.duration).dampingRatio(spring.enter.dampingRatio).reduceMotion(ReduceMotion.System));
  return entrances.get(k)!;
};

// The keyframes for a given low point, made once (the live dot and nothing else asks for more than one).
const breaths = new Map<string, object>();
const breath = (low: number, ms: number) => {
  const k = `${low}|${ms}`;
  if (!breaths.has(k)) breaths.set(k, { animationName: { from: { opacity: 1 }, to: { opacity: low } }, animationDuration: `${ms}ms`, animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDirection: "alternate" });
  return breaths.get(k)!;
};

/** A view whose opacity breathes between 1 and `low` (the live dot): a CSS animation on the UI thread, nothing per frame in JavaScript. Still when the phone's reduce motion is on. */
export function Pulse({ style, low = 0.35, ms = 900, children }: { style?: StyleProp<ViewStyle>; low?: number; ms?: number; children?: React.ReactNode }) {
  const calm = useReducedMotion();
  if (calm) return <View style={style}>{children}</View>;
  return <Animated.View style={[style, breath(low, ms)] as never}>{children}</Animated.View>;
}

/**
 * A card that springs up into place when it mounts (`enter`). `on` is read at mount only, so the caller decides which mounts are a first paint: a card that scrolls back into a
 * virtualized rail must not rise again. Still when the phone's reduce motion is on.
 */
export function Rise({ i = 0, on = true, style, children }: { i?: number; on?: boolean; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const [go] = useState(on);
  if (!go) return <View style={style}>{children}</View>;
  return <Animated.View entering={enter(i)} style={style}>{children}</Animated.View>;
}

/** Content that fades in where a placeholder stood (a quick opacity change, nothing moves): the list arriving after its skeleton. */
export function Appear({ style, children }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  return <Animated.View entering={APPEAR} style={style}>{children}</Animated.View>;
}
const APPEAR = FadeIn.duration(180).reduceMotion(ReduceMotion.System);

const HALO = { animationName: { from: { opacity: 0.55, transform: [{ scale: 1 }] }, to: { opacity: 0, transform: [{ scale: 2.8 }] } }, animationDuration: "1600ms", animationTimingFunction: "ease-out", animationIterationCount: "infinite" } as const;

/**
 * The LIVE mark: a steady red dot with a ring that keeps spreading out from it and fading (a broadcast "on air" light). One CSS animation on transform and opacity, on the UI
 * thread; with reduce motion on, the dot alone.
 */
export function LiveDot() {
  const calm = useReducedMotion();
  return (
    <View style={styles.dotBox}>
      {calm ? null : <Animated.View style={[styles.dot, styles.halo, HALO] as never} />}
      <View style={styles.dot} />
    </View>
  );
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
  dotBox: { width: 6, height: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.miss },
  halo: { position: "absolute", left: 0, top: 0 },
  working: { alignSelf: "stretch", paddingVertical: space.stack },
  workingFill: { flex: 1, minHeight: 280 },
});

// built on first use (the layout presets are not in the test double of Reanimated)
let reflow: ReturnType<typeof LinearTransition.duration> | undefined, leave: ReturnType<typeof FadeOut.duration> | undefined;
/**
 * A row in a short list whose order or membership changes (Saved, a market overview that re-sorts as prices move): when a sibling is added, removed or moves, this row glides to its new
 * place (layout transition, UI thread, transform only) and a removed one fades out, instead of the list jumping. Not for virtualized lists (FlashList rows recycle): those keep their order
 * changes instant. Static when the phone's reduce motion is on. Web twin: `Reflow` in `components/app/reflow.tsx`.
 */
export function Reflow({ style, children }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const calm = useReducedMotion();
  if (calm) return <View style={style}>{children}</View>;
  reflow ??= LinearTransition.duration(duration.base).reduceMotion(ReduceMotion.System);
  leave ??= FadeOut.duration(duration.fast).reduceMotion(ReduceMotion.System);
  return <Animated.View layout={reflow} exiting={leave} style={style}>{children}</Animated.View>;
}
