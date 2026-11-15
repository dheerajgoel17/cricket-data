import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HOME_PHASES, type HomePhase } from "@site/lib/home-phase";
import { push } from "@/lib/nav";
import { LineTabs } from "@/ui/line-tabs";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { color, font, radius, space, type } from "@/ui/tokens";
import * as Haptics from "expo-haptics";

/** Links that exist in the app (site More also lists web-only tools). */
const MORE: [string, string][] = [
  ["Search", "/search"],
  ["Competitions", "/competitions"],
  ["Player props", "/props"],
  ["Fancy lines", "/fancy"],
  ["Saved", "/saved"],
  ["Contact", "/contact"],
  ["Reading a prop", "/info/player-props"],
  ["Hit rate", "/info/hit-rate"],
  ["Fair odds", "/info/fair-odds"],
];

/**
 * Home's phase tabs: In play / Pre-match / Completed underline tabs with how many matches each holds (the site's `HomePhaseBar`), plus More for the rest of the app.
 * A full-width strip under the header, as on the site's phone Home: line tabs sitting on a hairline, the chosen one in the accent colour.
 */
export function PhaseBar({ value, counts, onChange }: { value: HomePhase; counts: Record<HomePhase, number>; onChange: (p: HomePhase) => void }) {
  const insets = useSafeAreaInsets();
  const [more, setMore] = useState(false);
  return (
    <>
      <LineTabs<HomePhase>
        label="In play, pre-match or completed"
        items={HOME_PHASES.map(([id, label]) => [id, label, counts[id]] as [HomePhase, string, number])}
        value={value}
        onChange={onChange}
        right={(
          <Press accessibilityRole="button" accessibilityLabel="More" onPress={() => { void Haptics.selectionAsync(); setMore(true); }} style={styles.moreBtn}>
            <Ionicons name="ellipsis-horizontal" size={20} color={color["muted-foreground"]} />
          </Press>
        )}
      />
      <Modal visible={more} animationType="slide" transparent onRequestClose={() => setMore(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMore(false)} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.stack) }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>More</Text>
            <Press onPress={() => setMore(false)} accessibilityRole="button" accessibilityLabel="Done">
              <Text style={styles.done}>Done</Text>
            </Press>
          </View>
          <View style={styles.links}>
            {MORE.map(([label, path]) => (
              <Press
                key={path}
                accessibilityRole="link"
                onPress={() => { setMore(false); push(path); }}
                style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.linkTxt}>{label}</Text>
                <Ionicons name="chevron-forward" size={16} color={color["muted-foreground"]} />
              </Press>
            ))}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  moreBtn: { alignSelf: "center", marginLeft: "auto", width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: color.popover, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.inset, paddingTop: space.snug },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.25)", marginBottom: space.stack },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space.group },
  sheetTitle: { ...type.title, color: color.foreground },
  done: { ...type.body, fontFamily: font.medium, color: color.primary },
  links: { gap: space.hair, paddingBottom: space.snug },
  link: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderRadius: 12 },
  linkTxt: { ...type.body, color: color.foreground },
});
