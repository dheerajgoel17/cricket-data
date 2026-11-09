/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { MIN_SAMPLE, conditionalReport as conditional, inplayScopes, liveInnings, sideIndex } from "@cricket/engine/inplay.js";
import { PLAYER_MIN_SAMPLE, PLAYER_RANGE, playerConditional as playerCond } from "@cricket/engine/player-inplay.js";
import { liveBoard, namesMatch, teamKey } from "@cricket/engine/live.js";
import { FORMATS } from "@cricket/engine/util.js";
import { useLiveMatch } from "@/hooks/useLive";
import { useData } from "@/lib/data";
import { cn } from "@/lib/utils";

// the engine is plain JS: give its reports the loose shape these views read
const conditionalReport = conditional as (store: any, ms: number[], o: { team?: number | null; innNo: number; state: { balls: number; runs: number }; target: { kind: string; n?: number }; line?: number | null }) => any;
const playerConditional = playerCond as (store: any, rows: any[], o: { fmt: number; state: { balls: number; runs: number }; line?: number | null }) => any;
const overs = (o: number) => (Number.isInteger(o) ? o.toFixed(1) : String(o));

/** The small red mark on a line that is a live price. */
export function LiveTag({ className }: { className?: string }) {
  return <span className={cn("label-cap text-caption font-bold text-miss", className)}>Live</span>;
}

/**
 * Under a live innings-total row: how past innings that were in the same spot (the same runs after the same balls, 10% either way) went against this row's line: "6 of 9 over". Counts of the
 * format's history (every side, three years, same level), never a model; nothing shows when the row is not the innings being batted now or nothing in the history was in that spot.
 */
export function TeamSpot({ r, fx, teams, className }: { r: any; fx: any; teams: [string, number][]; className?: string }) {
  const { store } = useData();
  const { match } = useLiveMatch(fx);
  const fmtIx = FORMATS.indexOf(fx.fmt), gender = fx.gender === "female" ? 1 : 0;
  const inn = useMemo(() => liveInnings(match, fmtIx), [match, fmtIx]);
  const rep = useMemo(() => {
    if (!r.live || r.key !== "team_total_runs" || !inn || !store.M || teamKey(inn.team) !== teamKey(r.team) || (r.inn || inn.innNo) !== inn.innNo) return null;
    const ti = sideIndex(teams, inn.team);
    const scopes = inplayScopes(store, { fmt: fmtIx, gender, team: ti >= 0 ? ti : null, now: Date.now() });
    return conditionalReport(store, scopes.wide, { innNo: inn.innNo, state: { balls: inn.balls, runs: inn.runs }, target: { kind: "total" }, line: r.line });
  }, [r.live, r.key, r.team, r.inn, r.line, inn, store, teams, fmtIx, gender]);
  if (!rep || !rep.n) return null;
  const [lo, hi] = rep.band as [number, number];
  return (
    <p className={cn("text-footnote text-muted-foreground", className)}>
      Same spot ({inn!.runs}/{inn!.wkts} after {overs(inn!.overs)} ov, {lo}–{hi} runs in {rep.n} past {fx.fmt} innings): <span className="font-medium text-foreground">{rep.summary.over} over, {rep.summary.under} under {r.line}</span>
      {rep.n < MIN_SAMPLE ? " · small sample" : ""}
    </p>
  );
}

/** The same for a batter at the crease (10 to 150 balls in): his own past innings in the same spot against this row's line. Needs his progression shard; nothing shows without it. */
export function BatterSpot({ r, className }: { r: any; className?: string }) {
  const { store } = useData();
  const { match } = useLiveMatch({ a: r.team, b: r.opp, start: r.start, fmt: r.fmt });
  const fmtIx = FORMATS.indexOf(r.fmt);
  const bat = useMemo(() => (liveBoard(match)?.batters as any[] | undefined)?.find((b) => namesMatch(b.name, r.name) && b.balls >= PLAYER_RANGE[0] && b.balls <= PLAYER_RANGE[1]) ?? null, [match, r.name]);
  const idx = useMemo(() => (store.P?.id ?? []).indexOf(r.pid), [store, r.pid]);
  const rows = useQuery({ queryKey: ["progression", idx], enabled: bat != null && idx >= 0, staleTime: Infinity, queryFn: () => store.playerProgression(idx) });
  const rep = useMemo(() => (bat && rows.data && store.M ? playerConditional(store, rows.data, { fmt: fmtIx, state: { balls: bat.balls, runs: bat.runs }, line: r.line }) : null), [bat, rows.data, store, fmtIx, r.line]);
  if (!bat || !rep || !rep.n) return null;
  return (
    <span className={cn("text-footnote text-muted-foreground", className)}>
      Same spot ({bat.runs} off {bat.balls}, {rep.n} of his innings): <span className="font-medium text-foreground">{rep.summary.over} over, {rep.summary.under} under {r.line}</span>
      {rep.n < PLAYER_MIN_SAMPLE ? " · small sample" : ""}
    </span>
  );
}
