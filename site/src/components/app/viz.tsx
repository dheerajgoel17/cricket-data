import { cn } from "@/lib/utils";
import { rateClass } from "@/lib/heat";
import { pc } from "@/lib/format";

type Slice = { key: string; n: number; color: string };

/** Donut of mixed outcomes (cleared / missed / push / not counted). Skip when fewer than three slices would show — a two-way split is the gauge. */
export function OutcomeDonut({ slices, center, caption }: { slices: Slice[]; center: string; caption: string }) {
  const live = slices.filter((s) => s.n > 0);
  if (live.length < 3) return null;
  const total = live.reduce((t, s) => t + s.n, 0);
  const r = 18, c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="grid shrink-0 justify-items-center gap-hair">
      <svg viewBox="0 0 48 48" className="size-20" role="img" aria-label={`${caption} ${center}`}>
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--border)" strokeWidth="4" />
        {live.map((s) => {
          const frac = s.n / total, dash = frac * c, gap = c - dash, rot = acc * 360 - 90;
          acc += frac;
          return <circle key={s.key} cx="24" cy="24" r={r} fill="none" stroke={s.color} strokeWidth="4" strokeDasharray={`${dash} ${gap}`} transform={`rotate(${rot} 24 24)`} />;
        })}
        <text x="24" y="28" textAnchor="middle" fontSize="11" fontWeight="700" fill="currentColor">{center}</text>
      </svg>
      <span className="text-caption text-muted-foreground">{caption}</span>
    </div>
  );
}

/** One-dimensional heat strip: each cell is a split's hit rate. Only used when there are enough rows to scan. */
export function RateHeatStrip({ rows, title }: { rows: { label: string; pOver: number | null; n: number }[]; title: string }) {
  if (rows.length < 5) return null;
  return (
    <div className="flex flex-col gap-tight" aria-label={title}>
      <div className="flex gap-hair overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {rows.map((r) => (
          <span key={r.label} title={`${r.label} ${r.pOver == null ? "–" : pc(r.pOver)} · ${r.n}`}
            className={cn("grid h-10 min-w-10 shrink-0 place-items-center rounded-md text-caption font-semibold tabular-nums", rateClass(r.pOver))}>
            {r.pOver == null ? "–" : `${Math.round(r.pOver * 100)}`}
          </span>
        ))}
      </div>
      <p className="text-caption text-muted-foreground">{title}</p>
    </div>
  );
}
