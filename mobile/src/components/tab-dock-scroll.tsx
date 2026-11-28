import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useFocusEffect, useNavigation, useRoute } from "expo-router";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { dockScrollState } from "@site/lib/tab-dock";

const CollapsedTab = createContext<string | null>(null);
const SetCollapsedTab = createContext<(route: string | null) => void>(() => {});

export function TabDockProvider({ children }: { children: ReactNode }) {
  const [collapsedTab, setCollapsedTab] = useState<string | null>(null);
  return (
    <SetCollapsedTab.Provider value={setCollapsedTab}>
      <CollapsedTab.Provider value={collapsedTab}>{children}</CollapsedTab.Provider>
    </SetCollapsedTab.Provider>
  );
}

export function useTabDock(routeKey?: string) {
  const collapsedTab = useContext(CollapsedTab);
  const setCollapsedTab = useContext(SetCollapsedTab);
  return { compact: routeKey === collapsedTab, expand: () => setCollapsedTab(null) };
}

export function useTabDockScroll() {
  const setCollapsedRoute = useContext(SetCollapsedTab);
  const route = useRoute();
  const navigation = useNavigation();
  const checkpoint = useRef(0);
  const offset = useRef(0);

  useFocusEffect(useCallback(() => {
    checkpoint.current = offset.current;
    setCollapsedRoute(null);
  }, [setCollapsedRoute]));

  return useCallback(({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    const y = Math.max(0, Math.min(contentOffset.y, contentSize.height - layoutMeasurement.height));
    offset.current = y;
    const collapsed = dockScrollState(y, checkpoint.current);
    if (collapsed === undefined || !navigation.isFocused()) return;
    checkpoint.current = y;
    setCollapsedRoute(collapsed ? route.key : null);
  }, [navigation, route.key, setCollapsedRoute]);
}
