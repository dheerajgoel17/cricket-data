import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { color, icon } from "@/ui/tokens";

/** Hit/Miss for the model side against the pre-match line (`cleared` = over the line). Push keeps Edge. */
export function sideStamp(side: "over" | "under" | undefined, verdict: "cleared" | "missed" | "push" | null | undefined): "Hit" | "Miss" | null {
  if (verdict !== "cleared" && verdict !== "missed") return null;
  const overCleared = verdict === "cleared";
  if (side === "under") return overCleared ? "Miss" : "Hit";
  return overCleared ? "Hit" : "Miss";
}

/** Settled model-side mark beside odds: tick = Hit, cross = Miss. */
export function ResultStamp({ kind }: { kind: "Hit" | "Miss" }) {
  return (
    <View accessibilityRole="image" accessibilityLabel={kind}>
      <Ionicons
        name={kind === "Hit" ? "checkmark" : "close"}
        size={icon.sm}
        color={kind === "Hit" ? color.primary : color.miss}
      />
    </View>
  );
}
