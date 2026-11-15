import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, View, type TextStyle } from "react-native";
import { Text } from "@/ui/text";
import Animated, { Easing, interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { stillNeed } from "@cricket/engine/tape.js";
import { ArrowDown, ArrowUp } from "@/ui/icons";
import { color, font, space, tint, type } from "@/ui/tokens";

/** Colour/arrow hold after a move — stock-ticker brief (~1 s), not sticky. */
const HOLD_MS = 1000;
/** How long the wash of colour takes to fade, and how far (pt) the new figure travels as it rolls in. */
const WASH_MS = 450, ROLL = 14;
// Precomputed outside worklets — calling `tint.*` inside useAnimatedStyle hits the JS runtime ("Tried to synchronously call a Remote Function").
const FLASH_RISE = [tint.primary(0), tint.primary(0.24)] as const;
const FLASH_FALL = [tint.miss(0), tint.miss(0.24)] as const;

/** Direction a number just moved: 1 up, -1 down, 0 still. Holds ~1 s (stock-ticker flash), then returns to 0 (the site's `useTick`). */
export function useTick(value: number | null | undefined) {
  const prev = useRef(value);
  const [dir, setDir] = useState<-1 | 0 | 1>(0);
  useEffect(() => {
    const cur = value, was = prev.current;
    prev.current = cur;
    if (cur == null || was == null || cur === was) return;
    setDir(cur > was ? 1 : -1);
    const t = setTimeout(() => setDir(0), HOLD_MS);
    return () => clearTimeout(t);
  }, [value]);
  return dir;
}

/**
 * A price or a so-far that moved between polls: the new figure rolls in (up on a rise, down on a fall) over a green or red wash, with a small arrow while it holds.
 * Plain text until the number first moves: most prices never do, so a list of rows mounts no animated view for them.
 */
/** `arrow={false}` skips the reserved arrow gutter (scoreboard next to a crest — site Tick). */
export function Tick({ value, children, style, arrow = true }: { value: number | null | undefined; children: ReactNode; style?: TextStyle; arrow?: boolean }) {
  const dir = useTick(value);
  const calm = useReducedMotion();
  const [armed, setArmed] = useState(false);
  if (dir !== 0 && !armed) setArmed(true);
  const text = <Text style={[styles.text, style]}>{children}</Text>;
  if (!armed) return <View style={styles.row}>{text}</View>;
  return (
    <Flash dir={dir} value={value} calm={calm}>
      {arrow ? (dir === 1 ? <ArrowUp color={color.primary} /> : dir === -1 ? <ArrowDown color={color.miss} /> : null) : null}
      {text}
    </Flash>
  );
}

/**
 * A number that just moved: the new figure rolls in from below on a rise and from above on a fall and springs to rest (clipped to its own box), over a wash of colour that fades.
 * Transform and background only, on the UI thread. With reduce motion on, the arrow alone says it.
 */
function Flash({ dir, value, calm, children }: { dir: -1 | 0 | 1; value: number | null | undefined; calm: boolean; children: ReactNode }) {
  const flash = useSharedValue(0), y = useSharedValue(0);
  useEffect(() => {
    if (dir === 0 || calm) return;
    flash.value = 1;
    flash.value = withTiming(0, { duration: WASH_MS, easing: Easing.out(Easing.cubic) });
    y.value = dir * ROLL;
    y.value = withSpring(0, { duration: 420, dampingRatio: 0.8 });
  }, [dir, value, flash, y, calm]);
  const colors = dir === -1 ? FLASH_FALL : FLASH_RISE;
  const bg = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(flash.value, [0, 1], colors) }));
  const roll = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={[styles.row, styles.clip, bg]}><Animated.View style={[styles.rollRow, roll]}>{children}</Animated.View></Animated.View>;
}

export type Standing = { v: number | null; state: string; verdict: "cleared" | "missed" | "push" | null };
const VERDICT = { cleared: "Cleared", missed: "Missed", push: "On the line" } as const;

/** So-far / final / Cleared against the booked line, flashing when the scorecard moves the number (the site's `StandingMark`). */
export function StandingMark({ standing, line }: { standing: Standing | null | undefined; line?: number }) {
  if (!standing) return null;
  if (standing.state === "void") return <Text style={styles.void}>VOID</Text>;
  const need = stillNeed(standing.v, line, standing.verdict);
  const tone = standing.verdict === "cleared" ? color.primary : standing.verdict === "missed" ? color.miss : color["muted-foreground"];
  return (
    <Tick value={standing.v} style={{ color: tone }}>
      {standing.v} {standing.state === "live" ? "so far" : standing.state}
      {need != null ? ` · ${need} to go` : ""}
      {standing.verdict ? ` · ${VERDICT[standing.verdict]}` : ""}
    </Tick>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 6, paddingHorizontal: 2 },
  clip: { overflow: "hidden" },
  rollRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  text: { ...type.callout, fontFamily: font.data, fontVariant: ["tabular-nums"] },
  void: { ...type.caption, color: color.amber, borderWidth: StyleSheet.hairlineWidth, borderColor: color.amber, borderRadius: 4, paddingHorizontal: space.hair, borderStyle: "dashed" },
});
