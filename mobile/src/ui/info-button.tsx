import { push } from "@/lib/nav";
import { Press } from "@/ui/press";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { color } from "@/ui/tokens";

/** The small "i" next to a heading or a number: opens what it means in a native sheet (`app/info/[topic].tsx`, words in `lib/info.ts`). */
export function InfoButton({ topic, label = "What does this mean?" }: { topic: string; label?: string }) {
  return (
    <Press
      onPress={() => { void Haptics.selectionAsync(); push(`/info/${topic}`); }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Ionicons name="information-circle-outline" size={18} color={color["muted-foreground"]} />
    </Press>
  );
}
