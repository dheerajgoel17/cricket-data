import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Lets the height of changing content (a tab body, a list after a filter) animate instead of snapping. The page below it then moves gradually and
 * the browser never clamps the scroll position when a tall block is swapped for a short one. Clips only vertically, so full-bleed lists
 * (negative side margins) still reach the screen edges. No animation under reduced motion.
 */
export function AnimatedHeight({ children, className }: { children: ReactNode; className?: string }) {
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);
  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setH(Math.ceil(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div style={{ height: h ?? "auto" }} className="overflow-y-clip transition-[height] duration-300 ease-out motion-reduce:transition-none">
      <div ref={inner} className={cn("flow-root", className)}>{children}</div>
    </div>
  );
}
