import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Skeletons shaped like the real content (same row heights, radii and grids), so the page does not jump when data arrives.

/** Props / trends list rows: photo, two text lines, so-far pill, edge. */
export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div data-skeleton="rows" aria-hidden className="-mx-gutter">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-tight px-gutter py-snug" style={{ opacity: 1 - i * 0.1 }}>
          <div className="flex items-center gap-snug">
            <Skeleton className="size-control shrink-0 rounded-full" />
            <div className="grid flex-1 gap-tight"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-24" /></div>
            <Skeleton className="h-5 w-16 rounded-md" />
          </div>
          <div className="flex items-center justify-between gap-snug pl-[calc(var(--control)+var(--spacing-snug))]">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-9 w-[72px] rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Player grid: header row and player rows with the game cells. */
export function GridSkeleton({ rows = 9 }: { rows?: number }) {
  return (
    <div data-skeleton="grid" aria-hidden className="overflow-hidden rounded-2xl bg-card ring-1 ring-hairline">
      <div className="flex items-center gap-snug border-b border-hairline px-3 py-snug"><Skeleton className="h-3 w-14" /><Skeleton className="ml-auto h-3 w-6" />{[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-8 w-9" />)}</div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-snug border-b border-hairline px-3 py-tight last:border-0" style={{ opacity: 1 - i * 0.07 }}>
          <Skeleton className="size-5 rounded-full" /><Skeleton className="h-3.5 w-24" /><Skeleton className="ml-auto h-3.5 w-8" />{[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-6 w-9 rounded-md" />)}
        </div>
      ))}
    </div>
  );
}

/** Grouped list of label / value rows (markets). */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div data-skeleton="list" aria-hidden className="overflow-hidden rounded-2xl bg-card ring-1 ring-hairline">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="flex items-center gap-snug border-b border-hairline px-inset py-snug last:border-0"><Skeleton className="h-3.5 w-36" /><Skeleton className="ml-auto h-3.5 w-10" /><Skeleton className="h-3.5 w-10" /></div>)}
    </div>
  );
}

/** Match header + live strip while the fixture loads: edge-to-edge under the top bar. */
export function MatchHeaderSkeleton() {
  return (
    <div data-skeleton="match" data-flush aria-hidden className="-mx-gutter flex flex-col border-b border-hairline bg-card">
      <div className="flex flex-col gap-tight px-gutter py-snug">
        <Skeleton className="h-3 w-40" />
        <div className="flex items-center justify-between gap-snug">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-6 w-24" />
        </div>
        <div className="flex items-center justify-between gap-snug">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid grid-cols-3 divide-x divide-dashed divide-hairline border-t border-hairline bg-background/60">
        {[0, 1, 2].map((n) => (
          <div key={n} className="grid gap-hair px-tight py-snug first:pl-gutter last:pr-gutter">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-snug border-t border-hairline px-gutter py-tight">
        <Skeleton className="h-6 w-full rounded-md" />
      </div>
    </div>
  );
}

/** Standalone scorecard placeholder (scorecard route). */
export function ScorecardSkeleton() {
  return (
    <div data-skeleton="scorecard" aria-hidden className="-mx-gutter flex flex-col gap-stack border-y border-hairline bg-card px-gutter py-inset">
      <div className="flex items-center gap-snug">
        <Skeleton className="size-16 rounded-full" />
        <div className="grid flex-1 justify-items-center gap-tight"><Skeleton className="h-3 w-16" /><Skeleton className="h-6 w-12" /></div>
        <Skeleton className="size-16 rounded-full" />
      </div>
      <div className="flex items-center justify-between gap-snug">
        <div className="flex items-center gap-snug"><Skeleton className="size-9 rounded-full" /><Skeleton className="h-3.5 w-24" /></div>
        <Skeleton className="h-3.5 w-16" />
      </div>
      <div className="flex gap-hair">{[0, 1, 2, 3, 4, 5].map((n) => <Skeleton key={n} className="size-6 rounded-md" />)}</div>
      <div className="flex flex-col gap-tight">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-snug"><Skeleton className="h-3.5 w-28" /><Skeleton className="ml-auto h-3.5 w-10" /><Skeleton className="h-3.5 w-8" /></div>
        ))}
      </div>
    </div>
  );
}

