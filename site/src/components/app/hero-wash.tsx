import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { entityAccent } from "@cricket/engine/entity-accents.js";

const DEFAULT_H = 220;

/**
 * Entity tint behind a scroll hero (app `EntityHeroWash` twin). Lives in document flow so it scrolls away with identity —
 * never a fixed screen wash. Unknown sides: brand primary. Never a full-page fill.
 */
export function HeroWash({
  accent,
  wash = true,
  height = DEFAULT_H,
  className,
  children,
  style,
}: {
  accent?: string | null;
  wash?: boolean;
  height?: number;
  className?: string;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  const hex = wash ? accent || "var(--primary)" : null;
  return (
    <div className={cn("relative", className)} style={style}>
      {hex ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-0"
          style={{
            height,
            background: `linear-gradient(to bottom, color-mix(in srgb, ${hex} 35%, transparent), color-mix(in srgb, ${hex} 8%, transparent), transparent)`,
          }}
        />
      ) : null}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/** Curated side accent, or null when unmapped. */
export function sideAccent(name?: string | null) {
  return name ? entityAccent(name) : null;
}
