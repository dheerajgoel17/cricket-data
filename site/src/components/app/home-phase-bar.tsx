import { NavLink } from "react-router-dom";
import { EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import { motion, useReducedMotion } from "motion/react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MORE_NAV } from "@/components/layout/nav";
import { track } from "@/lib/analytics";
import { HOME_PHASES, type HomePhase } from "@/lib/home-phase";
import { cn } from "@/lib/utils";

/**
 * Floating glass bar on home: In play / Pre-match / Resulted, plus More (the pages the sidebar already lists).
 * Sits above the iOS tab bar on phones; at the bottom of the viewport on desktop where that bar is hidden.
 */
export function HomePhaseBar({ value, counts, onChange }: { value: HomePhase; counts: Record<HomePhase, number>; onChange: (p: HomePhase) => void }) {
  const reduce = useReducedMotion();
  const pick = (p: HomePhase) => { if (p === value) return; track("home_phase", { phase: p }); onChange(p); };
  return (
    <nav
      aria-label="Match state"
      className="pointer-events-none fixed inset-x-gutter bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+var(--space-snug))] z-50 flex justify-center lg:bottom-stack"
    >
      <div className="pointer-events-auto flex max-w-full items-center gap-hair rounded-[var(--chip-radius)] bg-card/70 p-hair ring-1 ring-hairline backdrop-blur-2xl backdrop-saturate-150">
        <div role="tablist" aria-label="In play, pre-match or resulted" className="flex min-w-0">
          {HOME_PHASES.map(([id, label]) => {
            const on = value === id, n = counts[id];
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => pick(id)}
                className={cn("relative h-control shrink-0 rounded-[var(--chip-radius)] px-snug text-callout font-semibold", on ? "text-background" : "text-muted-foreground")}
              >
                {on && <motion.span layoutId="home-phase" aria-hidden className="absolute inset-0 rounded-[var(--chip-radius)] bg-foreground" transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }} />}
                <span className="relative flex items-center gap-hair">
                  {label}
                  <span className="text-caption font-medium tabular-nums opacity-70">{n}</span>
                </span>
              </button>
            );
          })}
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <button type="button" aria-label="More" className="grid size-control shrink-0 place-items-center rounded-[var(--chip-radius)] text-muted-foreground hover:bg-surface-hover hover:text-foreground">
              <EllipsisHorizontalIcon className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" showCloseButton={false} className="rounded-t-3xl border-0 bg-popover/80 px-inset pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-snug backdrop-blur-2xl backdrop-saturate-150 sm:mx-auto sm:max-w-md">
            <div aria-hidden className="mx-auto h-1.5 w-10 rounded-full bg-foreground/25" />
            <SheetHeader className="flex-row items-center justify-between p-0 pt-stack">
              <SheetTitle className="text-title font-bold tracking-tight">More</SheetTitle>
              <SheetClose className="text-body font-semibold text-primary active:opacity-50">Done</SheetClose>
            </SheetHeader>
            <SheetDescription className="sr-only">Players, tools and the rest of the site</SheetDescription>
            <ul className="grid gap-hair pt-group">
              {MORE_NAV.map(([label, to]) => (
                <li key={to}>
                  <SheetClose asChild>
                    <NavLink to={to} className="flex min-h-control items-center rounded-xl px-3 text-body hover:bg-surface-hover">{label}</NavLink>
                  </SheetClose>
                </li>
              ))}
            </ul>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}

export const EMPTY_PHASE: Record<HomePhase, string> = {
  live: "Nothing in play. Pre-match lists the next games.",
  pre: "No pre-match props yet.",
  final: "No resulted matches still listed.",
};
