import { StyleSheet } from "react-native";
// Colours come straight from the shared token file (site/packages/tokens/tokens.json). Sizes keep the web's role names with native values:
// close to the site's compact scale, since the app should read as the same product (docs/SITE.md, "UI libraries and the iOS / Android apps").
import tokens from "@cricket/tokens/tokens.json";

export const color = tokens.color;

/**
 * The site's fonts: Inter for text, one family name per weight (React Native has no variable-weight lookup for bundled fonts), and Barlow Semi Condensed, medium only, for
 * numbers (hit rates, odds, edge, stat values) and small uppercase labels (docs/SITE.md). Loaded in `app/_layout.tsx`.
 */
export const font = { regular: "Inter_400Regular", medium: "Inter_500Medium", semibold: "Inter_600SemiBold", bold: "Inter_700Bold", cond: "BarlowSemiCondensed_500Medium" } as const;

/** The site's `label-cap`: a small uppercase label in the condensed face (spread after a `type` role: `{ ...type.footnote, ...cap }`). */
export const cap = { fontFamily: font.cond, textTransform: "uppercase" as const, letterSpacing: 0.6 };
/** The site's `num-cond`: a number in the condensed face with figures of equal width. */
export const num = { fontFamily: font.cond, fontVariant: ["tabular-nums" as const] };

/**
 * A tonal surface (a card): a faint light wash over the black with a thin ring whose top edge is the brightest, as if lit from above. Quieter than a grey block and it reads as raised.
 * Spread it, then give the radius: `{ ...tonal, borderRadius: radius.card }`.
 */
export const tonal = { backgroundColor: "rgba(255,255,255,0.045)", borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(255,255,255,0.09)", borderTopColor: "rgba(255,255,255,0.2)" } as const;

/** Web `--gutter`, `--space-*`. */
export const space = { hair: 4, tight: 6, snug: 10, stack: 16, group: 20, section: 32, inset: 14, gutter: 14 };

export const radius = { card: 16, chip: 999, sheet: 24 };

export const type = {
  display: { fontFamily: font.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  title: { fontFamily: font.bold, fontSize: 18, lineHeight: 22, letterSpacing: -0.3 },
  body: { fontFamily: font.medium, fontSize: 16, lineHeight: 21 },
  callout: { fontFamily: font.medium, fontSize: 14, lineHeight: 19 },
  footnote: { fontFamily: font.medium, fontSize: 12, lineHeight: 16 },
  caption: { fontFamily: font.medium, fontSize: 10.5, lineHeight: 13 },
};

/** Web `--control` (36 pt), `--header-h` (56 pt). */
export const control = 36;
export const HEADER_HEIGHT = 56;
/** Share of the screen a fixture card takes, so the next match peeks (web `--fixture-card`). */
export const FIXTURE_CARD_SHARE = 0.8;
/** Height of the custom Android tab bar (the iOS bar is the system's). */
export const TAB_BAR_HEIGHT = 62;
