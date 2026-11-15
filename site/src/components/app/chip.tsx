import type { ReactNode } from "react";
import { AdjustmentsHorizontalIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A selectable rounded chip: filled when selected, 36 px tall (the control height), the touch target is the whole chip. Used in filter views and rails. */
export function Chip({ on, onClick, children, className, ...rest }: { on?: boolean; onClick?: () => void; children: ReactNode; className?: string } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} {...rest}
      className={cn("inline-flex h-control shrink-0 items-center gap-tight whitespace-nowrap rounded-[var(--chip-radius)] px-snug text-callout font-label outline-none transition-[transform,colors] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]",
        on ? "bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-surface-raised", className)}>
      {children}
    </button>
  );
}

/** The one "open the filters" button (Props, Fancy, Grid, Ground, Player): icon, label, and the number of active filters as a badge on the corner. App twin: `FilterButton` in `mobile/src/ui/chips.tsx`. */
export function FilterButton({ label = "Filters", count = 0, onClick }: { label?: ReactNode; count?: number; onClick: () => void }) {
  return (
    <Button type="button" variant="secondary" size="sm" aria-label={`Filters${count ? `, ${count} active` : ""}`} onClick={onClick}
      className="relative h-control shrink-0 rounded-[var(--chip-radius)] bg-card px-snug text-callout shadow-none">
      <AdjustmentsHorizontalIcon className="size-4" />{label}
      {count > 0 && <span className="absolute -right-hair -top-hair grid min-w-4 place-items-center rounded-full bg-primary px-hair text-caption font-emphasis text-primary-foreground ring-2 ring-background">{count}</span>}
    </Button>
  );
}

/** An applied filter in the chip row under the rail: its label and value, with a remove cross (a 44 px hit area around a small glyph). */
export function ActiveChip({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-control shrink-0 items-center gap-hair rounded-[var(--chip-radius)] bg-primary/15 pl-snug text-callout text-primary">
      <span className="text-muted-foreground">{label}</span><b className="font-label">{value}</b>
      <button type="button" aria-label={`Remove ${label} filter`} onClick={onRemove} className="grid size-control place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring active:opacity-60"><XMarkIcon className="size-3.5" /></button>
    </span>
  );
}
