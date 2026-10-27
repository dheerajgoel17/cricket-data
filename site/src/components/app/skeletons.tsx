import { Skeleton } from "@/components/ui/skeleton";

// Skeletons shaped like the real content (same row heights and widths), so the page does not jump when data arrives.

/** Props / trends list rows: photo, two text lines, edge, bars. */
export function RowsSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden className="-mx-4 sm:mx-0">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3 sm:h-[62px] sm:px-1" style={{ opacity: 1 - i * 0.1 }}>
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="grid flex-1 gap-2"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-24" /></div>
          <Skeleton className="hidden h-3.5 w-10 sm:block" /><Skeleton className="h-9 w-[84px] rounded-md sm:w-[104px]" />
        </div>
      ))}
    </div>
  );
}

/** Player grid: header row and player rows with the game cells. */
export function GridSkeleton({ rows = 9 }: { rows?: number }) {
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl bg-card ring-1 ring-white/5">
      <div className="flex items-center gap-3 border-b border-white/10 px-3 py-3"><Skeleton className="h-3 w-14" /><Skeleton className="ml-auto h-3 w-6" />{[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-8 w-9" />)}</div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-white/5 px-3 py-2.5 last:border-0" style={{ opacity: 1 - i * 0.07 }}>
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
      {Array.from({ length: rows }, (_, i) => <div key={i} className="flex items-center gap-3 border-b border-white/5 px-4 py-3.5 last:border-0"><Skeleton className="h-3.5 w-36" /><Skeleton className="ml-auto h-3.5 w-10" /><Skeleton className="h-3.5 w-10" /></div>)}
    </div>
  );
}

/** Match header while the fixture list loads. */
export function MatchHeaderSkeleton() {
  return (
    <div aria-hidden className="pt-3">
      <Skeleton className="size-11 rounded-full" />
      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="grid justify-items-center gap-2.5"><Skeleton className="h-12 w-[72px] rounded-md" /><Skeleton className="h-4 w-20" /></div>
        <div className="grid justify-items-center gap-2"><Skeleton className="h-3.5 w-20" /><Skeleton className="h-8 w-28" /><Skeleton className="h-4 w-24" /></div>
        <div className="grid justify-items-center gap-2.5"><Skeleton className="h-12 w-[72px] rounded-md" /><Skeleton className="h-4 w-20" /></div>
      </div>
    </div>
  );
}
