/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, createContext, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { AnimatedHeight } from "@/components/app/animated-height";
import { useHeaderFlush } from "@/lib/header-slot";
import { ballsToOvers, liveBoard, liveCard, namesMatch, oversToBalls } from "@cricket/engine/live.js";
import { PillGroup } from "@/components/app/pill-group";
import { abbr } from "@/lib/format";
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
              <table className="w-full text-footnote">
                <thead>
                  <tr className="label-cap text-footnote text-muted-foreground">
                    <th className="py-snug text-left">Batter</th>
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
                      <td className="py-snug pr-snug">
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
                      <td className="py-snug">Extras</td>
                      <Num className="font-medium text-foreground">{inn.extras.total}</Num>
                      <td colSpan={4} className="px-tight py-snug text-footnote">{extrasText(inn.extras).replace(/^\d+\s*/, "")}</td>
                    </tr>
                  )}
                  {inn.runs != null && (
                    <tr className="border-t border-hairline">
                      <td className="py-snug font-medium">Total</td>
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
              <table className="w-full text-footnote">
                <thead>
                  <tr className="label-cap text-footnote text-muted-foreground">
                    <th className="py-snug text-left">Bowler</th>
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
                      <td className="py-snug pr-snug">
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
    <div className="grid min-w-0 gap-hair">
      <Who name={player.name} team={player.team} sides={sides} strike={!bowling && !!player.strike} short className="text-footnote" />
      <span className="flex flex-wrap items-baseline gap-x-hair tabular-nums">
        <b className="font-condensed text-body leading-none">{figures}</b>
        <span className="text-caption text-muted-foreground">({detail})</span>
      </span>
    </div>
  );
}

/** Is the card running the full width of the page (so its rules cancel the page gutter, not the card's own padding)? */
const FlushCtx = createContext(false);

/** A divider across the whole card, edge to edge (it cancels the card's side padding): solid or dotted. */
export function Rule({ dotted }: { dotted?: boolean }) {
  const flush = useContext(FlushCtx);
  return <div aria-hidden className={cn("border-t border-hairline", flush ? "-mx-gutter" : "-mx-inset", dotted && "border-dotted")} />;
}

/** Current batters, bowler and deliveries. Extra match figures appear with the expanded scorecard. */
export function LiveBoard({ match, teams, expanded }: { match: any; teams?: Side[]; expanded: boolean }) {
  const board = liveBoard(match);
  if (!board) return null;
  const bw = board.bowler;
  const meta: ReactNode[] = [];
  if (board.partnership) meta.push(<span key="p"><span className="text-muted-foreground">P’ship</span> <b className="font-medium text-foreground">{board.partnership.runs ?? 0}</b> ({board.partnership.balls ?? 0})</span>);
  if (board.lastWicket) meta.push(<span key="w" className="min-w-0 truncate"><span className="text-muted-foreground">Last wkt</span> <Who name={board.lastWicket.name} team={board.lastWicket.team} sides={teams} short className="font-medium text-foreground" /> {board.lastWicket.runs ?? 0}({board.lastWicket.balls ?? 0})</span>);
  if (board.crr != null) meta.push(<span key="c"><span className="text-muted-foreground">CRR</span> {board.crr.toFixed(2)}</span>);
  if (board.rrr != null) meta.push(<span key="r"><span className="text-muted-foreground">RRR</span> {board.rrr.toFixed(2)}</span>);
  return (
    <section aria-label="Live scoreboard" className="flex flex-col gap-tight">
      {(!!board.batters.length || bw) && (
        <div className="grid grid-cols-3 gap-tight">
          {board.batters.slice(0, 2).map((b: any) => <LivePlayer key={b.id || b.name} player={b} sides={teams} />)}
          {bw && <div className="col-start-3 border-l border-hairline pl-tight"><LivePlayer player={bw} sides={teams} bowling /></div>}
        </div>
      )}
      {!!board.overs.length && <Overs overs={board.overs} />}
      {expanded && !!meta.length && <div className="flex flex-wrap items-baseline gap-x-snug gap-y-hair text-footnote tabular-nums">{meta}</div>}
    </section>
  );
}

