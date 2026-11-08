import { useEffect, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TABS } from "@/lib/tabs";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { color, font, TAB_BAR_HEIGHT, type } from "@/ui/tokens";

const PAD = 4, GAP = 2;

/** One tab: icon over label; chosen tab tinted, icon pops. */
function TabButton({ t, on }: { t: (typeof TABS)[number]; on: boolean }) {
  const k = useSharedValue(1);
  const first = useSharedValue(true);
  const icon = useAnimatedStyle(() => ({ transform: [{ scale: k.value }] }));
  useEffect(() => {
    if (first.value) { first.value = false; return; }
    if (on) k.value = withSequence(withTiming(0.82, { duration: 70 }), withSpring(1.12, { damping: 7, stiffness: 420 }), withSpring(1, { damping: 12 }));
  }, [on, k, first]);
  return (
    <Press
      scale={0.94}
      accessibilityRole="tab"
      accessibilityLabel={t.label}
      accessibilityState={{ selected: on }}
      onPress={() => { if (!on) { void Haptics.selectionAsync(); router.navigate(t.href as never); } }}
      style={styles.tab}>
      <Animated.View style={icon}><Ionicons name={on ? t.on : t.icon} size={24} color={on ? color.primary : color["muted-foreground"]} /></Animated.View>
      <Text style={[styles.label, { color: on ? color.primary : color["muted-foreground"] }]} numberOfLines={1}>{t.label}</Text>
    </Press>
  );
}

/**
 * Floating capsule tab bar (Android + browser preview). iOS uses the system bar in `app-tabs.tsx`.
 * Same tabs as the site Ionic bar; chosen tab has a soft thumb that springs across.
 */
export function FloatingTabBar() {
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const index = Math.max(0, TABS.findIndex((t) => path === t.href));
  const [w, setW] = useState(0);
  const tabW = w ? (w - PAD * 2 - GAP * (TABS.length - 1)) / TABS.length : 0;
  const x = useSharedValue(index);
  useEffect(() => { x.value = withSpring(index, { damping: 18, stiffness: 260, mass: 0.85 }); }, [index, x]);
  const glide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * (tabW + GAP) }] }));
  return (
    <View style={[styles.bar, { bottom: insets.bottom + 12, left: width < 360 ? 8 : 16, right: width < 360 ? 8 : 16 }]} pointerEvents="box-none">
      <View style={styles.row} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {tabW ? <Animated.View pointerEvents="none" style={[styles.thumb, { width: tabW }, glide]} /> : null}
        {TABS.map((t, i) => <TabButton key={t.name} t={t} on={i === index} />)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: "absolute", height: TAB_BAR_HEIGHT, borderRadius: TAB_BAR_HEIGHT / 2, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.16)", backgroundColor: "rgba(34,34,36,0.97)", zIndex: 50 },
  row: { flex: 1, flexDirection: "row", padding: PAD, gap: GAP },
  thumb: { position: "absolute", left: PAD, top: PAD, bottom: PAD, borderRadius: TAB_BAR_HEIGHT / 2 - PAD, backgroundColor: "rgba(120,120,128,0.30)" },
  tab: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", gap: 1 },
  label: { ...type.caption, fontFamily: font.semibold, maxWidth: "100%" },
});
