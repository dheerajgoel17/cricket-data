import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import * as Haptics from "expo-haptics";
import { goBack } from "@/lib/nav";
import { ChevronLeft } from "@/ui/icons";
import { font, color, space, type } from "@/ui/tokens";

/**
 * The bar over a page one level down (a match, a player), as in the reference app: a round back button, the name and what it is centred, and round buttons at the right
 * (save, share). The brand stays on the tabs.
 */
export function PageHeader({ title, subtitle, right, buttons = 1 }: { title: string; subtitle?: string; right?: ReactNode; buttons?: number }) {
  const side = { width: right ? buttons * 40 + (buttons - 1) * space.tight : 40 }; // both sides as wide as the buttons, so the title stays centred
  return (
    <View style={styles.bar}>
      <View style={[side, { alignItems: "flex-start" }]}>
        <Press accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} onPress={() => { void Haptics.selectionAsync(); goBack(); }} style={({ pressed }) => [styles.round, pressed && { opacity: 0.6 }]}>
          <ChevronLeft size={22} color={color.foreground} />
        </Press>
      </View>
      <View style={styles.mid} accessibilityRole="header">
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={[side, styles.right]}>{right}</View>
    </View>
  );
}

/** A round header button (44 pt) with its icon. */
export function RoundButton({ label, onPress, children, active }: { label: string; onPress: () => void; children: ReactNode; active?: boolean }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} hitSlop={6} onPress={() => { void Haptics.selectionAsync(); onPress(); }} style={({ pressed }) => [styles.round, pressed && { opacity: 0.6 }]}>
      {children}
    </Press>
  );
}

const styles = StyleSheet.create({
  bar: { height: 56, flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.gutter },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.10)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  mid: { flex: 1, alignItems: "center", gap: 1 },
  title: { ...type.body, fontFamily: font.bold, color: color.foreground },
  subtitle: { ...type.footnote, color: color["muted-foreground"] },
  right: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: space.tight },
});
