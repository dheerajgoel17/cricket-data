import { useRef, type ComponentRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BlurTargetView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { Tabs, router, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassSurface } from "@/ui/glass";
import { color, radius, TAB_BAR_HEIGHT, type } from "@/ui/tokens";

const TABS = [
  { name: "index", href: "/", label: "Fixtures", icon: "calendar-outline", on: "calendar" },
  { name: "props", href: "/props", label: "Props", icon: "stats-chart-outline", on: "stats-chart" },
  { name: "fancy", href: "/fancy", label: "Fancy", icon: "flash-outline", on: "flash" },
  { name: "saved", href: "/saved", label: "Saved", icon: "bookmark-outline", on: "bookmark" },
] as const;

// Android has no system glass, so the bar is ours: a blur of the screens (the BlurTargetView) behind a floating capsule that sits outside that view.
export default function AppTabs() {
  const target = useRef<ComponentRef<typeof View>>(null);
  const path = usePathname();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <BlurTargetView ref={target} style={styles.root}>
        <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.background } }} tabBar={() => null}>
          {TABS.map((t) => <Tabs.Screen key={t.name} name={t.name} />)}
        </Tabs>
      </BlurTargetView>
      <GlassSurface blurTarget={target} style={[styles.bar, { bottom: insets.bottom + 12 }]}>
        <View style={styles.row}>
          {TABS.map((t) => {
            const on = path === t.href;
            return (
              <Pressable
                key={t.name}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => { if (!on) { void Haptics.selectionAsync(); router.navigate(t.href); } }}
                style={styles.tab}>
                <Ionicons name={on ? t.on : t.icon} size={22} color={on ? color.primary : color["muted-foreground"]} />
                <Text style={[styles.label, { color: on ? color.primary : color["muted-foreground"] }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  bar: { position: "absolute", left: 16, right: 16, height: TAB_BAR_HEIGHT, borderRadius: radius.chip, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  row: { flex: 1, flexDirection: "row" },
  tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  label: { ...type.caption, fontWeight: "600" },
});
