import { useRef, type ComponentType } from "react";
import { useIsFocused } from "expo-router";

/**
 * The native tab bar mounts every tab at launch (Expo Router preloads them all), so five screens that nobody has opened were rendering and starting their own queries while Home was
 * still loading. A screen wrapped in this renders nothing until its tab is first chosen, then stays mounted.
 */
export function lazyTab(Screen: ComponentType): ComponentType {
  return function LazyTab() {
    const focused = useIsFocused();
    const opened = useRef(false);
    if (focused) opened.current = true;
    return opened.current ? <Screen /> : null;
  };
}
