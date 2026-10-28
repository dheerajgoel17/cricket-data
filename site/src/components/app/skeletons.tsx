import { Skeleton } from "@/components/ui/skeleton";

// Skeletons shaped like the real content (same row heights and widths), so the page does not jump when data arrives.

/** Props / trends list rows: photo, two text lines, edge, bars. */
export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden className="-mx-gutter">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex min-h-row items-center gap-snug px-gutter py-snug" style={{ opacity: 1 - i * 0.1 }}>
          <Skeleton className="size-control shrink-0 rounded-full" />
          <div className="grid flex-1 gap-tight"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-24" /></div>
          <Skeleton className="h-9 w-[84px] rounded-md sm:w-[104px]" />
        </div>
      ))}
    </div>
  );
}

/** Player grid: header row and player rows with the game cells. */
export function GridSkeleton({ rows = 9 }: { rows?: number }) {
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/5">
      <div className="flex items-center gap-snug border-b border-white/10 px-3 py-snug"><Skeleton className="h-3 w-14" /><Skeleton className="ml-auto h-3 w-6" />{[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-8 w-9" />)}</div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-snug border-b border-white/5 px-3 py-tight last:border-0" style={{ opacity: 1 - i * 0.07 }}>
          <Skeleton className="size-5 rounded-full" /><Skeleton className="h-3.5 w-24" /><Skeleton className="ml-auto h-3.5 w-8" />{[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-6 w-9 rounded-md" />)}
        </div>
      ))}
    </div>
  );
}

/** Grouped list of label / value rows (markets). */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/5">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="flex items-center gap-snug border-b border-white/5 px-inset py-snug last:border-0"><Skeleton className="h-3.5 w-36" /><Skeleton className="ml-auto h-3.5 w-10" /><Skeleton className="h-3.5 w-10" /></div>)}
    </div>
  );
}

/** Match header while the fixture list loads. */
export function MatchHeaderSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-tight pt-snug">
      <Skeleton className="size-control rounded-full" />
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-snug">
        <div className="grid justify-items-center gap-tight"><Skeleton className="h-12 w-[72px] rounded-md" /><Skeleton className="h-4 w-20" /></div>
        <div className="grid justify-items-center gap-tight"><Skeleton className="h-3.5 w-20" /><Skeleton className="h-8 w-28" /><Skeleton className="h-4 w-24" /></div>
        <div className="grid justify-items-center gap-tight"><Skeleton className="h-12 w-[72px] rounded-md" /><Skeleton className="h-4 w-20" /></div>
      </div>
    </div>
  );
}

/** Match Fancy while the bookmaker file loads: an overview list, then the panel. */
export function FancySkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-stack">
      <RowsSkeleton rows={3} />
      <div className="flex flex-col gap-stack rounded-2xl bg-card p-inset ring-1 ring-white/5">
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
    <div aria-hidden className="flex flex-col gap-stack">
      <div className="flex gap-snug overflow-hidden">{[16, 24, 20, 14].map((w, n) => <Skeleton key={n} className="h-control shrink-0 rounded-full" style={{ width: `${w * 4}px` }} />)}</div>
      <div className="flex gap-snug overflow-hidden">{[0, 1].map((n) => <Skeleton key={n} className="h-[168px] shrink-0 basis-[88%] rounded-[22px] sm:basis-[340px]" />)}</div>
    </div>
  );
}

/** The whole app while the data files and the page code load: header bar, series chips, two fixture cards, a props list. Both waits render this, so a refresh shows one skeleton, not two "Loading" messages. */
export function AppSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="min-h-screen">
      <div aria-hidden className="flex h-14 items-center gap-snug border-b border-border/60 px-gutter md:h-[60px]">
        <Skeleton className="size-6 rounded-md" /><Skeleton className="h-5 w-24" />
        <Skeleton className="mx-auto hidden h-control max-w-[560px] flex-1 rounded-full md:block" />
        <Skeleton className="ml-auto size-control rounded-full md:ml-0" />
      </div>
      <div aria-hidden className="flex">
        <div className="hidden w-64 shrink-0 flex-col gap-snug p-snug md:flex">{[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-control rounded-xl" />)}</div>
        <div className="mx-auto flex w-full min-w-0 max-w-[900px] flex-col gap-section px-gutter pb-section pt-stack">
          <RailSkeleton />
          <div className="flex flex-col gap-stack"><Skeleton className="h-5 w-40" /><RowsSkeleton rows={6} /></div>
        </div>
      </div>
    </div>
  );
}

/** Player page body while the run is going: summary card, side and line controls, chart card, bookmaker list. */
export function PlayerSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-section">
      <div className="flex flex-col gap-stack">
        <div className="flex items-center justify-between gap-stack rounded-2xl bg-card p-inset ring-1 ring-white/5">
          <div className="grid flex-1 grid-cols-3 gap-x-snug gap-y-stack">{Array.from({ length: 6 }, (_, n) => <div key={n} className="grid gap-tight"><Skeleton className="h-3 w-14" /><Skeleton className="h-6 w-16" /></div>)}</div>
          <Skeleton className="size-20 rounded-full" />
        </div>
        <div className="flex items-center justify-between gap-snug"><Skeleton className="h-control w-40 rounded-full" /><Skeleton className="h-control w-36 rounded-full" /></div>
        <div className="flex flex-col gap-snug rounded-2xl bg-card p-inset ring-1 ring-white/5"><Skeleton className="h-[300px] w-full" /><Skeleton className="h-control w-full rounded-full" /></div>
      </div>
      <div className="flex flex-col gap-snug"><Skeleton className="h-6 w-44" /><ListSkeleton rows={3} /></div>
    </div>
  );
}
