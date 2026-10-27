import { useEffect, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * Single-select pill group (shadcn ToggleGroup): one bordered rounded container, and the active highlight is a shared-layout Motion element
 * that slides between items (instant under reduced motion). The active item is scrolled into view when the row overflows.
 * `layoutId` must be unique per group on a page.
 */
export function PillGroup({ items, value, onChange, layoutId, label, className, itemClassName, segmented }: {
  items: [string, ReactNode][]; value: string; onChange: (v: string) => void; layoutId: string; label: string; className?: string; itemClassName?: string;
  /** One rounded track with a raised thumb (segmented control); each segment is as wide as its label. Default is separate rounded chips with a filled pill that slides to the selected one. */ segmented?: boolean;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('[data-state="on"]')?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" }); }, [value, reduce]);
  return (
    <ToggleGroup ref={ref} type="single" value={value} onValueChange={(v) => v && onChange(v)} variant="outline" spacing={segmented ? 0 : 2} aria-label={label}
      className={cn("justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", segmented ? "h-11 w-fit max-w-full rounded-full bg-card p-1" : "h-auto w-full gap-tight bg-transparent py-hair", className)}>
      {items.map(([v, l]) => (
        <ToggleGroupItem key={v} value={v} className={cn("relative shrink-0 border-0 bg-transparent font-medium transition-colors", segmented ? "h-9 flex-none rounded-full bg-transparent px-4 text-callout data-[spacing=0]:rounded-full data-[spacing=0]:first:rounded-full data-[spacing=0]:last:rounded-full hover:bg-transparent hover:text-foreground data-[state=on]:bg-transparent data-[state=off]:text-muted-foreground" : "h-11 rounded-full bg-card px-5 text-callout hover:bg-card hover:text-foreground data-[state=on]:bg-card data-[state=on]:text-background data-[state=off]:text-foreground/80", itemClassName)}>
          {value === v && <motion.span layoutId={layoutId} aria-hidden className={cn("absolute inset-0 rounded-full", segmented ? "bg-[#636366] shadow-[0_3px_8px_rgba(0,0,0,.4),0_1px_1px_rgba(0,0,0,.3)]" : "bg-foreground")} transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }} />}
          <span className="relative flex items-center">{l}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
