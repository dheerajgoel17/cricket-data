import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type TextStyle } from "react-native";
import { ROUND, RoundButton } from "@/ui/round-button";
import { Text } from "@/ui/text";
import Animated, { type AnimatedStyle } from "react-native-reanimated";
import { goBack } from "@/lib/nav";
import { ChevronLeft } from "@/ui/icons";
import { font, color, space, type } from "@/ui/tokens";

/**
 * The bar over a page one level down (a match, a player), as in the reference app: a round back button, the name and what it is centred, and round buttons at the right
 * (save, share). The brand stays on the tabs.
 * Optional `titleStyle` / `subtitleStyle` (e.g. scroll opacity) so a hero name below is not doubled at the top of the page.
 */
export function PageHeader({ title, subtitle, right, buttons = 1, titleStyle, subtitleStyle }: {
  title: string; subtitle?: string; right?: ReactNode; buttons?: number;
  titleStyle?: StyleProp<AnimatedStyle<TextStyle>>;
  subtitleStyle?: StyleProp<AnimatedStyle<TextStyle>>;
}) {
  const side = { width: right ? buttons * ROUND + (buttons - 1) * space.tight : ROUND }; // both sides as wide as the buttons, so the title stays centred
  return (
    <View style={styles.bar}>
      <View style={[side, { alignItems: "flex-start" }]}>
        <RoundButton label="Back" onPress={goBack}>
          <ChevronLeft size={22} color={color.foreground} />
        </RoundButton>
      </View>
      <View style={styles.mid} accessibilityRole="header">
        <Animated.Text style={[styles.title, titleStyle]} numberOfLines={1}>{title}</Animated.Text>
        {subtitle ? <Animated.Text style={[styles.subtitle, subtitleStyle]} numberOfLines={1}>{subtitle}</Animated.Text> : null}
      </View>
      <View style={[side, styles.right]}>{right}</View>
    </View>
  );
}

export { RoundButton } from "@/ui/round-button";

const styles = StyleSheet.create({
  bar: { height: 56, flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.gutter },
  mid: { flex: 1, alignItems: "center", gap: 1 },
  title: { ...type.body, fontFamily: font.bold, color: color.foreground },
  subtitle: { ...type.footnote, color: color["muted-foreground"] },
  right: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: space.tight },
});
