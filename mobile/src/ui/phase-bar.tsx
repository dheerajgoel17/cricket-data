import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import { layoutWidth } from "@/lib/fit";
import { HOME_PHASES, type HomePhase } from "@site/lib/home-phase";
import { GlassSurface } from "@/ui/glass";
import { useScreenInsets } from "@/ui/insets";
import { Segmented } from "@/ui/segmented";
import { color, radius, space } from "@/ui/tokens";

const PAD = 4;

/**
 * The floating control on Home: In play / Pre-match / Resulted with how many matches each holds (the site's `HomePhaseBar`). The system segmented control on each
 * platform, on a glass backing (a segmented control is see-through on its own, and the list scrolls under this one), above the tab bar.
 */
export function PhaseBar({ value, counts, onChange }: { value: HomePhase; counts: Record<HomePhase, number>; onChange: (p: HomePhase) => void }) {
  const { bottom } = useScreenInsets();
  const width = layoutWidth(useWindowDimensions().width, Platform.OS);
  const items = HOME_PHASES.map(([id, label]) => [id, `${label} ${counts[id]}`] as [HomePhase, string]);
  const outer = Math.min(width - 2 * space.gutter, 380);
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: bottom + space.snug }]}>
      <GlassSurface style={[styles.bar, { width: outer }]}>
        <View style={styles.inner}>
          <Segmented items={items} value={value} onChange={onChange} label="In play, pre-match or resulted" width={outer - 2 * PAD} height={36} />
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: space.gutter, right: space.gutter, alignItems: "center" },
  bar: { borderRadius: radius.chip, padding: PAD, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  inner: { alignItems: "center" },
});
