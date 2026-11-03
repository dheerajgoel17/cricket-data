/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Circle, Defs, Line, Pattern, Rect } from "react-native-svg";
import { CountUp, ReText } from "@/ui/count-up";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { barState } from "@cricket/engine/windows.js";
import { abbr, shortDate as shortDateRaw } from "@site/lib/format";
import { color, font, space, type } from "@/ui/tokens";

/** "06/09" as "6/9": the labels under the bars are short enough to show whole, as in the reference app. */
const shortDate = (d: string) => String(shortDateRaw(d)).replace(/\b0(\d)/g, "$1");

const HIT = color.hit, MISS = color.miss, AMBER = color.amber;
// each bar is one flat colour: no gradient, square corners
const TONE: Record<string, string> = { hit: "#2fd68f", miss: "#ef4444", push: "#f5a524" };
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A ring segment that draws itself from nothing to its length on the UI thread. */
function Arc({ r, start, dash, total, stroke, delay = 0, round }: { r: number; start: number; dash: number; total: number; stroke: string; delay?: number; round?: boolean }) {
  const g = useSharedValue(0);
  useEffect(() => { g.value = withDelay(delay, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) })); }, [g, delay]);
  const props = useAnimatedProps(() => ({ strokeDasharray: [dash * g.value, total] }));
  return <AnimatedCircle cx={24} cy={24} r={r} fill="none" stroke={stroke} strokeWidth={4} strokeLinecap={round ? "round" : "butt"} animatedProps={props} transform={`rotate(${start} 24 24)`} />;
}

