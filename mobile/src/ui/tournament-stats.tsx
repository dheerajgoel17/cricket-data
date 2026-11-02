import { push } from "@/lib/nav";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { editionRows, editionSummary, editionsOf, boards as tournamentBoards, trendSeries, TREND_METRICS } from "@cricket/engine/tournament.js";
import { abbr } from "@site/lib/format";
import { storeQuery } from "@/lib/data";
import { Chips } from "@/ui/chips";
import { InfoButton } from "@/ui/info-button";
import { Working } from "@/ui/motion";
import { PlayerAvatar } from "@/ui/player-avatar";
import { Segmented } from "@/ui/segmented";
import { TeamBadge } from "@/ui/team-badge";
import { cap, color, font, FIXTURE_CARD_SHARE, num, radius, space, type, tonal } from "@/ui/tokens";

const SHOWN = 5;
const day = (d: string, year: boolean) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });
const range = (a: string, b: string) => (a === b ? day(a, true) : `${day(a, a.slice(0, 4) !== b.slice(0, 4))} – ${day(b, true)}`);
const fact = (x: number | null | undefined, digits = 0) => (x == null ? "–" : x.toFixed(digits));

/** The stats of one league or series: the season picker, the season in four numbers, the leaders, the lists (batting, bowling, overall) and the same measures season by season (the site's `TournamentStats`). */
export function TournamentStats({ eventIdx, season, onSeason }: { eventIdx: number; season: string; onSeason: (key: string) => void }) {
  const stats = useQuery(storeQuery);
  const store: any = stats.data?.store;
  const eds = useMemo(() => (store ? editionsOf(store, eventIdx) : []), [store, eventIdx]);
  const ed = eds.find((x: any) => x.key === season) ?? eds[0];
  const summary = useMemo(() => (ed ? editionSummary(store, ed) : null), [store, ed]);
  const trend = useMemo(() => (ed ? trendSeries(store, eds, ed) : []), [store, eds, ed]);
  const [read, setRead] = useState<[number, number]>([0, 0]);
  const rows = useQuery({
    queryKey: ["edition-rows", eventIdx, ed?.key], enabled: !!ed, staleTime: Infinity, retry: 1,
    queryFn: () => { setRead([0, store.nshard]); return editionRows(store, ed.ms, { onProgress: (d: number, n: number) => setRead([d, n]) }); },
  });
  const result = useMemo(() => (ed && rows.data ? tournamentBoards(store, ed, rows.data) : null), [store, ed, rows.data]);
  if (!store) return <Working label="Loading…" />;
  if (!ed) return <Text style={styles.box}>No matches in the data for this competition.</Text>;
  return (
    <View style={styles.root}>
      {eds.length > 1 ? <View style={styles.bleed}><Chips items={eds.map((x: any) => [x.key, x.name] as [string, string])} value={ed.key} onChange={onSeason} /></View> : null}
      <View style={styles.meta}>
        <Text style={styles.metaText}>{ed.fmt} · {range(ed.from, ed.to)}</Text>
        <InfoButton topic="tournament-stats" label="About these stats" />
      </View>
      {summary?.counted ? <Facts s={summary} /> : null}
      {rows.isError ? (
        <View style={styles.errorBox}>
          <Text style={styles.callout}>Could not read the player files.</Text>
          <Press scale={1} onPress={() => void rows.refetch()} accessibilityRole="button" style={styles.retry}><Text style={styles.retryText}>Try again</Text></Press>
        </View>
      ) : !result ? <Loading done={read[0]} total={read[1]} />
        : !result.groups.some((g: any) => g.boards.length) ? <Text style={styles.box}>No player records for this season yet.</Text>
        : <Lists ed={ed} result={result} />}
      {trend.length > 1 ? <Trends points={trend} current={ed.key} onPick={onSeason} /> : null}
    </View>
  );
}

