import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { slugify } from "@/components/design-system/docs-article";

/**
 * Atlaskit / shadcn-style preview frame: H2 + lead, toolbar, tall centered canvas.
 * Prefer this for live component demos on the design host.
 */
export function PreviewFrame({
  title,
  description,
  children,
  className,
  canvasClassName,
  source,
  id,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  canvasClassName?: string;
  /** Quiet source chip in the preview toolbar (e.g. components/ui/button). */
  source?: string;
  /** Anchor id; defaults to slugify(title). */
  id?: string;
}) {
  const anchor = id || slugify(title);
  return (
    <section id={anchor} className={cn("scroll-mt-[calc(var(--header-h)+1rem)] grid gap-stack", className)}>
      <header className="grid max-w-prose gap-tight">
        <h2 className="text-[1.25rem] font-emphasis tracking-tight text-foreground">{title}</h2>
        {description ? <p className="text-callout text-muted-foreground">{description}</p> : null}
      </header>
      <div className="overflow-hidden rounded-xl border border-hairline bg-card shadow-[0_1px_0_oklch(0_0_0/0.04)]">
        <div className="flex h-9 items-center justify-between gap-snug border-b border-hairline bg-muted/50 px-inset">
          <span className="label-cap text-caption text-muted-foreground">Preview</span>
          {source ? <code className="truncate text-footnote text-muted-foreground">{source}</code> : null}
        </div>
        <div
          className={cn(
            "flex min-h-44 flex-wrap items-center justify-center gap-snug bg-muted/60 p-group sm:min-h-52 sm:p-10",
            // Soft checker so controls read on both light docs and product-coloured demos.
            "[background-image:radial-gradient(circle_at_1px_1px,oklch(0.55_0.02_150/0.12)_1px,transparent_0)] [background-size:12px_12px]",
            canvasClassName,
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

/** @deprecated Prefer PreviewFrame — kept as an alias so older call sites keep working. */
export const ExampleStage = PreviewFrame;

/** Quiet documentation panel (props, notes) — border only, no filled card chrome. */
export function DocPanel({ title, children, className, id }: { title?: string; children: ReactNode; className?: string; id?: string }) {
  const anchor = id || (title ? slugify(title) : undefined);
  return (
    <section id={anchor} className={cn("scroll-mt-[calc(var(--header-h)+1rem)] grid gap-snug rounded-xl border border-hairline bg-card p-inset sm:p-group", className)}>
      {title ? <h2 className="text-[1.25rem] font-emphasis tracking-tight">{title}</h2> : null}
      {children}
    </section>
  );
}