/** Hit-rate ring: green from 60%, amber from 40%, red below (the site's `Gauge`). The ring draws itself and the figure counts up. */
export function Gauge({ p, caption }: { p: number | null; caption: string }) {
  const arc = p == null ? 0 : Math.max(0, Math.min(1, p));
  const tone = arc >= 0.6 ? HIT : arc >= 0.4 ? AMBER : MISS;
  return (
    <View style={styles.gauge} accessibilityRole="image" accessibilityLabel={`${caption} ${p == null ? "none" : `${Math.round(arc * 100)}%`}`}>
      <View style={{ width: 64, height: 64 }}>
        <Svg width={64} height={64} viewBox="0 0 48 48">
          <Circle cx={24} cy={24} r={19} fill="none" stroke={color.border} strokeWidth={4} strokeDasharray="89.6 29.9" strokeLinecap="round" transform="rotate(135 24 24)" />
          {arc > 0 ? <Arc r={19} start={135} dash={89.6 * arc} total={200} stroke={tone} round /> : null}
        </Svg>
        <View style={styles.center} pointerEvents="none">
          {p == null ? <Text style={styles.centerText}>–</Text> : <CountUp value={Math.round(arc * 100)} suffix="%" style={styles.centerText} />}
        </View>
      </View>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

export interface Slice { key: string; n: number; color: string }

/** A ring split into how his games went: cleared, missed, pushed, not counted (the site's `OutcomeDonut`). Each segment draws in after the one before. */
export function OutcomeDonut({ slices, center, caption }: { slices: Slice[]; center: string; caption: string }) {
  const live = slices.filter((s) => s.n > 0);
  const total = live.reduce((t, s) => t + s.n, 0), r = 18, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <View style={styles.gauge} accessibilityRole="image" accessibilityLabel={`${caption} ${center}`}>
      <View style={{ width: 80, height: 80 }}>
        <Svg width={80} height={80} viewBox="0 0 48 48">
          <Circle cx={24} cy={24} r={r} fill="none" stroke={color.border} strokeWidth={4} />
          {live.map((s, k) => {
            const frac = s.n / total, start = acc * 360 - 90;
            acc += frac;
            return <Arc key={s.key} r={r} start={start} dash={frac * c} total={c} stroke={s.color} delay={k * 140} />;
          })}
        </Svg>
        <View style={styles.center} pointerEvents="none"><Text style={styles.centerText}>{center}</Text></View>
      </View>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

const COL = 30; // a bar's width when the chart scrolls sideways (more than 20 games)
const GAP = 4, TIP_W = 112;

/**
 * Bar chart of a player's last games against a line (the site's `ChartBars`): the axis names the top and the floor, the line carries its own value, each bar its number, each column its
 * date and opponent. Bars are flat solids that grow up from the floor, one after another, on the UI thread; a game he did not play is a hatched stub and never counts. Drag a finger
 * across the bars to read each game (the others dim, a tip follows, a tick of haptics at every bar). More than 20 games scroll sideways with the newest in view. Tap a bar for that game.
 */
export function ChartBars({ entries, line, side, height = 240, onSelect }: { entries: any[]; line: number; side: string; height?: number; onSelect?: (e: any, state: string) => void }) {
  const vals = entries.filter((e) => e.value != null).map((e) => e.value as number);
  const top = Math.max(2, Math.ceil(Math.max(line + 0.5, ...vals, 1)));
  const wide = entries.length > 20;
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { if (wide) setTimeout(() => scroller.current?.scrollToEnd({ animated: false }), 0); }, [wide, entries.length]);
  const col = wide ? { width: COL } : { flex: 1 };
  const step = wide ? 1 : entries.length > 10 ? Math.ceil(entries.length / 8) : 1; // a label every few bars when the columns are narrower than a date: never more than about eight

  // scrubbing (the plot's width is measured; the bar under the finger is `active`, -1 when no finger is down)
  const [plotW, setPlotW] = useState(0);
  const active = useSharedValue(-1);
  const tip = useSharedValue("");
  const tipX = useSharedValue(0);
  const tipShow = useSharedValue(0);
  const n = entries.length;
  const labels = entries.map((e) => `${e.value ?? "DNP"} · ${shortDate(e.date)}${e.tag ? ` ${e.tag}` : e.opp ? ` ${abbr(e.opp)}` : ""}`);
  const tick = () => { void Haptics.selectionAsync(); };
  const scrub = Gesture.Pan()
    .enabled(!wide && plotW > 0)
    .activeOffsetX([-6, 6])
    .failOffsetY([-14, 14])
    .onStart((e) => { tipShow.value = withTiming(1, { duration: 120 }); void e; })
    .onUpdate((e) => {
      const bw = (plotW - GAP * (n - 1)) / n;
      const i = Math.max(0, Math.min(n - 1, Math.floor((e.x + GAP / 2) / (bw + GAP))));
      if (i !== active.value) { active.value = i; tip.value = labels[i]; runOnJS(tick)(); }
      tipX.value = Math.max(0, Math.min(plotW - TIP_W, i * (bw + GAP) + bw / 2 - TIP_W / 2));
    })
    .onFinalize(() => { active.value = -1; tipShow.value = withTiming(0, { duration: 180 }); });
  const tipStyle = useAnimatedStyle(() => ({ opacity: tipShow.value, transform: [{ translateX: tipX.value }, { translateY: -6 * (1 - tipShow.value) }] }));

  return (
    <View style={styles.chart} accessibilityRole="image" accessibilityLabel={`Form chart, line ${line}`}>
      <View style={[styles.axis, { height }]}>
        <Text style={styles.tick}>{top}</Text>
        <Text style={styles.tick}>{Math.round((top / 2) * 10) / 10}</Text>
        <Text style={styles.tick}>0</Text>
      </View>
      <ScrollView ref={scroller} horizontal={wide} scrollEnabled={wide} showsHorizontalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={wide ? { minWidth: "100%" } : { flexGrow: 1 }}>
        <View style={{ flex: wide ? undefined : 1, width: wide ? entries.length * (COL + GAP) : undefined }}>
          <GestureDetector gesture={scrub}>
            <View style={{ height }} onLayout={(e) => setPlotW(Math.round(e.nativeEvent.layout.width))}>
              <View pointerEvents="none" style={[styles.line, { bottom: `${(Math.min(line, top) / top) * 100}%` }]}><Text style={styles.lineLabel}>{line}</Text></View>
              <View style={styles.bars}>
                {entries.map((e, i) => {
                  const s = barState(e, line, side) as string;
                  return (
                    <Press key={`${e.m}-${i}`} scale={1} onPress={() => onSelect?.(e, s)} accessibilityRole="button" accessibilityLabel={`${e.date} v ${e.opp}: ${e.value ?? "did not play"}`} style={[styles.slot, col]}>
                      {e.value == null ? <HatchStub i={i} active={active} /> : <Bar i={i} active={active} pct={Math.max((Math.min(e.value, top) / top) * 100, 1.5)} tone={s === "miss" ? "miss" : s === "push" ? "push" : "hit"} text={s === "miss" ? "#fff" : color.background} value={e.value} />}
                    </Press>
                  );
                })}
              </View>
              <Animated.View pointerEvents="none" style={[styles.tip, tipStyle]}><ReText text={tip} style={styles.tipText} /></Animated.View>
            </View>
          </GestureDetector>
          <View style={styles.xRow}>
            {entries.map((e, i) => (
              <View key={i} style={[styles.x, col, !wide && i === 0 && { alignItems: "flex-start" }, !wide && i === entries.length - 1 && { alignItems: "flex-end" }]}>
                {(entries.length - 1 - i) % step === 0 ? <><Text style={styles.xText} numberOfLines={1} ellipsizeMode="clip">{shortDate(e.date)}</Text>{(e.tag ?? abbr(e.opp)) ? <Text style={styles.xText} numberOfLines={1} ellipsizeMode="clip">{e.tag ?? abbr(e.opp)}</Text> : null}</> : null}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** One bar: a flat solid that grows from the floor (staggered), with its value inside; dims while a finger is on another bar. */
function Bar({ i, pct, tone, text, value, active }: { i: number; pct: number; tone: "hit" | "miss" | "push"; text: string; value: number; active: SharedValue<number> }) {
  const g = useSharedValue(0);
  useEffect(() => { g.value = withDelay(Math.min(i * 14, 420), withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) })); }, [g, i]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: g.value }], opacity: active.value < 0 || active.value === i ? 1 : 0.38 }));
  return (
    <Animated.View style={[styles.bar, { height: `${pct}%`, backgroundColor: TONE[tone] }, style, { transformOrigin: "bottom" } as any]}>
      <Text style={[styles.barText, { color: text }]} numberOfLines={1}>{value}</Text>
    </Animated.View>
  );
}

