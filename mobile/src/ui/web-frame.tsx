import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { color, WEB_MAX_WIDTH } from "@/ui/tokens";

// In a browser the app is a phone-sized column (WEB_MAX_WIDTH), so a desktop window shows it as designed instead of stretching rows and chips edge to edge.

/** In a browser, the app centred in a column with a hairline either side on the elevated canvas; on a phone it is just its children. */
export function WebFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== "web") return <>{children}</>;
  return (
    <View style={styles.page}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: color.background, alignItems: "center" },
  column: { flex: 1, width: "100%", maxWidth: WEB_MAX_WIDTH, backgroundColor: color.background, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
});