/** High-odds ticket while the live lines settle. */
export function TapeSkeleton() {
  return (
    <div data-skeleton="tape" aria-hidden className="relative flex min-w-0 flex-col gap-tight rounded-2xl bg-primary/80 p-inset">
      <div className="flex flex-col gap-tight">
        <Skeleton className="h-5 w-36 bg-primary-foreground/25" />
        <Skeleton className="h-3 w-52 bg-primary-foreground/20" />
      </div>
      <div className="relative h-0 py-snug">
        <div className="absolute inset-x-5 top-1/2 border-t border-dashed border-primary-foreground/35" />
        <span className="absolute top-1/2 left-0 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
        <span className="absolute top-1/2 right-0 size-5 translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
      </div>
      {[0, 1].map((n) => (
        <div key={n} className="flex min-h-row items-center gap-snug py-tight">
          <Skeleton className="size-control rounded-full bg-primary-foreground/25" />
          <div className="grid flex-1 gap-tight"><Skeleton className="h-3.5 w-28 bg-primary-foreground/25" /><Skeleton className="h-3 w-20 bg-primary-foreground/20" /></div>
          <Skeleton className="h-6 w-12 rounded-md bg-primary-foreground/25" />
        </div>
      ))}
    </div>
  );
}

/** Match Fancy while the bookmaker file loads: an overview list, then the panel. */
export function FancySkeleton() {
  return (
    <div data-skeleton="fancy" aria-hidden className="flex flex-col gap-stack">
      <RowsSkeleton rows={3} />
      <div className="flex flex-col gap-stack rounded-2xl bg-card p-inset ring-1 ring-hairline">
        <Skeleton className="h-5 w-40" />
        <div className="flex items-end gap-group"><Skeleton className="h-10 w-20" /><Skeleton className="h-6 w-16" /><Skeleton className="h-6 w-24" /></div>
        <Skeleton className="h-28 w-full" />
        <div className="grid grid-cols-2 gap-snug"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /></div>
      </div>
    </div>
  );
}

/** The home rail while its inputs load (fixtures, bookmaker lines, rail settings): series chips, two fixture cards. */
export function RailSkeleton() {
  return (
    <div data-skeleton="rail" aria-hidden className="-mx-gutter flex gap-snug overflow-hidden px-gutter">
      {[0, 1, 2].map((n) => (
        <div key={n} className="flex min-h-48 w-(--fixture-card) shrink-0 flex-col gap-snug rounded-2xl bg-card p-inset ring-1 ring-inset ring-hairline">
          <div className="flex justify-between gap-snug"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-24" /></div>
          {[0, 1].map((team) => <div key={team} className="flex items-center gap-snug"><Skeleton className="size-control shrink-0 rounded-full" /><Skeleton className="h-4 w-24" /></div>)}
          <div className="mt-auto flex items-end justify-between gap-snug pt-tight"><div className="grid gap-hair"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-28" /></div><Skeleton className="h-3 w-12" /></div>
        </div>
      ))}
    </div>
  );
}

export function HomePropsSkeleton() {
  return (
    <div data-skeleton="home-props" aria-hidden className="flex min-w-0 flex-col gap-stack">
      <div className="flex gap-tight overflow-hidden">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-control w-32 shrink-0 rounded-full" />)}
      </div>
      <RowsSkeleton rows={3} />
    </div>
  );
}

/** Content fallback inside the mounted shell. */
export function PageSkeleton() {
  return <div role="status" aria-label="Loading page"><RowsSkeleton rows={3} /></div>;
}

/** Cold start, before the application shell can mount. */
export function AppSkeleton() {
  return (
    <div data-skeleton="app" role="status" aria-label="Loading" className="min-h-screen">
      <div aria-hidden className="flex h-(--header-h) items-center gap-snug border-b border-hairline px-gutter">
        <Skeleton className="size-control rounded-lg" /><Skeleton className="h-5 w-24" />
        <Skeleton className="ml-auto size-control rounded-full" /><Skeleton className="size-control rounded-full" />
      </div>
      <div aria-hidden className="flex">
        <div className="hidden w-64 shrink-0 flex-col gap-snug p-snug lg:flex">{[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-control rounded-xl" />)}</div>
        <div className="mx-auto flex w-full min-w-0 max-w-(--content-max) flex-col px-gutter pb-section">
          <div className="-mx-gutter flex h-12 items-center gap-stack border-b border-hairline px-gutter">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-3 w-16" />)}
            <Skeleton className="ml-auto h-3 w-5" />
          </div>
          <div className="flex flex-col gap-section pt-stack">
            <RailSkeleton />
            <section className="flex flex-col gap-stack"><h2 className="text-title font-emphasis tracking-tight">Props</h2><HomePropsSkeleton /></section>
          </div>
        </div>
      </div>
      <div aria-hidden className="fixed inset-x-0 bottom-0 flex h-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] items-center justify-around border-t border-hairline bg-background lg:hidden">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="size-5 rounded-md" />)}
      </div>
    </div>
  );
}

