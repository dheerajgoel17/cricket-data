import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { HOME_PHASES, type HomePhase } from "@site/lib/home-phase";
import { GlassSurface } from "@/ui/glass";
import { color, control, radius, space, type } from "@/ui/tokens";

/** The In play / Pre-match / Resulted switch (the web's home bar), with how many matches each holds. */
export function PhasePills({ phase, counts, onChange }: { phase: HomePhase; counts: Record<HomePhase, number>; onChange: (p: HomePhase) => void }) {
  return (
    <GlassSurface style={styles.bar}>
      <View style={styles.row}>
        {HOME_PHASES.map(([key, label]) => {
          const on = key === phase;
          return (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => { if (!on) { void Haptics.selectionAsync(); onChange(key); } }}
              style={[styles.pill, on && styles.pillOn]}>
              <Text style={[styles.text, on && styles.textOn]}>{label}</Text>
              <Text style={[styles.count, on && styles.textOn]}>{counts[key]}</Text>
            </Pressable>
          );
        })}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  bar: { borderRadius: radius.chip, padding: 4 },
  row: { flexDirection: "row", gap: 4 },
  pill: { flex: 1, minHeight: control - 8, borderRadius: radius.chip, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: space.tight },
  pillOn: { backgroundColor: color.foreground },
  text: { ...type.callout, fontWeight: "600", color: color.foreground },
  count: { ...type.footnote, color: color["muted-foreground"], fontVariant: ["tabular-nums"] },
  textOn: { color: color.background },
});
