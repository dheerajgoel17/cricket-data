import { Star } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import { useSaved } from "@/lib/saved";
import { cn } from "@/lib/utils";

/** Round save button (players / teams live in this browser only). */
export function StarButton({ kind, idx, className }: { kind: "player" | "team"; idx: number; className?: string }) {
  const { has, toggle } = useSaved();
  const key = `${kind}:${idx}`;
  const on = has(key);
  return (
    <motion.button type="button" aria-label={on ? "Remove from Saved" : "Save"} aria-pressed={on} whileTap={{ scale: 0.88 }} whileHover={{ scale: 1.06 }}
      onClick={() => toast(toggle(key) ? "Saved. Find it under Saved." : "Removed from Saved")}
      className={cn("grid size-11 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-secondary text-foreground", className)}>
      <Star className={cn("size-5", on && "fill-amber stroke-amber")} />
    </motion.button>
  );
}
