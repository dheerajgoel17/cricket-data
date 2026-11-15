import { StyleSheet, type TextStyle } from "react-native";
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
 * Surfaces: the one set of boxes the app uses (web `Card` / flat bleed). `card` is the solid raised group (a fixture block, a stats group, a list box): the card colour, the card radius,
 * nothing else; spread it and add padding / `overflow: "hidden"` where the content needs it. A table or list that spans the page is not a card: it is flat, full-bleed, with hairlines
 * (`Bleed`). Never write a surface by hand (`tokens.test.ts` fails on a wash + ring recipe or a `card` colour + radius pair).
 */
export const surface = {
  card: { backgroundColor: color.card, borderRadius: remPx(tokens.size["card-radius"]) },
} as const;

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
  destructive: (a: number) => hexAlpha(color.destructive, a),
  white: (a: number) => `rgba(255,255,255,${a})`,
  black: (a: number) => `rgba(0,0,0,${a})`,
  /** Arbitrary hex → rgba (page atmosphere washes, entity accents). */
  hex: hexAlpha,
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

/** The page rhythm, one set of gaps for every screen (tokens.json `rhythm`; web: gap-snug / gap-stack / gap-section). A screen picks a role here and never a raw `space.*` for page-level gaps. */
export const rhythm = { within: space.snug, between: space.stack, section: space.section, top: space.stack, inline: space.gutter } as const;

export const radius = {
  /** Web `--radius-sm` (control radius − 4): small tiles, tags, tooltips. */
  sm: remPx(Z.radius) - 4,
  /** Web `--radius`: inputs, tiles, compact cards. */
  control: remPx(Z.radius),
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

/**
 * Motion durations in ms (tokens.json `motion`, same names as the web's `--duration-*`): instant 80 (press-in, tiny state), fast 150 (colour / opacity changes, chips), base 220
 * (thumbs, underlines, accordions, sheets), moderate 300 (entrances, page fades), flash 450 (a price that moved), slow 500 (big reveals). Never write a literal `duration`.
 */
export const duration = Object.fromEntries(Object.entries(tokens.motion).filter(([k]) => k.startsWith("duration-")).map(([k, v]) => [k.slice(9), parseInt(String(v), 10)])) as Record<"instant" | "fast" | "base" | "moderate" | "flash" | "slow", number>;

/** Spring presets (tokens.json `spring`): settle (an indicator gliding), roll (a figure rolling in), enter (a card rising). */
const sp = ({ duration, dampingRatio }: { duration: number; dampingRatio: number }) => ({ duration, dampingRatio });
export const spring = { settle: sp(tokens.spring.settle), roll: sp(tokens.spring.roll), enter: sp(tokens.spring.enter) } as const;

const lh = (size: number, ratio: string) => Math.round(size * parseFloat(ratio));
const ls = (size: number, em: string | undefined) => (em ? Math.round(size * parseFloat(em) * 1000) / 1000 : 0);

const body = remPx(T["fs-body"]);
const metricFs = remPx(T["fs-metric"]), figureFs = remPx(T["fs-figure"]), statFs = remPx(T["fs-stat"]);
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
  /** Section / card / sheet title: title size at the label weight (web `h3 text-title font-label`). `title` (bold) is for a page's own headline. */
  heading: { fontFamily: font.medium, fontSize: title, lineHeight: lh(title, T["fs-title-lh"]), letterSpacing: ls(title, T["fs-title-ls"]) },
  caption: { fontFamily: font.regular, fontSize: caption, lineHeight: lh(caption, T["fs-caption-lh"]), letterSpacing: ls(caption, T["fs-caption-ls"]) },
};


/**
 * Named text roles: the only text recipes a screen may spread (CI: `tokens.test.ts`). Three families of job:
 * - **copy / label / strong** (Satoshi): `t.body` is reading text, `t.bodyLabel` is a control, chip, row label or title at the label weight (500), `t.bodyStrong` is a name or the one key line (700). Same for callout, footnote, caption.
 * - **data** (Barlow Condensed, tabular): `d.callout` is a figure at the label weight (500: prices, hit rates, counts), `dStrong.callout` the key figure (700: a score, a total). Sizes: caption, footnote, callout, body, title.
 * - **caps** (`cap`): uppercase column heads and kickers.
 * The web twins are `text-*` + `font-label` / `font-emphasis` and `font-condensed tabular-nums`.
 */
type Sz = "caption" | "footnote" | "callout" | "body" | "title";
const tx = (sz: Sz, family: string): TextStyle => ({ ...type[sz], fontFamily: family });
const dx = (sz: Sz, family: string): TextStyle => ({ ...type[sz], fontFamily: family, fontVariant: ["tabular-nums"] });
export const t = {
  ...type,
  bodyLabel: tx("body", font.medium), calloutLabel: tx("callout", font.medium), footnoteLabel: tx("footnote", font.medium), captionLabel: tx("caption", font.medium),
  bodyStrong: tx("body", font.bold), calloutStrong: tx("callout", font.bold), footnoteStrong: tx("footnote", font.bold), captionStrong: tx("caption", font.bold),
} as const;
/** Weight only, for a span inside text that already has its size (copy 400, label 500, strong 700; data = Barlow at 500, dataStrong at 700). */
export const w = { copy: { fontFamily: font.regular }, label: { fontFamily: font.medium }, strong: { fontFamily: font.bold }, data: { fontFamily: font.dataLight }, dataStrong: { fontFamily: font.data } } as const;
/** Figures at the label weight (500). */
export const d = { caption: dx("caption", font.dataLight), footnote: dx("footnote", font.dataLight), callout: dx("callout", font.dataLight), body: dx("body", font.dataLight), title: dx("title", font.dataLight) } as const;
/** The key figure (700). */
export const dStrong = { caption: dx("caption", font.data), footnote: dx("footnote", font.data), callout: dx("callout", font.data), body: dx("body", font.data), title: dx("title", font.data) } as const;

const metricSize = metricFs;
/** The site's `font-condensed text-metric font-emphasis`: a row's hero line ("O/U 29.5") in Barlow Condensed Bold, tabular. */
export const metric = { fontFamily: font.data, fontSize: metricSize, lineHeight: metricSize + 2, letterSpacing: ls(metricSize, T["fs-metric-ls"]), fontVariant: ["tabular-nums" as const] };
/** The site's `font-condensed text-title font-emphasis`: the model edge beside a row. */
export const figure = { fontFamily: font.data, fontSize: title, lineHeight: title + 2, letterSpacing: -0.3, fontVariant: ["tabular-nums" as const] };

/** The widest the app gets in a browser (`ui/web-frame.tsx`), and so the width its text is fitted to there. */
export const WEB_MAX_WIDTH = 560;

/** Web `--control` / `--header-h` from tokens.json. */
export const control = remPx(Z.control);
export const HEADER_HEIGHT = remPx(Z["header-h"]);
/** Share of the screen a fixture card takes, so the next match peeks (web `--fixture-card`). */
export const FIXTURE_CARD_SHARE = 0.8;
/** Height of the docked tab bar's row (`components/tab-bar.tsx`), without the home indicator's room under it. */
export const TAB_BAR_HEIGHT = 54;

/**
 * The size scale as plain numbers, for figures that keep their own family / letter-spacing (`num`, `numLg`): the web's `text-caption … text-stat` roles. Never write a literal `fontSize`
 * in a screen; pick the role (CI: `tokens.test.ts`). `cap.fontSize` (11) is the uppercase label.
 */
export const fs = { caption, footnote, callout, body, title, metric: metricFs, figure: figureFs, display, stat: statFs } as const;
