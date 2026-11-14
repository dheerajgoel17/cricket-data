import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HOME_PHASES, type HomePhase } from "@site/lib/home-phase";
import { push } from "@/lib/nav";
import { useScreenInsets } from "@/ui/insets";
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
 * The floating control on Home: In play / Pre-match / Completed underline tabs with how many matches each holds
 * (the site's `HomePhaseBar`), plus More for the rest of the app.
 */
export function PhaseBar({ value, counts, onChange }: { value: HomePhase; counts: Record<HomePhase, number>; onChange: (p: HomePhase) => void }) {
  const { bottom } = useScreenInsets();
  const insets = useSafeAreaInsets();
  const [more, setMore] = useState(false);
  return (
    <>
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
          <Press
            accessibilityRole="button"
            accessibilityLabel="More"
            onPress={() => { void Haptics.selectionAsync(); setMore(true); }}
            style={styles.moreBtn}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={color["muted-foreground"]} />
          </Press>
        </View>
      </View>
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
  moreBtn: { alignSelf: "center", width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
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
