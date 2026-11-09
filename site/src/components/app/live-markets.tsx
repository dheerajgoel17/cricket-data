/* eslint-disable @typescript-eslint/no-explicit-any */
import { odds } from "@/lib/format";
import { BookBadge } from "./book-badge";
import { LiveBadge } from "./live-spot";

/** One live market of the Match Fancy list: an over / under line with both prices, or a pick with its outcomes. Same row chrome as the other rows of the list; prices only (no history for it). */
export function LiveMarketRow({ m }: { m: any }) {
  return (
    <div className="grid gap-hair px-gutter py-snug">
      <span className="flex min-w-0 items-baseline gap-snug">
        <span className="truncate text-body font-medium leading-snug">{m.market}</span>
        <LiveBadge />
        {m.book && <BookBadge source={m.book} />}
      </span>
      {m.kind === "ou" ? (
        <span className="flex flex-wrap items-baseline gap-x-snug text-callout text-muted-foreground">
          <span className="font-condensed text-metric font-bold leading-none tracking-tight tabular-nums text-foreground">O/U {m.line}</span>
          <span className="font-condensed tabular-nums">O <b className="text-body text-foreground">{odds(m.over)}</b></span>
          <span className="font-condensed tabular-nums">U <b className="text-body text-foreground">{odds(m.under)}</b></span>
        </span>
      ) : (
        <span className="flex flex-wrap items-baseline gap-x-snug gap-y-hair text-callout text-muted-foreground">
          {(m.outcomes || []).map((o: any) => (
            <span key={`${o.label}|${o.sub || ""}`} className="inline-flex items-baseline gap-tight font-condensed tabular-nums">
              {o.label}{o.sub ? ` (${o.sub})` : ""} <b className="text-body text-foreground">{odds(o.price)}</b>
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