/** Player page body: compact metrics, then the chart first (8) beside lines (4); this-match sits under the chart. */
export function PlayerSkeleton() {
  return (
    <div data-skeleton="player" aria-hidden className="flex flex-col gap-section lg:grid lg:grid-cols-12 lg:items-start">
      <div className="flex items-center justify-between gap-stack rounded-2xl bg-card p-inset ring-1 ring-hairline lg:col-span-12">
        <div className="grid flex-1 grid-cols-3 gap-x-snug gap-y-stack lg:grid-cols-6">{Array.from({ length: 6 }, (_, n) => <div key={n} className="grid gap-tight"><Skeleton className="h-3 w-14" /><Skeleton className="h-6 w-16" /></div>)}</div>
        <Skeleton className="size-20 rounded-full" />
      </div>
      <div className="flex flex-col gap-stack lg:col-span-8 lg:row-start-2">
        <div className="flex items-center justify-between gap-snug"><Skeleton className="h-control w-40 rounded-full" /><Skeleton className="h-control w-36 rounded-full" /></div>
        <div className="flex flex-col gap-snug rounded-2xl bg-card p-inset ring-1 ring-hairline"><Skeleton className="h-[340px] w-full" /><Skeleton className="h-control w-full rounded-full" /><Skeleton className="h-3 w-56" /></div>
      </div>
      <div className="flex flex-col gap-snug rounded-2xl bg-card p-inset ring-1 ring-hairline lg:col-span-5 lg:row-start-3">
        <Skeleton className="h-3 w-20" />
        <div className="flex items-center gap-snug"><Skeleton className="size-8 rounded-full" /><Skeleton className="h-4 w-36" /></div>
        <Skeleton className="h-3 w-48" />
        <div className="flex items-center justify-between gap-snug"><Skeleton className="h-5 w-32" /><Skeleton className="h-5 w-12 rounded-md" /></div>
        <div className="grid grid-cols-2 gap-snug"><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-16 rounded-xl" /></div>
      </div>
      <div className="flex flex-col gap-snug lg:col-span-4 lg:col-start-9 lg:row-start-2"><Skeleton className="h-6 w-24" /><ListSkeleton rows={4} /></div>
    </div>
  );
}

/** Ground / venue page: title, metric tiles, then a form list. */
export function GroundSkeleton() {
  return (
    <div data-skeleton="ground" aria-hidden className="flex flex-col gap-stack">
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-3.5 w-40" />
      <div className="grid grid-cols-2 gap-snug sm:grid-cols-4">
        {[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-[72px] rounded-2xl" />)}
      </div>
      <ListSkeleton rows={4} />
    </div>
  );
}

/** Leagues / competition: chips, then metric tiles and a list. */
export function LeagueSkeleton() {
  return (
    <div data-skeleton="league" aria-hidden className="flex flex-col gap-stack">
      <div className="flex gap-snug overflow-hidden">
        {[72, 96, 64, 88].map((w, i) => <Skeleton key={i} className="h-control shrink-0 rounded-full" style={{ width: w }} />)}
      </div>
      <div className="grid grid-cols-2 gap-snug sm:grid-cols-4">
        {[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-16 rounded-2xl" />)}
      </div>
      <ListSkeleton rows={5} />
    </div>
  );
}

/** Named shapes used by the route catalogue and tests. */
export type SkeletonShape =
  | "home-props" | "rows" | "grid" | "list" | "match" | "scorecard" | "tape" | "fancy" | "rail" | "app" | "player" | "ground" | "league";

export const SKELETON_BY_SHAPE: Record<SkeletonShape, () => ReactNode> = {
  "home-props": () => <HomePropsSkeleton />,
  rows: () => <RowsSkeleton />,
  grid: () => <GridSkeleton />,
  list: () => <ListSkeleton />,
  match: () => <MatchHeaderSkeleton />,
  scorecard: () => <ScorecardSkeleton />,
  tape: () => <TapeSkeleton />,
  fancy: () => <FancySkeleton />,
  rail: () => <RailSkeleton />,
  app: () => <AppSkeleton />,
  player: () => <PlayerSkeleton />,
  ground: () => <GroundSkeleton />,
  league: () => <LeagueSkeleton />,
};
