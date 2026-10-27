import { useEffect, useRef, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * Single-select pill group (shadcn ToggleGroup): one bordered rounded container, and the active highlight is a shared-layout Motion element
 * that slides between items (instant under reduced motion). The active item is scrolled into view when the row overflows.
 * `layoutId` must be unique per group on a page.
 */
export function PillGroup({ items, value, onChange, layoutId, label, className, itemClassName }: {
  items: [string, ReactNode][]; value: string; onChange: (v: string) => void; layoutId: string; label: string; className?: string; itemClassName?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('[data-state="on"]')?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" }); }, [value, reduce]);
  return (
    <ToggleGroup ref={ref} type="single" value={value} onValueChange={(v) => v && onChange(v)} variant="outline" spacing={0} aria-label={label}
      className={cn("h-11 w-full justify-start overflow-x-auto rounded-full border bg-card p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      {items.map(([v, l]) => (
        <ToggleGroupItem key={v} value={v} className={cn("relative h-9 shrink-0 rounded-full border-0 bg-transparent px-4 text-sm font-medium transition-colors hover:bg-transparent hover:text-foreground data-[state=on]:bg-transparent data-[state=off]:text-muted-foreground", itemClassName)}>
          {value === v && <motion.span layoutId={layoutId} aria-hidden className="absolute inset-0 rounded-full bg-accent" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }} />}
          <span className="relative flex items-center">{l}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