/** A game he did not play: a short hatched stub (never counted). */
function HatchStub({ i, active }: { i: number; active: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: active.value < 0 || active.value === i ? 1 : 0.38 }));
  return (
    <Animated.View style={[styles.stub, style]}>
      <Svg width="100%" height="100%">
        <Defs><Pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><Line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,0.32)" strokeWidth="2" /></Pattern></Defs>
        <Rect width="100%" height="100%" rx="3" fill="rgba(153,153,153,0.18)" /><Rect width="100%" height="100%" rx="3" fill="url(#hatch)" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  gauge: { alignItems: "center", gap: space.hair },
  caption: { ...type.caption, color: color["muted-foreground"] },
  chart: { flexDirection: "row", gap: 4 },
  axis: { width: 28, justifyContent: "space-between", alignItems: "flex-end" },
  tick: { fontSize: 15, lineHeight: 15, fontFamily: font.data, color: color.foreground, fontVariant: ["tabular-nums"] },
  line: { position: "absolute", left: 0, right: 0, zIndex: 2, borderTopWidth: 1, borderColor: "#fff" },
  lineLabel: { position: "absolute", left: 0, top: -22, fontSize: 16, fontFamily: font.data, color: color.foreground, backgroundColor: "rgba(0,0,0,0.75)", paddingHorizontal: 4, borderRadius: 4, overflow: "hidden", fontVariant: ["tabular-nums"] },
  bars: { ...StyleSheet.absoluteFill, flexDirection: "row", alignItems: "flex-end", gap: GAP },
  center: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  centerText: { fontSize: 15, lineHeight: 18, fontFamily: font.data, color: color.foreground, fontVariant: ["tabular-nums"], textAlign: "center" },
  tip: { position: "absolute", top: -4, left: 0, width: TIP_W, alignItems: "center", backgroundColor: "rgba(40,40,44,0.96)", borderRadius: 10, paddingVertical: 4, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.18)", zIndex: 5 },
  tipText: { fontSize: 14, fontFamily: font.data, color: color.foreground, textAlign: "center", width: "100%" },
  slot: { height: "100%", justifyContent: "flex-end" },
  stub: { height: 22, width: "100%" },
  bar: { width: "100%", justifyContent: "flex-end", alignItems: "center", paddingBottom: 4, overflow: "hidden" },
  barText: { fontSize: 13, width: "100%", textAlign: "center", fontFamily: font.data, fontVariant: ["tabular-nums"] },
  xRow: { flexDirection: "row", gap: 4, paddingTop: 6 },
  x: { alignItems: "center" },
  xText: { width: 44, textAlign: "center", fontSize: 10.5, lineHeight: 13, fontFamily: font.medium, color: color["muted-foreground"] },
});
