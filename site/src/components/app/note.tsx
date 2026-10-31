import type { ReactNode } from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

/** A reading note: an info mark, a short title and one point per line, on a quiet rule at the left. For "how these numbers are worked out", not for warnings. */
export function Note({ title, items, className }: { title: string; items: ReactNode[]; className?: string }) {
  return (
    <aside role="note" aria-label={title} className={cn("flex gap-snug border-l-2 border-hairline pl-snug", className)}>
      <InformationCircleIcon aria-hidden className="relative top-px size-4 shrink-0 self-start text-muted-foreground" />
      <div className="grid gap-tight">
        <p className="label-cap text-callout text-foreground/80">{title}</p>
        <ul className="grid gap-hair text-footnote leading-snug text-muted-foreground">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
      </div>
    </aside>
  );
}
