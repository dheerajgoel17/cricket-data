import { Tabs } from "expo-router";
import { TABS } from "@/lib/tabs";
import { TabBar } from "@/components/tab-bar";
import { color } from "@/ui/tokens";

// The four tabs with one docked bar (`TabBar`) on iOS, Android and the browser preview. Not the system tab bar: on iOS 26 that is a floating liquid-glass capsule, and the app's
// bar sits on the bottom edge. A tab is mounted when first chosen and frozen while another is in front (`ui/lazy-tab.tsx`; the navigator's own `freezeOnBlur` has no effect in this
// Expo Router), so a hidden tab does no work on a live poll. Tabs never slide: switching is a short crossfade (`animation: "fade"`, opacity only, so it costs no layout and stays on the UI thread).
export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{ headerShown: false, lazy: true, animation: "fade", sceneStyle: { backgroundColor: color.background } }}
      tabBar={(props) => <TabBar {...props} />}>
      {TABS.map((t) => <Tabs.Screen key={t.name} name={t.name} />)}
    </Tabs>
  );
}
