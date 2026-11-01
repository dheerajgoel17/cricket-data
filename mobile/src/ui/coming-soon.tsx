import { StyleSheet, Text, View } from "react-native";
import { color, space, type } from "@/ui/tokens";

/** A tab whose screen is not built yet (Phase 1 of the app). */
export function ComingSoon({ title }: { title: string }) {
  return (
    <View style={styles.box}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>Coming soon.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, backgroundColor: color.background, alignItems: "center", justifyContent: "center", gap: space.tight },
  title: { ...type.title, color: color.foreground },
  note: { ...type.callout, color: color["muted-foreground"] },
});
