import { describe, expect, it } from "vitest";

// Pages and shared components that follow the design system (see "Type and spacing scales" in src/index.css and docs/SITE.md):
// sizes come from named tokens, never from pixel values or raw spacing numbers. Add a file here when its page is migrated.
const GOVERNED = [
  "components/app/hot-props.tsx", "components/app/fixture-card.tsx", "components/app/live-board.tsx", "components/app/match-fancy.tsx", "components/app/recent-form.tsx",
  "components/app/pill-group.tsx", "components/app/grid.tsx", "components/app/skeletons.tsx", "components/app/mini-bars.tsx", "components/app/live-feed.tsx",
  "components/app/tick.tsx", "components/app/market-tape.tsx", "components/app/next-match.tsx",
  "components/app/line-stepper.tsx", "components/app/viz.tsx",
  "components/layout/Shell.tsx", "components/layout/Header.tsx", "components/layout/GlobalSearch.tsx", "components/layout/IosTabBar.tsx", "pages/Fixtures.tsx", "pages/Home.tsx", "pages/Player.tsx", "pages/Lists.tsx", "components/app/hot-home.tsx", "components/app/home-phase-bar.tsx",
  "components/app/alt-lines.tsx", "components/app/chip.tsx", "components/app/match-status.tsx", "components/app/note.tsx", "components/app/player-name.tsx", "components/app/odds-table.tsx", "components/app/screener-filters.tsx", "pages/Saved.tsx", "components/app/tournament-stats.tsx", "components/app/result.tsx", "pages/Leagues.tsx",
  "components/app/live-spot.tsx", "components/app/live-markets.tsx", "components/app/fixture-ground.tsx", "components/app/ground-filters.tsx", "pages/Contact.tsx",
  "components/app/page.tsx", "components/app/forms.tsx", "components/app/entity-hero.tsx", "components/app/pill-tabs.tsx", "components/app/chart.tsx", "components/app/star.tsx",
  "pages/Markets.tsx", "pages/Simple.tsx", "pages/Tools.tsx", "pages/Legal.tsx",
  "components/app/ad-slot.tsx", "components/app/animated-height.tsx", "components/app/animated-number.tsx", "components/app/badges.tsx", "components/app/book-badge.tsx",
  "components/app/book-table.tsx", "components/app/empty-state.tsx", "components/app/error-boundary.tsx", "components/app/fancy-filters.tsx", "components/app/grid-filters.tsx",
  "components/app/line-ladder.tsx", "components/app/player-picker.tsx", "components/app/portrait.tsx", "components/app/sign-in-sheet.tsx", "components/app/stats-ad.tsx",
  "pages/AdminAds.tsx",
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

/** Product pages + app chrome: EmptyState only (EmptyNote stays as a deprecated alias in page.tsx). */
const PRODUCT = Object.keys(sources).filter((k) => /\/(pages|components\/app)\//.test(k) && !k.endsWith("/page.tsx"));
const UI = Object.keys(sources).filter((k) => /\/components\/ui\//.test(k));

describe("empty + icon hygiene", () => {
  it("product pages and app components do not import EmptyNote", () => {
    const hits = PRODUCT.filter((k) => /\bEmptyNote\b/.test(sources[k] || ""));
    expect(hits, hits.join(", ")).toEqual([]);
  });
  it("product pages, app components, and ui primitives do not import lucide-react", () => {
    const hits = [...PRODUCT, ...UI].filter((k) => /from\s+["']lucide-react["']/.test(sources[k] || ""));
    expect(hits, hits.join(", ")).toEqual([]);
  });
});
