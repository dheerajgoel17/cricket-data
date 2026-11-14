import { Platform } from "react-native";
import { Stack } from "expo-router";
import { color } from "@/ui/tokens";

/**
 * Nested stack so fixture → fancy / ground → back keeps the match page mounted
 * (UI state + react-query observers) instead of remounting the index route.
 */
export default function FixtureLayout() {
  return (
    <Stack screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: color.background },
      animation: Platform.OS === "android" ? "ios_from_right" : "default",
    }} />
  );
}
