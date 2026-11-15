import type { ComponentProps, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Match / row status marks — one recipe for LIVE, In Play Market, session breaks, and muted phases.
 * Use named `tone` + `surface`; do not fork colours at the call site.
 *
 * - live + pill → white on miss (scoreboard: match is live)
 * - live + plain → miss caption (rarely used; props no longer mark Live per player)
 * - live + dot → miss text + pulse (fixture card / rail)
 * - inPlay → miss caption ("In Play Market" — line/odds are in-play)
 * - session → amber (Stumps / Rain delay / …)
 * - muted → Final / Started / Upcoming / Delayed
 */
export const statusLabelVariants = cva("label-cap shrink-0 font-emphasis", {
  variants: {
    tone: {
      live: "",
      inPlay: "text-miss",
      session: "text-amber",
      muted: "text-muted-foreground",
    },
    surface: {
      plain: "text-caption",
      pill: "rounded-full px-snug py-hair",
      dot: "inline-flex items-center gap-tight text-footnote",
    },
  },
  compoundVariants: [
    { tone: "live", surface: "pill", class: "bg-miss text-primary-foreground" },
    { tone: "live", surface: "plain", class: "text-miss" },
    { tone: "live", surface: "dot", class: "text-miss" },
    { tone: "session", surface: "pill", class: "bg-amber/20 text-amber" },
    { tone: "session", surface: "plain", class: "text-footnote text-amber" },
    { tone: "muted", surface: "pill", class: "bg-secondary text-muted-foreground" },
    { tone: "muted", surface: "plain", class: "text-footnote text-muted-foreground" },
    { tone: "inPlay", surface: "plain", class: "text-caption text-miss" },
  ],
  defaultVariants: { tone: "muted", surface: "plain" },
});

function PulseDot() {
  return (
    <span aria-hidden className="relative grid size-1.5 place-items-center">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-miss/60 motion-reduce:animate-none" />
      <span className="relative size-1.5 rounded-full bg-miss" />
    </span>
  );
}

export type StatusLabelProps = ComponentProps<"span"> &
  VariantProps<typeof statusLabelVariants> & {
    /** Override the default copy for the tone (pill live → "LIVE", plain/dot live → "Live"). */
    children?: ReactNode;
  };

function defaultCopy(tone: StatusLabelProps["tone"], surface: StatusLabelProps["surface"]) {
  if (tone === "live") return surface === "pill" ? "LIVE" : "Live";
  if (tone === "inPlay") return "In Play Market";
  return null;
}

export function StatusLabel({ tone = "muted", surface = "plain", className, children, ...props }: StatusLabelProps) {
  const label = children ?? defaultCopy(tone, surface);
  return (
    <span
      role={tone === "live" || tone === "session" ? "status" : undefined}
      className={cn(statusLabelVariants({ tone, surface }), className)}
      {...props}
    >
      {tone === "live" && surface === "dot" ? <PulseDot /> : null}
      {label}
    </span>
  );
}
