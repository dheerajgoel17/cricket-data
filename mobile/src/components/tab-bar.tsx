import type { ComponentProps } from "react";
import { StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";
import type { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TABS } from "@/lib/tabs";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { color, font, TAB_BAR_HEIGHT, type } from "@/ui/tokens";

type Props = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

/**
 * The bottom tab bar on every platform: docked to the bottom edge, full width, a solid surface with a hairline on top (no capsule, no glass, no blur). It is the navigator's own
 * `tabBar`, so a screen ends where the bar begins and nothing scrolls under it. The chosen tab is the accent colour with the filled icon; nothing slides.
 */
export function TabBar({ state, emitter, navigateToTab, insets }: Props) {
  const bottom = insets.bottom;
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: bottom }]}>
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
            onPress={() => {
              const e = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (on || e.defaultPrevented) return;
              void Haptics.selectionAsync();
              navigateToTab(route.key);
            }}
            style={styles.tab}>
            <Ionicons name={on ? t.on : t.icon} size={22} color={tint} />
            <Text style={[styles.label, { color: tint }]} numberOfLines={1}>{t.label}</Text>
          </Press>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", backgroundColor: color.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  tab: { flex: 1, minWidth: 0, height: TAB_BAR_HEIGHT, alignItems: "center", justifyContent: "center", gap: 2 },
  label: { ...type.caption, fontFamily: font.medium, maxWidth: "100%" },
});
