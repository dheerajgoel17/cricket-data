import { Pressable, StyleSheet, View } from "react-native";
import { HOME_PHASES, type HomePhase } from "@site/lib/home-phase";
import { useScreenInsets } from "@/ui/insets";
import { Text } from "@/ui/text";
import { color, space, type } from "@/ui/tokens";
import * as Haptics from "expo-haptics";

/**
 * The floating control on Home: In play / Pre-match / Completed underline tabs with how many matches each holds
 * (the site's `HomePhaseBar`). Sits above the tab bar.
 */
export function PhaseBar({ value, counts, onChange }: { value: HomePhase; counts: Record<HomePhase, number>; onChange: (p: HomePhase) => void }) {
  const { bottom } = useScreenInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: bottom + space.snug }]}>
      <View accessibilityRole="tablist" accessibilityLabel="In play, pre-match or completed" style={styles.row}>
        {HOME_PHASES.map(([id, label]) => {
          const on = id === value;
          return (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => {
                if (id === value) return;
                void Haptics.selectionAsync();
                onChange(id);
              }}
              style={styles.tab}
            >
              <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
                {label} {counts[id]}
              </Text>
              <View style={[styles.rule, on && styles.ruleOn]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: space.gutter, right: space.gutter, alignItems: "center" },
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: space.stack,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
    backgroundColor: color.background,
    paddingHorizontal: space.snug,
  },
  tab: { alignItems: "center", paddingTop: space.snug },
  label: { ...type.callout, color: color["muted-foreground"], paddingBottom: space.snug },
  labelOn: { color: color.primary },
  rule: { alignSelf: "stretch", height: 2, borderRadius: 1, backgroundColor: "transparent" },
  ruleOn: { backgroundColor: color.primary },
});
