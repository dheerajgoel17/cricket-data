/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { playerIdFor } from "@/engine/identity.js";
import { ballsToOvers, liveBoard, liveCard, namesMatch } from "@/engine/live.js";
import { FormHeadline, RecentForm, recentForms } from "@/components/app/recent-form";
import { playerPhotos } from "@/lib/assets";
import { useData } from "@/lib/data";
import { cn } from "@/lib/utils";

type Side = [string, number];
const FACE = { sm: "size-6", md: "size-9", lg: "size-12", xl: "size-16" } as const;

function shortName(n: string) {
  const p = String(n).trim().split(/\s+/);
  if (p.length < 2) return n;
  const last = p[p.length - 1], particle = p[p.length - 2];
  return /^(de|den|van|von|el|al|la|le|da|di)$/i.test(particle) ? `${particle} ${last}` : last;
}

function usePlayerIdx(name: string, team?: string, sides?: Side[]) {
  const { rz, store, identity } = useData();
  const teamIdx = sides?.find(([n]) => n === team)?.[1];
  const genderTeam = teamIdx != null && teamIdx >= 0 ? teamIdx : sides?.find(([, i]) => i >= 0)?.[1];
  const gender = genderTeam != null && genderTeam >= 0 ? store.genderOfTeam(genderTeam) : undefined;
  return useMemo(() => {
    const pid = playerIdFor(identity, name, { gender, team });
    if (pid) {
      const i = store.P.id.indexOf(pid);
      if (i >= 0 && (gender == null || store.P.g[i] === gender)) return i;
    }
    const opts: { team?: number; gender?: number } = {};
    if (teamIdx != null && teamIdx >= 0) opts.team = teamIdx;
    if (gender != null) opts.gender = gender;
    const hits = rz.players(name, opts, 5) as { idx: number; score: number }[];
    const pick = gender == null ? hits[0] : hits.find((h) => store.P.g[h.idx] === gender);
    return pick ? pick.idx : null;
  }, [rz, store, identity, name, team, teamIdx, gender]);
}

const Silhouette = () => <svg viewBox="0 0 40 40" aria-hidden className="size-3/4 fill-current text-muted-foreground/50"><circle cx="20" cy="15" r="7" /><path d="M5 40c1-9 7-14 15-14s14 5 15 14z" /></svg>;

/** Photo only. No frame. Silhouette if every URL fails. */
function Face({ name, photo, team, sides, size = "md" }: { name: string; photo?: string; team?: string; sides?: Side[]; size?: keyof typeof FACE }) {
  const idx = usePlayerIdx(name, team, sides);
  const { store, photos } = useData();
  const urls = useMemo(() => {
    const fromIdx = idx != null ? (playerPhotos(photos, store.P.id[idx]) as string[]) : [];
    return [photo, ...fromIdx].filter(Boolean) as string[];
  }, [photo, idx, photos, store]);
  const [i, setI] = useState(0);
  const url = urls[i];
  return (
    <span title={name} className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full", FACE[size])}>
      {url ? <img src={url} alt="" className="size-full object-cover object-top" onError={() => setI((n) => n + 1)} /> : <Silhouette />}
    </span>
  );
}

function Who({ name, team, sides, strike, short, className }: { name: string; team?: string; sides?: Side[]; strike?: boolean; short?: boolean; className?: string }) {
  const idx = usePlayerIdx(name, team, sides);
  const text = short ? shortName(name) : name;
  const label = <>{text}{strike ? <span className="text-primary">*</span> : null}</>;
  const cls = cn("truncate font-semibold", strike && "text-primary", className);
  return idx != null ? <Link to={`/player/${idx}`} className={cn(cls, "hover:underline")}>{label}</Link> : <span className={cls}>{label}</span>;
}

function Score({ p }: { p: any }) {
  return (
    <span className="shrink-0 tabular-nums leading-none">
      <span className="text-title font-bold">{p.runs ?? 0}</span>
      <span className="text-callout text-muted-foreground"> ({p.balls ?? 0})</span>
    </span>
  );
}

/** One end of the pair: big photo + name at the top, score/balls at the bottom, mirrored on the off side. */
function BatterEnd({ p, sides, mirror }: { p: any; sides?: Side[]; mirror?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-1 items-stretch gap-snug", mirror && "flex-row-reverse")}>
      <Face name={p.name} photo={p.photo} team={p.team} sides={sides} size="xl" />
      <div className={cn("flex min-w-0 flex-1 flex-col justify-between py-hair", mirror && "items-end text-right")}>
        <Who name={p.name} team={p.team} sides={sides} strike={!!p.strike} short className="min-w-0 text-body" />
        <Score p={p} />
      </div>
    </div>
  );
}

