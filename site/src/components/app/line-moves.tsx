import { useMemo } from "react";
import { fixtureMoves } from "@cricket/engine/lines.js";
import { STATS } from "@cricket/engine/rules.js";
import { cn } from "@/lib/utils";
import { ScrollRow } from "./scroll-row";

type Move = { t: "line" | "fancy"; player?: string; stat?: string; key?: string; team?: string; open: number; line: number; source?: string; n?: number };

const MAX = 6;
const words = (k: string) => k.replace(/_bf$/, "").replace(/^(team|match)_/, "").replace(/_/g, " ");
const what = (m: Move) => (m.t === "line" ? `${m.player ?? ""} ${((STATS as any)[m.stat || ""]?.label || m.stat || "").toLowerCase()}` : `${m.team ? `${m.team} ` : ""}${words(m.key || "")}`).trim();

/** One market, however many sources moved it: the latest move of each, so a line two books moved shows once. */
export function distinctMoves(moves: Move[]): Move[] {
  const seen = new Set<string>(), out: Move[] = [];
  for (const m of moves) {
    const k = `${m.t}|${m.player ?? m.key}|${m.stat ?? ""}|${m.team ?? ""}`;
    if (!seen.has(k)) { seen.add(k); out.push(m); }
  }
  return out;
}

/** "Lines moved" strip for a match that has not started: one amber chip per market a book moved ("H Kerr fours ↑ 16.5 → 17.5"), newest first. Nothing when no line moved. */
export function LineMovesStrip({ doc, fx, className }: { doc: any; fx: any; className?: string }) {
  const shown = useMemo(() => distinctMoves(fixtureMoves(doc, fx) as Move[]), [doc, fx]);
  if (!shown.length) return null;
  return (
    <ScrollRow className={cn("-mx-gutter", className)} aria-label="Lines that moved before the start">
      <ul className="flex w-max items-center gap-snug px-gutter">
        {shown.slice(0, MAX).map((m, i) => {
          const up = m.line > m.open;
          return (
            <li key={i} className="inline-flex items-center gap-tight rounded-full bg-amber/15 px-snug py-hair text-footnote font-label text-amber" aria-label={`${what(m)} line moved ${up ? "up" : "down"} from ${m.open} to ${m.line}`}>
              <svg viewBox="0 0 12 12" className={cn("size-3 shrink-0", !up && "rotate-180")} aria-hidden><path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="max-w-40 truncate capitalize">{what(m)}</span>
              <span className="tabular-nums"><span className="opacity-70">{m.open}</span> → {m.line}</span>
            </li>
          );
        })}
        {shown.length > MAX ? <li className="shrink-0 text-footnote text-amber">+{shown.length - MAX}</li> : null}
      </ul>
    </ScrollRow>
  );
}
