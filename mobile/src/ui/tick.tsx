import { useEffect, useRef, useState, type ReactNode } from "react";
import { StyleSheet, type TextStyle } from "react-native";
import { Text } from "@/ui/text";
import Animated, { Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { stillNeed } from "@cricket/engine/tape.js";
import { ArrowDown, ArrowUp } from "@/ui/icons";
import { color, space, type } from "@/ui/tokens";

const HOLD_MS = 1100;

/** Direction a number just moved: 1 up, -1 down, 0 still. Holds for a beat so a 15 s live poll is visible, then returns to 0 (the site's `useTick`). */
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

/** Flash green on a rise, red on a drop, with a small arrow while the flash holds; the colour fades out over the hold. How a price or a so-far that moved is seen between polls. */
export function Tick({ value, children, style }: { value: number | null | undefined; children: ReactNode; style?: TextStyle }) {
  const dir = useTick(value);
  const flash = useSharedValue(0);
  useEffect(() => {
    if (dir === 0) return;
    flash.value = 1;
    flash.value = withTiming(0, { duration: HOLD_MS, easing: Easing.out(Easing.quad) });
  }, [dir, value, flash]);
  const rise = dir !== -1;
  const bg = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(flash.value, [0, 1], rise ? ["rgba(39,218,142,0)", "rgba(39,218,142,0.24)"] : ["rgba(255,0,0,0)", "rgba(255,0,0,0.24)"]) }));
  return (
    <Animated.View style={[styles.row, bg]}>
      {dir === 1 ? <ArrowUp color={color.primary} /> : dir === -1 ? <ArrowDown color={color.miss} /> : null}
      <Text style={[styles.text, style]}>{children}</Text>
    </Animated.View>
  );
}

export type Standing = { v: number | null; state: string; verdict: "cleared" | "missed" | "push" | null };
const VERDICT = { cleared: "Cleared", missed: "Missed", push: "Push" } as const;

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
  text: { ...type.callout, fontVariant: ["tabular-nums"] },
  void: { ...type.caption, color: color.amber, borderWidth: StyleSheet.hairlineWidth, borderColor: color.amber, borderRadius: 4, paddingHorizontal: space.hair, borderStyle: "dashed" },
});
