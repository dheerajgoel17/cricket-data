import { NativeTabs } from "expo-router/native-tabs";
import { color } from "@/ui/tokens";

// iOS: the system tab bar, which is liquid glass on iOS 26 and later and the classic translucent bar before that. Android has its own file (app-tabs.android.tsx).
export default function AppTabs() {
  return (
    <NativeTabs tintColor={color.primary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Fixtures</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "calendar", selected: "calendar" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="props">
        <NativeTabs.Trigger.Label>Props</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="fancy">
        <NativeTabs.Trigger.Label>Fancy</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "sparkles", selected: "sparkles" }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="saved">
        <NativeTabs.Trigger.Label>Saved</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "bookmark", selected: "bookmark.fill" }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
