/**
 * Catalogue: PropLines + FancyLines densities. Chrome follows the viewport (`auto`:
 * compact below lg, dense from lg) — never the page route.
 */
import { ChartBarIcon, ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { MiniBars } from "@/components/app/mini-bars";
import { LiveMarketRow } from "@/components/app/live-markets";
import { InPlayBadge } from "@/components/app/live-spot";
import { ResultStamp } from "@/components/app/result-stamp";
import { TeamFlag } from "@/components/app/badges";
import { PreviewFrame } from "@/components/design-system/example-stage";
import { cn } from "@/lib/utils";

const LINE = 24.5;
const PRICE = 1.9;
const EDGE = 0.12;
const LAST = [
  { v: 31, s: "hit" }, { v: 12, s: "miss" }, { v: 28, s: "hit" }, { v: null, s: "dnp" },
  { v: 19, s: "miss" }, { v: 41, s: "hit" }, { v: 24.5, s: "push" }, { v: 33, s: "hit" },
  { v: 8, s: "miss" }, { v: 27, s: "hit" },
];
function Face({ label }: { label: string }) {
  return (
    <span className="grid size-control shrink-0 place-items-center rounded-full bg-secondary text-caption font-emphasis text-muted-foreground" aria-hidden>
      {label}
    </span>
  );
}

function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[375px] overflow-hidden rounded-xl border border-hairline bg-background shadow-sm">
      <ul>{children}</ul>
    </div>
  );
}

function EdgeCol({ edge, side }: { edge: number; side: "Over" | "Under" }) {
  return (
    <>
      <span className="sr-only">{side}</span>
      {/* Same fixed ScanEdge track as product rows */}
      <span className="grid w-11 shrink-0 justify-items-center gap-hair px-tight">
        <span className="label-cap text-caption text-muted-foreground">Edge</span>
        <span className={cn("font-condensed text-title font-emphasis leading-none tabular-nums", edge > 0 ? "text-primary" : edge < 0 ? "text-miss" : "text-muted-foreground")}>
          {edge > 0 ? "+" : ""}{(edge * 100).toFixed(0)}
        </span>
      </span>
    </>
  );
}

/** PropLines compact: avatar · name · one O/U side · Edge · MiniBars. */
function CompactPropDemo({ inPlay = false, stamp }: { inPlay?: boolean; stamp?: "Hit" | "Miss" }) {
  return (
    <li className="border-t border-hairline first:border-t-0">
      <div className="grid min-h-row w-full grid-cols-[var(--control)_minmax(0,1fr)_auto_auto] items-center gap-snug px-gutter py-snug">
        <Face label="VK" />
        <span className="grid min-w-0 gap-hair">
          <span className="flex min-w-0 items-center gap-tight text-body font-emphasis leading-snug">
            <span className="truncate">V Kohli</span>
            <TeamFlag name="India" />
            {inPlay ? <InPlayBadge /> : null}
          </span>
          <span className="flex min-w-0 items-center gap-x-tight text-callout font-sans font-emphasis leading-snug text-foreground">
            <span className="text-primary">O</span>
            <span className="tabular-nums">{LINE}</span>
            <span className="min-w-0 truncate">Runs</span>
            <span className="font-condensed tabular-nums text-muted-foreground">{PRICE.toFixed(2)}</span>
            {stamp ? <ResultStamp kind={stamp} /> : null}
          </span>
        </span>
        <EdgeCol edge={EDGE} side="Over" />
        <MiniBars last={LAST} line={LINE} />
      </div>
    </li>
  );
}

function ScanFancyRow({ inPlay = false, stamp }: { inPlay?: boolean; stamp?: "Hit" | "Miss" }) {
  return (
    <li className="border-t border-hairline first:border-t-0">
      <div className="grid min-h-row w-full grid-cols-[var(--control)_minmax(0,1fr)_auto_auto] items-center gap-snug px-gutter py-snug">
        <span className="grid size-control place-items-center rounded-full bg-secondary text-muted-foreground" aria-hidden>
          <ChartBarIcon className="size-5" />
        </span>
        <span className="grid min-w-0 gap-hair">
          <span className="flex min-w-0 items-center gap-tight text-body font-emphasis leading-snug">
            <span className="truncate">Match sixes</span>
            {inPlay ? <InPlayBadge /> : null}
          </span>
          <span className="flex min-w-0 items-center gap-x-tight text-callout font-sans font-emphasis leading-snug text-foreground">
            <span className="text-primary">O</span>
            <span className="tabular-nums">12.5</span>
            <span className="font-condensed tabular-nums text-muted-foreground">1.85</span>
            {stamp ? <ResultStamp kind={stamp} /> : null}
          </span>
        </span>
        <EdgeCol edge={0.08} side="Over" />
        <MiniBars last={LAST.map((x) => ({ ...x, v: x.v == null ? null : Math.round((x.v / 24.5) * 12) }))} line={12.5} />
      </div>
    </li>
  );
}

