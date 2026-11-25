import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Text } from "@/ui/text";
import { color, space, tint, type } from "@/ui/tokens";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "miss";

/** Twin of the site's shadcn `Badge` (components/ui/badge.tsx): same variants, a full-round chip with a small label. */
const LOOK: Record<BadgeVariant, { bg: string; fg: string; border?: string }> = {
  default: { bg: color.primary, fg: color["primary-foreground"] },
  secondary: { bg: color.secondary, fg: color["secondary-foreground"] },
  destructive: { bg: color.destructive, fg: color.foreground },
  outline: { bg: "transparent", fg: color.foreground, border: color.border },
  miss: { bg: tint.miss(0.15), fg: color.miss },
};

export function Badge({ variant = "default", children, style }: { variant?: BadgeVariant; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const l = LOOK[variant];
  return (
    <View accessibilityRole="text" style={[styles.badge, { backgroundColor: l.bg }, l.border ? { borderColor: l.border, borderWidth: StyleSheet.hairlineWidth } : null, style]}>
      <Text style={[styles.label, { color: l.fg }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: space.snug, paddingVertical: 2, flexShrink: 0 },
  label: { ...type.caption, fontWeight: "600" },
});
