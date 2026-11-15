import type { ReactNode } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { TOUCH } from "@/ui/platform";
import { color, control, radius, space, t } from "@/ui/tokens";

/**
 * The app's one button: `primary` (accent fill, the sheet's Apply, Sign in, Email) or `secondary` (quiet fill, Clear, Write about this), `md` at the platform's touch height (44 iOS / 48 Android)
 * or `sm` at the control height (36, inline). `flex` shares a row (Clear 1 : Apply 2). Never style a `Press` into a button by hand (`tokens.test.ts`). Web twin: `Button` in `components/ui/button.tsx`.
 */
export function Button({ label, onPress, variant = "primary", size = "md", icon, flex, disabled, accessibilityLabel, style }: {
  label: string; onPress: () => void; variant?: "primary" | "secondary"; size?: "md" | "sm"; icon?: ReactNode; flex?: number; /** Dims the button and ignores presses (a request in flight). */ disabled?: boolean; accessibilityLabel?: string; style?: StyleProp<ViewStyle>;
}) {
  const primary = variant === "primary", sm = size === "sm";
  return (
    <Press scale={sm ? 0.97 : 1} onPress={onPress} disabled={disabled} accessibilityState={{ disabled: !!disabled }} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.base, { height: sm ? control : TOUCH, backgroundColor: primary ? color.primary : color.secondary }, flex ? { flex } : null, sm && styles.sm, pressed && { opacity: 0.85 }, disabled && { opacity: 0.55 }, style]}>
      {icon}
      <Text style={[sm ? t.calloutLabel : t.bodyLabel, { color: primary ? color["primary-foreground"] : color.foreground }]} numberOfLines={1}>{label}</Text>
    </Press>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.chip, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.tight, paddingHorizontal: space.group },
  sm: { paddingHorizontal: space.stack },
});
