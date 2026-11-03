import { push } from "@/lib/nav";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { fancyByLine, fancyFor } from "@cricket/engine/lines.js";
import { FANCY_INNS, MATCH_KEYS, TEAM_KEYS, batFirstBooked, buildOverview, fancyFm, firstInnsMs, innTag, parseFm, scoreMarket } from "@cricket/engine/fancy-edge.js";
import { fancyStanding } from "@cricket/engine/live.js";
import { MATCH_MARKETS, TEAM_TOTAL_MARKETS, selectMatches, topBatters, venueIndices } from "@cricket/engine/markets.js";
import { fancyShareText } from "@cricket/engine/share-text.js";
import { FORMATS } from "@cricket/engine/util.js";
import { abbr, odds, pc } from "@site/lib/format";
import { shareFixtureUrl } from "@site/lib/share";
import { SITE_URL } from "@/lib/config";
import { fxInfoOf } from "@/lib/fancy";
import { storeQuery } from "@/lib/data";
import { liveQuery } from "@/lib/queries";
import { liveMatchFor } from "@/lib/rail";
import { BookBadge } from "@/ui/book-badge";
import { ChartBars } from "@/ui/charts";
import { Chips } from "@/ui/chips";
import { BookList, OverviewRow } from "@/ui/fancy-row";
import { LineStepper } from "@/ui/line-stepper";
import { Working } from "@/ui/motion";
import { PlayerAvatar } from "@/ui/player-avatar";
import { Segmented } from "@/ui/segmented";
import { StandingMark, type Standing } from "@/ui/tick";
import { cap, color, font, num, numLg, radius, space, type, tonal } from "@/ui/tokens";
import { router } from "expo-router";

const fancyLines = fancyFor as (doc: any, fixture: any, key: string, team?: string | null, inn?: number) => any[]; // the engine is plain JS: give its result the shape this view reads
const WINDOWS = [5, 10, 20, 30];
const HERE_MIN = 3;
const DIFFERS = 0.3; // how far (as a share of matches) the ground's hit rate must sit from the teams' form to be called out
const stepOf = (key: string) => (/runs$|score$|^overs_/.test(key) ? 5 : 1);
const pct1 = (r: number | null) => (r == null ? "–" : `${(r * 100).toFixed(1)}%`);
const short = (n: number | null | undefined, d = 1) => (n == null ? "–" : Number.isInteger(n) ? String(n) : n.toFixed(d));

/**
 * Match Fancy: whole-match and team-total markets (runs, session overs, extras, sixes, fours, boundaries, 50s, top over, top score, top batter) over the teams' last N matches in this
 * format (the site's `MatchFancy`; the numbers all come from `engine/fancy-edge.js`). A Test side's 1st / 2nd innings total is its own row. "Bookmaker lines" lists every market the books
 * price, one row each in the props-list style; tapping one opens it below with the median, a chart of every recent match against the line, over / under shares and fair prices, and a line ladder.
 */
