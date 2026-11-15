import { CheckIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { cn } from "@/lib/utils";

/** Hit/Miss for the model side against the pre-match line (`cleared` = over the line). Push keeps Edge. */
export function sideStamp(side: "over" | "under" | undefined, verdict: "cleared" | "missed" | "push" | null | undefined): "Hit" | "Miss" | null {
  if (verdict !== "cleared" && verdict !== "missed") return null;
  const overCleared = verdict === "cleared";
  if (side === "under") return overCleared ? "Miss" : "Hit";
  return overCleared ? "Hit" : "Miss";
}

/** Settled model-side mark beside the line: tick = Hit, cross = Miss. Sized in `em` so it matches the surrounding callout line. */
export function ResultStamp({ kind, className }: { kind: "Hit" | "Miss"; className?: string }) {
  const Icon = kind === "Hit" ? CheckIcon : XMarkIcon;
  return (
    <span
      role="img"
      aria-label={kind}
      className={cn(
        "inline-flex size-[1.125em] shrink-0 items-center justify-center leading-none",
        kind === "Hit" ? "text-primary" : "text-miss",
        className,
      )}
    >
      <Icon className="size-full" aria-hidden />
    </span>
  );
}
