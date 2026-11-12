/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { TableCellsIcon } from "@heroicons/react/24/outline";
import { ballsToOvers, liveBoard, liveCard, namesMatch, oversToBalls } from "@cricket/engine/live.js";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { PillGroup } from "@/components/app/pill-group";
import { abbr } from "@/lib/format";
import { playerPhotos } from "@/lib/assets";
import { useData } from "@/lib/data";
import { cn } from "@/lib/utils";

type Side = [string, number];

function shortName(n: string) {
  const p = String(n).trim().split(/\s+/);
  if (p.length < 2) return n;
  const last = p[p.length - 1], particle = p[p.length - 2];
  return /^(de|den|van|von|el|al|la|le|da|di)$/i.test(particle) ? `${particle} ${last}` : last;
}

function usePlayerIdx(name: string, team?: string, sides?: Side[]) {
  const { rz } = useData();
  const teamIdx = sides?.find(([n]) => n === team)?.[1];
  return useMemo(() => {
    const hits = rz.players(name, teamIdx != null && teamIdx >= 0 ? { team: teamIdx } : {}, 2) as { idx: number; score: number }[];
    return hits.length && hits[0].score >= 8 ? hits[0].idx : null; // the resolver's own bar for "this is the player"; a debutant or unknown name stays plain text
  }, [rz, name, teamIdx]);
}

const Silhouette = () => <svg viewBox="0 0 40 40" aria-hidden className="size-3/4 fill-current text-muted-foreground/50"><circle cx="20" cy="15" r="7" /><path d="M5 40c1-9 7-14 15-14s14 5 15 14z" /></svg>;

/** Photo only, no frame; a silhouette if every URL fails. */
function Face({ name, photo, team, sides }: { name: string; photo?: string; team?: string; sides?: Side[] }) {
  const idx = usePlayerIdx(name, team, sides);
  const { store, photos } = useData();
  const urls = useMemo(() => {
    const fromIdx = idx != null ? (playerPhotos(photos, store.P.id[idx]) as string[]) : [];
    return [photo, ...fromIdx].filter(Boolean) as string[];
  }, [photo, idx, photos, store]);
  const [i, setI] = useState(0);
  const url = urls[i];
  return (
    <span title={name} className="relative inline-grid size-6 shrink-0 sm:size-8 place-items-center overflow-hidden rounded-full">
      {url ? <img src={url} alt="" className="size-full object-cover object-top" onError={() => setI((n) => n + 1)} /> : <Silhouette />}
    </span>
  );
}

function Who({ name, team, sides, strike, short, className }: { name: string; team?: string; sides?: Side[]; strike?: boolean; short?: boolean; className?: string }) {
  const idx = usePlayerIdx(name, team, sides);
  const text = short ? shortName(name) : name;
  const label = <>{text}{strike ? <span className="text-primary">*</span> : null}</>;
  const cls = cn("truncate font-medium", strike && "text-primary", className);
  return idx != null ? <Link to={`/player/${idx}`} className={cn(cls, "underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-primary active:opacity-70")}>{label}</Link> : <span className={cls}>{label}</span>;
}

