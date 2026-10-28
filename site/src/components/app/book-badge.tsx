import { useState } from "react";
import { bookName } from "@/engine/lines.js";
import { bookLogo } from "@/lib/books";
import { cn } from "@/lib/utils";

const broken = new Set<string>(); // logo files that failed to load: every other badge for that book goes straight to the name

/** Where a price comes from: the book's own logo when we hold one, else a neutral chip with its name. The name is always what a screen reader gets. */
export function BookBadge({ source, className }: { source: string; className?: string }) {
  const name = bookName(source), src = bookLogo(source);
  const [failed, setFailed] = useState(() => !!src && broken.has(src));
  if (!src || failed) return <span data-book={source} className={cn("inline-block whitespace-nowrap rounded-full bg-white/10 px-tight align-middle text-footnote font-medium leading-snug text-foreground/80", className)}>{name}</span>;
  return <img data-book={source} src={src} alt={name} loading="lazy" decoding="async" onError={() => { broken.add(src); setFailed(true); }} className={cn("inline-block h-3.5 w-auto max-w-24 align-middle", className)} />;
}
