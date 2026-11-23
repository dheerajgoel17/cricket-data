/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState, type ReactNode } from "react";
import { ChartBarIcon } from "@heroicons/react/24/outline";
import { bookName } from "@cricket/engine/lines.js";
import { edgeTag } from "@cricket/engine/props-view.js";
import { BookBadge } from "./book-badge";
import { TeamBadge } from "./badges";
import { InPlayBadge } from "./live-spot";
import { MiniBars, MiniBarsSlot, SCAN_ROW_GRID, ScanEdge } from "./mini-bars";
import { FormChips } from "./recent-form";
import { ResultStamp, sideStamp } from "./result-stamp";
import { Tick, type Standing } from "./tick";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { odds } from "@/lib/format";
import { cn } from "@/lib/utils";

export type FancyLinesDensity = "auto" | "compact" | "dense";

const rowKey = (r: any) => r.id || `${r.scope}:${r.key}:${r.inn || 0}${r.live ? ":live" : ""}`;

/**
 * Face Over / Under under a fancy row. `marks={false}`: prices only — no logos.
 * `detailOnly`: skip when the dense Over/Under column already covers the same single-line odds
 * (only render for split O/U lines).
 */
export function FancyBooks({ r, marks = true, detailOnly = false }: { r: any; marks?: boolean; detailOnly?: boolean }) {
  const over = r.over != null && r.over > 1;
  const under = r.under != null && r.under > 1;
  if (!over && !under) return null;
  const split = (r.overLine != null && r.underLine != null && r.overLine !== r.underLine)
    || (r.overLine != null && r.overLine !== r.line)
    || (r.underLine != null && r.underLine !== r.line);
  if (detailOnly && !split) return null;
  return (
    <span className="flex flex-wrap items-center gap-x-tight gap-y-hair text-callout tabular-nums text-muted-foreground" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {over ? (
        <span className="inline-flex min-w-0 items-center gap-hair whitespace-nowrap font-condensed">
          <span className="text-muted-foreground">O{r.overLine != null && r.overLine !== r.line ? ` ${r.overLine}` : ""}</span>
          <Tick quiet arrow={marks} value={r.over} className={cn("text-body font-emphasis text-foreground", !marks && "px-0")}>{odds(r.over)}</Tick>
          {marks && r.overBook ? <BookBadge source={r.overBook} className="min-w-0 truncate" /> : null}
        </span>
      ) : null}
      {under ? (
        <span className="inline-flex min-w-0 items-center gap-hair whitespace-nowrap font-condensed">
          <span className="text-muted-foreground">U{r.underLine != null && r.underLine !== r.line ? ` ${r.underLine}` : ""}</span>
          <Tick quiet arrow={marks} value={r.under} className={cn("text-body font-emphasis text-foreground", !marks && "px-0")}>{odds(r.under)}</Tick>
          {marks && r.underBook ? <BookBadge source={r.underBook} className="min-w-0 truncate" /> : null}
        </span>
      ) : null}
    </span>
  );
}

/** Shared scan meta — one line (O/U · line · scope · lean price · Hit/Miss); same shape as PropLineMeta. */
export function FancyLineMeta({ r, standing }: { r: any; standing?: Standing | null }) {
  const under = r.side === "under";
  const leanLine = under && r.underLine != null ? r.underLine : r.overLine != null ? r.overLine : r.line;
  const price = under ? r.under : r.over;
  const mark = standing ?? r.standing;
  const stamp = sideStamp(r.side, mark?.verdict ?? null);
  const innScope = typeof r.innScope === "string" ? r.innScope : "";
  return (
    <span className="flex min-w-0 items-center gap-x-tight text-callout font-sans font-emphasis leading-snug text-foreground">
      <span className={cn("shrink-0", under ? "text-miss" : "text-primary")}>{under ? "U" : "O"}</span>
      <span className="shrink-0 tabular-nums">{leanLine}</span>
      {innScope ? <span className="min-w-0 truncate">{innScope}</span> : null}
      {price > 1 ? <span className="shrink-0 font-condensed tabular-nums text-muted-foreground">{odds(price)}</span> : null}
      {stamp ? <ResultStamp kind={stamp} /> : null}
    </span>
  );
}