function ov(p: any) {
  const n = ballsToOvers(p?.ballsBowled);
  if (n == null) return null;
  return Number.isInteger(n) ? n.toFixed(1) : String(n);
}

function Ball({ b }: { b: string }) {
  return (
    <span className={cn("grid size-6 place-items-center rounded-md text-caption font-bold tabular-nums", /w/i.test(b) ? "bg-miss/20 text-miss" : /[456]/.test(b) ? "bg-primary/20 text-primary" : "bg-secondary text-foreground")}>{b}</span>
  );
}

/** Delivery chips, grouped by over. A hairline marks the over break. */
function Overs({ overs }: { overs: { balls: string[] }[] }) {
  const groups = (overs || []).filter((o) => o.balls.length);
  if (!groups.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-snug" aria-label={`Deliveries ${groups.map((o) => o.balls.join(" ")).join(", end of over, ")}`}>
      {groups.map((o, i) => (
        <span key={i} className="flex items-center gap-snug">
          {i > 0 && <span role="separator" aria-hidden className="h-5 w-px shrink-0 bg-muted-foreground/40" />}
          <span className="flex flex-nowrap items-center gap-hair">
            {o.balls.map((b, j) => <Ball key={`${b}-${j}`} b={b} />)}
          </span>
        </span>
      ))}
    </div>
  );
}

