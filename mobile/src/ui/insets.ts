import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_HEIGHT } from "@/ui/tokens";

/**
 * The room a screen leaves for the system around it: the status bar on top, and below the home indicator and the tab bar. The iOS tab bar is the system's and is part of the
 * bottom safe area; on Android the floating tab bar is ours, so its height and margin are added (`withTabBar` false on a page pushed over the tabs, which has none). Nothing is added in the browser preview.
 */
export function useScreenInsets(withTabBar = true) {
  const i = useSafeAreaInsets();
  return { top: i.top, bottom: i.bottom + (withTabBar && Platform.OS === "android" ? TAB_BAR_HEIGHT + 24 : 0) };
}
