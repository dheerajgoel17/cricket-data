import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { odds } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BookBadge } from "./book-badge";

type Priced = { source: string; over: number | null; under: number | null };

/** The books that are not already shown up front (`shown`: their sources) for one line: a "+N books" toggle that opens a table of each one's over and under price. */
export function BookTable({ books, shown, className }: { books: Priced[]; shown: (string | undefined)[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rest = books.filter((b) => !shown.includes(b.source));
  if (!rest.length) return null;
  return (
    <div className={cn("flex flex-col gap-hair text-footnote tabular-nums text-muted-foreground", className)}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}
        className="inline-flex w-fit items-center gap-hair rounded-full px-tight font-medium text-foreground/70 hover:bg-hairline">
        {open ? "Hide" : `+${rest.length} book${rest.length > 1 ? "s" : ""}`}<ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <table id={id} className="w-full max-w-sm text-left">
          <thead><tr className="text-caption uppercase tracking-wider"><th className="py-hair font-medium">Book</th><th className="py-hair font-medium">Over</th><th className="py-hair font-medium">Under</th></tr></thead>
          <tbody>{rest.map((b) => <tr key={b.source}><td className="py-hair"><BookBadge source={b.source} /></td><td>{odds(b.over)}</td><td>{odds(b.under)}</td></tr>)}</tbody>
        </table>
      )}
    </div>
  );
}
