import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_HEIGHT } from "@/ui/tokens";

/** Room a scrolling screen leaves around its content. The iOS system tab bar and status bar are handled by `contentInsetAdjustmentBehavior="automatic"`; on Android the floating tab bar is ours. */
export function useScreenInsets() {
  const i = useSafeAreaInsets();
  return Platform.OS === "ios" ? { top: 0, bottom: 0 } : { top: i.top, bottom: i.bottom + TAB_BAR_HEIGHT + 24 };
}
