import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import type { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TABS } from "@/lib/tabs";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { color, TAB_BAR_HEIGHT, t, icon } from "@/ui/tokens";

type Props = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

/**
 * The bottom tab bar on every platform: docked to the bottom edge, full width, a solid surface with a hairline on top (no capsule, no glass, no blur). It is the navigator's own
 * `tabBar`, so a screen ends where the bar begins and nothing scrolls under it. The chosen tab is the accent colour with the filled icon; nothing slides.
 */
export function TabBar({ state, emitter, navigateToTab, insets }: Props) {
  function select(index: number) {
    const route = state.routes[index];
    if (!route) return;
    const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (index === state.index || event.defaultPrevented) return;
    void Haptics.selectionAsync();
    navigateToTab(route.key);
  }

  const swipe = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .maxPointers(1)
    .runOnJS(true)
    .onEnd(({ translationX, translationY }, success) => {
      if (!success || Math.abs(translationX) < 36 || Math.abs(translationX) <= Math.abs(translationY)) return;
      select(state.index + (translationX < 0 ? 1 : -1));
    });

  return (
    <GestureDetector gesture={swipe} touchAction="pan-y">
      <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: insets.bottom, paddingHorizontal: Math.max(insets.left, insets.right) }]}>
        {state.routes.map((route, i) => {
          const t = TABS.find((x) => x.name === route.name);
          if (!t) return null;
          const on = state.index === i;
          const tint = on ? color.primary : color["muted-foreground"];
          return (
            <Press
              key={route.key}
              scale={0.94}
              accessibilityRole="tab"
              accessibilityLabel={t.label}
              accessibilityState={{ selected: on }}
              onPress={() => select(i)}
              style={styles.tab}>
              <Ionicons name={on ? t.on : t.icon} size={icon.lg} color={tint} />
              <Text style={[styles.label, { color: tint }]} numberOfLines={1}>{t.label}</Text>
            </Press>
          );
        })}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", justifyContent: "center", backgroundColor: color.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  tab: { width: 80, flexShrink: 1, minWidth: 0, height: TAB_BAR_HEIGHT, alignItems: "center", justifyContent: "center", gap: 2 },
  label: { ...t.captionLabel, maxWidth: "100%" },
});
