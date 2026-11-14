import type { SkeletonShape } from "@/components/app/skeletons";

/**
 * Which loading shape each page / sub-surface uses. Tests assert every surface has a
 * page-shaped skeleton (not a bare spinner or a mismatched list of prop rows).
 */
export type SkeletonRoute = {
  id: string;
  page: string;
  shape: SkeletonShape;
  file: string;
};

export const SKELETON_ROUTES: readonly SkeletonRoute[] = [
  { id: "app", page: "App shell", shape: "app", file: "components/app/skeletons.tsx" },
  { id: "home/rail", page: "Home · fixture rail", shape: "rail", file: "pages/Home.tsx" },
  { id: "home/tape", page: "Home · market tape", shape: "tape", file: "components/app/hot-home.tsx" },
  { id: "home/props", page: "Home · Props block", shape: "rows", file: "components/app/hot-home.tsx" },
  { id: "props", page: "Player props / Lists", shape: "rows", file: "pages/Lists.tsx" },
  { id: "hot-props", page: "Hot props scoring", shape: "rows", file: "components/app/hot-props.tsx" },
  { id: "fixture", page: "Fixture · header + props", shape: "match", file: "pages/Fixtures.tsx" },
  { id: "fixture/props", page: "Fixture · Props", shape: "rows", file: "pages/Fixtures.tsx" },
  { id: "fixture/grid", page: "Fixture · Grid", shape: "grid", file: "pages/Fixtures.tsx" },
  { id: "fixture/trends", page: "Fixture · Custom line", shape: "list", file: "pages/Fixtures.tsx" },
  { id: "fixture/fancy", page: "Fixture · Match Fancy", shape: "fancy", file: "components/app/match-fancy.tsx" },
  { id: "fixture/ground", page: "Fixture · Ground", shape: "ground", file: "components/app/fixture-ground.tsx" },
  { id: "player", page: "Player page", shape: "player", file: "pages/Player.tsx" },
  { id: "markets/team", page: "Team / ground markets", shape: "list", file: "pages/Markets.tsx" },
  { id: "tools", page: "Tools (pair stands)", shape: "list", file: "pages/Tools.tsx" },
  { id: "scorecard", page: "Scorecard route", shape: "scorecard", file: "components/app/skeletons.tsx" },
  { id: "leagues", page: "Leagues · tournament stats", shape: "league", file: "components/app/tournament-stats.tsx" },
] as const;

export const SKELETON_SHAPES: readonly SkeletonShape[] = [
  "rows", "grid", "list", "match", "scorecard", "tape", "fancy", "rail", "app", "player", "ground", "league",
];
