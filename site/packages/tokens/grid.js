import tokens from "./tokens.json" with { type: "json" };
import { remPx } from "./rem.js";

const G = tokens.grid, BP = { md: 768, lg: 1024, xl: 1440 };

/** The layout grid for a window width (px): how many columns, the gap between cards, the page margin (the web's `--gutter`) and how many cards fit a row. Pure, shared by the app (`useGrid`) and the tests. */
export function gridFor(width) {
  const columns = width >= BP.xl ? G["columns-xl"] : width >= BP.md ? G["columns-md"] : G["columns-compact"];
  const margin = width >= BP.lg ? 24 : width >= BP.md ? 20 : remPx(tokens.size.gutter);
  const gutter = remPx(G.gutter), span = G["card-span"];
  return { columns, gutter, margin, span, perRow: Math.max(1, Math.floor(columns / span)) };
}

/** Width in px of an item spanning `n` columns in a row `width` px wide (the page margins excluded). */
export function spanWidth(width, n = G["card-span"]) {
  const g = gridFor(width), inner = width - g.margin * 2;
  return (inner - g.gutter * (g.columns - 1)) / g.columns * n + g.gutter * (n - 1);
}
