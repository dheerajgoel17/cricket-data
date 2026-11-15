/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { TableCellsIcon } from "@heroicons/react/24/outline";
import { ballsToOvers, formatBall, liveBoard, liveCard, namesMatch, ongoingOverBalls, oversToBalls } from "@cricket/engine/live.js";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PillGroup } from "@/components/app/pill-group";
import { TABLE_BLEED, TABLE_HEAD } from "@/components/app/page";
import { abbr } from "@/lib/format";
import { useData } from "@/lib/data";
import { cn } from "@/lib/utils";

type Side = [string, number];

/** Initial + surname for the live strip ("D Warner"); particles kept ("V Kohli" stays short). */
function shortName(n: string) {
  const p = String(n).trim().split(/\s+/);
  if (p.length < 2) return n;
  const last = p[p.length - 1], particle = p[p.length - 2];
  const head = p[0][0]?.toUpperCase() || "";
  if (/^(de|den|van|von|el|al|la|le|da|di)$/i.test(particle)) return `${head} ${particle} ${last}`;
  return `${head} ${last}`;
}

function usePlayerIdx(name: string, team?: string, sides?: Side[]) {
  const { rz } = useData();
  const teamIdx = sides?.find(([n]) => n === team)?.[1];
  return useMemo(() => {
    const hits = rz.players(name, teamIdx != null && teamIdx >= 0 ? { team: teamIdx } : {}, 2) as { idx: number; score: number }[];
    return hits.length && hits[0].score >= 8 ? hits[0].idx : null; // the resolver's own bar for "this is the player"; a debutant or unknown name stays plain text
  }, [rz, name, teamIdx]);
}

function Who({ name, team, sides, strike, short, className }: { name: string; team?: string; sides?: Side[]; strike?: boolean; short?: boolean; className?: string }) {
  const idx = usePlayerIdx(name, team, sides);
  const text = short ? shortName(name) : name;
  const label = <>{text}{strike ? <span className="text-primary">*</span> : null}</>;
  const cls = cn("truncate font-label", strike && "text-primary", className);
  return idx != null ? <Link to={`/player/${idx}`} className={cn(cls, "underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-primary active:opacity-70")}>{label}</Link> : <span className={cls}>{label}</span>;
}

