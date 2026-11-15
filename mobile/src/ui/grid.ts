import { useWindowDimensions } from "react-native";
import { gridFor, spanWidth } from "@cricket/tokens/grid.js";

/** The layout grid for the current window (columns, gutter, page margin, cards per row): the same pure function the web's `CardGrid` is tested against (`site/packages/tokens/grid.js`). `span(n)` is the width of an item spanning n columns. */
export function useGrid() {
  const { width } = useWindowDimensions();
  return { ...gridFor(width), width, span: (n?: number) => spanWidth(width, n) };
}
