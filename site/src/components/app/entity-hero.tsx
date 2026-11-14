import { type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

/** Flat entity header for team / venue / competition / fixture pages: badge, name, sub line, meta pills, optional save button. */
export function EntityHero({ badge, name, sub, meta = [], save }: { badge?: ReactNode; name: ReactNode; sub?: ReactNode; meta?: string[]; save?: ReactNode }) {
  return (
    <section className="flex items-center gap-stack border-b border-hairline py-stack md:gap-group md:py-group">
      {badge}
      <div className="flex min-w-0 flex-1 flex-col gap-tight">
        <h1 className="text-display font-medium leading-tight md:text-stat">{name}</h1>
        {sub ? <p className="text-callout text-muted-foreground">{sub}</p> : null}
        {meta.length ? (
          <div className="flex flex-wrap gap-hair">
            {meta.map((m) => (
              <Badge key={m} variant="secondary" className="rounded-full px-snug py-tight text-callout font-normal">{m}</Badge>
            ))}
          </div>
        ) : null}
      </div>
      {save}
    </section>
  );
}
