import { describe, expect, it } from "vitest";

// Pages and shared components that follow the design system (see "Type and spacing scales" in src/index.css and docs/SITE.md):
// sizes come from named tokens, never from pixel values or raw spacing numbers. Add a file here when its page is migrated.
const GOVERNED = [
  "components/app/hot-props.tsx", "components/app/fixture-card.tsx", "components/app/live-board.tsx", "components/app/match-fancy.tsx", "components/app/recent-form.tsx",
  "components/app/pill-group.tsx", "components/app/grid.tsx", "components/app/skeletons.tsx", "components/app/mini-bars.tsx", "components/app/live-feed.tsx",
  "components/app/line-stepper.tsx", "components/app/viz.tsx",
  "components/layout/Shell.tsx", "components/layout/Header.tsx", "components/layout/GlobalSearch.tsx", "components/layout/ThemeToggle.tsx", "pages/Fixtures.tsx", "pages/Home.tsx", "pages/Player.tsx", "pages/Lists.tsx", "components/app/hot-home.tsx",
];
const sources = import.meta.glob("../**/*.tsx", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const src = (f: string) => sources[`../${f}`] ?? "";

// text-[13px], and Tailwind's own sizes (text-sm...): only the named scale is allowed
const HARD_TEXT = /(?<![\w-])(?:[a-z]+:)*text-(?:\[[^\]]*px\]|xs|sm|base|lg|xl|2xl|3xl|4xl)(?![\w-])/g;
// mt-5, pt-3.5, py-2, gap-4, gap-x-3 ...: stacks and gaps use tight / snug / stack / group / section (hair for micro gaps)
const RAW_SPACE = /(?<![\w-])(?:[a-z]+:)*(?:mt|mb|my|pt|pb|py|gap|gap-x|gap-y)-(?!0(?![\w.]))\d[\d.]*(?![\w])/g;

// Blocks do not set their own vertical margins: a parent stacks them with flex/grid gap, so every gap on a page comes from one place.
// (mt-auto, which pushes a footer to the bottom of a card, is the only margin allowed.)
const OWN_MARGIN = /(?<![\w-])(?:[a-z]+:)*(?:mt|mb|my)-(?!auto(?![\w-]))[\w.[\]-]+/g;

describe("design tokens", () => {
  it("finds the governed files", () => { for (const f of GOVERNED) expect(src(f), f).not.toBe(""); });
  for (const f of GOVERNED) {
    it(`${f} uses the type scale`, () => { expect(src(f).match(HARD_TEXT) ?? []).toEqual([]); });
    it(`${f} uses the spacing scale`, () => { expect(src(f).match(RAW_SPACE) ?? []).toEqual([]); });
    it(`${f} stacks blocks with gap, not margins`, () => { expect(src(f).match(OWN_MARGIN) ?? []).toEqual([]); });
  }
});
