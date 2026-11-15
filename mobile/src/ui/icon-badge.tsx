import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { color } from "@/ui/tokens";

/** An icon on a quiet filled circle (Contact topics, empty states): 36 pt by default, 40 for an empty state's lead icon. Not a button (that is `RoundButton`). */
export function IconBadge({ children, size = 36 }: { children: ReactNode; size?: 36 | 40 }) {
  return <View accessibilityElementsHidden style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }]}>{children}</View>;
}

const styles = StyleSheet.create({
  badge: { alignItems: "center", justifyContent: "center", backgroundColor: color.secondary },
});
