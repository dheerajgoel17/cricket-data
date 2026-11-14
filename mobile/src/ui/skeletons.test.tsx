import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { SKELETON_ROUTES, SKELETON_SHAPES } from "@/ui/skeleton-routes";
import {
  CardSkeleton,
  CompsSkeleton,
  FancyCardSkeleton,
  GroundSkeleton,
  GridSkeleton,
  LeagueSkeleton,
  ListSkeleton,
  MarketSkeleton,
  MatchHeaderSkeleton,
  PlayerSkeleton,
  RowsSkeleton,
  TapeSkeleton,
  renderSkeleton,
  type SkeletonShape,
} from "@/ui/skeletons";
import { Working } from "@/ui/motion";

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (c: unknown) => c },
    Easing: { inOut: (e: unknown) => e, ease: {}, quad: {} },
    FadeInDown: { delay: () => ({ duration: () => ({}) }) },
    cancelAnimation: jest.fn(),
    makeMutable: (v: number) => ({ value: v }),
    useAnimatedStyle: (fn: () => object) => fn(),
    useSharedValue: (v: number) => ({ value: v }),
    withRepeat: (v: unknown) => v,
    withTiming: (v: unknown) => v,
  };
});

jest.mock("react-native-svg", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Stub = (p: object) => React.createElement(View, p);
  return { __esModule: true, default: Stub, Defs: Stub, LinearGradient: Stub, Rect: Stub, Stop: Stub };
});

const root = resolve(__dirname, "../..");

const COMPONENTS: Record<SkeletonShape, React.ComponentType<object>> = {
  rows: RowsSkeleton as React.ComponentType<object>,
  fancy: FancyCardSkeleton as React.ComponentType<object>,
  match: MatchHeaderSkeleton as React.ComponentType<object>,
  player: PlayerSkeleton as React.ComponentType<object>,
  grid: GridSkeleton as React.ComponentType<object>,
  list: ListSkeleton as React.ComponentType<object>,
  league: LeagueSkeleton as React.ComponentType<object>,
  comps: CompsSkeleton as React.ComponentType<object>,
  ground: GroundSkeleton as React.ComponentType<object>,
  tape: TapeSkeleton as React.ComponentType<object>,
  market: MarketSkeleton as React.ComponentType<object>,
  card: CardSkeleton as React.ComponentType<object>,
};

describe("skeleton shapes", () => {
  it("exports a component for every shape", () => {
    expect(Object.keys(COMPONENTS).sort()).toEqual([...SKELETON_SHAPES].sort());
  });

  it.each([...SKELETON_SHAPES])("renderSkeleton(%s) returns a valid element", (shape) => {
    const el = renderSkeleton(shape);
    expect(React.isValidElement(el)).toBe(true);
  });

  it.each([...SKELETON_SHAPES])("%s component is a function", (shape) => {
    expect(typeof COMPONENTS[shape]).toBe("function");
  });

  it("Working is a function that accepts shape", () => {
    expect(typeof Working).toBe("function");
    const el = React.createElement(Working, { label: "Loading…", shape: "fancy" as SkeletonShape });
    expect(React.isValidElement(el)).toBe(true);
    expect(el.props.shape).toBe("fancy");
    expect(el.props.label).toBe("Loading…");
  });

  it("CardSkeleton requires a width (rail footprint)", () => {
    const el = React.createElement(CardSkeleton, { width: 280 });
    expect(el.props.width).toBe(280);
  });
});

describe("skeleton routes (every page / subpage)", () => {
  it("covers tabs, fixture subpages, player, team, league, ground", () => {
    const ids = SKELETON_ROUTES.map((r) => r.id);
    for (const need of [
      "tabs/home/rail", "tabs/home/props", "tabs/home/tape", "tabs/props", "tabs/fancy", "tabs/leagues", "tabs/saved",
      "fixture", "fixture/props", "fixture/fancy", "fixture/grid", "fixture/trends", "fixture/fancy-market", "fixture/ground",
      "player", "team/grid", "team/markets", "team/top", "league", "competitions", "venue", "ground-page", "tournament-stats",
    ]) {
      expect(ids).toContain(need);
    }
  });

  it("every route shape is a known skeleton shape", () => {
    for (const r of SKELETON_ROUTES) {
      expect(SKELETON_SHAPES).toContain(r.shape);
    }
  });

  it.each(SKELETON_ROUTES.map((r) => [r.id, r.shape, r.file] as const))(
    "%s is wired to shape %s in %s",
    (_id, shape, file) => {
      const src = readFileSync(resolve(root, "src", file), "utf8");
      const markers = shapeMarkers(shape);
      expect(markers.some((m) => src.includes(m))).toBe(true);
    },
  );
});

function shapeMarkers(shape: SkeletonShape): string[] {
  const map: Record<SkeletonShape, string[]> = {
    rows: ['shape="rows"', "RowsSkeleton", "rows={5}", "rows={4}", "rows={2}"],
    fancy: ['shape="fancy"', "FancyCardSkeleton"],
    match: ["MatchHeaderSkeleton", 'shape="match"'],
    player: ["PlayerSkeleton", 'shape="player"'],
    grid: ['shape="grid"', "GridSkeleton"],
    list: ['shape="list"', "ListSkeleton"],
    league: ['shape="league"', "LeagueSkeleton"],
    comps: ['shape="comps"', "CompsSkeleton"],
    ground: ['shape="ground"', "GroundSkeleton"],
    tape: ["TapeSkeleton", 'shape="tape"'],
    market: ['shape="market"', "MarketSkeleton"],
    card: ["CardSkeleton"],
  };
  return map[shape];
}
