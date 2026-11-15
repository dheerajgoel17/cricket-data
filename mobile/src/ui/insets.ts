import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * The room a screen leaves for the system around it: the status bar on top and, below, the home indicator. A tab screen ends where the docked tab bar begins (the bar is the
 * navigator's own and holds the bottom safe area itself), so it leaves nothing below; a detail page (`false`) has no tab bar and leaves the home indicator's room.
 */
export function useScreenInsets(withTabBar = true) {
  const i = useSafeAreaInsets();
  return { top: i.top, bottom: withTabBar ? 0 : i.bottom };
}
