import { Star } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { propKey, useSaved } from "@/lib/saved";
import { useAuth } from "@/lib/auth";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/** Round save button for a player or team (account watchlist). Logged out: opens sign-in. */
export function StarButton({ kind, idx, className }: { kind: "player" | "team"; idx: number; className?: string }) {
  const { has, toggle } = useSaved();
  const { user, openSignIn } = useAuth();
  const key = `${kind}:${idx}`;
  const on = has(key);
  return (
    <motion.button type="button" aria-label={on ? "Remove from Saved" : "Save"} aria-pressed={on} whileTap={{ scale: 0.88 }} whileHover={{ scale: 1.06 }}
      onClick={() => {
        tap();
        if (!user) { openSignIn(); return; }
        toast(toggle(key) ? "Saved. Find it under Saved." : "Removed from Saved");
      }}
      className={cn("grid size-control shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-secondary text-foreground", className)}>
      <Star className={cn("size-5", on && "fill-amber stroke-amber")} />
    </motion.button>
  );
}

/** Watchlist star for one priced line. Logged out: opens sign-in; never navigates. */
export function PropStar({ idx, stat, line, fmt, className }: { idx: number; stat: string; line: number; fmt: number; className?: string }) {
  const { has, toggle } = useSaved();
  const { user, openSignIn } = useAuth();
  const key = propKey(idx, stat, line, fmt);
  const on = has(key);
  return (
    <button type="button" aria-label={on ? "Remove from watchlist" : "Add to watchlist"} aria-pressed={on}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        tap();
        if (!user) { openSignIn(); return; }
        toast(toggle(key) ? "Added to your watchlist (Saved)" : "Removed from watchlist");
      }}
      className={cn("grid size-control shrink-0 cursor-pointer place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-90", className)}>
      <Star className={cn("size-[18px]", on && "fill-amber stroke-amber")} />
    </button>
  );
}
