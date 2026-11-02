import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Tabs, router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TABS } from "@/lib/tabs";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { color, font, TAB_BAR_HEIGHT, type } from "@/ui/tokens";

const PAD = 4, GAP = 2;

/** One tab, as on iOS: icon over its label, always both; the chosen one is tinted and its icon pops. */
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

// Android has no system glass, so the bar is ours, made to look like iOS's: a floating capsule with every tab's icon and label, and a soft capsule behind the chosen one that glides to
// the next on a spring. A solid dark tint (a live blur of the screens behind it is too heavy for the GPU).
export default function AppTabs() {
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const index = Math.max(0, TABS.findIndex((t) => path === t.href));
  const [w, setW] = useState(0);
  const tabW = w ? (w - PAD * 2 - GAP * (TABS.length - 1)) / TABS.length : 0;
  const x = useSharedValue(index);
  useEffect(() => { x.value = withSpring(index, { damping: 18, stiffness: 260, mass: 0.85 }); }, [index, x]);
  const glide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * (tabW + GAP) }] }));
  return (
    <View style={styles.root}>
      <View style={styles.root}>
        <Tabs screenOptions={{ headerShown: false, freezeOnBlur: true, sceneStyle: { backgroundColor: color.background } }} tabBar={() => null}>
          {TABS.map((t) => <Tabs.Screen key={t.name} name={t.name} />)}
        </Tabs>
      </View>
      <View style={[styles.bar, { bottom: insets.bottom + 12 }]}>
        <View style={styles.row} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
          {tabW ? <Animated.View pointerEvents="none" style={[styles.thumb, { width: tabW }, glide]} /> : null}
          {TABS.map((t, i) => <TabButton key={t.name} t={t} on={i === index} />)}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  bar: { position: "absolute", left: 16, right: 16, height: TAB_BAR_HEIGHT, borderRadius: TAB_BAR_HEIGHT / 2, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.16)", backgroundColor: "rgba(34,34,36,0.97)" },
  row: { flex: 1, flexDirection: "row", padding: PAD, gap: GAP },
  thumb: { position: "absolute", left: PAD, top: PAD, bottom: PAD, borderRadius: TAB_BAR_HEIGHT / 2 - PAD, backgroundColor: "rgba(120,120,128,0.30)" },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 1 },
  label: { ...type.caption, fontFamily: font.semibold },
});
