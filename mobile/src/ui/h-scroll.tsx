import { forwardRef } from "react";
import { ScrollView, type ScrollViewProps } from "react-native";

/**
 * The app's one horizontally scrolling row (chips, tabs, active filters): content runs edge to edge, with no fade or blur at the sides, so a chip is cut cleanly by the screen edge as it
 * scrolls. Use it instead of a bare horizontal `ScrollView` (`tokens.test.ts`). Web twin: `ScrollRow` / `PillGroup`.
 */
export const HScroll = forwardRef<ScrollView, Omit<ScrollViewProps, "horizontal">>(function HScroll(props, ref) {
  return <ScrollView ref={ref as never} horizontal showsHorizontalScrollIndicator={false} {...props} />;
});