function DenseHead({ label }: { label: string }) {
  return (
    <th className="px-snug py-tight text-left label-cap text-footnote text-muted-foreground whitespace-nowrap">
      <span className="inline-flex items-center gap-hair">{label}<ChevronUpDownIcon className="size-3 opacity-40" aria-hidden /></span>
    </th>
  );
}

/** PropLines dense: identity + books + L10 + season/H2H/ground + model edge. */
function DensePropDemo() {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-hairline bg-background shadow-sm">
      <table className="w-full min-w-[44rem] text-callout">
        <thead>
          <tr className="border-b border-hairline">
            <th className="px-snug py-tight pl-[calc(var(--control)+var(--spacing-snug)*2)] text-left label-cap text-footnote text-muted-foreground">Lines</th>
            <DenseHead label="L10 chart" />
            <th className="px-snug py-tight text-left label-cap text-footnote text-muted-foreground">Over / under</th>
            <DenseHead label="2026" />
            <DenseHead label="H2H" />
            <DenseHead label="Ground" />
            <th className="px-snug py-tight text-right label-cap text-footnote text-muted-foreground">Model edge</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-hairline">
            <td className="px-snug py-snug">
              <span className="flex items-center gap-snug">
                <Face label="VK" />
                <span className="grid min-w-0 gap-hair">
                  <span className="flex min-w-0 items-center gap-tight text-body font-emphasis leading-snug">
                    <span className="truncate">V Kohli</span>
                    <TeamFlag name="India" />
                  </span>
                  <span className="min-w-0 text-callout font-sans font-emphasis text-foreground">
                    <span className="text-primary">O</span>
                    {" "}
                    <span className="tabular-nums">{LINE}</span>
                    {" "}
                    Runs
                    {" "}
                    <span className="font-condensed tabular-nums text-muted-foreground">{PRICE.toFixed(2)}</span>
                  </span>
                </span>
              </span>
            </td>
            <td className="px-snug py-snug"><MiniBars last={LAST} line={LINE} /></td>
            <td className="px-snug py-snug font-condensed text-title font-emphasis tabular-nums">{PRICE.toFixed(2)}<span className="ml-snug text-callout font-label text-muted-foreground">U 1.95</span></td>
            <td className="px-snug py-snug font-condensed text-body font-label tabular-nums text-primary">72%</td>
            <td className="px-snug py-snug font-condensed text-body font-label tabular-nums">50%</td>
            <td className="px-snug py-snug"><span className="grid gap-hair"><span className="font-condensed text-body font-label tabular-nums text-miss">40%</span><span className="truncate text-caption text-muted-foreground">Wankhede</span></span></td>
            <td className="px-snug py-snug text-right font-condensed text-title font-emphasis tabular-nums text-primary">+12.0<span className="block label-cap text-caption font-label text-muted-foreground">Lean over</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DenseFancyDemo() {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-hairline bg-background shadow-sm">
      <table className="w-full min-w-[40rem] text-callout">
        <thead>
          <tr className="border-b border-hairline">
            <th className="px-snug py-tight pl-[calc(var(--control)+var(--spacing-snug)*2)] text-left label-cap text-footnote text-muted-foreground">Lines</th>
            <th className="px-snug py-tight text-left label-cap text-footnote text-muted-foreground">L10 chart</th>
            <th className="px-snug py-tight text-left label-cap text-footnote text-muted-foreground">Over / under</th>
            <th className="px-snug py-tight text-left label-cap text-footnote text-muted-foreground">Hit rate</th>
            <th className="px-snug py-tight text-left label-cap text-footnote text-muted-foreground">Ground</th>
            <th className="px-snug py-tight text-right label-cap text-footnote text-muted-foreground">Model edge</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-hairline">
            <td className="px-snug py-snug">
              <span className="flex items-start gap-snug">
                <span className="grid size-control place-items-center rounded-full bg-secondary text-muted-foreground" aria-hidden>
                  <ChartBarIcon className="size-5" />
                </span>
                <span className="grid min-w-0 gap-hair">
                  <span className="truncate text-body font-emphasis leading-snug">Match sixes</span>
                  <span className="min-w-0 text-callout font-sans font-emphasis text-foreground">
                    <span className="text-primary">O</span>{" "}
                    <span className="tabular-nums">12.5</span>{" "}
                    <span className="font-condensed tabular-nums text-muted-foreground">1.85</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-tight gap-y-hair text-callout tabular-nums text-muted-foreground">
                    <span className="inline-flex items-center gap-hair font-condensed">
                      <span>O</span>
                      <span className="text-body font-emphasis text-foreground">1.85</span>
                    </span>
                    <span className="inline-flex items-center gap-hair font-condensed">
                      <span>U</span>
                      <span className="text-body font-emphasis text-foreground">1.95</span>
                    </span>
                  </span>
                </span>
              </span>
            </td>
            <td className="px-snug py-snug"><MiniBars last={LAST.map((x) => ({ ...x, v: x.v == null ? null : Math.round((x.v / 24.5) * 12) }))} line={12.5} /></td>
            <td className="px-snug py-snug font-condensed text-title font-emphasis tabular-nums">1.85<span className="ml-snug text-callout font-label text-muted-foreground">U 1.95</span></td>
            <td className="px-snug py-snug font-condensed text-body font-label tabular-nums text-primary">60%<span className="font-copy text-muted-foreground"> · 10</span></td>
            <td className="px-snug py-snug"><span className="truncate text-caption text-muted-foreground">Ground · Under (5)</span></td>
            <td className="px-snug py-snug text-right font-condensed text-title font-emphasis tabular-nums text-primary">+8.0<span className="block label-cap text-caption font-label text-muted-foreground">Over</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** PropLines + FancyLines compact vs dense for the design host. */
export function RowDensityDemos() {
  return (
    <>
      <PreviewFrame
        title="Compact — below lg"
        description="Breakpoint rule (`density=auto`): scan row on every web page below lg, and the app twin. Shared SCAN_ROW_GRID + ScanEdge + MiniBars."
        canvasClassName="items-stretch justify-start bg-background"
        source="PropLines · FancyLines density=auto"
      >
        <div className="grid w-full justify-items-center gap-stack">
          <div className="grid w-full max-w-[375px] gap-tight">
            <span className="label-cap text-caption text-muted-foreground">Player prop</span>
            <PhoneShell>
              <CompactPropDemo />
              <CompactPropDemo />
            </PhoneShell>
          </div>
          <div className="grid w-full max-w-[375px] gap-tight">
            <span className="label-cap text-caption text-muted-foreground">Fancy</span>
            <PhoneShell>
              <ScanFancyRow />
            </PhoneShell>
          </div>
        </div>
      </PreviewFrame>
      <PreviewFrame
        title="Dense — lg+"
        description="Dense `auto` from lg on fixture Match Fancy and /props. `/fancy` CardGrid stays compact (cards cannot hold the research table). Home from lg uses one interleaved dense mix table. Prop fixture: season/H2H/ground. Fancy: hit rate + ground."
        canvasClassName="items-stretch justify-start bg-background"
        source="PropLines · FancyLines density=auto"
      >
        <div className="grid w-full gap-stack">
          <div className="grid gap-tight">
            <span className="label-cap text-caption text-muted-foreground">PropLines</span>
            <DensePropDemo />
          </div>
          <div className="grid gap-tight">
            <span className="label-cap text-caption text-muted-foreground">FancyLines</span>
            <DenseFancyDemo />
          </div>
        </div>
      </PreviewFrame>
      <PreviewFrame
        title="Settled — compact"
        description="Edge stays; a Hit/Miss stamp sits beside the odds once the pre-match line has a verdict."
        canvasClassName="items-stretch justify-start bg-background"
        source="PropLines · FancyLines density=compact"
      >
        <div className="grid w-full justify-items-center gap-stack">
          <div className="grid w-full max-w-[375px] gap-tight">
            <span className="label-cap text-caption text-muted-foreground">Player prop</span>
            <PhoneShell>
              <CompactPropDemo inPlay stamp="Hit" />
              <CompactPropDemo stamp="Miss" />
            </PhoneShell>
          </div>
          <div className="grid w-full max-w-[375px] gap-tight">
            <span className="label-cap text-caption text-muted-foreground">Fancy</span>
            <PhoneShell>
              <ScanFancyRow inPlay stamp="Hit" />
              <ScanFancyRow stamp="Miss" />
            </PhoneShell>
          </div>
        </div>
      </PreviewFrame>
      <PreviewFrame
        title="In Play Market — liveRows"
        description="Match Fancy in-play-only markets reuse CompactFancyItem with `live`. `scoreLiveOuRow` fills Edge + L10 from the overs tape (same as scored fancy). Demo shows a scored row."
        canvasClassName="items-stretch justify-start bg-background"
        source="live-markets.tsx · scoreLiveOuRow"
      >
        <div className="grid w-full justify-items-center gap-tight">
          <PhoneShell>
            <li className="border-t border-hairline first:border-t-0">
              <LiveMarketRow
                m={{ kind: "ou", market: "Runs in First 50 Overs", line: 181.5, over: 1.83, under: 1.83 }}
                scored={{
                  label: "50 overs", live: true, line: 181.5, over: 1.83, under: 1.83, side: "over",
                  edge: 0.09, last: LAST.map((x) => ({ ...x, v: x.v == null ? null : Math.round((x.v / 24.5) * 180) })),
                }}
              />
            </li>
            <li className="border-t border-hairline">
              <LiveMarketRow
                m={{ kind: "ou", market: "Bangladesh Overs 0-50 Runs 1st innings", line: 178.5, over: 2.0, under: 1.8 }}
                scored={{
                  label: "BAN · 50 overs", live: true, line: 178.5, over: 2.0, under: 1.8, side: "under", innScope: "1st INN",
                  edge: 0.05, last: LAST.map((x) => ({ ...x, v: x.v == null ? null : Math.round((x.v / 24.5) * 175) })),
                }}
              />
            </li>
          </PhoneShell>
        </div>
      </PreviewFrame>
    </>
  );
}
