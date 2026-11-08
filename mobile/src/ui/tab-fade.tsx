import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color } from "@/ui/tokens";

/**
 * The bottom fade on every screen: the page dissolves into the black above the floating bars and the home indicator, so content never ends in a hard edge against them. A gradient only,
 * drawn under the bars and out of the way of touches. Put it last in a screen's root view.
 */
export function TabFade({ withTabBar = true }: { withTabBar?: boolean }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.88)", color.background]}
      locations={[0, 0.6, 1]}
      style={[styles.fade, { height: (withTabBar ? 92 : 16) + bottom }]}
    />
  );
}

const styles = StyleSheet.create({
  fade: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
