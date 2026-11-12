import { useEffect, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import Animated, { Easing, FadeInDown, cancelAnimation, makeMutable, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { color, radius, space, type } from "@/ui/tokens";

/** How a card or row comes in: a short rise and fade, each a little after the one before (the site's Motion `initial` / `animate` with a stagger, capped at the sixth). */
export const enter = (i = 0) => FadeInDown.delay(Math.min(i, 6) * 40).duration(300);

/** A view whose opacity breathes between 1 and `low`, for the live dot and for placeholders while data loads. */
export function Pulse({ style, low = 0.35, ms = 900, children }: { style?: StyleProp<ViewStyle>; low?: number; ms?: number; children?: React.ReactNode }) {
  const o = useSharedValue(1);
  useEffect(() => {
    o.value = withRepeat(withTiming(low, { duration: ms, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [o, low, ms]);
  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** The pulsing dot before LIVE. */
export function LiveDot() {
  return <Pulse style={styles.dot} />;
}

// One value drives every placeholder on screen, so twenty skeleton rows are one animation, not twenty: a soft light sweeps across them, left to right, together.
const beat = makeMutable(0);
let watching = 0;
function useBeat() {
  useEffect(() => {
    if (watching++ === 0) beat.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), -1, false);
    return () => { if (--watching === 0) cancelAnimation(beat); };
  }, []);
}

/** A grey block with a light that sweeps across it while what it stands for is loading. */
export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  useBeat();
  const [w, setW] = useState(0);
  const sweep = useAnimatedStyle(() => ({ transform: [{ translateX: -w + 2 * w * beat.value }] }));
  return (
    <View style={[styles.skeleton, style, styles.clip]} onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      {w ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sweep]}>
          <Svg width="100%" height="100%">
            <Defs><LinearGradient id="sheen" x1="0" y1="0" x2="1" y2="0"><Stop offset="0" stopColor="#fff" stopOpacity="0" /><Stop offset="0.5" stopColor="#fff" stopOpacity="0.09" /><Stop offset="1" stopColor="#fff" stopOpacity="0" /></LinearGradient></Defs>
            <Rect width="100%" height="100%" fill="url(#sheen)" />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  );
}

const W1 = ["46%", "38%", "54%", "42%", "50%"];
const W2 = ["72%", "64%", "78%", "68%", "60%"];

/** The loading rows of a list, drawn like a prop row (picture, name, the line, a small footnote, the edge on the right, a hairline between), each a little fainter than the one above. */
export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <View>
      {Array.from({ length: rows }, (_, k) => (
        <View key={k} style={[styles.skRow, k > 0 && styles.skSep, { opacity: Math.max(0.45, 1 - k * 0.14) }]}>
          <Skeleton style={styles.skAvatar} />
          <View style={styles.skText}>
            <Skeleton style={[styles.skLine, { width: W1[k % 5] }]} />
            <Skeleton style={[styles.skBig, { width: W2[k % 5] }]} />
            <Skeleton style={[styles.skLine, { width: "34%", height: 9 }]} />
          </View>
          <View style={styles.skSide}><Skeleton style={styles.skEdge} /><Skeleton style={styles.skTag} /></View>
        </View>
      ))}
    </View>
  );
}

/** The loading card of the Home rail: the fixture card's surface, a small header line, two sides with a crest and a score each, and the footer. */
export function CardSkeleton({ width }: { width: number }) {
  return (
    <View style={[styles.skCard, { width }]}>
      <View style={styles.skMeta}><Skeleton style={[styles.skLine, { width: 70 }]} /><Skeleton style={[styles.skLine, { width: 110 }]} /></View>
      <View style={styles.skSides}>
        {[0, 1].map((k) => (
          <View key={k} style={styles.skSide2}>
            <Skeleton style={styles.skCrest} />
            <Skeleton style={[styles.skTeam, { width: k ? "34%" : "42%" }]} />
            <Skeleton style={styles.skScore} />
          </View>
        ))}
      </View>
      <View style={styles.skMeta}><Skeleton style={[styles.skLine, { width: "52%" }]} /><Skeleton style={[styles.skLine, { width: 44 }]} /></View>
    </View>
  );
}

/**
 * What a section shows while it loads or is worked out: grey rows in the shape of what is coming, pulsing together, never a spinner. `label` is for screen readers. `fill` takes
 * the whole height left (a page that is still loading); without it the rows sit where the content will be.
 */
export function Working({ label, fill, rows = 3 }: { label: string; fill?: boolean; rows?: number }) {
  return (
    <View style={[styles.working, fill && styles.workingFill]} accessibilityRole="progressbar" accessibilityLabel={label}>
      <RowsSkeleton rows={fill ? Math.max(rows, 5) : rows} />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.destructive },
  skeleton: { backgroundColor: "rgba(255,255,255,0.09)", borderRadius: radius.card },
  skRow: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.gutter, paddingVertical: space.snug },
  skSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  skAvatar: { width: 44, height: 44, borderRadius: 22 },
  skText: { flex: 1, gap: 7 },
  skLine: { height: 10, borderRadius: 5 },
  skBig: { height: 18, borderRadius: 6 },
  skSide: { alignItems: "flex-end", gap: 8 },
  skEdge: { width: 46, height: 18, borderRadius: 6 },
  skTag: { width: 28, height: 9, borderRadius: 4.5 },
  skCard: { flexShrink: 0, height: 190, backgroundColor: color.card, borderRadius: radius.card, padding: space.inset, justifyContent: "space-between" },
  skMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  skSides: { gap: space.snug },
  skSide2: { flexDirection: "row", alignItems: "center", gap: space.snug },
  skCrest: { width: 36, height: 36, borderRadius: 18 },
  skTeam: { height: 14, borderRadius: 7 },
  skScore: { width: 56, height: 14, borderRadius: 7, marginLeft: "auto" },
  working: { alignSelf: "stretch", paddingVertical: space.stack },
  workingFill: { flex: 1, minHeight: 280 },
});