/** Not in play: per innings, the score, the two best batters and the best bowler, one line each. */
function CardSummary({ match, teams }: { match: any; teams?: Side[] }) {
  const card = cardInns(match);
  return (
    <div className="flex flex-col gap-snug">
      {card.map((inn: any, k: number) => {
        const bat = [...(inn.batters || [])].sort((a: any, b: any) => (b.runs ?? 0) - (a.runs ?? 0)).slice(0, 2);
        const bowl = [...(inn.bowlers || [])].sort((a: any, b: any) => (b.wickets ?? 0) - (a.wickets ?? 0) || (a.conceded ?? 0) - (b.conceded ?? 0))[0];
        return (
          <div key={innId(inn)} className="flex flex-col gap-hair">
            <div className="flex items-baseline justify-between gap-snug">
              <span className="truncate text-callout font-medium">{innLabel(card, k)}</span>
              <span className="shrink-0 font-condensed text-body font-bold tabular-nums">{innScore(inn) || "—"}</span>
            </div>
            {!!bat.length && <p className="truncate text-footnote text-muted-foreground">{bat.map((b: any, j: number) => <Fragment key={b.id || b.name}>{j > 0 && " · "}<Who name={b.name} team={b.team || inn.team} sides={teams} short className="font-medium text-foreground" /> {b.runs ?? 0} ({b.balls ?? 0})</Fragment>)}</p>}
            {bowl && <p className="truncate text-footnote text-muted-foreground"><Who name={bowl.name} team={bowl.team} sides={teams} short className="font-medium text-foreground" /> {bowl.wickets ?? 0}–{bowl.conceded ?? 0} ({fmtOv(bowl.overs)})</p>}
          </div>
        );
      })}
    </div>
  );
}

/** The match's scorecard as one card: the live strip while it is on (a short top-performers summary otherwise), and a tap on the row below it opens the full card in place. So-far only. */
export const scoreboardShows = (match: any, inPlay: boolean) => hasCard(match) || (inPlay && !!liveBoard(match));

/** `top` (status and ground line) and `head` (the two sides with their scores) sit at the top of the card while a match is in play: the card is then the page's header, full width and flush under the top bar, with compact player figures beneath the team scores. Otherwise it is a rounded card in the page. */
export function ScorecardCard({ match, teams, inPlay, fixtureId, top, head }: { match: any; teams?: Side[]; inPlay: boolean; fixtureId?: string; top?: ReactNode; head?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const full = hasCard(match), strip = inPlay && !!liveBoard(match);
  const flush = inPlay && !!top && scoreboardShows(match, inPlay);
  useHeaderFlush(flush);
  if (!scoreboardShows(match, inPlay)) return null;
  return (
    <FlushCtx.Provider value={flush}>
    <section aria-label="Scorecard" data-flush={flush ? "" : undefined} className={cn("flex flex-col gap-tight", flush ? "-mx-gutter bg-background px-gutter py-snug" : "rounded-2xl bg-card p-inset")}>
      {inPlay && top ? <>{top}</> : null}
      {inPlay && head ? <>{head}<Rule /></> : null}
      {strip ? <LiveBoard match={match} teams={teams} expanded={open || !full} /> : <CardSummary match={match} teams={teams} />}
      {full && (
        <>
          <Rule />
          <div>
            <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
              className="flex w-full items-center gap-tight text-callout font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring active:opacity-70">
              {open ? "Hide scorecard" : "Full scorecard"}
              <ChevronDownIcon className={cn("ml-auto size-4 transition-transform", open && "rotate-180")} aria-hidden />
            </button>
            <AnimatedHeight>
              {open && (
                <div className="flex flex-col gap-tight pt-snug">
                  {fixtureId ? <Link to={`/fixture/${fixtureId}/scorecard`} className="ml-auto block w-fit text-footnote font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Open as a page</Link> : null}
                  <ScorecardBody match={match} teams={teams} />
                </div>
              )}
            </AnimatedHeight>
          </div>
        </>
      )}
    </section>
    </FlushCtx.Provider>
  );
}
