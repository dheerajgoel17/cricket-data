import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Empty section / page: a quiet surface, optional icon, a short title and one supporting line.
 * Use on every list that can have nothing to show (home Props, Fancy, Saved, filters, leagues…).
 */
export function EmptyState({
  icon,
  title,
  body,
  action,
  compact,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  /** Tighter padding for a named section under a heading (Saved watchlist, etc.). */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-start gap-snug rounded-2xl bg-surface ring-1 ring-hairline",
        compact ? "px-inset py-stack" : "px-gutter py-group",
        className,
      )}
    >
      {icon ? (
        <span className="grid size-10 place-items-center rounded-full bg-secondary text-muted-foreground [&_svg]:size-5" aria-hidden>
          {icon}
        </span>
      ) : null}
      <div className="grid min-w-0 gap-hair">
        <p className="text-body font-medium text-foreground">{title}</p>
        {body ? <p className="text-callout text-muted-foreground">{body}</p> : null}
      </div>
      {action ? <div className="pt-tight">{action}</div> : null}
    </div>
  );
}