function ov(p: any) {
  const n = ballsToOvers(p?.ballsBowled);
  if (n == null) return null;
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

function Ball({ b }: { b: string }) {
  return (
    <span className={cn("grid h-6 min-w-6 shrink-0 place-items-center rounded-md px-hair text-caption font-bold tabular-nums whitespace-nowrap", /w/i.test(b) ? "bg-miss/20 text-miss" : /[456]/.test(b) ? "bg-primary/20 text-primary" : "bg-secondary text-foreground")}>{b}</span>
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
              <span className="shrink-0 text-callout font-medium tabular-nums text-muted-foreground" title={o.n != null ? `Over ${o.n}` : undefined}>{o.n != null ? o.n : "·"}</span>
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

function Num({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-tight py-snug text-right text-footnote tabular-nums", className)}>{children}</td>;
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

/** Batting + bowling tables, one innings at a time: a selector over the innings (two in a T20 or ODI, up to four in a Test) that follows the latest one until a tab is picked. So-far only. */
export function ScorecardBody({ match, teams }: { match: any; teams?: Side[] }) {
  const [pick, setPick] = useState<string>();
  const namePadding = "px-tight";
  const card = cardInns(match);
  if (!card.length) return null;
  const at = pick && card.some((i: any) => innId(i) === pick) ? card.findIndex((i: any) => innId(i) === pick) : card.length - 1, inn = card[at];
  const balls = inn.overs != null ? oversToBalls(inn.overs) : null, rr = inn.runs != null && balls ? (inn.runs / (balls / 6)).toFixed(2) : null;
  const onStrike = (name: string) => (match?.players || []).some((p: any) => p.strike && namesMatch(p.name, name));
  const yet = (inn: any) => (inn.yetToBat || []).filter((n: string) => n && !/^[A-Z0-9]{1,4}$/.test(n));
  return (
    <div className="flex flex-col gap-stack">
      {card.length > 1 && (
        <PillGroup layoutId="innings-chip" label="Innings" value={innId(inn)} onChange={setPick}
          items={card.map((i: any, j: number) => [innId(i), <span key={innId(i)}>{innLabel(card, j)} <span className="ml-1 text-footnote opacity-70">{innScore(i) || "—"}</span></span>] as [string, ReactNode])} />
      )}
      {[inn].map((inn: any) => (
        <div key={innId(inn)} className="flex flex-col">
          <div className="flex items-center gap-snug py-snug">
            <span className="min-w-0 flex-1 truncate text-callout font-medium">{inn.team || `Innings ${inn.n}`}{card.length > 2 ? ` · ${innLabel(card, at).split(" ")[1] ?? ORD[0]} innings` : ""}</span>
            <span className="shrink-0 text-footnote font-medium tabular-nums">{innScore(inn) || "—"}{rr ? ` · RR ${rr}` : ""}</span>
          </div>
          {!!inn.batters?.length && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-footnote [&_td]:border [&_td]:border-hairline [&_th]:border [&_th]:border-hairline [&_th]:bg-secondary/50">
                <thead>
                  <tr className="label-cap text-footnote text-muted-foreground">
                    <th className={cn("py-snug text-left", namePadding)}>Batter</th>
                    <th className="px-tight py-snug text-right">R</th>
                    <th className="px-tight py-snug text-right">B</th>
                    <th className="px-tight py-snug text-right">4s</th>
                    <th className="px-tight py-snug text-right">6s</th>
                    <th className="px-tight py-snug text-right">SR</th>
                  </tr>
                </thead>
                <tbody>
                  {inn.batters.map((p: any) => (
                    <tr key={p.id || p.name} className="border-t border-hairline">
                      <td className={cn("py-snug", namePadding)}>
                        <div className="flex min-w-0 items-center gap-snug">
                          <div className="min-w-0">
                            <Who name={p.name} team={p.team || inn.team} sides={teams} strike={onStrike(p.name)} className="text-callout font-medium" />
                            {!p.out && !onStrike(p.name) ? <span className="text-primary">*</span> : null}
                            <div className="text-footnote text-muted-foreground">{p.dismissal || (p.out ? "out" : "not out")}</div>
                          </div>
                        </div>
                      </td>
                      <Num className="font-medium text-foreground">{p.runs ?? 0}</Num>
                      <Num>{p.balls ?? 0}</Num>
                      <Num>{p.fours ?? 0}</Num>
                      <Num>{p.sixes ?? 0}</Num>
                      <Num>{p.sr != null ? Number(p.sr).toFixed(2) : "—"}</Num>
                    </tr>
                  ))}
                  {inn.extras && (
                    <tr className="border-t border-hairline text-muted-foreground">
                      <td className={cn("py-snug", namePadding)}>Extras</td>
                      <Num className="font-medium text-foreground">{inn.extras.total}</Num>
                      <td colSpan={4} className="px-tight py-snug text-footnote">{extrasText(inn.extras).replace(/^\d+\s*/, "")}</td>
                    </tr>
                  )}
                  {inn.runs != null && (
                    <tr className="border-t border-hairline">
                      <td className={cn("py-snug font-medium", namePadding)}>Total</td>
                      <Num className="font-medium text-foreground">{inn.runs}</Num>
                      <td colSpan={4} className="px-tight py-snug text-footnote text-muted-foreground">{inn.wkts != null ? `${inn.wkts} wkts` : ""}{inn.overs != null ? ` · ${fmtOv(inn.overs)} ov` : ""}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {!!inn.fow?.length && (
            <p className="py-snug text-footnote text-muted-foreground">
              <span className="font-medium text-foreground">FOW</span>{" "}
              {inn.fow.map((w: any, k: number) => <Fragment key={`${w.wkts}-${w.name}`}>{k > 0 && " · "}{w.wkts}–{w.runs} (<Who name={w.name} team={inn.team} sides={teams} className="font-normal" />{w.balls != null ? `, ${fmtOv(ballsToOvers(w.balls))}` : ""})</Fragment>)}
            </p>
          )}
          {!!yet(inn).length && (
            <p className="py-snug text-footnote text-muted-foreground"><span className="font-medium text-foreground">Yet to bat</span> {yet(inn).map((n: string, k: number) => <Fragment key={n}>{k > 0 && ", "}<Who name={n} team={inn.team} sides={teams} className="font-normal" /></Fragment>)}</p>
          )}
          {!!inn.bowlers?.length && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-footnote [&_td]:border [&_td]:border-hairline [&_th]:border [&_th]:border-hairline [&_th]:bg-secondary/50">
                <thead>
                  <tr className="label-cap text-footnote text-muted-foreground">
                    <th className={cn("py-snug text-left", namePadding)}>Bowler</th>
                    <th className="px-tight py-snug text-right">O</th>
                    <th className="px-tight py-snug text-right">M</th>
                    <th className="px-tight py-snug text-right">R</th>
                    <th className="px-tight py-snug text-right">W</th>
                    <th className="px-tight py-snug text-right">Econ</th>
                  </tr>
                </thead>
                <tbody>
                  {inn.bowlers.map((p: any) => (
                    <tr key={p.id || p.name} className="border-t border-hairline">
                      <td className={cn("py-snug", namePadding)}>
                        <div className="flex min-w-0 items-center gap-snug">
                          <Who name={p.name} team={p.team} sides={teams} className="text-callout font-medium" />
                        </div>
                      </td>
                      <Num>{fmtOv(p.overs)}</Num>
                      <Num>{p.maidens ?? 0}</Num>
                      <Num>{p.conceded ?? 0}</Num>
                      <Num className="font-medium text-foreground">{p.wickets ?? 0}</Num>
                      <Num>{p.econ != null ? Number(p.econ).toFixed(2) : "—"}</Num>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
      <p className="py-snug text-footnote text-muted-foreground">So far this match. Not used for settlement.</p>
    </div>
  );
}

function LivePlayer({ player, sides, bowling = false }: { player: any; sides?: Side[]; bowling?: boolean }) {
  const figures = bowling ? `${player.wickets ?? 0}–${player.conceded ?? 0}` : player.runs ?? 0;
  const detail = bowling ? `${ov(player) ?? "–"} ov` : `${player.balls ?? 0} balls`;
  return (
    <div className="flex min-w-0 items-center gap-hair sm:gap-tight">
      <Face key={player.photo || player.name} name={player.name} photo={player.photo} team={player.team} sides={sides} />
      <div className="grid min-w-0 gap-hair">
        <Who name={player.name} team={player.team} sides={sides} strike={!bowling && !!player.strike} short className="text-footnote" />
        <span className="flex flex-wrap items-baseline gap-x-hair tabular-nums">
          <b className="font-condensed text-body leading-none">{figures}</b>
          <span className="text-caption text-muted-foreground">({detail})</span>
        </span>
      </div>
    </div>
  );
}

/** Current players, deliveries and chase figures in the fixture header. */
export function LiveBoard({ match, teams }: { match: any; teams?: Side[] }) {
  const board = liveBoard(match);
  if (!board) return null;
  const bw = board.bowler;
  const meta: ReactNode[] = [];
  if (board.partnership) meta.push(<span key="p"><span className="text-muted-foreground">P’ship</span> <b className="font-medium text-foreground">{board.partnership.runs ?? 0}</b> ({board.partnership.balls ?? 0})</span>);
  if (board.lastWicket) meta.push(<span key="w" className="min-w-0 truncate"><span className="text-muted-foreground">Last wkt</span> <Who name={board.lastWicket.name} team={board.lastWicket.team} sides={teams} short className="font-medium text-foreground" /> {board.lastWicket.runs ?? 0}({board.lastWicket.balls ?? 0})</span>);
  if (board.crr != null) meta.push(<span key="c"><span className="text-muted-foreground">CRR</span> {board.crr.toFixed(2)}</span>);
  if (board.rrr != null) meta.push(<span key="r"><span className="text-muted-foreground">RRR</span> {board.rrr.toFixed(2)}</span>);
  return (
    <section aria-label="Live scoreboard" className="flex flex-col divide-y divide-dashed divide-hairline border-t border-hairline">
      {(!!board.batters.length || bw) && (
        <div className="grid grid-cols-3 divide-x divide-dashed divide-hairline bg-background/60">
          {[board.batters[0], board.batters[1], bw].map((player, i) => (
            <div key={i} className="grid min-w-0 content-start gap-hair px-tight py-snug first:pl-inset last:pr-inset">
              <div className="label-cap text-caption text-muted-foreground">{i === 2 ? "Bowler" : `Batter ${i + 1}`}</div>
              {player ? <LivePlayer player={player} sides={teams} bowling={i === 2} /> : <span className="text-footnote text-muted-foreground">—</span>}
            </div>
          ))}
        </div>
      )}
      {!!board.overs.length && (
        <div className="min-w-0 px-inset py-snug"><Overs overs={board.overs} /></div>
      )}
      {!!meta.length && <div className="flex flex-wrap items-baseline gap-x-snug gap-y-hair px-inset py-snug text-footnote tabular-nums">{meta}</div>}
    </section>
  );
}

export function ScorecardAccordion({ match, teams }: { match: any; teams?: Side[] }) {
  const [section, setSection] = useState("");
  return (
    <Accordion type="single" collapsible value={section} onValueChange={setSection} className="min-w-0 border-t border-hairline">
      <AccordionItem value="scorecard">
        <AccordionTrigger className="min-h-control gap-snug rounded-none bg-background/60 px-inset py-tight text-callout hover:bg-surface-hover hover:no-underline focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&>svg]:motion-reduce:transition-none">
          <span className="flex min-w-0 items-center gap-snug">
            <TableCellsIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            {section ? "Hide scorecard" : "Full scorecard"}
          </span>
        </AccordionTrigger>
        <AccordionContent className="border-t border-dashed border-hairline px-inset py-snug">
          <ScorecardBody match={match} teams={teams} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
