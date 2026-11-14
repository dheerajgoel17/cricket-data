import type { SkeletonShape } from "@/ui/skeletons";

/**
 * Which loading shape each screen / sub-surface uses. Kept as data so tests can assert
 * every page has a page-shaped skeleton (not a generic spinner or mismatched rows).
 */
export type SkeletonRoute = {
  /** Route or surface id (matches app path or component role). */
  id: string;
  /** Human page / subpage name. */
  page: string;
  /** Skeleton shape shown while that surface loads. */
  shape: SkeletonShape;
  /** Where Working / *Skeleton is mounted. */
  file: string;
};

export const SKELETON_ROUTES: readonly SkeletonRoute[] = [
  { id: "tabs/home/rail", page: "Home · fixture rail", shape: "card", file: "app/(tabs)/index.tsx" },
  { id: "tabs/home/props", page: "Home · Props block", shape: "rows", file: "ui/hot-home.tsx" },
  { id: "tabs/home/tape", page: "Home · market tape", shape: "tape", file: "ui/hot-home.tsx" },
  { id: "tabs/props", page: "Player props tab", shape: "rows", file: "app/(tabs)/props.tsx" },
  { id: "tabs/fancy", page: "Fancy tab", shape: "fancy", file: "app/(tabs)/fancy.tsx" },
  { id: "tabs/leagues", page: "Leagues tab", shape: "league", file: "app/(tabs)/leagues.tsx" },
  { id: "tabs/saved", page: "Saved tab", shape: "list", file: "app/(tabs)/saved.tsx" },
  { id: "fixture", page: "Fixture · header", shape: "match", file: "app/fixture/[id]/index.tsx" },
  { id: "fixture/props", page: "Fixture · Props", shape: "rows", file: "app/fixture/[id]/index.tsx" },
  { id: "fixture/fancy", page: "Fixture · Match Fancy", shape: "rows", file: "ui/match-fancy.tsx" },
  { id: "fixture/grid", page: "Fixture · Grid", shape: "grid", file: "app/fixture/[id]/index.tsx" },
  { id: "fixture/trends", page: "Fixture · Custom line", shape: "list", file: "app/fixture/[id]/index.tsx" },
  { id: "fixture/fancy-market", page: "Fancy market page", shape: "market", file: "app/fixture/[id]/fancy.tsx" },
  { id: "fixture/ground", page: "Fixture ground", shape: "ground", file: "app/fixture/[id]/ground.tsx" },
  { id: "player", page: "Player page", shape: "player", file: "app/player/[idx].tsx" },
  { id: "team/grid", page: "Team · Player grid", shape: "grid", file: "app/team/[idx].tsx" },
  { id: "team/markets", page: "Team · Markets", shape: "list", file: "app/team/[idx].tsx" },
  { id: "team/top", page: "Team · Top batter", shape: "list", file: "app/team/[idx].tsx" },
  { id: "league", page: "League competition", shape: "league", file: "app/league/[id].tsx" },
  { id: "competitions", page: "All competitions", shape: "comps", file: "app/competitions.tsx" },
  { id: "venue", page: "Ground (venue)", shape: "ground", file: "app/venue/[idx].tsx" },
  { id: "ground-page", page: "Ground page body", shape: "ground", file: "ui/ground-page.tsx" },
  { id: "tournament-stats", page: "Tournament stats", shape: "league", file: "ui/tournament-stats.tsx" },
] as const;

/** Every distinct shape that must render without throwing. */
export const SKELETON_SHAPES: readonly SkeletonShape[] = [
  "rows", "fancy", "match", "player", "grid", "list", "league", "comps", "ground", "tape", "market", "card",
];
