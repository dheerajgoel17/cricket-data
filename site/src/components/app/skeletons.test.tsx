import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SKELETON_BY_SHAPE, type SkeletonShape } from "./skeletons";
import { SKELETON_ROUTES, SKELETON_SHAPES } from "@/lib/skeleton-routes";

const root = resolve(__dirname, "../../..");

describe("skeleton shapes", () => {
  it.each([...SKELETON_SHAPES])("renders %s without crashing", (shape) => {
    const { container } = render(<>{SKELETON_BY_SHAPE[shape]()}</>);
    expect(container.querySelector(`[data-skeleton="${shape}"]`)).toBeTruthy();
  });

  it("exposes every shape in SKELETON_BY_SHAPE", () => {
    expect(Object.keys(SKELETON_BY_SHAPE).sort()).toEqual([...SKELETON_SHAPES].sort());
  });
});

describe("skeleton routes (every page / subpage)", () => {
  it("lists a shape for each home, fixture, player and markets surface", () => {
    const ids = SKELETON_ROUTES.map((r) => r.id);
    for (const need of ["home/rail", "home/tape", "home/props", "fixture", "fixture/props", "fixture/grid", "fixture/fancy", "fixture/ground", "player", "props", "markets/team"]) {
      expect(ids).toContain(need);
    }
  });

  it.each(SKELETON_ROUTES.map((r) => [r.id, r.shape, r.file] as const))(
    "%s uses shape %s and the wiring file mentions that skeleton",
    (id, shape, file) => {
      expect(SKELETON_SHAPES).toContain(shape);
      const src = readFileSync(resolve(root, "src", file), "utf8");
      const token = shapeToken(shape);
      // App / scorecard catalogue entries live in skeletons.tsx itself.
      if (file.endsWith("skeletons.tsx") && (id === "app" || id === "scorecard" || id === "leagues")) {
        expect(src).toContain(token);
        return;
      }
      expect(src, `${file} should import or render ${token} for ${id}`).toMatch(new RegExp(token));
    },
  );
});

function shapeToken(shape: SkeletonShape): string {
  const map: Record<SkeletonShape, string> = {
    rows: "RowsSkeleton",
    grid: "GridSkeleton",
    list: "ListSkeleton",
    match: "MatchHeaderSkeleton",
    scorecard: "ScorecardSkeleton",
    tape: "TapeSkeleton",
    fancy: "FancySkeleton",
    rail: "RailSkeleton",
    app: "AppSkeleton",
    player: "PlayerSkeleton",
    ground: "GroundSkeleton",
    league: "LeagueSkeleton",
  };
  return map[shape];
}
