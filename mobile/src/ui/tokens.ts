import { StyleSheet } from "react-native";
// Colours come straight from the shared token file (site/packages/tokens/tokens.json). Sizes keep the web's role names with native values:
// close to the site's compact scale, since the app should read as the same product (docs/SITE.md, "UI libraries and the iOS / Android apps").
import tokens from "@cricket/tokens/tokens.json";

export const color = tokens.color;

/**
 * Same pairing as `site/src/index.css`: Satoshi for text and titles (≈ Crex Diatype),
 * Barlow Condensed for numbers and 11 pt uppercase labels (scoreboard figures). One family
 * name per weight — React Native has no variable-weight lookup. Loaded in `app/_layout.tsx`.
 */
export const font = {
  regular: "Satoshi-Regular",
  medium: "Satoshi-Medium",
  semibold: "Satoshi-Bold",
  bold: "Satoshi-Bold",
  data: "BarlowCondensed_700Bold",
  dataLight: "BarlowCondensed_500Medium",
} as const;

/** The site's `label-cap`: an 11 pt uppercase label in Barlow Condensed with +4% tracking. */
export const cap = { fontFamily: font.dataLight, textTransform: "uppercase" as const, fontSize: 11, lineHeight: 13, letterSpacing: 0.44 };
/** A small number (up to 17 pt) in Condensed Bold, tabular. */
export const num = { fontFamily: font.data, fontVariant: ["tabular-nums" as const], letterSpacing: -0.15 };
/** A big figure (20 pt and up) in Condensed Medium; tracking ~-2% of size. */
export const numLg = { fontFamily: font.dataLight, fontVariant: ["tabular-nums" as const], letterSpacing: -0.4 };

/**
 * A tonal surface (a card): a faint light wash over the black with a thin ring whose top edge is the brightest, as if lit from above. Quieter than a grey block and it reads as raised.
 * Spread it, then give the radius: `{ ...tonal, borderRadius: radius.card }`.
 */
export const tonal = { backgroundColor: "rgba(255,255,255,0.045)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.09)", borderTopColor: "rgba(255,255,255,0.2)" } as const;

/** Web `--gutter`, `--space-*`. */
export const space = { hair: 4, tight: 6, snug: 10, stack: 16, group: 20, section: 32, inset: 14, gutter: 14 };

export const radius = { card: 16, chip: 999, sheet: 24 };

export const type = {
  // Matches the site's cricket-stats Satoshi scale (dense lh, slight negative tracking).
  display: { fontFamily: font.bold, fontSize: 28, lineHeight: 31, letterSpacing: -0.7 },
  title: { fontFamily: font.bold, fontSize: 18, lineHeight: 22, letterSpacing: -0.36 },
  body: { fontFamily: font.medium, fontSize: 15, lineHeight: 19, letterSpacing: -0.15 },
  callout: { fontFamily: font.medium, fontSize: 13, lineHeight: 17, letterSpacing: -0.065 },
  footnote: { fontFamily: font.medium, fontSize: 12, lineHeight: 15, letterSpacing: 0 },
  caption: { fontFamily: font.medium, fontSize: 10, lineHeight: 13, letterSpacing: 0.1 },
};

/** The widest the app gets in a browser (`ui/web-frame.tsx`), and so the width its text is fitted to there. */
export const WEB_MAX_WIDTH = 560;

/** Web `--control` (36 pt), `--header-h` (56 pt). */
export const control = 36;
export const HEADER_HEIGHT = 56;
/** Share of the screen a fixture card takes, so the next match peeks (web `--fixture-card`). */
export const FIXTURE_CARD_SHARE = 0.8;
/** Height of the custom Android tab bar (the iOS bar is the system's). */
export const TAB_BAR_HEIGHT = 62;
