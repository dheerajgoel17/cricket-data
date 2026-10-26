import { type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

/** Flat entity header for team / venue / competition / fixture pages: badge, name, sub line, meta pills, optional save button. */
export function EntityHero({ badge, name, sub, meta = [], save }: { badge?: ReactNode; name: ReactNode; sub?: ReactNode; meta?: string[]; save?: ReactNode }) {
  return (
    <section className="mb-3 flex items-center gap-4 border-b py-4 md:gap-6 md:py-5">
      {badge}
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-medium leading-tight md:text-4xl">{name}</h1>
        {sub ? <p className="text-muted-foreground">{sub}</p> : null}
        {meta.length ? <div className="mt-2 flex flex-wrap gap-1.5">{meta.map((m) => <Badge key={m} variant="secondary" className="rounded-full px-3 py-1 text-[13px] font-normal">{m}</Badge>)}</div> : null}
      </div>
      {save}
    </section>
  );
}
