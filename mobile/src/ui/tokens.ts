import { StyleSheet } from "react-native";
// Colours and size roles come from the shared token file (site/packages/tokens/tokens.json).
// Space / type / radius / control are derived so the app stays on the same contract as the site (docs/DESIGN_SYSTEM.md).
import tokens from "@cricket/tokens/tokens.json";
import { remPx } from "@cricket/tokens/rem.js";

export const color = tokens.color;

/**
 * Same pairing as `site/src/index.css`: Satoshi for text and titles (≈ Crex Diatype),
 * Barlow Condensed for numbers and 11 pt uppercase labels (scoreboard figures). One family
 * name per weight — React Native has no variable-weight lookup. Loaded in `app/_layout.tsx`.
 */
const satoshi = { 300: "Satoshi-Light", 400: "Satoshi-Regular", 500: "Satoshi-Medium", 700: "Satoshi-Bold", 900: "Satoshi-Black" } as const;
const W = tokens.weight;

export const font = {
  light: satoshi[W["weight-editorial"] as keyof typeof satoshi],
  regular: satoshi[W["weight-copy"] as keyof typeof satoshi],
  medium: satoshi[W["weight-label"] as keyof typeof satoshi],
  bold: satoshi[W["weight-emphasis"] as keyof typeof satoshi],
  data: "BarlowCondensed_700Bold",
  dataDefault: "BarlowCondensed_300Light",
  dataLight: "BarlowCondensed_500Medium",
} as const;

/** The site's `label-cap`: an 11 pt uppercase label in Barlow Condensed with +4% tracking. */
export const cap = { fontFamily: font.dataLight, textTransform: "uppercase" as const, fontSize: 11, lineHeight: 13, letterSpacing: 0.44 };
/** A small tabular number in Barlow Condensed Light. */
export const num = { fontFamily: font.dataDefault, fontVariant: ["tabular-nums" as const], letterSpacing: -0.15 };
/** A big figure (20 pt and up) in Condensed Light; tracking ~-2% of size. */
export const numLg = { fontFamily: font.dataDefault, fontVariant: ["tabular-nums" as const], letterSpacing: -0.4 };

/**
 * A tonal surface (a card): a faint light wash over the black with a thin ring whose top edge is the brightest, as if lit from above. Quieter than a grey block and it reads as raised.
 * Spread it, then give the radius: `{ ...tonal, borderRadius: radius.card }`.
 */
export const tonal = { backgroundColor: "rgba(255,255,255,0.045)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.09)", borderTopColor: "rgba(255,255,255,0.2)" } as const;

/** Hex token → rgba for heat cells, active chips, and row highlight (avoid copying primary/miss/amber rgba by hand). */
function hexAlpha(hex: string, a: number) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export const tint = {
  primary: (a: number) => hexAlpha(color.primary, a),
  miss: (a: number) => hexAlpha(color.miss, a),
  amber: (a: number) => hexAlpha(color.amber, a),
  white: (a: number) => `rgba(255,255,255,${a})`,
  black: (a: number) => `rgba(0,0,0,${a})`,
  /** Selected ladder / table row wash (matches web card-on). */
  row: "rgba(58,58,60,0.45)",
} as const;

const S = tokens.space;
const Z = tokens.size;
const T = tokens.type;

/** Web `--gutter`, `--space-*` (from tokens.json). */
export const space = {
  hair: remPx(S["space-hair"]),
  tight: remPx(S["space-tight"]),
  snug: remPx(S["space-snug"]),
  stack: remPx(S["space-stack"]),
  group: remPx(S["space-group"]),
  section: remPx(S["space-section"]),
  inset: remPx(S["space-inset"]),
  gutter: remPx(Z.gutter),
};

export const radius = {
  card: remPx(Z["card-radius"]),
  chip: remPx(Z["chip-radius"]),
  sheet: remPx(Z["sheet-radius"]),
};

/** Shared easing curves (site `tokens.json` motion + Emil / animate-expo). */
export const ease = {
  out: [0.23, 1, 0.32, 1] as const,
  inOut: [0.77, 0, 0.175, 1] as const,
  drawer: [0.32, 0.72, 0, 1] as const,
};

const lh = (size: number, ratio: string) => Math.round(size * parseFloat(ratio));
const ls = (size: number, em: string | undefined) => (em ? Math.round(size * parseFloat(em) * 1000) / 1000 : 0);

const body = remPx(T["fs-body"]);
const title = remPx(T["fs-title"]);
const callout = remPx(T["fs-callout"]);
const footnote = remPx(T["fs-footnote"]);
const caption = remPx(T["fs-caption"]);
const display = remPx(T["fs-display"]);

export const type = {
  // Matches the site's cricket-stats Satoshi scale (dense lh, slight negative tracking).
  display: { fontFamily: font.bold, fontSize: display, lineHeight: lh(display, T["fs-display-lh"]), letterSpacing: ls(display, T["fs-display-ls"]) },
  title: { fontFamily: font.bold, fontSize: title, lineHeight: lh(title, T["fs-title-lh"]), letterSpacing: ls(title, T["fs-title-ls"]) },
  body: { fontFamily: font.regular, fontSize: body, lineHeight: lh(body, T["fs-body-lh"]), letterSpacing: ls(body, T["fs-body-ls"]) },
  callout: { fontFamily: font.regular, fontSize: callout, lineHeight: lh(callout, T["fs-callout-lh"]), letterSpacing: ls(callout, T["fs-callout-ls"]) },
  footnote: { fontFamily: font.regular, fontSize: footnote, lineHeight: lh(footnote, T["fs-footnote-lh"]), letterSpacing: 0 },
  caption: { fontFamily: font.regular, fontSize: caption, lineHeight: lh(caption, T["fs-caption-lh"]), letterSpacing: ls(caption, T["fs-caption-ls"]) },
};

/** The widest the app gets in a browser (`ui/web-frame.tsx`), and so the width its text is fitted to there. */
export const WEB_MAX_WIDTH = 560;

/** Web `--control` / `--header-h` from tokens.json. */
export const control = remPx(Z.control);
export const HEADER_HEIGHT = remPx(Z["header-h"]);
/** Share of the screen a fixture card takes, so the next match peeks (web `--fixture-card`). */
export const FIXTURE_CARD_SHARE = 0.8;
/** Height of the custom Android tab bar (the iOS bar is the system's). */
export const TAB_BAR_HEIGHT = 62;