function ov(p: any) {
  const n = ballsToOvers(p?.ballsBowled);
  if (n == null) return null;
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

function ballTone(b: string) {
  const s = formatBall(b);
  if (/^W$/i.test(s)) return "wicket";
  if (/^[456]$/.test(s)) return "boundary";
  if (/\d*(WD|NB|LB|B|PEN)$/i.test(s)) return "extra";
  return "plain";
}

function Ball({ b }: { b: string }) {
  const label = formatBall(b);
  const long = label.length > 1;
  const tone = ballTone(label);
  return (
    <span
      className={cn(
        "grid h-6 shrink-0 place-items-center text-caption font-emphasis tabular-nums whitespace-nowrap",
        long ? "min-w-6 rounded-full px-snug" : "size-6 rounded-full",
        tone === "wicket" && "bg-miss/25 text-miss",
        tone === "boundary" && "bg-foreground text-background",
        tone === "extra" && "bg-muted text-foreground",
        tone === "plain" && "bg-secondary text-foreground",
      )}
    >
      {label}
    </span>
  );
}

/** "Ball by ball" fixed on the left; overs scroll beside it (oldest left → current on the right). Left fade sits between the label and the tape so earlier overs stay obvious. */
function Overs({ overs }: { overs: { n?: number | null; balls: string[] }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fadeLeft, setFadeLeft] = useState(false);
  const groups = (overs || []).filter((o) => o.balls.length);
  const sig = groups.map((o) => `${o.n ?? ""}:${o.balls.join(",")}`).join("|");
  const syncFade = () => {
    const el = ref.current;
    if (!el) return;
    setFadeLeft(el.scrollLeft > 2);
  };
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
    syncFade();
  }, [sig]);
  if (!groups.length) return null;
  return (
    <div className="flex min-w-0 items-center gap-snug" aria-label={`Ball by ball: ${groups.map((o) => `${o.n != null ? `over ${o.n} ` : ""}${o.balls.join(" ")}`).join(", ")}. Scroll left for earlier overs.`}>
      <span className="label-cap shrink-0 text-footnote text-muted-foreground">Ball by ball</span>
      <div className="relative min-w-0 flex-1">
        {fadeLeft ? <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent" /> : null}
        <div
          ref={ref}
          onScroll={syncFade}
          className="flex flex-nowrap items-center gap-snug overflow-x-auto overscroll-x-contain [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden"
        >
          {groups.map((o, i) => (
            <span key={o.n ?? i} className="flex shrink-0 items-center gap-snug">
              {i > 0 && <span role="separator" aria-hidden className="h-5 w-px shrink-0 bg-muted-foreground/40" />}
              <span className="shrink-0 text-callout font-label tabular-nums text-muted-foreground" title={o.n != null ? `Over ${o.n}` : undefined}>{o.n != null ? o.n : "·"}</span>
              <span className="flex flex-nowrap items-center gap-hair">
                {o.balls.map((b, j) => <Ball key={`${b}-${j}`} b={b} />)}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function innScore(inn: any) {
  if (inn?.runs == null) return "";
  const w = inn.wkts != null ? `/${inn.wkts}` : "";
  const o = inn.overs != null ? ` ${Number.isInteger(inn.overs) ? inn.overs.toFixed(1) : inn.overs} ov` : "";
  return `${inn.runs}${w}${o}`;
}

function extrasText(e: any) {
  if (!e) return "";
  const bits = ([["b", e.byes], ["lb", e.legByes], ["w", e.wides], ["nb", e.noBalls], ["pen", e.penalty]] as [string, number][]).filter(([, v]) => v);
  return `${e.total ?? 0}${bits.length ? ` (${bits.map(([k, v]) => `${k} ${v}`).join(", ")})` : ""}`;
}

function fmtOv(o: number | null | undefined) {
  if (o == null) return "—";
  return Number.isInteger(o) ? o.toFixed(1) : String(o);
}

function Num({ children, className, edge }: { children: ReactNode; className?: string; edge?: boolean }) {
  return <td className={cn("px-snug py-snug text-right text-footnote tabular-nums", edge && "pr-gutter", className)}>{children}</td>;
}

function Th({ children, edge, end }: { children: ReactNode; edge?: "start" | "end"; end?: boolean }) {
  return (
    <th className={cn(TABLE_HEAD, end && "text-right", edge === "start" && "pl-gutter", edge === "end" && "pr-gutter")}>
      {children}
    </th>
  );
}

/** Is there a scorecard to show (a batter, a bowler or a total on any innings)? */
export const hasCard = (match: any) => cardInns(match).length > 0;

function cardInns(match: any) {
  return liveCard(match).filter((inn: any) => (inn.batters || []).length || (inn.bowlers || []).length || inn.runs != null);
}

const ORD = ["1st", "2nd", "3rd", "4th"];
const innId = (i: any) => `${i.n}-${i.team}`;

/** "NZ" for a one-innings-a-side match, "NZ 2nd" once a side has batted twice (Tests). */
export function innLabel(card: any[], k: number) {
  const team = card[k].team, nth = card.slice(0, k + 1).filter((i) => i.team === team).length;
  return card.some((i, j) => j !== k && i.team === team) ? `${abbr(team)} ${ORD[nth - 1] ?? `${nth}th`}` : abbr(team);
}

/**
 * Full scorecard: team/innings categories (MarketTape-style segmented tabs) → batting (edge-bleed) → FOW / yet to bat → bowling.
 * No partnership / last-wkt / CRR strip here — that stays on the live strip above. So-far only, never settlement.
 */
export function ScorecardBody({ match, teams }: { match: any; teams?: Side[] }) {
  const [pick, setPick] = useState<string>();
  const card = cardInns(match);
  if (!card.length) return null;
  const at = pick && card.some((i: any) => innId(i) === pick) ? card.findIndex((i: any) => innId(i) === pick) : card.length - 1;
  const inn = card[at];
  const balls = inn.overs != null ? oversToBalls(inn.overs) : null;
  const rr = inn.runs != null && balls ? (inn.runs / (balls / 6)).toFixed(2) : null;
  const onStrike = (name: string) => (match?.players || []).some((p: any) => p.strike && namesMatch(p.name, name));
  const yet = (inn.yetToBat || []).filter((n: string) => n && !/^[A-Z0-9]{1,4}$/.test(n));
  const multi = card.length > 1;
  const tabs: [string, ReactNode][] = card.map((i: any, j: number) => {
    const score = innScore(i) || "—";
    return [innId(i), <span key={innId(i)} className="min-w-0 truncate">{innLabel(card, j)} · {score}</span>];
  });
  return (
    <div className="flex flex-col gap-stack">
      {multi ? (
        <PillGroup
          segmented
          layoutId="scorecard-side"
          label="Innings"
          value={innId(inn)}
          onChange={setPick}
          items={tabs}
          className="w-full"
          itemClassName="min-w-0 flex-1 justify-center"
        />
      ) : (
        <div className="flex items-baseline justify-between gap-snug">
          <h3 className="min-w-0 truncate text-body font-emphasis">{inn.team || `Innings ${inn.n}`}</h3>
          <span className="shrink-0 font-condensed text-title font-emphasis tabular-nums">
            {innScore(inn) || "—"}
            {rr ? <span className="ml-snug text-footnote font-label text-muted-foreground">RR {rr}</span> : null}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-snug">
        {multi && rr ? (
          <p className="text-footnote text-muted-foreground tabular-nums">RR {rr}</p>
        ) : null}

        {!!inn.batters?.length && (
          <div className={cn(TABLE_BLEED, "overflow-x-auto")}>
            <table className="w-full border-collapse text-footnote">
              <thead>
                <tr className="hover:bg-transparent">
                  <Th edge="start">Batter</Th>
                  <Th end>R</Th>
                  <Th end>B</Th>
                  <Th end>4s</Th>
                  <Th end>6s</Th>
                  <Th end edge="end">SR</Th>
                </tr>
              </thead>
              <tbody>
                {inn.batters.map((p: any) => (
                  <tr key={p.id || p.name} className="min-h-row border-t border-hairline">
                    <td className="py-snug pl-gutter pr-snug">
                      <div className="min-w-0">
                        <Who name={p.name} team={p.team || inn.team} sides={teams} strike={onStrike(p.name)} className="text-callout font-label" />
                        <div className="text-footnote text-muted-foreground">{p.dismissal || (p.out ? "out" : "not out")}</div>
                      </div>
                    </td>
                    <Num className="font-label text-foreground">{p.runs ?? 0}</Num>
                    <Num>{p.balls ?? 0}</Num>
                    <Num>{p.fours ?? 0}</Num>
                    <Num>{p.sixes ?? 0}</Num>
                    <Num edge>{p.sr != null ? Number(p.sr).toFixed(2) : "—"}</Num>
                  </tr>
                ))}
                {inn.extras && (
                  <tr className="border-t border-hairline text-muted-foreground">
                    <td className="py-snug pl-gutter pr-snug">Extras</td>
                    <Num className="font-label text-foreground">{inn.extras.total}</Num>
                    <td colSpan={4} className="px-snug py-snug pr-gutter text-footnote">{extrasText(inn.extras).replace(/^\d+\s*/, "")}</td>
                  </tr>
                )}
                {inn.runs != null && (
                  <tr className="border-t border-hairline">
                    <td className="py-snug pl-gutter pr-snug font-label">Total</td>
                    <Num className="font-label text-foreground">{inn.runs}</Num>
                    <td colSpan={4} className="px-snug py-snug pr-gutter text-footnote text-muted-foreground">
                      {inn.wkts != null ? `${inn.wkts} wkts` : ""}{inn.overs != null ? ` · ${fmtOv(inn.overs)} ov` : ""}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {(!!inn.fow?.length || !!yet.length) && (
          <div className="flex flex-col gap-tight text-footnote text-muted-foreground">
            {!!inn.fow?.length && (
              <p>
                <span className="font-label text-foreground">FOW</span>{" "}
                {inn.fow.map((w: any, k: number) => (
                  <Fragment key={`${w.wkts}-${w.name}`}>
                    {k > 0 && " · "}
                    {w.wkts}–{w.runs} (<Who name={w.name} team={inn.team} sides={teams} className="font-copy" />
                    {w.balls != null ? `, ${fmtOv(ballsToOvers(w.balls))}` : ""})
                  </Fragment>
                ))}
              </p>
            )}
            {!!yet.length && (
              <p>
                <span className="font-label text-foreground">Yet to bat</span>{" "}
                {yet.map((n: string, k: number) => (
                  <Fragment key={n}>{k > 0 && ", "}<Who name={n} team={inn.team} sides={teams} className="font-copy" /></Fragment>
                ))}
              </p>
            )}
          </div>
        )}

        {!!inn.bowlers?.length && (
          <div className="flex flex-col gap-tight">
            <h4 className="label-cap text-footnote text-muted-foreground">Bowling</h4>
            <div className={cn(TABLE_BLEED, "overflow-x-auto")}>
              <table className="w-full border-collapse text-footnote">
                <thead>
                  <tr className="hover:bg-transparent">
                    <Th edge="start">Bowler</Th>
                    <Th end>O</Th>
                    <Th end>M</Th>
                    <Th end>R</Th>
                    <Th end>W</Th>
                    <Th end edge="end">Econ</Th>
                  </tr>
                </thead>
                <tbody>
                  {inn.bowlers.map((p: any) => (
                    <tr key={p.id || p.name} className="min-h-row border-t border-hairline">
                      <td className="py-snug pl-gutter pr-snug">
                        <Who name={p.name} team={p.team} sides={teams} className="text-callout font-label" />
                      </td>
                      <Num>{fmtOv(p.overs)}</Num>
                      <Num>{p.maidens ?? 0}</Num>
                      <Num>{p.conceded ?? 0}</Num>
                      <Num className="font-label text-foreground">{p.wickets ?? 0}</Num>
                      <Num edge>{p.econ != null ? Number(p.econ).toFixed(2) : "—"}</Num>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <p className="text-footnote text-muted-foreground">So far this match. Not used for settlement.</p>
    </div>
  );
}

/** Current players and deliveries under the fixture scoreboard (bowler + balls | batters). */
export function LiveBoard({ match, teams }: { match: any; teams?: Side[] }) {
  const board = liveBoard(match);
  if (!board || (!board.batters.length && !board.bowler && !board.overs.length)) return null;
  const bw = board.bowler;
  const balls = ongoingOverBalls(board);
  const batters = (board.batters || []).slice(0, 2);
  return (
    <section aria-label="Live scoreboard" className="grid grid-cols-2 gap-snug border-t border-hairline bg-secondary/40 px-gutter py-snug">
      <div className="grid min-w-0 content-start gap-tight border-r border-hairline pr-snug">
        {bw ? (
          <div className="flex min-w-0 items-baseline justify-between gap-snug">
            <Who name={bw.name} team={bw.team} sides={teams} short className="min-w-0 truncate text-callout" />
            <span className="shrink-0 font-condensed text-callout font-emphasis tabular-nums text-muted-foreground">
              {[ov(bw) ?? "–", bw.conceded ?? 0, bw.wickets ?? 0].join("-")}
            </span>
          </div>
        ) : (
          <span className="text-footnote text-muted-foreground">—</span>
        )}
        {balls.length ? (
          <div className="flex flex-wrap items-center gap-hair" aria-label={`This over ${balls.join(" ")}`}>
            {balls.map((b: string, i: number) => <Ball key={`${b}-${i}`} b={b} />)}
          </div>
        ) : !!board.overs.length ? (
          <Overs overs={board.overs} />
        ) : null}
      </div>
      <div className="grid min-w-0 content-start gap-tight pl-snug">
        {batters.length ? batters.map((p: any) => (
          <div key={p.name} className="flex min-w-0 items-baseline justify-between gap-snug">
            <span className="flex min-w-0 items-center gap-hair">
              <span className={cn("size-1.5 shrink-0 rounded-full", p.strike ? "bg-foreground" : "bg-transparent")} aria-hidden />
              <Who name={p.name} team={p.team} sides={teams} short className="min-w-0 truncate text-callout" />
            </span>
            <span className="shrink-0 font-condensed text-callout tabular-nums">
              <b className="font-emphasis text-foreground">{p.runs ?? 0}</b>
              {" "}
              <span className="text-muted-foreground">{p.balls ?? 0}</span>
            </span>
          </div>
        )) : (
          <span className="text-footnote text-muted-foreground">—</span>
        )}
      </div>
    </section>
  );
}

export function ScorecardAccordion({ match, teams }: { match: any; teams?: Side[]; inPlay?: boolean }) {
  const [section, setSection] = useState("");
  return (
    <Accordion type="single" collapsible value={section} onValueChange={setSection} className="min-w-0 border-t border-hairline">
      <AccordionItem value="scorecard" className="border-0">
        <AccordionTrigger className="min-h-control gap-snug rounded-none bg-background/60 px-gutter py-tight text-callout hover:bg-surface-hover hover:no-underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&>svg]:motion-reduce:transition-none">
          <span className="flex min-w-0 items-center gap-snug">
            <TableCellsIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            {section ? "Hide scorecard" : "Full scorecard"}
          </span>
        </AccordionTrigger>
        {/* Gutter on the shell so TABLE_BLEED can pull batting/bowling to the card edges. */}
        <AccordionContent className="flex flex-col gap-0 border-t border-dashed border-hairline px-gutter py-snug">
          <ScorecardBody match={match} teams={teams} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
