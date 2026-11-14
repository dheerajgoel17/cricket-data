import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { TABLE_BLEED } from "@/ui/data-table";

/**
 * Native twin of web `TABLE_BLEED`: pull a block to the phone gutters with hairline edges.
 * Use for game logs and any full-bleed list that is not already a `DataTable bleed`.
 */
export function Bleed({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[TABLE_BLEED, style]}>{children}</View>;
}
