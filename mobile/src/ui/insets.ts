import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_HEIGHT } from "@/ui/tokens";

/**
 * The room a screen leaves for the system around it: the status bar on top, and below the home indicator and the tab bar. The iOS tab bar is the system's and is part of the
 * bottom safe area; on Android and web the floating bar overlays content, so reserve its height and margins. Detail pages pass `false`.
 */
export function useScreenInsets(withTabBar = true) {
  const i = useSafeAreaInsets();
  return { top: i.top, bottom: i.bottom + (withTabBar && Platform.OS !== "ios" ? TAB_BAR_HEIGHT + 24 : 0) };
}
