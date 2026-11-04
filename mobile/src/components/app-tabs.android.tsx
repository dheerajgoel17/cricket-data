import { View, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { TABS } from "@/lib/tabs";
import { FloatingTabBar } from "@/components/floating-tab-bar";
import { color } from "@/ui/tokens";

// Android has no system glass, so the bar is ours (FloatingTabBar). Same capsule as the browser preview.
export default function AppTabs() {
  return (
    <View style={styles.root}>
      <View style={styles.root}>
        <Tabs screenOptions={{ headerShown: false, freezeOnBlur: true, sceneStyle: { backgroundColor: color.background } }} tabBar={() => null}>
          {TABS.map((t) => <Tabs.Screen key={t.name} name={t.name} />)}
        </Tabs>
      </View>
      <FloatingTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
});
