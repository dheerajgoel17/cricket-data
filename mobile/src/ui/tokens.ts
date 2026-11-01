// Colours come straight from the shared token file (site/packages/tokens/tokens.json). Sizes keep the web's role names with native values:
// iOS Human Interface sizes (17 pt body, 44 pt controls) rather than the web's rem scale (docs/SITE.md, "UI libraries and the iOS / Android apps").
import { Platform } from "react-native";
import tokens from "@cricket/tokens/tokens.json";

export const color = tokens.color;

export const space = { hair: 4, tight: 6, snug: 10, stack: 16, group: 20, section: 32, inset: 16 };

export const radius = { card: 16, chip: 999, sheet: 24 };

export const type = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: "700" as const, letterSpacing: -0.4 },
  title: { fontSize: 20, lineHeight: 25, fontWeight: "600" as const, letterSpacing: -0.3 },
  body: { fontSize: Platform.OS === "ios" ? 17 : 16, lineHeight: 22, fontWeight: "400" as const },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: "400" as const },
  footnote: { fontSize: 13, lineHeight: 17, fontWeight: "400" as const },
  caption: { fontSize: 11, lineHeight: 13, fontWeight: "600" as const, letterSpacing: 0.4 },
};

export const control = 44;
/** Height of the custom Android tab bar (the iOS bar is the system's). */
export const TAB_BAR_HEIGHT = 56;