/** The season in four numbers, from the innings totals (matches that count for summary markets, as on the Markets tab). */
function Facts({ s }: { s: any }) {
  const cells: [string, string][] = [["Matches", String(s.matches)], ["Avg 1st inns", fact(s.avgFirst)], ["6s a match", fact(s.sixesPerMatch, 1)], ["Bat 1st won", s.batFirstWinPct == null ? "–" : `${fact(s.batFirstWinPct)}%`]];
  return (
    <View style={styles.facts}>
      {cells.map(([k, v], i) => (
        <View key={k} style={[styles.fact, i > 0 && styles.factSep]}>
          <Text style={styles.cap} numberOfLines={1}>{k}</Text>
          <Text style={styles.factNum}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

function Loading({ done, total }: { done: number; total: number }) {
  return (
    <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="Reading player files">
      <Working label={total ? `Reading player files ${done} / ${total}` : "Reading player files…"} />
      <View style={styles.track}><View style={[styles.bar, { width: `${total ? (100 * done) / total : 0}%` }]} /></View>
    </View>
  );
}

function Lists({ ed, result }: { ed: any; result: any }) {
  const { width } = useWindowDimensions();
  const groups = result.groups.filter((g: any) => g.boards.length);
  const [tab, setTab] = useState("bat");
  const group = groups.find((g: any) => g.id === tab) ?? groups[0];
  const cardW = Math.round(width * FIXTURE_CARD_SHARE);
  return (
    <>
      {result.leaders.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardW + space.snug} decelerationRate="fast" style={styles.bleed} contentContainerStyle={{ gap: space.snug, paddingHorizontal: space.gutter }}>
          {result.leaders.map((l: any) => <LeaderCard key={l.id} l={l} test={ed.fmt === "Test"} width={cardW} />)}
        </ScrollView>
      ) : null}
      {groups.length > 1 ? <Segmented<string> items={groups.map((g: any) => [g.id, g.label] as [string, string])} value={group.id} onChange={setTab} label="Stats" /> : null}
      <View style={{ gap: space.stack }}>{group.boards.map((b: any) => <BoardCard key={`${group.id}-${b.id}`} b={b} />)}</View>
    </>
  );
}

/** The headline card of a list: the leader's picture in his team's shirt, his name and side, and the figure. */
function LeaderCard({ l, test, width }: { l: any; test: boolean; width: number }) {
  const stats = useQuery(storeQuery);
  const store: any = stats.data?.store;
  const r = l.row, team = store.teams[r.t]?.n ?? "";
  return (
    <Press scale={1} onPress={() => push(`/player/${r.p}`)} accessibilityRole="button" accessibilityLabel={`${l.label}: ${store.playerName(r.p)}, ${r.v}`} style={({ pressed }) => [styles.leader, { width }, pressed && { opacity: 0.7 }]}>
      <Text style={styles.cap}>{l.label}</Text>
      <View style={styles.leaderRow}>
        <PlayerAvatar pid={store.P.id[r.p]} team={team} test={test} size={52} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={styles.leaderName} numberOfLines={1}>{store.playerName(r.p)}</Text>
          <Text style={styles.sub} numberOfLines={1}>{abbr(team)}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.leaderNum}>{r.v}</Text>
          <Text style={styles.cap}>{l.head}</Text>
        </View>
      </View>
    </Press>
  );
}

/** One list as a table: rank, name with side, the headline figure, then two supporting columns; the best five, the rest behind "Show all". */
function BoardCard({ b }: { b: any }) {
  const stats = useQuery(storeQuery);
  const store: any = stats.data?.store;
  const [all, setAll] = useState(false);
  const shown = all ? b.rows : b.rows.slice(0, SHOWN);
  const side = (t?: number) => abbr(store.teams[t ?? -1]?.n ?? "");
  const cols: string[] = b.cols.slice(0, 2);
  return (
    <View style={styles.card} accessibilityLabel={b.title}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{b.title}</Text>
        {b.note ? <InfoButton topic="tournament-stats" label={`About ${b.title}`} /> : null}
      </View>
      <View style={styles.tr}>
        <Text style={[styles.th, { width: 22 }]}>#</Text>
        <Text style={[styles.th, { flex: 1 }]}>{b.rows[0]?.p != null ? "Player" : "Team"}</Text>
        <Text style={[styles.th, styles.numCol]} numberOfLines={1}>{b.head}</Text>
        {cols.map((c) => <Text key={c} style={[styles.th, styles.numCol]} numberOfLines={1}>{c}</Text>)}
      </View>
      {shown.map((r: any) => {
        const player = r.p != null, crest = store.teams[r.t]?.n ?? "";
        const name = player ? store.playerName(r.p) : store.teamName(r.t, true);
        const sub = r.m == null ? (player ? side(r.t) : "") : `${player ? `${side(r.t)} ` : ""}v ${side(r.q)}${r.date ? ` · ${day(r.date, false)}` : ""}`;
        return (
          <Press scale={1} key={`${r.rank}-${r.p ?? r.t}-${r.m ?? ""}`} disabled={!player} onPress={() => push(`/player/${r.p}`)} accessibilityRole={player ? "button" : "text"} style={({ pressed }) => [styles.tr, styles.trSep, pressed && { opacity: 0.6 }]}>
            <Text style={[styles.rank, { width: 22 }]}>{r.rank}</Text>
            <View style={styles.who}>
              {player ? <PlayerAvatar pid={store.P.id[r.p]} team={crest} size={32} /> : <TeamBadge name={crest} size={32} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                {sub ? <Text style={styles.subSmall} numberOfLines={1}>{sub}</Text> : null}
              </View>
            </View>
            <Text style={[styles.value, styles.numCol, r.rank === 1 && { color: color.primary }]}>{r.v}</Text>
            {cols.map((_, i) => <Text key={i} style={[styles.extra, styles.numCol]}>{r.cells[i]}</Text>)}
          </Press>
        );
      })}
      {b.rows.length > SHOWN ? (
        <Press scale={1} onPress={() => setAll(!all)} accessibilityRole="button" accessibilityState={{ expanded: all }} style={({ pressed }) => [styles.more, pressed && { opacity: 0.6 }]}>
          <Text style={styles.moreText}>{all ? "Show less" : `Show all ${b.rows.length}`}</Text>
        </Press>
      ) : null}
    </View>
  );
}

/** One measure for every season of this competition (same format and gender), oldest on the left; tap a bar to look at that season. */
function Trends({ points, current, onPick }: { points: any[]; current: string; onPick: (key: string) => void }) {
  const [metric, setMetric] = useState(TREND_METRICS[0].id);
  const m = TREND_METRICS.find((x: any) => x.id === metric) ?? TREND_METRICS[0];
  const vals = points.map((p) => p[m.id] as number | null);
  const top = Math.max(1, ...vals.map((v) => v ?? 0));
  const at = points.findIndex((p) => p.key === current);
  const read = (i: number) => (vals[i] == null ? "–" : m.digits ? vals[i]!.toFixed(m.digits) : String(Math.round(vals[i]!)));
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}><Text style={styles.cardTitle}>Season by season</Text><InfoButton topic="season-trend" label="About season by season" /></View>
      <View style={styles.bleed}><Chips items={TREND_METRICS.map((x: any) => [x.id, x.label] as [string, string])} value={metric} onChange={setMetric} /></View>
      <View style={styles.bars} accessibilityRole="image" accessibilityLabel={`${m.label} by season: ${points.map((p, i) => `${p.label} ${read(i)}`).join(", ")}`}>
        {points.map((p, i) => (
          <Press scale={1} key={p.key} onPress={() => onPick(p.key)} accessibilityRole="button" accessibilityLabel={`${p.label}: ${read(i)}`} accessibilityState={{ selected: p.key === current }} style={styles.barHit}>
            <View style={[styles.barFill, { height: `${Math.max(((vals[i] ?? 0) / top) * 100, 3)}%`, backgroundColor: p.key === current ? color.primary : "rgba(255,255,255,0.25)" }]} />
          </Press>
        ))}
      </View>
      <View style={styles.axis}>
        <Text style={[styles.sub, { flex: 1 }]}>{points[0].label}</Text>
        <Text style={styles.axisMid}>{at >= 0 ? `${points[at].label} · ${read(at)}` : ""}</Text>
        <Text style={[styles.sub, { flex: 1, textAlign: "right" }]}>{points[points.length - 1].label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.stack },
  bleed: { marginHorizontal: -space.gutter },
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  metaText: { ...type.callout, color: color["muted-foreground"] },
  box: { ...type.callout, color: color["muted-foreground"], ...tonal, borderRadius: radius.card, padding: space.stack },
  callout: { ...type.callout, color: color.foreground },
  errorBox: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.snug, backgroundColor: color.card, borderRadius: radius.card, padding: space.stack },
  retry: { height: 36, paddingHorizontal: space.stack, borderRadius: radius.chip, backgroundColor: color.foreground, justifyContent: "center" },
  retryText: { ...type.callout, color: color.background },
  facts: { flexDirection: "row", ...tonal, borderRadius: radius.card, paddingVertical: space.snug },
  fact: { flex: 1, minWidth: 0, gap: 2, paddingHorizontal: space.snug },
  factSep: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: color.hairline },
  factNum: { ...num, fontSize: 24, lineHeight: 28, color: color.foreground },
  cap: { ...type.caption, ...cap, color: color["muted-foreground"] },
  loading: { gap: space.snug },
  track: { height: 4, borderRadius: 2, backgroundColor: color.hairline, overflow: "hidden", marginHorizontal: space.stack },
  bar: { height: "100%", backgroundColor: color.primary, borderRadius: 2 },
  leader: { ...tonal, borderRadius: radius.card, padding: space.stack, gap: space.snug },
  leaderRow: { flexDirection: "row", alignItems: "center", gap: space.snug },
  leaderName: { ...type.body, fontFamily: font.medium, color: color.foreground },
  leaderNum: { ...num, fontSize: 30, lineHeight: 32, color: color.primary },
  sub: { ...type.footnote, color: color["muted-foreground"] },
  subSmall: { ...type.caption, color: color["muted-foreground"] },
  card: { ...tonal, borderRadius: radius.card, paddingTop: space.snug, paddingBottom: space.tight, overflow: "hidden", gap: space.tight },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: space.stack },
  cardTitle: { ...type.body, fontFamily: font.medium, color: color.foreground },
  tr: { flexDirection: "row", alignItems: "center", gap: space.tight, paddingHorizontal: space.stack, minHeight: 28 },
  trSep: { minHeight: 52, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  th: { ...type.caption, ...cap, color: color["muted-foreground"] },
  numCol: { width: 52, textAlign: "right" },
  rank: { ...type.footnote, color: color["muted-foreground"], fontVariant: ["tabular-nums"] },
  who: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: space.snug },
  name: { ...type.callout, fontFamily: font.medium, color: color.foreground },
  value: { ...num, fontSize: 17, color: color.foreground },
  extra: { ...num, fontSize: 15, color: color["muted-foreground"] },
  more: { height: 44, alignItems: "center", justifyContent: "center", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  moreText: { ...type.callout, fontFamily: font.medium, color: color["muted-foreground"] },
  bars: { height: 112, flexDirection: "row", alignItems: "flex-end", gap: 2, marginHorizontal: space.stack, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  barHit: { flex: 1, height: "100%", justifyContent: "flex-end" },
  barFill: { width: "100%", borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  axis: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.stack, paddingBottom: space.snug },
  axisMid: { ...type.footnote, fontFamily: font.medium, color: color.foreground, flex: 2, textAlign: "center" },
});