/** The toss rows (`kind: "toss"`, engine `tossRows`): a price and who it is from, then the side's toss record against this opponent and at this ground. */
const isToss = (r: any) => r?.kind === "toss";
const wonOf = (x: { won: number; n: number }) => `${x.won} of ${x.n}`;
export const tossSub = (r: any) => [r.vsOpp ? `vs ${r.vsOpp.opp} ${wonOf(r.vsOpp)}` : "", r.atGround ? `At ground ${wonOf(r.atGround)}` : ""].filter(Boolean).join(" · ");

/** A line of text that truncates; hovering or focusing it shows the full text, and only when it really is cut off. */
function TruncTip({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={open} onOpenChange={(o) => setOpen(o && !!ref.current && ref.current.scrollWidth > ref.current.clientWidth)}>
        <TooltipTrigger asChild><span ref={ref} className={cn("truncate", className)}>{text}</span></TooltipTrigger>
        <TooltipContent>{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function TossMeta({ r }: { r: any }) {
  return (
    <span className="flex min-w-0 items-center gap-x-tight text-callout font-sans font-emphasis leading-snug text-foreground">
      <span className="shrink-0 font-condensed tabular-nums">{odds(r.over)}</span>
      <TruncTip text={r.default ? "Default price" : bookName(r.overBook)} className="min-w-0 font-copy text-muted-foreground" />
    </span>
  );
}

export function FancyHitRate({ r }: { r: any }) {
  if (!r.played) return <span className="text-muted-foreground">–</span>;
  const p = r.hits / r.played;
  const tone = isToss(r) ? "text-foreground" : p >= 0.7 ? "text-primary" : p <= 0.4 ? "text-miss" : "text-foreground";
  return (
    <span className={cn("font-condensed text-body font-label tabular-nums", tone)}>
      {Math.round(p * 100)}%<span className="font-copy text-muted-foreground"> · {r.played}</span>
    </span>
  );
}

export function FancyGround({ r }: { r: any }) {
  if (isToss(r)) return r.vsOpp || r.atGround ? <span className="grid min-w-0 text-caption text-muted-foreground">{r.vsOpp ? <TruncTip text={`vs ${r.vsOpp.opp} · ${wonOf(r.vsOpp)}`} /> : null}{r.atGround ? <TruncTip text={`Ground · ${wonOf(r.atGround)}`} /> : null}</span> : null;
  const at = r.at;
  if (!at?.n) return null;
  const side = at.side === "under" ? "Under" : "Over";
  return <span className="truncate text-caption text-muted-foreground">Ground · {side} ({at.n})</span>;
}

/** Compact scan item (shared grid with PropLines compact). VOID replaces MiniBars (same as Not in XI on props). `inset`: nested in a padded card — drop row gutter so padding is not doubled. `onOpen` optional (in-play-only `liveRows` have nowhere to open). */
export function CompactFancyItem({ r, onOpen, active, sub, standing, inset }: {
  r: any; onOpen?: () => void; active?: boolean; sub?: string; standing?: Standing | null; inset?: boolean;
}) {
  const mark = standing ?? r.standing;
  const toss = isToss(r);
  const voided = !toss && mark?.state === "void";
  const className = cn(SCAN_ROW_GRID, inset && "px-0", "text-left", onOpen && "transition-colors active:bg-card", active && "bg-card");
  const body = (
    <>
      {r.team
        ? <TeamBadge name={r.team} size="md" className="size-control" />
        : <span className="grid size-control place-items-center rounded-full bg-secondary text-muted-foreground" aria-hidden><ChartBarIcon className="size-5" /></span>}
      <span className="grid min-w-0 gap-hair">
        <span className="flex min-w-0 items-center gap-tight">
          <span className="min-w-0 truncate text-body font-emphasis leading-snug">{r.label}</span>
          {r.live ? <InPlayBadge /> : null}
        </span>
        {toss && !sub && tossSub(r) ? <TruncTip text={tossSub(r)} className="text-footnote text-muted-foreground" /> : sub ? <span className="truncate text-footnote text-muted-foreground">{sub}</span> : null}
        {toss ? <TossMeta r={r} /> : !voided ? <FancyLineMeta r={r} standing={mark} /> : null}
      </span>
      {voided || toss ? <span className="w-11 shrink-0" aria-hidden /> : <ScanEdge edge={r.edge} />}
      {toss ? (
        r.form?.length ? <FormChips compact results={r.form.slice(-5)} /> : <MiniBarsSlot><span className="text-caption text-muted-foreground">–</span></MiniBarsSlot>
      ) : voided ? (
        <MiniBarsSlot>
          <span className="rounded border border-dashed border-amber/60 px-hair text-caption text-amber">VOID</span>
        </MiniBarsSlot>
      ) : (
        <MiniBars last={r.last || []} line={r.line} max={r.max} />
      )}
    </>
  );
  if (onOpen) {
    return <button type="button" onClick={onOpen} aria-label={`Open ${r.label}`} className={className}>{body}</button>;
  }
  return <div className={className}>{body}</div>;
}

function CompactFancyList({ rows, onOpen, standingOf, activeOf, subOf, afterRow, bleed = true, inset }: {
  rows: any[];
  onOpen: (r: any) => void;
  standingOf?: (r: any) => Standing | null | undefined;
  activeOf?: (r: any) => boolean;
  subOf?: (r: any) => string | undefined;
  afterRow?: (r: any) => ReactNode;
  bleed?: boolean;
  inset?: boolean;
}) {
  const flush = inset ?? !bleed;
  return (
    <ul className={bleed ? "-mx-gutter" : undefined}>
      {rows.map((r) => (
        <li key={rowKey(r)} className="border-t border-hairline first:border-t-0">
          <CompactFancyItem r={r} onOpen={r.static ? undefined : () => onOpen(r)} active={activeOf?.(r)} sub={subOf?.(r)} standing={standingOf?.(r) ?? r.standing} inset={flush} />
          {afterRow?.(r)}
        </li>
      ))}
    </ul>
  );
}

const TH_BASE = "h-auto py-tight text-left label-cap text-footnote font-label text-muted-foreground whitespace-nowrap";
const TD_START = "py-snug pl-gutter pr-snug";
const TD_MID = "px-snug py-snug";
const TD_END = "py-snug pl-snug pr-gutter";

function DenseFancyTable({ rows, onOpen, standingOf, afterRow }: {
  rows: any[];
  onOpen: (r: any) => void;
  standingOf?: (r: any) => Standing | null | undefined;
  afterRow?: (r: any) => ReactNode;
}) {
  return (
    <div className="-mx-gutter overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-callout">
        <thead>
          <tr className="border-b border-hairline">
            <th className={cn(TH_BASE, "pl-[calc(var(--gutter)+var(--control)+var(--spacing-snug))] pr-snug")}>Lines</th>
            <th className={cn(TH_BASE, "px-snug")}>L10 chart</th>
            <th className={cn(TH_BASE, "px-snug")}>Over / under</th>
            <th className={cn(TH_BASE, "px-snug")}>Hit rate</th>
            <th className={cn(TH_BASE, "px-snug")}>Ground</th>
            <th className={cn(TH_BASE, "text-right pl-snug pr-gutter")}>Model edge</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const mark = standingOf?.(r) ?? r.standing;
            const voided = mark?.state === "void";
            const edgeTone = r.edge == null ? "text-muted-foreground" : r.edge > 0 ? "text-primary" : "text-miss";
            return (
              <tr key={rowKey(r)} className={cn("border-b border-hairline last:border-b-0", !r.static && "cursor-pointer hover:bg-surface-hover")} onClick={r.static ? undefined : () => onOpen(r)}>
                <td className={TD_START}>
                  <span className="flex min-w-0 items-start gap-snug">
                    {r.team
                      ? <TeamBadge name={r.team} size="md" className="size-control shrink-0" />
                      : <span className="grid size-control shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground" aria-hidden><ChartBarIcon className="size-5" /></span>}
                    <span className="grid min-w-0 flex-1 gap-hair">
                      <span className="flex min-w-0 items-center gap-tight text-body font-emphasis leading-snug">
                        <span className="min-w-0 truncate">{r.label}</span>
                        {r.live ? <InPlayBadge /> : null}
                      </span>
                      {isToss(r) ? <TossMeta r={r} /> : !voided ? <FancyLineMeta r={r} standing={mark} /> : null}
                      {afterRow?.(r)}
                    </span>
                  </span>
                </td>
                <td className={TD_MID}>
                  {isToss(r) ? (
                    r.form?.length ? <FormChips compact results={r.form} /> : <span className="text-muted-foreground">–</span>
                  ) : voided ? (
                    <MiniBarsSlot>
                      <span className="rounded border border-dashed border-amber/60 px-hair text-caption text-amber">VOID</span>
                    </MiniBarsSlot>
                  ) : (
                    <MiniBars last={r.last || []} line={r.line} max={r.max} />
                  )}
                </td>
                <td className={cn(TD_MID, "font-condensed text-title font-emphasis tabular-nums")}>
                  {r.over != null && r.over > 1 ? <Tick quiet value={r.over}>{odds(r.over)}</Tick> : "–"}
                  {r.under != null && r.under > 1 ? <span className="ml-snug text-callout font-label text-muted-foreground">U {odds(r.under)}</span> : null}
                </td>
                <td className={TD_MID}><FancyHitRate r={r} /></td>
                <td className={TD_MID}><FancyGround r={r} /></td>
                <td className={cn(TD_END, "text-right font-condensed text-title font-emphasis tabular-nums", edgeTone)}>
                  {isToss(r) ? null : r.edge == null ? "–" : (
                    <>
                      <span>{`${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(1)}`}</span>
                      <span className="block label-cap text-caption font-label text-muted-foreground">{edgeTag(r.edge, r.side)}</span>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One fancy-line surface: compact scan below `lg`, dense research table from `lg` when `density=auto`.
 * `/fancy` CardGrid stays compact (dense needs a full page). Phone sections bleed the hairlines; `md` panels pass `inset`.
 */
export function FancyLines({
  rows, onOpen, standingOf, activeOf, subOf, afterRow, density = "auto", bleed = true, inset,
}: {
  rows: any[];
  onOpen: (r: any) => void;
  standingOf?: (r: any) => Standing | null | undefined;
  activeOf?: (r: any) => boolean;
  subOf?: (r: any) => string | undefined;
  afterRow?: (r: any) => ReactNode;
  density?: FancyLinesDensity;
  /** Page-edge bleed (`-mx-gutter` on the list). */
  bleed?: boolean;
  /** Drop row `px-gutter` (padded card). Defaults to `!bleed`. Phone full-bleed sections use `bleed={false} inset={false}` so hairlines meet the edge while copy keeps the gutter. */
  inset?: boolean;
}) {
  if (!rows.length) return null;
  const showCompact = density === "auto" || density === "compact";
  const showDense = density === "auto" || density === "dense";
  return (
    <>
      {showCompact ? (
        <div className={density === "auto" ? "lg:hidden" : undefined}>
          <CompactFancyList rows={rows} onOpen={onOpen} standingOf={standingOf} activeOf={activeOf} subOf={subOf} afterRow={afterRow} bleed={bleed} inset={inset} />
        </div>
      ) : null}
      {showDense ? (
        <div className={cn(density === "auto" ? "hidden lg:block" : undefined, !bleed && density !== "auto" && "overflow-x-auto")}>
          <DenseFancyTable rows={rows} onOpen={onOpen} standingOf={standingOf} afterRow={afterRow} />
        </div>
      ) : null}
    </>
  );
}

/** @deprecated Prefer `FancyLines` / `CompactFancyItem`. Single button for mixed Home lists. */
export function OverviewRow({ r, onOpen, active, sub, standing }: { r: any; onOpen: () => void; active?: boolean; sub?: string; standing?: Standing | null }) {
  return <CompactFancyItem r={r} onOpen={onOpen} active={active} sub={sub} standing={standing} />;
}
