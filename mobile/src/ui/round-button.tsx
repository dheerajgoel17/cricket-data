import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Press } from "@/ui/press";
import { hitSlopFor } from "@/ui/platform";
import { color } from "@/ui/tokens";

/** Diameter of the round header / sheet buttons (the drawing; the touch target is topped up to the platform minimum by `hitSlopFor`). */
export const ROUND = 40;

/** The app's one round icon button (back, search, account, share, close, save): a quiet filled circle with a hairline ring and its icon. Never restyle a `Press` into a circle by hand. */
export function RoundButton({ label, onPress, children, active }: { label: string; onPress: () => void; children: ReactNode; active?: boolean }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} hitSlop={hitSlopFor(ROUND)} onPress={() => { void Haptics.selectionAsync(); onPress(); }} style={({ pressed }) => [styles.round, pressed && { opacity: 0.6 }]}>
      {children}
    </Press>
  );
}

const styles = StyleSheet.create({
  round: { width: ROUND, height: ROUND, borderRadius: ROUND / 2, backgroundColor: color["control-fill"], borderWidth: StyleSheet.hairlineWidth, borderColor: color["control-ring"], alignItems: "center", justifyContent: "center" },
});