function Person({ p, sides, sub }: { p: any; sides?: Side[]; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-snug">
      <Face name={p.name} photo={p.photo} team={p.team} sides={sides} />
      <div className="grid min-w-0 flex-1 gap-hair">
        <Who name={p.name} team={p.team} sides={sides} strike={!!p.strike} className="text-callout" />
        {sub}
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="grid justify-items-end gap-hair">
      <span className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">{k}</span>
      <span className="text-callout font-semibold tabular-nums">{v}</span>
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

function cardInns(match: any) {
  return liveCard(match).filter((inn: any) => (inn.batters || []).length || (inn.bowlers || []).length || inn.runs != null);
}

/** CREX / Cricinfo batting + bowling tables. So-far only. Type matches Recent form rows. */
function ScorecardBody({ match, teams }: { match: any; teams?: Side[] }) {
  const card = cardInns(match);
  if (!card.length) return null;
  const onStrike = (name: string) => (match?.players || []).some((p: any) => p.strike && namesMatch(p.name, name));
  const yet = (inn: any) => (inn.yetToBat || []).filter((n: string) => n && !/^[A-Z0-9]{1,4}$/.test(n));
  return (
    <div className="flex flex-col gap-stack">
      {card.map((inn: any) => (
        <div key={`${inn.n}-${inn.team}`} className="flex flex-col">
          {card.length > 1 && (
            <div className="flex items-center gap-snug py-snug">
              <span className="min-w-0 flex-1 truncate text-callout font-medium">{inn.team || `Innings ${inn.n}`}</span>
              <span className="shrink-0 text-footnote font-medium tabular-nums">{innScore(inn) || "—"}</span>
            </div>
          )}
          {!!inn.batters?.length && (
            <div className="overflow-x-auto">
              <table className="w-full text-footnote">
                <thead>
                  <tr className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
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
                    <tr key={p.id || p.name} className="border-t border-white/5">
                      <td className="py-snug pr-snug">
                        <Who name={p.name} team={p.team} sides={teams} strike={onStrike(p.name)} className="text-callout font-medium" />
                        {!p.out && !onStrike(p.name) ? <span className="text-primary">*</span> : null}
                        <div className="text-footnote text-muted-foreground">{p.dismissal || (p.out ? "out" : "not out")}</div>
                      </td>
                      <Num className="font-medium text-foreground">{p.runs ?? 0}</Num>
                      <Num>{p.balls ?? 0}</Num>
                      <Num>{p.fours ?? 0}</Num>
                      <Num>{p.sixes ?? 0}</Num>
                      <Num>{p.sr != null ? Number(p.sr).toFixed(2) : "—"}</Num>
                    </tr>
                  ))}
                  {inn.extras && (
                    <tr className="border-t border-white/5 text-muted-foreground">
                      <td className="py-snug">Extras</td>
                      <Num className="font-medium text-foreground">{inn.extras.total}</Num>
                      <td colSpan={4} className="px-tight py-snug text-footnote">{extrasText(inn.extras).replace(/^\d+\s*/, "")}</td>
                    </tr>
                  )}
                  {inn.runs != null && (
                    <tr className="border-t border-white/10">
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
              {inn.fow.map((w: any) => `${w.wkts}–${w.runs} (${w.name}${w.balls != null ? `, ${fmtOv(ballsToOvers(w.balls))}` : ""})`).join(" · ")}
            </p>
          )}
          {!!yet(inn).length && (
            <p className="py-snug text-footnote text-muted-foreground"><span className="font-medium text-foreground">Yet to bat</span> {yet(inn).join(", ")}</p>
          )}
          {!!inn.bowlers?.length && (
            <div className="overflow-x-auto">
              <table className="w-full text-footnote">
                <thead>
                  <tr className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">
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
                    <tr key={p.id || p.name} className="border-t border-white/5">
                      <td className="py-snug pr-snug"><Who name={p.name} team={p.team} sides={teams} className="text-callout font-medium" /></td>
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

/** Scorecard + recent form, same trigger row, both closed so props stay first. */
export function MatchAccordions({ match, teams, fmt }: { match?: any; teams: Side[]; fmt: string }) {
  const { store } = useData();
  const card = match ? cardInns(match) : [];
  const form = recentForms(store, teams, fmt);
  const showForm = form.some((f) => f.games.length);
  if (!card.length && !showForm) return null;
  return (
    <Accordion type="multiple" className="w-full">
      {!!card.length && (
        <AccordionItem value="scorecard" className="border-white/10">
          <AccordionTrigger className="gap-snug py-snug hover:no-underline">
            <span className="flex min-w-0 flex-1 items-center gap-snug">
              <span className="truncate text-body font-semibold">Scorecard</span>
              <span className="ml-auto truncate text-callout font-medium tabular-nums text-muted-foreground">{card[0].team} {innScore(card[0])}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-tight">
            <ScorecardBody match={match} teams={teams} />
          </AccordionContent>
        </AccordionItem>
      )}
      {showForm && (
        <AccordionItem value="form" className="border-white/10">
          <AccordionTrigger className="gap-snug py-snug hover:no-underline">
            <FormHeadline teams={teams} fmt={fmt} />
          </AccordionTrigger>
          <AccordionContent className="pb-tight">
            <RecentForm teams={teams} fmt={fmt} />
          </AccordionContent>
        </AccordionItem>
      )}
    </Accordion>
  );
}

/** Current pair, last wicket, bowler, this-over deliveries and rates. Flat. So-far only. */
export function LiveBoard({ match, teams }: { match: any; teams?: Side[] }) {
  const board = liveBoard(match);
  if (!board) return null;
  const bowlOv = ov(board.bowler);
  return (
    <section aria-label="Live scoreboard" className="flex flex-col gap-stack">
      {board.batters[0] && (
        <div className="flex items-stretch gap-snug">
          <BatterEnd p={board.batters[0]} sides={teams} />
          <div className="grid shrink-0 content-between justify-items-center py-hair">
            <span className="text-caption font-semibold uppercase tracking-wider text-muted-foreground">P’ship</span>
            <span className="text-body font-bold tabular-nums leading-none">
              {board.partnership ? <>{board.partnership.runs ?? 0} <span className="text-footnote font-medium text-muted-foreground">({board.partnership.balls ?? 0})</span></> : "—"}
            </span>
          </div>
          {board.batters[1] ? <BatterEnd p={board.batters[1]} sides={teams} mirror /> : <div className="flex-1" />}
        </div>
      )}
      {board.lastWicket && (
        <div className="flex items-center justify-between gap-snug text-footnote text-muted-foreground">
          <span>Last wkt</span>
          <span className="min-w-0 truncate"><Who name={board.lastWicket.name} team={board.lastWicket.team} sides={teams} className="font-medium text-foreground" /> {board.lastWicket.runs ?? 0}({board.lastWicket.balls ?? 0})</span>
        </div>
      )}
      {board.bowler && (
        <div className="flex min-w-0 items-center gap-snug">
          <Person p={board.bowler} sides={teams} sub={<span className="text-caption text-muted-foreground">Bowling</span>} />
          <div className="flex shrink-0 items-end gap-stack">
            <Stat k="W-R" v={`${board.bowler.wickets ?? 0}–${board.bowler.conceded ?? 0}`} />
            <Stat k="Overs" v={bowlOv ?? "—"} />
            <Stat k="Econ" v={board.bowler.econ != null ? Number(board.bowler.econ).toFixed(2) : "—"} />
          </div>
        </div>
      )}
      {!!board.overs.length && <Overs overs={board.overs} />}
      {(board.crr != null || board.rrr != null) && (
        <div className="flex flex-wrap items-center gap-x-stack gap-y-tight">
          {board.crr != null && <span className="text-footnote font-medium tabular-nums text-muted-foreground">CRR {board.crr.toFixed(2)}</span>}
          {board.rrr != null && <span className="text-footnote font-medium tabular-nums text-muted-foreground">RRR {board.rrr.toFixed(2)}</span>}
        </div>
      )}
    </section>
  );
}
