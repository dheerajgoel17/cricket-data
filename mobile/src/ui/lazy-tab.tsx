import { startTransition, Suspense, useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation, useRoute } from "expo-router";
import { AppHeader } from "@/ui/brand";
import { useScreenInsets } from "@/ui/insets";
import { color } from "@/ui/tokens";

/** Is this screen the tab navigator's chosen tab? A page pushed over the tabs does not change it (the tab under it is still the chosen one, and is what a back swipe uncovers). */
function useTabChosen(): boolean {
  const nav = useNavigation(), route = useRoute();
  const read = () => { const s = nav.getState(); return !s || s.routes[s.index]?.key === route.key; };
  return useSyncExternalStore((changed) => nav.addListener("state" as never, changed), read, read);
}

// The standard "freeze": a child that throws a promise which never settles while frozen, inside a Suspense boundary with nothing as its fallback. React keeps the subtree's state and
// native views and simply stops rendering it; thawed, it renders once with whatever arrived meanwhile.
function Thaw({ frozen, children }: { frozen: boolean; children: ReactNode }) {
  const hold = useRef<Promise<void> | null>(null);
  if (frozen) throw (hold.current ??= new Promise<void>(() => {}));
  hold.current = null;
  return children;
}

/**
 * A tab that is not the chosen one does no work. Expo Router keeps every visited tab mounted and (from SDK 58) no longer freezes the hidden ones, so each 15 s live poll re-rendered
 * Home, Props and Fancy at once whichever was on screen. A hidden tab is frozen here and thaws, already up to date, the moment it is chosen again.
 */
function Frozen({ children }: { children: ReactNode }) {
  const chosen = useTabChosen();
  return <Suspense fallback={null}><Thaw frozen={!chosen}>{children}</Thaw></Suspense>;
}

/** A tab that is mounted from the start (Fixtures): frozen while another tab is in front. */
export function keptTab(Screen: ComponentType): ComponentType {
  return function KeptTab() {
    return <Frozen><Screen /></Frozen>;
  };
}

/**
 * A tab's screen, mounted when the tab is first chosen and then kept (frozen while hidden, see `Frozen`). The first frame after the tap is only the tab's own header (`title`), so
 * the tab bar answers at once; the screen itself is rendered as a transition, which React does in small slices and can interrupt, so a list of fifty rows being built never holds a
 * touch, a scroll or the next tap.
 */
export function lazyTab(Screen: ComponentType, title?: string): ComponentType {
  return function LazyTab() {
    const chosen = useTabChosen();
    const [shown, setShown] = useState(false);
    useEffect(() => { if (chosen && !shown) startTransition(() => setShown(true)); }, [chosen, shown]);
    return shown ? <Frozen><Screen /></Frozen> : <TabShell title={title} />;
  };
}

function TabShell({ title }: { title?: string }) {
  const inset = useScreenInsets();
  return <View style={[styles.root, { paddingTop: inset.top }]}>{title ? <AppHeader title={title} /> : null}</View>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: color.background } });
