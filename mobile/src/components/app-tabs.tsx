import { NativeTabs } from "expo-router/native-tabs";
import { color } from "@/ui/tokens";

// The same Ionicons the site's tab bar uses (calendar, stats-chart, dice, trophy, bookmark), outline when idle and filled when chosen, as template images the bar tints.
// Rendered from the ionicons package (MIT) at 24 pt, @1x / @2x / @3x: assets/tab-icons.
const ICONS = {
  index: { default: require("../../assets/tab-icons/calendar-outline.png"), selected: require("../../assets/tab-icons/calendar.png") },
  props: { default: require("../../assets/tab-icons/stats-chart-outline.png"), selected: require("../../assets/tab-icons/stats-chart.png") },
  fancy: { default: require("../../assets/tab-icons/dice-outline.png"), selected: require("../../assets/tab-icons/dice.png") },
  leagues: { default: require("../../assets/tab-icons/trophy-outline.png"), selected: require("../../assets/tab-icons/trophy.png") },
  saved: { default: require("../../assets/tab-icons/bookmark-outline.png"), selected: require("../../assets/tab-icons/bookmark.png") },
};

// iOS: the system tab bar, which is liquid glass on iOS 26 and later and the classic translucent bar before that. Android has its own file (app-tabs.android.tsx).
export default function AppTabs() {
  return (
    <NativeTabs tintColor={color.primary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Fixtures</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={ICONS.index} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="props">
        <NativeTabs.Trigger.Label>Props</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={ICONS.props} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="fancy">
        <NativeTabs.Trigger.Label>Fancy</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={ICONS.fancy} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="leagues">
        <NativeTabs.Trigger.Label>Leagues</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={ICONS.leagues} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="saved">
        <NativeTabs.Trigger.Label>Saved</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={ICONS.saved} renderingMode="template" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
