import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { color } from "@/ui/tokens";

/** The widest the app gets in a browser: a phone-sized column, so a desktop window shows the app as designed instead of stretching rows and chips edge to edge. */
export const WEB_MAX_WIDTH = 560;

/** In a browser, the app centred in a column with a hairline either side on a black page; on a phone it is just its children. */
export function WebFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== "web") return <>{children}</>;
  return (
    <View style={styles.page}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#000000", alignItems: "center" },
  column: { flex: 1, width: "100%", maxWidth: WEB_MAX_WIDTH, backgroundColor: color.background, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
});
