import { forwardRef, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/** Wrap a short list whose membership changes (Saved) so a removed row fades out and the rows under it glide up. App twin: `Reflow` in `mobile/src/ui/motion.tsx`. */
export function ReflowGroup({ children }: { children: ReactNode }) {
  return <AnimatePresence initial={false} mode="popLayout">{children}</AnimatePresence>;
}

/** One row of a `ReflowGroup`: glides to its new place (position only) and fades when removed; static under reduced motion. */
export const ReflowItem = forwardRef<HTMLLIElement, { className?: string; children: ReactNode }>(function ReflowItem({ className, children }, ref) {
  const reduce = useReducedMotion();
  return (
    <motion.li ref={ref} layout={reduce ? false : "position"} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }} className={className}>
      {children}
    </motion.li>
  );
});
