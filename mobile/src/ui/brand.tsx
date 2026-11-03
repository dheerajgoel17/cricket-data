import { push } from "@/lib/nav";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop } from "react-native-svg";
import { color, HEADER_HEIGHT, space, type } from "@/ui/tokens";

/** The Fancy.cash mark: a rounded dark tile with a green F whose top arm ends in a ball (same drawing as the site's `BrandMark`). */
export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="f" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#3cf0a6" /><Stop offset="1" stopColor="#1fb877" /></LinearGradient>
      </Defs>
      <Rect width={64} height={64} rx={15} fill={color["primary-foreground"]} />
      <G fill="url(#f)">
        <Rect x={17} y={14} width={10} height={37} rx={5} /><Rect x={17} y={14} width={25} height={10} rx={5} />
        <Rect x={17} y={29.5} width={18} height={10} rx={5} /><Circle cx={48.5} cy={19} r={6} />
      </G>
    </Svg>
  );
}

/**
 * Top bar. The Fixtures tab carries the brand (the mark and the wordmark); every other tab puts its own heading here instead (`title`, with `info` beside it and `action` before the search
 * button), so its page starts straight on its content. A hairline underneath.
 */
export function AppHeader({ title, info, action }: { title?: string; info?: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.bar}>
      {title ? (
        <View style={styles.titleRow}><Text style={styles.heading} numberOfLines={1}>{title}</Text>{info}</View>
      ) : (
        <>
          <BrandMark />
          <Text style={styles.word}>Fancy.cash</Text>
        </>
      )}
      {action}
      <Press accessibilityRole="button" accessibilityLabel="Search" hitSlop={8} onPress={() => { void Haptics.selectionAsync(); push("/search"); }} style={({ pressed }) => [styles.search, pressed && { opacity: 0.6 }]}>
        <Ionicons name="search-outline" size={20} color={color.foreground} />
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: HEADER_HEIGHT, flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.gutter, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  titleRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.snug },
  heading: { ...type.display, fontSize: 28, lineHeight: 34, color: color.foreground, flexShrink: 1 },
  word: { ...type.title, color: color.foreground, flex: 1 },
  search: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.10)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
});
