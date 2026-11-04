import { View, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { TABS } from "@/lib/tabs";
import { FloatingTabBar } from "@/components/floating-tab-bar";
import { color } from "@/ui/tokens";

/**
 * Browser preview (`npm run web` on :8082): same floating capsule footer as Android, so you can
 * check how the app tab bar looks without a device. iOS still uses the system bar (`app-tabs.tsx`).
 */
export default function AppTabs() {
  return (
    <View style={styles.root}>
      <View style={styles.root}>
        <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.background } }} tabBar={() => null}>
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
