/* eslint-disable @typescript-eslint/no-explicit-any */
import { useNavigate } from "react-router-dom";
import { ChartBarIcon } from "@heroicons/react/24/outline";
import { edgeTag } from "@cricket/engine/props-view.js";
import { TeamBadge } from "./badges";
import { FancyGround, FancyHitRate, FancyLineMeta } from "./fancy-lines";
import { PropBarsSlot, PropLineIdentity, PropLineMeta, PropProgress, RateCell, propLineHref } from "./hot-props";
import { InPlayBadge } from "./live-spot";
import { MiniBars, MiniBarsSlot } from "./mini-bars";
import { PlayerAvatar } from "./portrait";
import { Tick } from "./tick";
import { odds, shortVenue } from "@/lib/format";
import { cn } from "@/lib/utils";

const TH = "h-auto py-tight text-left label-cap text-footnote font-label text-muted-foreground whitespace-nowrap";
const TD_START = "py-snug pl-gutter pr-snug";
const TD_MID = "px-snug py-snug";
const TD_END = "py-snug pl-snug pr-gutter";

export type HomeMixItem =
  | { kind: "player"; key: string; r: any }
  | { kind: "fancy"; key: string; r: any; f: any };

/**
 * Home desktop: one dense research table with props + fancy interleaved (same Top-N order as the compact mix).
 * Shared columns (Lines · L10 · O/U · Hit rate · Ground · Edge) — not two PropLines/FancyLines tables.
 */
export function HomeMixDenseTable({
  items, soFarOf, outOf, onOpenFancy,
}: {
  items: HomeMixItem[];
  soFarOf: (r: any) => any;
  outOf: (r: any) => boolean;
  onOpenFancy: (item: Extract<HomeMixItem, { kind: "fancy" }>) => void;
}) {
  const nav = useNavigate();
  if (!items.length) return null;
  return (
    <div className="-mx-gutter overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-callout">
        <thead>
          <tr className="border-b border-hairline">
            <th className={cn(TH, "pl-[calc(var(--gutter)+var(--control)+var(--spacing-snug))] pr-snug")}>Lines</th>
            <th className={cn(TH, "px-snug")}>L10 chart</th>
            <th className={cn(TH, "px-snug")}>Over / under</th>
            <th className={cn(TH, "px-snug")}>Hit rate</th>
            <th className={cn(TH, "px-snug")}>Ground</th>
            <th className={cn(TH, "text-right pl-snug pr-gutter")}>Model edge</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => item.kind === "player"
            ? <PlayerDenseRow key={item.key} r={item.r} soFar={soFarOf(item.r)} out={outOf(item.r)} onOpen={() => nav(propLineHref(item.r))} />
            : <FancyDenseRow key={item.key} r={item.r} onOpen={() => onOpenFancy(item)} />)}
        </tbody>
      </table>
    </div>
  );
}

function PlayerDenseRow({ r, soFar, out, onOpen }: { r: any; soFar: any; out: boolean; onOpen: () => void }) {
  const ground = shortVenue(r.venue);
  const edgeTone = out || r.edge == null ? "text-muted-foreground" : r.edge > 0 ? "text-primary" : "text-miss";
  return (
    <tr className="cursor-pointer border-b border-hairline last:border-b-0 hover:bg-surface-hover" onClick={onOpen}>
      <td className={TD_START}>
        <span className="flex min-w-0 items-start gap-snug">
          <PlayerAvatar idx={r.idx} team={r.team} test={r.fmt === "Test"} className="size-control shrink-0" />
          <span className="grid min-w-0 flex-1 gap-hair">
            <PropLineIdentity r={r} out={out} linkClass="hover:underline focus-visible:underline" onNameClick={(e) => e.stopPropagation()} />
            <PropLineMeta r={r} soFar={soFar} out={out} />
            <PropProgress r={r} soFar={soFar} out={out} />
          </span>
        </span>
      </td>
      <td className={TD_MID}><PropBarsSlot r={r} soFar={soFar} out={out} /></td>
      <td className={cn(TD_MID, "font-condensed text-title font-emphasis tabular-nums")}>
        {out ? "–" : (
          <>
            <Tick quiet value={r.over}>{odds(r.over)}</Tick>
            {r.under > 1 ? <span className="ml-snug text-callout font-label text-muted-foreground">U {odds(r.under)}</span> : null}
          </>
        )}
      </td>
      <td className={TD_MID}><RateCell p={r.l10?.p ?? null} n={r.l10?.played} /></td>
      <td className={TD_MID} title={r.venue}>
        <span className="grid min-w-0 gap-hair">
          <RateCell p={r.ven?.p ?? null} n={r.ven?.played} />
          {ground ? <span className="truncate text-caption text-muted-foreground">{ground}</span> : null}
        </span>
      </td>
      <td className={cn(TD_END, "text-right font-condensed text-title font-emphasis tabular-nums", edgeTone)}>
        {out || r.edge == null ? "–" : (
          <>
            <span>{`${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(1)}`}</span>
            <span className="block label-cap text-caption font-label text-muted-foreground">{edgeTag(r.edge, r.side)}</span>
          </>
        )}
      </td>
    </tr>
  );
}

function FancyDenseRow({ r, onOpen }: { r: any; onOpen: () => void }) {
  const mark = r.standing;
  const voided = mark?.state === "void";
  const edgeTone = r.edge == null ? "text-muted-foreground" : r.edge > 0 ? "text-primary" : "text-miss";
  return (
    <tr className="cursor-pointer border-b border-hairline last:border-b-0 hover:bg-surface-hover" onClick={onOpen}>
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
            {!voided ? <FancyLineMeta r={r} standing={mark} /> : null}
          </span>
        </span>
      </td>
      <td className={TD_MID}>
        {voided ? (
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
        {r.edge == null ? "–" : (
          <>
            <span>{`${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(1)}`}</span>
            <span className="block label-cap text-caption font-label text-muted-foreground">{edgeTag(r.edge, r.side)}</span>
          </>
        )}
      </td>
    </tr>
  );
}
