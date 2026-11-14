import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import * as SplashScreen from "expo-splash-screen";
import { Text } from "@/ui/text";
import { color } from "@/ui/tokens";

/** The mark's drawing units (the site's `BrandMark`: a 64-unit tile) and the size it is drawn at. */
const SIZE = 112, U = SIZE / 64;
/** The shortest the splash stays up, so the drawing is seen through, and how long it takes to dissolve into the app. */
const MIN_MS = 1100, FADE_MS = 300;
const GREEN = color.primary;

const out = Easing.out(Easing.cubic);

/**
 * The splash after the system's: the same black, then the F is drawn in (the stem down, the two arms across, the ball springing in at the end of the top arm), the wordmark rises under it, and
 * the whole thing dissolves into the app once its fonts are in. Only transforms and opacity, all on the UI thread, so it is as light on a low-end phone as on a new one. The system splash
 * is plain black (no image: a launcher icon is masked differently by every phone), so this is the first thing drawn. With the phone's reduce-motion on, the mark is simply there and fades out.
 */
export function AnimatedSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const calm = useReducedMotion();
  const t0 = useRef(Date.now());
  const stem = useSharedValue(calm ? 1 : 0), top = useSharedValue(calm ? 1 : 0), mid = useSharedValue(calm ? 1 : 0), ball = useSharedValue(calm ? 1 : 0);
  const word = useSharedValue(calm ? 1 : 0), shell = useSharedValue(1);

  useEffect(() => {
    if (calm) return;
    stem.value = withTiming(1, { duration: 320, easing: out });
    top.value = withDelay(150, withTiming(1, { duration: 300, easing: out }));
    mid.value = withDelay(270, withTiming(1, { duration: 240, easing: out }));
    ball.value = withDelay(430, withSpring(1, { damping: 9, stiffness: 240, mass: 0.7 }));
    word.value = withDelay(620, withTiming(1, { duration: 360, easing: out })); // in the system font, so it never waits for the app's fonts
  }, [calm, stem, top, mid, ball, word]);

  // Everything above runs on the UI thread from the first frame, so it plays through even while the JS thread is busy mounting the app (the app mounts the moment its fonts are in). Only the
  // dissolve waits on JS: for the app to be ready and for the splash to have been up for MIN_MS, counted from its first frame.
  useEffect(() => {
    if (!ready) return;
    const wait = Math.max(0, MIN_MS - (Date.now() - t0.current));
    const id = setTimeout(() => { shell.value = withTiming(0, { duration: FADE_MS, easing: Easing.bezier(0.23, 1, 0.32, 1) }, (finished) => { if (finished) scheduleOnRN(onDone); }); }, wait);
    return () => clearTimeout(id);
  }, [ready, shell, onDone]);

  const stemS = useAnimatedStyle(() => ({ transform: [{ scaleY: stem.value }] }));
  const topS = useAnimatedStyle(() => ({ transform: [{ scaleX: top.value }] }));
  const midS = useAnimatedStyle(() => ({ transform: [{ scaleX: mid.value }] }));
  const ballS = useAnimatedStyle(() => ({ transform: [{ scale: ball.value }] }));
  const wordS = useAnimatedStyle(() => ({ opacity: word.value, transform: [{ translateY: (1 - word.value) * 10 }] }));
  const shellS = useAnimatedStyle(() => ({ opacity: shell.value, transform: [{ scale: 1 + (1 - shell.value) * 0.05 }] }));

  const piece = (x: number, y: number, w: number, h: number, r: number) => ({ position: "absolute" as const, left: x * U, top: y * U, width: w * U, height: h * U, borderRadius: r * U, backgroundColor: GREEN });
  return (
    <Animated.View style={[styles.fill, shellS]} pointerEvents="none" onLayout={() => void SplashScreen.hideAsync()}>
      <View style={styles.center}>
        <View style={{ width: SIZE, height: SIZE }}>
          <Animated.View style={[piece(17, 14, 10, 37, 5), stemS, { transformOrigin: "top" } as object]} />
          <Animated.View style={[piece(17, 14, 25, 10, 5), topS, { transformOrigin: "left" } as object]} />
          <Animated.View style={[piece(17, 29.5, 18, 10, 5), midS, { transformOrigin: "left" } as object]} />
          <Animated.View style={[piece(42.5, 13, 12, 12, 6), ballS]} />
        </View>
        <Animated.View style={wordS}><Text style={styles.word}>Fancy.cash</Text></Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, backgroundColor: "#000000", zIndex: 100 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  word: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5, color: color.foreground },
});
