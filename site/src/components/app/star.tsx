import { Star } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { propKey, useSaved } from "@/lib/saved";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/** Round save button (players / teams live in this browser only). */
export function StarButton({ kind, idx, className }: { kind: "player" | "team"; idx: number; className?: string }) {
  const { has, toggle } = useSaved();
  const key = `${kind}:${idx}`;
  const on = has(key);
  return (
    <motion.button type="button" aria-label={on ? "Remove from Saved" : "Save"} aria-pressed={on} whileTap={{ scale: 0.88 }} whileHover={{ scale: 1.06 }}
      onClick={() => { tap(); toast(toggle(key) ? "Saved. Find it under Saved." : "Removed from Saved"); }}
      className={cn("grid size-control shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-secondary text-foreground", className)}>
      <Star className={cn("size-5", on && "fill-amber stroke-amber")} />
    </motion.button>
  );
}

/** Watchlist star for one priced line (player, stat, line, format): small, in a 36 px hit area, never navigates. Saved props live on this device and show on the Saved page. */
export function PropStar({ idx, stat, line, fmt, className }: { idx: number; stat: string; line: number; fmt: number; className?: string }) {
  const { has, toggle } = useSaved();
  const on = has(propKey(idx, stat, line, fmt));
  return (
    <button type="button" aria-label={on ? "Remove from watchlist" : "Add to watchlist"} aria-pressed={on}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); tap(); toast(toggle(propKey(idx, stat, line, fmt)) ? "Added to your watchlist (Saved)" : "Removed from watchlist"); }}
      className={cn("grid size-control shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-90", className)}>
      <Star className={cn("size-[18px]", on && "fill-amber stroke-amber")} />
    </button>
  );
}
