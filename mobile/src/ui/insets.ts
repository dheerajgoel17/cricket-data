import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_HEIGHT } from "@/ui/tokens";

export const TAB_DOCK_MARGIN = 10;

/** Keep the last row above the floating dock and the system home indicator. */
export function useScreenInsets(withTabBar = true) {
  const i = useSafeAreaInsets();
  return { top: i.top, bottom: withTabBar ? TAB_BAR_HEIGHT + Math.max(TAB_DOCK_MARGIN, i.bottom) : i.bottom };
}
