import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { TABS } from "@/lib/tabs";
import { color } from "@/ui/tokens";

// The browser preview (`npm run web`): there is no native tab bar in a browser, so this is a plain bottom bar in the site's colours. Not a shipped target.
export default function AppTabs() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: color.background },
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color["muted-foreground"],
        tabBarStyle: { backgroundColor: "rgba(0,0,0,0.85)", borderTopColor: color.hairline, height: 56 },
        tabBarLabelStyle: { fontSize: 10, fontFamily: "Inter_500Medium" },
        tabBarItemStyle: { paddingHorizontal: 0 },
      }}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label, tabBarIcon: ({ color: c, focused }) => <Ionicons name={focused ? t.on : t.icon} size={22} color={String(c)} /> }} />
      ))}
    </Tabs>
  );
}
