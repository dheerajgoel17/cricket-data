import { Tabs } from "expo-router";
import { TABS } from "@/lib/tabs";
import { TabBar } from "@/components/tab-bar";
import { TabDockProvider } from "@/components/tab-dock-scroll";
import { color } from "@/ui/tokens";

export default function AppTabs() {
  return (
    <TabDockProvider>
      <Tabs
        screenOptions={{ headerShown: false, lazy: true, animation: "fade", sceneStyle: { backgroundColor: color.background } }}
        tabBar={(props) => <TabBar {...props} />}>
        {TABS.map((t) => <Tabs.Screen key={t.name} name={t.name} />)}
      </Tabs>
    </TabDockProvider>
  );
}
