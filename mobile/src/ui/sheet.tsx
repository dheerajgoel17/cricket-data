import { Ionicons } from "@expo/vector-icons";
import { Button } from "@/ui/button";
import { RoundButton } from "@/ui/round-button";
import { Text } from "@/ui/text";
import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, icon, radius, space, t, tint, type } from "@/ui/tokens";

/** The dimmed backdrop behind a sheet; pressing it closes the sheet. */
export function SheetBackdrop({ onClose, label = "Close" }: { onClose: () => void; label?: string }) {
  return <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel={label} />;
}

/** The small bar at the top of a sheet that says it can be dragged away. */
export function Grabber({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.grabber, style]} accessibilityElementsHidden />;
}

/**
 * The app's one bottom sheet (filters, More, any pick-from-a-list panel): a slide-up modal with the shared backdrop, the sheet radius and the home indicator's room at the bottom.
 * `full` takes the height under the status bar (the screener); `style` overrides the panel (a tinted surface, a different inset). Never build a `Modal` + backdrop by hand.
 */
export function Sheet({ visible, onClose, label = "Close", full, style, children }: { visible: boolean; onClose: () => void; label?: string; full?: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <SheetBackdrop onClose={onClose} label={label} />
      <View style={[styles.panel, full ? styles.full : styles.bottom, { paddingBottom: Math.max(insets.bottom, space.stack) }, style]} accessibilityViewIsModal>
        {children}
      </View>
    </Modal>
  );
}

export function FilterSheet({ visible, onClose, onClear, onApply, children }: {
  visible: boolean; onClose: () => void; onClear: () => void; onApply: () => void; children: ReactNode;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} label="Close filters">
      <View style={styles.filterHead}>
        <Text style={styles.filterTitle}>Filters</Text>
        <RoundButton label="Close" onPress={onClose}><Ionicons name="close" size={icon.md} color={color.foreground} /></RoundButton>
      </View>
      {children}
      <View style={styles.filterFoot}>
        <Button variant="secondary" flex={1} label="Clear" onPress={onClear} />
        <Button flex={2} label="Apply" onPress={onApply} />
      </View>
    </Sheet>
  );
}

export function FilterSection({ label, children }: { label: string; children: ReactNode }) {
  return <View style={styles.filterSection}><Text style={styles.filterLabel}>{label}</Text>{children}</View>;
}

const styles = StyleSheet.create({
  filterHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  filterTitle: { ...type.heading, color: color.foreground },
  filterSection: { gap: space.tight },
  filterLabel: { ...t.bodyLabel, color: color.foreground },
  filterFoot: { flexDirection: "row", gap: space.snug, marginTop: space.tight },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: color.scrim },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: tint.white(0.25), marginBottom: space.stack },
  panel: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: color.background, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.gutter, paddingTop: space.stack, gap: space.snug },
  bottom: {},
  full: { top: 48, paddingHorizontal: 0, paddingTop: 0, gap: 0 },
});