export function MatchFancy({ fx, teams, fmt, doc, start }: { fx: any; teams: [string, number][]; fmt: string; doc: any; start?: { fm?: string; sc?: string } }) {
  const stats = useQuery(storeQuery), live = useQuery(liveQuery);
  const store: any = stats.data?.store;
  const liveMatch = liveMatchFor(live.data, doc, fx);
  const [sc, setSc] = useState(start?.sc ?? "-1"), [fmId, setFmId] = useState(start?.fm ?? ""), [win, setWin] = useState(20), [here, setHere] = useState(false), [ml, setMl] = useState<number>();
  const fxInfo = useMemo(() => fxInfoOf(fx), [fx]);
  const fmtIdx = FORMATS.indexOf(fmt);
  const gender = fx.gender === "female" ? 1 : 0;
  const venueName = String(fx.venue || "").split(",")[0].trim();

  const booked = (k: string, teamName: string | null, inn = 0) => k !== "top_batter" && fancyLines(doc, fxInfo, k, teamName, inn).length > 0;
  const anyBooked = (list: [string, string][], teamName: string | null) => list.some(([k]) => (FANCY_INNS as number[]).some((inn) => booked(k, teamName, inn)));
  const scopes = [["-1", "Match", (MATCH_KEYS as [string, string][]).some(([k]) => booked(k, null))] as const, ...teams.map(([name, i]) => [String(i), name, anyBooked(TEAM_KEYS as [string, string][], name)] as const)].filter(([, , on]) => on);
  const scope = scopes.some(([v]) => v === sc) ? Number(sc) : scopes.length ? Number(scopes[0][0]) : -1;
  const team = teams.find(([, i]) => i === scope);
  const keys = (scope < 0 ? MATCH_KEYS : TEAM_KEYS) as [string, string][];
  const keyList = keys.flatMap(([k, lab]) => (scope < 0 ? [0] : (FANCY_INNS as number[])).filter((inn) => booked(k, team?.[0] ?? null, inn)).map((inn) => [fancyFm(k, inn), [innTag(inn), lab].filter(Boolean).join(" · ")] as [string, string]));
  const fm = keyList.some(([k]) => k === fmId) ? fmId : keyList[0]?.[0] || "";
  const { key, inn } = parseFm(fm) as { key: string; inn: number };
  const marketLabel = (k: string) => keys.find(([id]) => id === k)?.[1] ?? (k === "top_batter" ? "Top batter" : (((scope < 0 ? MATCH_MARKETS : TEAM_TOTAL_MARKETS) as any)[k]?.label as string));

  // the ground: the matches played there (the data spells one ground several ways), for the sample switch and the note under the over / under cards
  const venueIdx = useMemo(() => (store ? ((venueIndices as any)(store, fx.venue) as number[]) : []), [store, fx.venue]);
  const hereMatches = (n: number): number[] => (scope < 0 ? (selectMatches as any)(store, { fmt: fmtIdx, gender, venue: venueIdx, lastN: n }) : (selectMatches as any)(store, { fmt: fmtIdx, gender, venue: venueIdx, team: scope, lastN: n }));
  const useHere = here && venueIdx.length > 0;
  const ms = useMemo(() => {
    if (!store) return [] as number[];
    if (useHere) return hereMatches(win);
    const sets = (scope < 0 ? teams : teams.filter(([, i]) => i === scope)).map(([, i]) => (selectMatches as any)(store, { fmt: fmtIdx, gender, team: i, lastN: win }) as number[]);
    return [...new Set(sets.flat())].sort((a, b) => a - b);
  }, [store, teams, scope, fmtIdx, win, useHere, venueIdx]); // eslint-disable-line react-hooks/exhaustive-deps
  const bookedNow = useMemo(() => (!key || key === "top_batter" ? [] : fancyLines(doc, fxInfo, key, team?.[0] ?? null, inn)), [doc, fxInfo, key, team, inn]);
  const batFirstNow = batFirstBooked(bookedNow, inn, scope) as boolean;
  const scoredMs = useMemo(() => (store && batFirstNow ? (firstInnsMs(store, ms, scope) as number[]) : ms), [ms, batFirstNow, store, scope]);
  const run = (k: string, line?: number | null, from = scoredMs): any => (scoreMarket as any)(store, from, scope, k, line, inn);

  // every market the books price, scored on the same matches and ranked by the better side's edge
  const overview = useMemo(() => {
    if (!store) return [] as any[];
    const ground = venueIdx.length ? hereMatches(10) : undefined;
    const inns = scope < 0 ? [0] : (FANCY_INNS as number[]);
    return inns.flatMap((n) => (buildOverview as any)({ store, doc, fxInfo, ms, scope, teamName: team?.[0] ?? null, keys, label: marketLabel, ground, inn: n }))
      .map((r: any) => ({ ...r, standing: fancyStanding(liveMatch, r) }))
      .sort((x: any, y: any) => (y.edge ?? -9) - (x.edge ?? -9));
  }, [doc, ms, fxInfo, team, scope, store, liveMatch, venueIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const book = useMemo(() => (fancyByLine(bookedNow) as { line: number; over: number | null; under: number | null; books: { over: number | null; under: number | null; source: string }[] }[]), [bookedNow]);
  const base = useMemo(() => (!store || !key || key === "top_batter" ? null : run(key)), [store, scoredMs, key, scope, inn]); // eslint-disable-line react-hooks/exhaustive-deps
  const line: number = ml ?? (book.find((l) => l.over != null && l.under != null) ?? book.find((l) => l.over != null) ?? book[0])?.line ?? base?.ladder[2]?.line ?? base?.ladder[0]?.line ?? 0.5;
  const liveSoFar = (key && key !== "top_batter" ? fancyStanding(liveMatch, { key, team: team?.[0] ?? null, inn, line, batFirst: batFirstNow }) : null) as Standing | null;
  const rep = useMemo(() => (key === "top_batter" || !base ? null : run(key, line)), [base, store, scoredMs, key, scope, line]); // eslint-disable-line react-hooks/exhaustive-deps
  // ladder rows: the engine's lines around the median plus the bookmaker's own line(s), computed on the same matches
  const ladder = useMemo(() => {
    if (!rep) return [] as any[];
    const have = new Set(rep.ladder.map((l: any) => l.line));
    const extra = book.filter((b) => !have.has(b.line)).map((b) => run(key, b.line).summary);
    return [...rep.ladder, ...extra].sort((a: any, b: any) => a.line - b.line);
  }, [rep, book, store, scoredMs, key, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const bookHere = book.find((b) => b.line === line);
  const choose = (p: { sc?: string; fm?: string }) => { if (p.sc !== undefined) setSc(p.sc); if (p.fm !== undefined) setFmId(p.fm); setMl(undefined); };

  // how this market has gone at the ground, set against the sample on screen
  const ground = useMemo(() => {
    if (!store || !rep || key === "top_batter" || venueIdx.length === 0) return null;
    const vms = batFirstNow ? (firstInnsMs(store, hereMatches(10), scope) as number[]) : hereMatches(10);
    if (vms.length < HERE_MIN) return null;
    const r = run(key, line, vms).summary, n = vms.length;
    const share = (hit: number, total: number) => (total ? hit / total : 0);
    return { n, under: r.under as number, over: r.over as number, max: r.max as number | null, differs: !useHere && Math.abs(share(r.under, n) - share(rep.summary.under, rep.n)) >= DIFFERS };
  }, [rep, key, line, venueIdx, scope, fmtIdx, store, useHere]); // eslint-disable-line react-hooks/exhaustive-deps

  // the date and side of each match under its bar (the values are the matches of `scoredMs`, oldest first)
  const entries = useMemo(() => (!store || !rep ? [] : scoredMs.map((m, i) => {
    const M = store.M, a = M.a[m], b = M.b[m], opp = scope >= 0 ? (a === scope ? b : a) : -1;
    return { value: rep.values[i] as number, date: M.d[m] as string, opp: "", tag: scope >= 0 ? abbr(store.teamName(opp, true)) : "", m };
  })), [scoredMs, store, scope, rep]);

  const shareLine = () => {
    if (!rep) return;
    const pO = rep.summary.pOver, pU = rep.summary.pUnder;
    const lean = pO != null && pU != null && pO !== pU ? (pO > pU ? "over" : "under") : null;
    const vms = venueIdx.length ? (batFirstNow ? (firstInnsMs(store, hereMatches(10), scope) as number[]) : hereMatches(10)) : [];
    const url = shareFixtureUrl(SITE_URL, fx.id);
    const text = (fancyShareText as any)({ a: fx.a, b: fx.b, label: [innTag(inn), team ? `${team[0]} ` : "", marketLabel(key)].filter(Boolean).join(" ").replace(/\s+/g, " "), line, side: lean, price: lean ? (bookHere as any)?.[lean] : null, values: rep.values, ground: venueName, groundValues: vms.length ? run(key, line, vms).values : [], url });
    void Share.share({ message: text || url, title: `${fx.a} v ${fx.b}` });
  };

  if (!store) return <Working label="Loading…" />;
  return (
    <View style={styles.root}>
      <View style={styles.controls}>
        {scopes.length > 1 ? <Segmented<string> items={scopes.map(([v, label]) => [v, v === "-1" ? "Match" : abbr(label)] as [string, string])} value={String(scope)} onChange={(v) => choose({ sc: v, fm: "" })} label="Scope" /> : null}
        <Segmented<string> items={WINDOWS.map((n) => [String(n), `L${n}`] as [string, string])} value={String(win)} onChange={(v) => { setWin(Number(v)); setMl(undefined); }} label="Matches" />
        <Text style={styles.sample}>
          {scoredMs.length} {fmt} matches{useHere ? ` at ${venueName}` : scope >= 0 ? ` of ${team?.[0]}` : ""}{batFirstNow ? " batting first" : ""}
          {scoredMs.length ? ` · through ${new Date(`${store.M.d[scoredMs[scoredMs.length - 1]]}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}` : ""}
        </Text>
        {venueIdx.length > 0 ? <Segmented<string> items={[["0", "Teams' form"], ["1", `At ${venueName}`]]} value={here ? "1" : "0"} onChange={(v) => { setHere(v === "1"); setMl(undefined); }} label="Matches from" /> : null}
      </View>

      {!ms.length ? <Text style={styles.empty}>No {fmt} matches to base this on.</Text> : (
        <>
          {overview.length > 0 ? (
            <View style={{ gap: space.snug }}>
              <Text style={styles.h2}>Bookmaker lines</Text>
              {liveMatch?.status === "live" ? <Text style={styles.note}>So far this match, delayed up to about 20 seconds. Not used for settlement.</Text> : null}
              <View style={styles.bleed}>
                {overview.map((r: any, i: number) => (
                  <View key={r.id || fancyFm(r.key, r.inn || 0)} style={i > 0 && styles.sep}>
                    <OverviewRow r={r} active={fancyFm(r.key, r.inn || 0) === fm} onOpen={() => choose({ fm: fancyFm(r.key, r.inn || 0) })} />
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ gap: space.snug }}>
            {keyList.length > 1 ? <View style={styles.bleed}><Chips items={keyList} value={fm} onChange={(v) => choose({ fm: v })} /></View> : null}
            {key === "top_batter" ? <TopBatters ms={ms} scope={scope} teamName={team?.[0]} /> : rep ? (
              <View style={{ gap: space.stack }}>
                <View style={styles.titleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.h3}>{[innTag(inn), marketLabel(key)].filter(Boolean).join(" · ")}</Text>
                    <Text style={styles.note}>last {rep.n} matches</Text>
                  </View>
                  <Press scale={1} onPress={shareLine} accessibilityRole="button" accessibilityLabel="Share this line" style={styles.round}><Ionicons name="share-outline" size={20} color={color.foreground} /></Press>
                </View>
                {liveSoFar != null ? <Text style={styles.live}><StandingMark standing={liveSoFar} line={line} /></Text> : null}
                <View style={styles.stats}>
                  <Stat k="Median" v={short(rep.summary.median)} big />
                  <Stat k="Mean" v={rep.summary.mean == null ? "–" : rep.summary.mean.toFixed(1)} />
                  <Stat k="Range" v={`${short(rep.summary.min, 0)}–${short(rep.summary.max, 0)}`} />
                </View>
                <ChartBars entries={entries} line={line} side="over" height={200} />
                <View style={styles.stepRow}>
                  <LineStepper value={line} label="O/U" min={0} onStep={(d) => setMl(d < 0 ? Math.max(0, Math.round((line - stepOf(key)) * 2) / 2) : Math.round((line + stepOf(key)) * 2) / 2)} />
                  {book.filter((b) => b.line !== line).map((b) => (
                    <Press scale={1} key={b.line} onPress={() => setMl(b.line)} accessibilityRole="button" style={styles.lineBtn}>
                      {b.books.map((x) => <BookBadge key={x.source} source={x.source} />)}<Text style={styles.lineBtnText}>line {b.line}</Text>
                    </Press>
                  ))}
                </View>
                <View style={styles.cards}>
                  {(["over", "under"] as const).map((side) => {
                    const p: number | null = rep.summary[side === "over" ? "pOver" : "pUnder"], fair = rep.summary[side === "over" ? "fairOver" : "fairUnder"], hit = rep.summary[side];
                    const b = bookHere && bookHere[side] != null ? bookHere.books.find((x) => x[side] === bookHere[side]) : null;
                    return (
                      <View key={side} style={styles.side}>
                        <Text style={styles.sideKey}>{side} {line}</Text>
                        <Text style={[styles.sideNum, side === "over" && { color: color.primary }]}>{pct1(p)}</Text>
                        <Meter value={p ?? 0} tone={side === "over" ? color.primary : "rgba(255,255,255,0.7)"} />
                        <Text style={styles.note}>{hit} of {rep.n} · fair {odds(fair)}</Text>
                        {b ? <View style={styles.sideBook}><BookBadge source={b.source} /><Text style={styles.sidePrice}>{odds(b[side])}</Text></View> : null}
                      </View>
                    );
                  })}
                </View>
                {ground ? (
                  <Text style={[styles.note, ground.differs && { color: color.amber }]}>
                    {ground.differs ? <Text style={{ fontFamily: font.medium }}>Ground differs. </Text> : null}At {venueName}, last {ground.n} {fmt} {scope >= 0 ? `of ${team?.[0]}` : "matches"}: {ground.under} under {line}, {ground.over} over{ground.max != null ? ` · highest ${ground.max}` : ""}
                    {useHere ? "" : ` (teams' form: ${rep.summary.under} of ${rep.n} under)`}.
                  </Text>
                ) : null}
                {bookHere ? <BookList books={bookHere.books} shown={(["over", "under"] as const).map((s) => (bookHere[s] != null ? bookHere.books.find((x) => x[s] === bookHere[s])?.source : undefined))} /> : null}
                {rep.n < 10 ? <Text style={[styles.note, { color: color.amber }]}>Small sample ({rep.n} matches): treat these with caution.</Text> : null}

                <View style={styles.ladder}>
                  <View style={styles.ladderHead}><Text style={[styles.th, { flex: 1 }]}>Line</Text><Text style={[styles.th, styles.col]}>Over</Text><Text style={[styles.th, styles.col]}>Under</Text></View>
                  {ladder.map((l: any) => (
                    <Press scale={1} key={l.line} onPress={() => setMl(l.line)} accessibilityRole="button" style={({ pressed }) => [styles.ladderRow, l.line === line && styles.ladderOn, pressed && { opacity: 0.6 }]}>
                      <View style={styles.lineCell}><Text style={styles.ladderLine}>{l.line}</Text>{book.find((b) => b.line === l.line)?.books.map((x) => <BookBadge key={x.source} source={x.source} />)}</View>
                      <Text style={[styles.col, styles.cellNum]}><Text style={{ color: color.primary }}>{pc(l.pOver)}</Text> <Text style={styles.fair}>{odds(l.fairOver)}</Text></Text>
                      <Text style={[styles.col, styles.cellNum]}>{pc(l.pUnder)} <Text style={styles.fair}>{odds(l.fairUnder)}</Text></Text>
                    </Press>
                  ))}
                </View>
              </View>
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

function Stat({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return <View style={{ gap: 2 }}><Text style={styles.statKey}>{k}</Text><Text style={[styles.statNum, big && { fontSize: 34, lineHeight: 38 }]}>{v}</Text></View>;
}

/** A share as a bar that fills from the left on the UI thread. */
function Meter({ value, tone }: { value: number; tone: string }) {
  const w = useSharedValue(0);
  useEffect(() => { w.value = withTiming(value, { duration: 450 }); }, [value, w]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(w.value, 0.001) }] })); // scale, not width: no layout pass per frame
  return <View style={styles.meter}><Animated.View style={[styles.meterFill, { backgroundColor: tone, transformOrigin: "left" } as object, fill]} /></View>;
}

/** The chance of each batter making the highest score (of the match, or of the side batting first), from the matches on screen. */
function TopBatters({ ms, scope, teamName }: { ms: number[]; scope: number; teamName?: string }) {
  const stats = useQuery(storeQuery);
  const store: any = stats.data?.store;
  const t = useMemo(() => (scope < 0 ? (topBatters as any)(store, ms, { scope: "match" }) : (topBatters as any)(store, ms, { team: scope, scope: "team" })) as { n: number; rows: any[] }, [store, ms, scope]);
  const max = Math.max(...t.rows.map((r) => r.pSole), 0.0001);
  return (
    <View style={styles.top}>
      <View style={{ padding: space.stack, gap: 2 }}>
        <Text style={styles.h3}>Top batter</Text>
        <Text style={styles.note}>{scope < 0 ? `highest score in the match, last ${t.n} matches` : `${teamName} batting first, last ${t.n} matches`}</Text>
      </View>
      {t.rows.map((r) => (
        <Press scale={1} key={r.player} onPress={() => push(`/player/${r.player}`)} accessibilityRole="button" style={({ pressed }) => [styles.topRow, pressed && { opacity: 0.6 }]}>
          <View style={[styles.topFill, { width: `${(r.pSole / max) * 100}%` }]} />
          <PlayerAvatar pid={store.P.id[r.player]} team={store.teamName(store.P.tm[r.player])} size={36} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.topName} numberOfLines={1}>{r.name}</Text>
            <Text style={styles.note}>{r.sole} sole{r.tied ? ` + ${r.tied} tied` : ""} of {t.n}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}><Text style={styles.topPct}>{pct1(r.pSole)}</Text><Text style={styles.note}>fair {odds(r.fairSole)}</Text></View>
        </Press>
      ))}
      {!t.rows.length ? <Text style={[styles.note, { padding: space.stack }]}>Not enough matches.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.stack },
  controls: { gap: space.snug },
  sample: { ...type.footnote, color: color["muted-foreground"] },
  empty: { ...type.callout, color: color["muted-foreground"] },
  h2: { ...type.title, color: color.foreground },
  h3: { ...type.body, fontFamily: font.medium, color: color.foreground },
  note: { ...type.footnote, color: color["muted-foreground"] },
  bleed: { marginHorizontal: -space.gutter },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.snug },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.secondary, alignItems: "center", justifyContent: "center" },
  live: { ...type.callout, color: color.primary },
  stats: { flexDirection: "row", alignItems: "flex-end", gap: space.group },
  statKey: { ...type.footnote, color: color["muted-foreground"] },
  statNum: { ...numLg, fontSize: 24, letterSpacing: -0.48, lineHeight: 28, color: color.foreground },
  stepRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.snug },
  lineBtn: { height: 36, flexDirection: "row", alignItems: "center", gap: space.tight, paddingHorizontal: space.snug + 2, borderRadius: radius.chip, backgroundColor: color.secondary },
  lineBtnText: { ...type.callout, color: color.foreground },
  cards: { flexDirection: "row", gap: space.snug },
  side: { flex: 1, gap: space.tight, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, paddingTop: space.snug },
  sideKey: { ...type.footnote, fontFamily: font.medium, color: color["muted-foreground"], textTransform: "capitalize" },
  sideNum: { ...numLg, fontSize: 28, letterSpacing: -0.56, lineHeight: 32, color: color.foreground },
  sideBook: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, paddingTop: space.tight },
  sidePrice: { ...num, fontSize: 16, color: color.primary },
  meter: { height: 6, borderRadius: 3, backgroundColor: color.hairline, overflow: "hidden" },
  meterFill: { height: "100%", width: "100%", borderRadius: 3 },
  ladder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  ladderHead: { flexDirection: "row", alignItems: "center", paddingVertical: space.tight },
  th: { ...type.caption, ...cap, color: color["muted-foreground"] },
  col: { width: 112, textAlign: "right" },
  ladderRow: { flexDirection: "row", alignItems: "center", minHeight: 46, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  ladderOn: { backgroundColor: "rgba(58,58,60,0.45)" },
  lineCell: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.tight },
  ladderLine: { ...num, fontSize: 17, color: color.foreground },
  cellNum: { ...num, fontSize: 16, color: color.foreground },
  fair: { ...type.footnote, color: color["muted-foreground"] },
  top: { ...tonal, borderRadius: radius.card, overflow: "hidden" },
  topRow: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.stack, paddingVertical: space.snug, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  topFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "rgba(39,218,142,0.10)" },
  topName: { ...type.body, fontFamily: font.medium, color: color.foreground },
  topPct: { ...num, fontSize: 18, color: color.primary },
});
