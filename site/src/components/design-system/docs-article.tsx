import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

const focusRing = "rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Stable section ids for On-this-page + PreviewFrame anchors. */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "section";
}

export type TocItem = { id: string; label: string };
export type PagerLink = { to: string; label: string; group?: string };

/** Docs article H1 + lead (shadcn / Radix style — not product PageTitle). */
export function DocsPageHeader({
  title,
  lead,
  group,
  source,
}: {
  title: string;
  lead?: string;
  group?: string;
  source?: string;
}) {
  return (
    <header className="grid max-w-3xl gap-stack border-b border-hairline pb-group">
      {group ? (
        <p className="label-cap text-footnote text-muted-foreground">{group}</p>
      ) : null}
      <div className="grid gap-snug">
        <h1 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-emphasis leading-[1.1] tracking-[-0.03em] text-foreground">
          {title}
        </h1>
        {lead ? <p className="max-w-prose text-title font-copy text-muted-foreground">{lead}</p> : null}
      </div>
      {source ? (
        <code className="w-fit rounded-md bg-muted px-snug py-hair text-footnote text-muted-foreground">{source}</code>
      ) : null}
    </header>
  );
}

/** Quiet “when to use” callout under the page lead. */
export function WhenToUse({ children }: { children: ReactNode }) {
  return (
    <aside className="mt-group max-w-prose rounded-lg border border-hairline bg-muted/40 px-inset py-stack">
      <p className="label-cap text-caption text-muted-foreground">When to use</p>
      <p className="mt-tight text-callout text-foreground">{children}</p>
    </aside>
  );
}

/** Sticky On-this-page rail (xl+), matching shadcn / Carbon docs. */
export function DocsToc({ items }: { items: readonly TocItem[] }) {
  if (!items.length) return null;
  return (
    <nav
      aria-label="On this page"
      className="hidden xl:block"
    >
      <div className="sticky top-[calc(var(--header-h)+1.5rem)] grid gap-snug">
        <p className="label-cap text-caption text-muted-foreground">On this page</p>
        <ul className="grid gap-tight border-l border-hairline">
          {items.map(({ id, label }) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className={cn(
                  "-ml-px block border-l-2 border-transparent py-hair pl-stack text-callout text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
                  focusRing,
                )}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

/** Prev / next topic cards at the foot of a docs article. */
export function DocsPager({ prev, next }: { prev?: PagerLink | null; next?: PagerLink | null }) {
  if (!prev && !next) return null;
  return (
    <nav aria-label="Adjacent topics" className="mt-16 grid gap-snug border-t border-hairline pt-group sm:grid-cols-2">
      {prev ? (
        <Link
          to={prev.to}
          className={cn(
            "group grid gap-hair rounded-xl border border-hairline bg-card p-inset transition-colors hover:border-primary/40 hover:bg-surface",
            focusRing,
          )}
        >
          <span className="flex items-center gap-tight text-footnote text-muted-foreground">
            <ArrowLeftIcon className="size-3.5" aria-hidden />
            Previous
          </span>
          <span className="text-title font-emphasis text-foreground group-hover:text-primary">{prev.label}</span>
          {prev.group ? <span className="text-footnote text-muted-foreground">{prev.group}</span> : null}
        </Link>
      ) : <span className="hidden sm:block" />}
      {next ? (
        <Link
          to={next.to}
          className={cn(
            "group grid gap-hair rounded-xl border border-hairline bg-card p-inset text-right transition-colors hover:border-primary/40 hover:bg-surface sm:justify-items-end",
            focusRing,
          )}
        >
          <span className="flex items-center justify-end gap-tight text-footnote text-muted-foreground">
            Next
            <ArrowRightIcon className="size-3.5" aria-hidden />
          </span>
          <span className="text-title font-emphasis text-foreground group-hover:text-primary">{next.label}</span>
          {next.group ? <span className="text-footnote text-muted-foreground">{next.group}</span> : null}
        </Link>
      ) : null}
    </nav>
  );
}

/**
 * Docs content column: article header + optional when-to-use + body + TOC rail + pager.
 * Keeps product Header / Sidebar outside; this is only the right-pane article.
 */
export function DocsArticle({
  title,
  lead,
  group,
  source,
  when,
  toc = [],
  pager,
  children,
  className,
}: {
  title: string;
  lead?: string;
  group?: string;
  source?: string;
  when?: ReactNode;
  toc?: readonly TocItem[];
  pager?: { prev?: PagerLink | null; next?: PagerLink | null };
  children: ReactNode;
  className?: string;
}) {
  const showToc = toc.length > 1;
  return (
    <div className={cn(showToc && "xl:grid xl:grid-cols-[minmax(0,1fr)_11rem] xl:gap-12", className)}>
      <article className="min-w-0">
        <DocsPageHeader title={title} lead={lead} group={group} source={source} />
        {when ? <WhenToUse>{when}</WhenToUse> : null}
        <div className="mt-12 grid gap-12">{children}</div>
        {pager ? <DocsPager prev={pager.prev} next={pager.next} /> : null}
      </article>
      {showToc ? <DocsToc items={toc} /> : null}
    </div>
  );
}
