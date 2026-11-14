import { useState } from "react";
import { bookName } from "@cricket/engine/lines.js";
import { bookLogo, bookVariant } from "@/lib/books";
import { cn } from "@/lib/utils";

const broken = new Set<string>(); // logo files that failed to load: every other badge for that book goes straight to the name

/** Where a price comes from: the book's own logo when we hold one, else a neutral chip with its name. The name is always what a screen reader gets. */
export function BookBadge({ source, className }: { source: string; className?: string }) {
  const name = bookName(source), src = bookLogo(source);
  const [failed, setFailed] = useState(() => !!src && broken.has(src));
  if (!src || failed) return <span data-book={source} className={cn("inline-block max-w-full truncate rounded-full bg-hairline px-tight align-middle text-footnote font-label leading-snug text-foreground/80", className)}>{name}</span>;
  const variant = bookVariant(source);
  const img = <img data-book={source} src={src} alt={name} loading="lazy" decoding="async" onError={() => { broken.add(src); setFailed(true); }} className={cn("inline-block h-3 w-auto max-w-16 align-middle", className)} />;
  return variant ? <span className={cn("inline-flex max-w-full items-center gap-hair align-middle overflow-hidden", className)}>{img}<span aria-hidden className="truncate text-caption font-label text-muted-foreground">{variant}</span></span> : img;
}

