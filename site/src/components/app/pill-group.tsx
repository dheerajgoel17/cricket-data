import { useEffect, useRef, type ReactNode } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { motion, useReducedMotion } from "motion/react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * Single-select pill group (shadcn ToggleGroup). Variants:
 * - default / outlined: filled primary selected pill (parent filters)
 * - segmented: raised thumb in a track
 * - sub: quieter text row (underline on selected); put a hairline on the parent row (home phase bar), not on this group
 * Motion slide is instant under reduced motion. `layoutId` must be unique per group.
 */
export function PillGroup({ items, value, onChange, layoutId, label, className, itemClassName, segmented, sub, resetValue }: {
  items: [string, ReactNode][]; value: string; onChange: (v: string) => void; layoutId: string; label: string; className?: string; itemClassName?: string;
  /** One rounded track with a raised thumb (segmented control); each segment is as wide as its label. */ segmented?: boolean;
  /** Quiet text chips: selected = primary text + underline (no pill fill). */ sub?: boolean;
  /** Outlined filters. Pressing the selected filter again restores this default. */
  resetValue?: string;
}) {
  const outlined = resetValue != null;
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  // scroll the overflowing row only — scrollIntoView on the chip was dragging the page up to the chart
  useEffect(() => {
    const root = ref.current, el = root?.querySelector<HTMLElement>('[data-state="on"]');
    if (!root || !el) return;
    const r = el.getBoundingClientRect(), c = root.getBoundingClientRect();
    root.scrollTo({ left: root.scrollLeft + (r.left - c.left) - (c.width - r.width) / 2, behavior: reduce ? "auto" : "smooth" });
  }, [value, reduce]);
  return (
    <ToggleGroup ref={ref} type="single" value={value} onValueChange={(v) => { if (v) onChange(v); else if (resetValue != null && value !== resetValue) onChange(resetValue); }} variant="outline" spacing={segmented ? 0 : 2} aria-label={label}
      className={cn("justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        segmented ? "h-control w-fit max-w-full rounded-[var(--chip-radius)] bg-card p-0.5"
          : sub ? "h-auto w-full gap-stack bg-transparent"
            : "h-auto w-full gap-tight bg-transparent",
        className)}>
      {items.map(([v, l]) => {
        const clearable = value === v && outlined && v !== resetValue;
        const on = value === v;
        return (
          <ToggleGroupItem key={v} value={v} title={clearable ? "Clear filter" : undefined}
            className={cn(
              "relative shrink-0 font-medium transition-colors",
              sub
                ? "h-auto rounded-none border-0 bg-transparent px-0 py-stack text-callout shadow-none hover:bg-transparent hover:text-foreground data-[state=on]:bg-transparent data-[state=on]:text-primary data-[state=off]:text-muted-foreground"
                : outlined
                  ? "h-control rounded-[var(--chip-radius)] border! border-hairline! bg-card! px-3.5 text-callout text-foreground! shadow-none hover:bg-surface-hover data-[state=on]:border-transparent! data-[state=on]:bg-transparent! data-[state=on]:text-primary-foreground!"
                  : segmented
                    ? "h-full flex-none rounded-[var(--chip-radius)] border-0 bg-transparent px-3 text-callout data-[spacing=0]:rounded-[var(--chip-radius)] data-[spacing=0]:first:rounded-[var(--chip-radius)] data-[spacing=0]:last:rounded-[var(--chip-radius)] hover:bg-transparent hover:text-foreground data-[state=on]:bg-transparent data-[state=off]:text-muted-foreground"
                    : "h-control rounded-[var(--chip-radius)] border-0 bg-card px-3.5 text-callout hover:bg-card hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-primary-foreground data-[state=off]:text-foreground/80",
              itemClassName,
            )}>
            {on && !sub && <motion.span layoutId={layoutId} aria-hidden className={cn("absolute inset-0 rounded-[var(--chip-radius)]", segmented ? "bg-secondary shadow-sm" : "bg-primary")} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }} />}
            {on && sub && <motion.span layoutId={layoutId} aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }} />}
            <span className="relative flex items-center gap-hair">{l}{clearable && <XMarkIcon className="size-3.5 shrink-0 opacity-70" aria-hidden />}</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
