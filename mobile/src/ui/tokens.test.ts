import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { control, fs, HEADER_HEIGHT, icon, radius, rhythm, space, state, tint, type } from "./tokens";

const src = join(__dirname, "..");
const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(n) && !/\.test\./.test(n) ? [p] : []; });

describe("tokens derived from tokens.json", () => {
  it("matches the site's compact scale (16 px rem)", () => {
    expect(space).toEqual({ hair: 4, tight: 6, snug: 10, stack: 16, group: 20, section: 32, inset: 14, gutter: 14 });
    expect(radius).toEqual({ sm: 8, control: 12, card: 16, chip: 999, sheet: 24 });
    expect(fs).toMatchObject({ caption: 10, footnote: 12, callout: 13, body: 15, title: 18, metric: 20, figure: 24, display: 28, stat: 30 });
    expect(control).toBe(36);
    expect(HEADER_HEIGHT).toBe(56);
    expect(type.body.fontSize).toBe(15);
    expect(type.display.fontSize).toBe(28);
    expect(type.footnote.fontSize).toBe(12);
  });

  it("exposes tint helpers from color tokens", () => {
    expect(tint.primary(0.2)).toBe("rgba(39,218,142,0.2)");
    expect(tint.miss(0.45)).toBe("rgba(255,0,0,0.45)");
    expect(tint.amber(0.25)).toBe("rgba(245,165,36,0.25)");
    expect(tint.hex("#1B4F9C", 0.35)).toBe("rgba(27,79,156,0.35)");
  });

  // The design-system contract: screens pick a size role / colour token, never a literal (the web enforces the same in design-tokens.test.ts).
  it("has no literal font sizes in screens or components (11 = the cap label)", () => {
    const bad = files(src).flatMap((f) => readFileSync(f, "utf8").split("\n").flatMap((l, i) => (/fontSize: (?!11\b)[0-9]/.test(l) ? [`${f.replace(src, "")}:${i + 1}`] : [])));
    expect(bad).toEqual([]);
  });
  it("has no colour literals outside tokens, the brand mark and animation worklets", () => {
    const bad = files(src).filter((f) => !/brand\.tsx$/.test(f)).flatMap((f) => readFileSync(f, "utf8").split("\n").flatMap((l, i) => (/rgba?\(|#[0-9a-fA-F]{3,8}\b/.test(l) && !/interpolateColor|useAnimatedStyle/.test(l) ? [`${f.replace(src, "")}:${i + 1}`] : [])));
    expect(bad).toEqual([]);
  });

  // Centralised pieces: one bottom sheet, one round button. A screen that needs one imports it; a hand-built copy fails here.
  it("builds sheets and round buttons only in their shared components", () => {
    const hits = (re: RegExp, allow: RegExp) => files(src).filter((f) => !allow.test(f)).flatMap((f) => readFileSync(f, "utf8").split("\n").flatMap((l, i) => (re.test(l) ? [`${f.replace(src, "")}:${i + 1}`] : [])));
    expect(hits(/<Modal\b/, /(ui\/sheet|ui\/sign-in-sheet)\.tsx$/)).toEqual([]);
    expect(hits(/width: 40, height: 40/, /(ui\/round-button|ui\/empty-state)\.tsx$/)).toEqual([]);
  });

  it("keeps one surface recipe and one scrolling-row component", () => {
    const hits = (re: RegExp, allow?: RegExp) => files(src).filter((f) => !allow?.test(f)).flatMap((f) => readFileSync(f, "utf8").split("\n").flatMap((l, i) => (re.test(l) ? [`${f.replace(src, "")}:${i + 1}`] : [])));
    expect(hits(/\btonal\b/)).toEqual([]);
    expect(hits(/backgroundColor: color\.card, borderRadius: radius\.card|borderRadius: radius\.card, backgroundColor: color\.card/, /skeletons\.tsx$/)).toEqual([]);
    expect(hits(/<ScrollView[^>]*\bhorizontal\b/, /(ui\/h-scroll|ui\/grid-table|ui\/charts|ui\/tournament-stats)\.tsx$/)).toEqual([]);
  });
  it("derives the page rhythm from the space roles", () => {
    expect(rhythm).toEqual({ within: 10, between: 16, section: 32, top: 16, inline: 14 });
  });

  it("picks text from the named roles, never a raw font family", () => {
    const bad = files(src).filter((f) => !/\/app\/_layout\.tsx$/.test(f)).flatMap((f) => readFileSync(f, "utf8").split("\n").flatMap((l, i) => (/\bfont\.(regular|medium|bold|data|dataLight|dataDefault|light)\b/.test(l) ? [`${f.replace(src, "")}:${i + 1}`] : [])));
    expect(bad).toEqual([]);
  });

  it("builds buttons and search boxes only in their shared components", () => {
    const hits = (re: RegExp, allow: RegExp) => files(src).filter((f) => !allow.test(f)).flatMap((f) => readFileSync(f, "utf8").split("\n").flatMap((l, i) => (re.test(l) ? [`${f.replace(src, "")}:${i + 1}`] : [])));
    expect(hits(/height: (36|44|48)\b[^}]*backgroundColor: color\.(primary|secondary)\b|backgroundColor: color\.(primary|secondary)\b[^}]*height: (36|44|48)\b/, /(ui\/button|ui\/line-stepper)\.tsx$/)).toEqual([]);
    expect(hits(/placeholderTextColor=\{color\["muted-foreground"\]\} style=\{styles\.input\} (accessibilityLabel|autoFocus)/, /ui\/search-field\.tsx$/)).toEqual([]);
  });

  it("takes shadows from the elevation tokens, never a screen's own", () => {
    const bad = files(src).filter((f) => !/ui\/platform\.ts/.test(f)).flatMap((f) => readFileSync(f, "utf8").split("\n").flatMap((l, i) => (/\bshadow(Color|Opacity|Radius|Offset)\b|\belevation: [0-9]/.test(l) ? [`${f.replace(src, "")}:${i + 1}`] : [])));
    expect(bad).toEqual([]);
  });

  it("takes icon sizes, pressed / dim opacities from tokens", () => {
    const hits = (re: RegExp) => files(src).flatMap((f) => readFileSync(f, "utf8").split("\n").flatMap((l, i) => (re.test(l) ? [`${f.replace(src, "")}:${i + 1}`] : [])));
    expect(hits(/<Ionicons[^>]*size=\{\d+\}/)).toEqual([]);
    expect(hits(/pressed && \{ opacity: /)).toEqual([]);
  });
  it("derives icon sizes and states from the token file", () => {
    expect(icon).toEqual({ xs: 12, sm: 16, md: 20, lg: 24 });
    expect(state.pressed.opacity).toBe(0.7);
  });
});
