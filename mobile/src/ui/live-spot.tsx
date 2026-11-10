/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { MIN_SAMPLE, conditionalReport as conditional, inplayScopes, liveInnings, sideIndex } from "@cricket/engine/inplay.js";
import { PLAYER_MIN_SAMPLE, PLAYER_RANGE, playerConditional as playerCond } from "@cricket/engine/player-inplay.js";
import { batterHistoryKey } from "@cricket/engine/inplay-history.js";
import { liveBoard, liveForFixture, namesMatch, teamKey } from "@cricket/engine/live.js";
import { FORMATS } from "@cricket/engine/util.js";
import { storeQuery } from "@/lib/data";
import { getJson } from "@/lib/net";
import { liveQuery } from "@/lib/queries";
import { Text } from "@/ui/text";
import { color, font, type } from "@/ui/tokens";

// "From here" under a live row, as the site's `live-spot.tsx`: how past innings that were in the same spot went against the row's line. Counts of history, never a model.
const conditionalReport = conditional as (store: any, ms: number[], o: { team?: number | null; innNo: number; state: { balls: number; runs: number }; target: { kind: string; n?: number }; line?: number | null }) => any;
const playerConditional = playerCond as (store: any, rows: any[], o: { fmt: number; state: { balls: number; runs: number }; line?: number | null }) => any;

/** Under a live innings-total row: "6 over · 3 under · 9 innings" of the format's history in the same spot; nothing when the row is not the innings being batted now or nothing was in that spot. */
export function TeamSpot({ r, fx, teams }: { r: any; fx: any; teams: [string, number][] }) {
  const store = useQuery(storeQuery).data?.store;
  const live = useQuery(liveQuery).data;
  const fmtIx = FORMATS.indexOf(fx.fmt), gender = fx.gender === "female" ? 1 : 0;
  const match = useMemo(() => liveForFixture(live, { a: fx.a, b: fx.b, start: fx.start, fmt: fx.fmt }), [live, fx.a, fx.b, fx.start, fx.fmt]);
  const inn = useMemo(() => liveInnings(match, fmtIx), [match, fmtIx]);
  const rep = useMemo(() => {
    if (!store?.M || !r.live || r.key !== "team_total_runs" || !inn || teamKey(inn.team) !== teamKey(r.team) || (r.inn || inn.innNo) !== inn.innNo) return null;
    const ti = sideIndex(teams, inn.team);
    const scopes = inplayScopes(store, { fmt: fmtIx, gender, team: ti >= 0 ? ti : null, now: Date.now() });
    return conditionalReport(store, scopes.wide, { innNo: inn.innNo, state: { balls: inn.balls, runs: inn.runs }, target: { kind: "total" }, line: r.line });
  }, [r.live, r.key, r.team, r.inn, r.line, inn, store, teams, fmtIx, gender]);
  if (!rep || !rep.n) return null;
  return (
    <Text style={styles.note}>
      Similar team innings: <Text style={styles.strong}>{rep.summary.over} over · {rep.summary.under} under</Text> · {rep.n} innings{rep.n < MIN_SAMPLE ? " · small sample" : ""}
    </Text>
  );
}

/** The same for a batter at the crease (10 to 150 balls in): his own past innings in the same spot, and the recent innings of the format with a similar score. Needs his progression shard. */
export function BatterSpot({ r }: { r: any }) {
  const store = useQuery(storeQuery).data?.store;
  const live = useQuery(liveQuery).data;
  const fmtIx = FORMATS.indexOf(r.fmt);
  const match = useMemo(() => liveForFixture(live, { a: r.team, b: r.opp, start: r.start, fmt: r.fmt }), [live, r.team, r.opp, r.start, r.fmt]);
  const bat = useMemo(() => (liveBoard(match)?.batters as any[] | undefined)?.find((b) => namesMatch(b.name, r.name) && b.balls >= PLAYER_RANGE[0] && b.balls <= PLAYER_RANGE[1]) ?? null, [match, r.name]);
  const idx = useMemo(() => (store?.P?.id ?? []).indexOf(r.pid), [store, r.pid]);
  const rows = useQuery({ queryKey: ["progression", idx], enabled: !!store && bat != null && idx >= 0, staleTime: Infinity, queryFn: () => store.playerProgression(idx) });
  const rep = useMemo(() => (bat && rows.data && store?.M ? playerConditional(store, rows.data, { fmt: fmtIx, state: { balls: bat.balls, runs: bat.runs }, line: r.line }) : null), [bat, rows.data, store, fmtIx, r.line]);
  const band = bat && r.stat === "runs" ? batterHistoryKey({ fmt: r.fmt, gender: r.gender, balls: bat.balls, runs: bat.runs, line: r.line }) : null;
  const archived = useQuery({ queryKey: ["inplay-history"], enabled: band != null, staleTime: Infinity, queryFn: async () => { try { return await getJson("/data/inplay-history.json"); } catch { return null; } } });
  const counts = band ? (archived.data as Record<string, { over: number; under: number; push: number }> | null | undefined)?.[band] : null;
  if (!bat || (!rep?.n && !counts)) return null;
  return (
    <>
      {rep?.n ? <Text style={styles.note}>Batter’s own history: <Text style={styles.strong}>{rep.summary.over} over · {rep.summary.under} under</Text> · {rep.n} innings{rep.n < PLAYER_MIN_SAMPLE ? " · small sample" : ""}</Text> : null}
      {counts ? <Text style={styles.note}>Similar in-play lines: <Text style={styles.strong}>{counts.over} over · {counts.under} under{counts.push > 0 ? ` · ${counts.push} on the line` : ""}</Text> · {counts.over + counts.under + counts.push} innings{counts.over + counts.under < PLAYER_MIN_SAMPLE ? " · small sample" : ""}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  note: { ...type.footnote, color: color["muted-foreground"] },
  strong: { fontFamily: font.medium, color: color.foreground },
});
