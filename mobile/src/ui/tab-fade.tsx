import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color } from "@/ui/tokens";

/**
 * The bottom fade on every screen: the last rows dissolve into the black instead of ending in a hard edge against the docked tab bar (a tab screen) or the home indicator (a detail
 * page, `withTabBar={false}`). A gradient only, out of the way of touches. Put it last in the view that holds the scrolling content.
 */
export function TabFade({ withTabBar = true }: { withTabBar?: boolean }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={["rgba(0,0,0,0)", color.background]}
      style={[styles.fade, { height: withTabBar ? 20 : 16 + bottom }]}
    />
  );
}

const styles = StyleSheet.create({
  fade: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
