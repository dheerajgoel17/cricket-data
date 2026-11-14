import { push } from "@/lib/nav";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Share, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { SCOPE_LABEL } from "@cricket/engine/lines.js";
import { lineNotIn, lineStanding, liveForFixture } from "@cricket/engine/live.js";
import { shareText } from "@cricket/engine/share-text.js";
import { sideEdge } from "@cricket/engine/stats.js";
import { barState, windowRate } from "@cricket/engine/windows.js";
import { fmtIndex } from "@cricket/engine/util.js";
import { abbr, num, odds, pc } from "@site/lib/format";
import { sharePlayerUrl } from "@site/lib/share";
import { SITE_URL } from "@/lib/config";
import { deriveChart, STAT_OPTIONS, usePlayerScreen, type Filters } from "@/lib/player";
import { useQuery } from "@tanstack/react-query";
import { profileParts } from "@/lib/profile";
import { profilesQuery } from "@/lib/queries";
import { Accordion } from "@/ui/accordion";
import { BlurBar, BlurTargetView, useCollapseOnScroll } from "@/ui/blur-bar";
import { BookBadge } from "@/ui/book-badge";
import { ChartBars, Gauge, OutcomeDonut } from "@/ui/charts";
import { CountUp } from "@/ui/count-up";
import { CapsuleTabs } from "@/ui/capsule";
import { Bleed } from "@/ui/bleed";
import { ChoiceChip, ChoiceRow } from "@/ui/chips";
import { DataTable, Metric, Pill } from "@/ui/data-table";
import { EmptyState } from "@/ui/empty-state";
import { InfoButton } from "@/ui/info-button";
import { useScreenInsets } from "@/ui/insets";
import { LineStepper } from "@/ui/line-stepper";
import { enter } from "@/ui/motion";
import { PlayerSkeleton } from "@/ui/skeletons";
import { MatchStatus, NextFilters, NextMatchCard } from "@/ui/next-match";
import { PageHeader, RoundButton } from "@/ui/page-header";
import { PlayerPortrait } from "@/ui/player-avatar";
import { Segmented } from "@/ui/segmented";
import { pushRecentPlayer } from "@/lib/saved";
import { PropStar, StarButton } from "@/ui/star";
import { TeamBadge } from "@/ui/team-badge";
import { Tick } from "@/ui/tick";
import { cap, color, control, font, radius, space, type, tonal } from "@/ui/tokens";
import { TabFade } from "@/ui/tab-fade";
import { WindowPills } from "@/ui/window-pills";

const HOME_AWAY: [string, string][] = [["", "any"], ["home", "home"], ["away", "away"], ["neutral", "neutral"]];
const FILTER_GROUPS: { key: keyof Filters; label: string; options?: [string, string][] }[] = [
  { key: "opp", label: "Opposition" }, { key: "venue", label: "Venue" },
  { key: "vt", label: "Home / away", options: HOME_AWAY },
  { key: "inn", label: "Batted first / chasing", options: [["", "any"], ["first", "batted first"], ["second", "chasing"]] },
  { key: "pos", label: "Position", options: [["", "any"], ["1-2", "openers"], ["1-3", "top 3"], ["4-6", "middle"], ["7-11", "lower"]] },
  { key: "lvl", label: "Level", options: [["", "all"], ["intl", "international"], ["club", "club / league"]] },
  { key: "last", label: "Last games", options: [["", "all"], ["5", "5"], ["10", "10"], ["20", "20"]] },
];

/**
 * A player, as on the site: the stat chips and format switch in a blurred bar that tucks away while you scroll down and returns when you scroll up; the player, his numbers, the
 * chart against a line he can step, the match he plays next, filters, and the lines, game log and splits. Opened from a prop row on its line (`?stat=&line=&fmt=&scope=&start=`).
 */
export default function PlayerPage() {
  const params = useLocalSearchParams<{ idx: string; stat?: string; line?: string; fmt?: string; scope?: string; team?: string; start?: string }>();
  const idx = Number(params.idx);
  const inset = useScreenInsets(false);
  const [stat, setStat] = useState(params.stat ?? "");
  const [fmt, setFmt] = useState<number | undefined>(params.fmt !== undefined && params.fmt !== "" ? Number(params.fmt) : undefined);
  const [scope, setScope] = useState<number | undefined>(params.scope ? Number(params.scope) : undefined);
  const [lineQ, setLineQ] = useState<number | undefined>(params.line !== undefined && params.line !== "" && Number.isFinite(Number(params.line)) ? Number(params.line) : undefined);
  const [startQ] = useState(params.start || undefined); // kick-off of the priced match the link opened from (sticky for kit / lines when two games share a format)
  const [filters, setFilters] = useState<Filters>({});
  const s = usePlayerScreen(idx, { stat, fmt, scope, line: lineQ, start: startQ, filters });
  const profile = profileParts(useQuery(profilesQuery).data, s.pid).join(" · ");
  useEffect(() => { if (s.ok) pushRecentPlayer(idx); }, [idx, s.ok]);
  const pricedSet = useMemo(() => new Set(s.pricedStats), [s.pricedStats]);

  const target = useRef<ComponentRef<typeof View>>(null);
  const { collapsed, onScroll, y } = useCollapseOnScroll();
  const [barH, setBarH] = useState(0), [subH, setSubH] = useState(0);
  const sub = useAnimatedStyle(() => ({ height: subH ? subH * (1 - collapsed.value) : undefined, opacity: 1 - collapsed.value }));
  // the hero: the portrait rides slower than the page and fades as it goes, and swells when the page is pulled down past the top; the name follows more gently
  const portraitFx = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, 240], [1, 0.15], "clamp"), transform: [{ translateY: y.value * 0.35 }, { scale: 1 + Math.max(-y.value, 0) / 520 }] }));
  const nameFx = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * 0.12 }] }));

  const res = s.res.data;
  // cached plan / lines: never blank the page on a background refetch
  const loading = s.loadingStore || (!res && !s.res.isError);
  const patch = (p: Record<string, string>) => { setFilters((f) => ({ ...f, ...p })); setLineQ(undefined); };
  const share = () => {
    const entries = res?.ok ? res.chart?.entries : [];
    const line = lineQ ?? (s.book ? s.book.main.line : null);
    const price = Math.max(0, ...(s.book?.lines?.find((l: any) => line != null && Math.abs(l.line - line) < 0.01)?.books || []).map((b: any) => b.over || 0)) || null;
    const url = sharePlayerUrl(SITE_URL, idx, s.stat, line);
    void Share.share({ message: shareText({ entries, line, side: "over", fmt: s.fmt, price, ground: s.next?.ground, opp: s.next?.opp, url }) || url, title: s.name });
  };
  const game = (e: any, st: string, label: string, auxLabel?: string) => push({ pathname: "/info/[topic]", params: { topic: "game", d: e.date, o: e.opp, v: e.venueName ?? "", x: e.value == null ? ({ void: "VOID: in the XI, did not bat/bowl", na: "N/A: XI not recorded", dnp: "DNP: not in the XI" } as any)[st] ?? "–" : String(e.value), l: label, a: auxLabel && e.value != null ? `${auxLabel}: ${e.aux ?? "–"}` : "", p: e.pos ? `No. ${e.pos}` : "", n: s.name } });

  return (
    <View style={styles.root}>
      <BlurTargetView ref={target} style={styles.root}>
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: barH, paddingBottom: inset.bottom + space.section }}>
          {!s.loadingStore && !s.ok ? <View style={styles.pad}><EmptyState title="Unknown player" body="This player is not in the stats data." /></View> : (
            <>
              <View style={[styles.hero, styles.pad]}>
                <Animated.View style={[styles.heroLeft, nameFx]}>
                  <Text style={styles.name} numberOfLines={2}>{s.name}</Text>
                  <View style={styles.teamLine}>
                    <View style={styles.logoCrop}><TeamBadge name={s.side} size={56} bare /></View>
                    <Text style={styles.sub} numberOfLines={1}>{s.side}</Text>
                  </View>
                  {profile ? <Text style={styles.profile} numberOfLines={2}>{profile}</Text> : null}
                </Animated.View>
                {s.pid ? <Animated.View style={portraitFx}><PlayerPortrait pid={s.pid} team={s.side || params.team} test={s.fmt === "Test"} width={112} /></Animated.View> : null}
              </View>
              {loading ? (
                <View style={{ paddingTop: space.stack }} accessibilityRole="progressbar" accessibilityLabel="Reading his games…"><PlayerSkeleton /></View>
              ) : !res.ok ? (
                <View style={styles.pad}><EmptyState title="Could not load games" body={String(res.error || "Try again in a moment.")} /></View>
              ) : (
                <Loaded key={`${s.stat}-${s.fmtVal}-${JSON.stringify(s.plan.filters)}-${s.plan.venue}-${s.book ? 1 : 0}`} s={s} filters={filters} onFilters={patch} onGame={game} />
              )}
            </>
          )}
        </Animated.ScrollView>
      </BlurTargetView>

      <View style={styles.bar} onLayout={(e) => setBarH((h) => Math.max(h, Math.round(e.nativeEvent.layout.height)))}>
        <BlurBar blurTarget={target} style={{ paddingTop: inset.top }}>
          <PageHeader title={s.name || "Player"} subtitle={s.side || undefined} buttons={2} right={s.ok ? (
            <>
              <StarButton idx={idx} />
              <RoundButton label="Share" onPress={share}><Ionicons name="share-outline" size={20} color={color.foreground} /></RoundButton>
            </>
          ) : undefined} />
          <CapsuleTabs label="Stat" items={STAT_OPTIONS.map(([k, l]) => [k, l, !pricedSet.has(k)] as [string, string, boolean])} value={s.stat} onChange={(k) => { setStat(k); setLineQ(undefined); }} />
          <Animated.View style={[styles.sub2, sub]}>
            <View onLayout={(e) => { const h = Math.round(e.nativeEvent.layout.height); if (h && h !== subH) setSubH(h); }} style={[styles.subInner, { position: "absolute", left: 0, right: 0, top: 0 }]}>
              {s.fmts.length > 1 ? <Segmented<string> items={s.fmts.map(([i, f]) => [String(i), f] as [string, string])} value={String(s.fmtVal)} onChange={(v) => { setFmt(Number(v)); setLineQ(undefined); setScope(undefined); }} label="Format" /> : null}
              {s.testBat ? <Segmented<string> items={[0, 1, 2].map((n) => [String(n), (SCOPE_LABEL as any)[n]] as [string, string])} value={String(s.scope)} onChange={(v) => { setScope(Number(v)); setLineQ(undefined); }} label="Innings" /> : null}
            </View>
          </Animated.View>
        </BlurBar>
      </View>
      <TabFade withTabBar={false} />
    </View>
  );
}

const arrow = (up: boolean | null) => (up == null ? null : <Text style={{ color: up ? color.primary : color.miss, fontSize: 12 }}>{up ? "▲ " : "▼ "}</Text>);

/** A hit rate on a tint that says how good it is (green from 60%, red to 40%), all one width so a column lines up. */
function HitCell({ p }: { p: number | null }) {
  return <Pill text={p == null ? "–" : pc(p)} tone={p == null ? "none" : p >= 0.6 ? "up" : p <= 0.4 ? "down" : "mid"} />;
}

function Loaded({ s, filters, onFilters, onGame }: { s: ReturnType<typeof usePlayerScreen>; filters: Filters; onFilters: (p: Record<string, string>) => void; onGame: (e: any, st: string, label: string, aux?: string) => void }) {
  const res = s.res.data, c = res.chart, entries: any[] = c ? c.entries : [];
  const { book, next, fmt, stat, idx, pid, name } = s;
  const [line, setLine] = useState<number>(c ? c.line : 0.5);
  const [side, setSide] = useState<"over" | "under">(c ? c.side : "over");
  const [win, setWin] = useState<number>(entries.length > 10 ? 10 : 0);
  const [tab, setTab] = useState("lines");
  const [logCount, setLogCount] = useState(30);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const d = useMemo(() => deriveChart({ entries, line, side, win, summary: res.summary, sameLine: res.plan?.line === line && (res.plan?.side || "over") === side }), [entries, line, side, win, res]);
  const { ws, cur, all, shown, mix } = d;
  const bookAt = book ? book.lines.find((l: any) => l.line === line) : null;
  const bestPrice = bookAt ? Math.max(0, ...bookAt.books.map((b: any) => b[side] || 0)) : 0;
  const prior = bookAt?.prob == null ? null : side === "over" ? bookAt.prob : 1 - bookAt.prob;
  const edge = bookAt && cur ? sideEdge(cur.hits, cur.played, prior, bestPrice) : null;
  const active = (res.filters || []).filter(([k]: [string]) => !["Player", "Stat", "Format", "Line", "Side", "Test innings"].includes(k));
  const slices = [
    { key: "hit", n: mix.hit, color: color.hit }, { key: "miss", n: mix.miss, color: color.miss }, { key: "push", n: mix.push, color: color.amber }, { key: "out", n: mix.out, color: color.dnp },
  ].filter((x) => x.n > 0);
  const sideLetter = side === "over" ? "O" : "U";
  const label = res.statLabel as string;

  const [ha, hb] = String(next?.match || "").split(/\s+vs\s+/i);
  const liveMatch = next ? liveForFixture(s.live.data, { a: next.team || ha, b: next.opp || hb, start: next.start, fmt }) : null;
  const asLine = book ? { pid, player: name, book_name: book.book_name, team: book.team, stat, line, inn: book.inn } : null;
  const lastE = entries[entries.length - 1];
  const settled = lastE && next && abbr(lastE.opp) === abbr(next.opp) && Math.abs(Date.parse(String(lastE.date)) - Date.parse(String(next.start).slice(0, 10))) <= 86400e3 ? lastE.value : undefined;
  const standing = book && next?.priced && asLine ? lineStanding(liveMatch, asLine, s.identity, { stored: book.result, settled }) : null;
  const out = !!(book && next?.priced && asLine && lineNotIn(liveMatch, asLine, s.identity));
  const step = (dlt: number) => setLine((v) => Math.max(0.5, Math.round((v + dlt) * 100) / 100));

  // options for the Opposition and Venue filters: what is on the chart now, the biggest samples first
  const topBy = (pick: (e: any) => string | undefined) => {
    const m = new Map<string, number>();
    for (const e of entries) { const v = pick(e); if (v) m.set(v, (m.get(v) || 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([v]) => v);
  };
  const optionsFor = (k: keyof Filters): [string, string][] => {
    const g = FILTER_GROUPS.find((x) => x.key === k)!;
    if (g.options) return g.options;
    const vals = topBy(k === "opp" ? (e) => e.opp : (e) => e.venueName);
    const chosen = filters[k];
    return [["", "any"], ...(chosen && !vals.includes(chosen) ? [[chosen, chosen] as [string, string]] : []), ...vals.map((v) => [v, k === "venue" ? String(v).split(",")[0] : v] as [string, string])];
  };
  const clearAll = () => onFilters({ opp: "", venue: "", vt: "", inn: "", pos: "", lvl: "", last: "" });

  if (!entries.length || !cur) {
    return (
      <View style={[styles.pad, { gap: space.stack, paddingTop: space.snug }]}>
        {!book ? <Unpriced label={label} /> : null}
        {next ? <NextMatchCard next={next} entries={entries} line={line} side={side} book={next.priced ? book : null} statLabel={label} fmt={fmt} standing={standing} out={out} /> : null}
        <EmptyState
          title={`No ${res.sample?.unit || "games"}`}
          body={active.length ? "No games match these filters. Relax a filter to see a sample." : "No games match this selection."}
          action={active.length ? <Press scale={1} onPress={clearAll} style={styles.button} accessibilityRole="button"><Text style={styles.buttonText}>Clear filters</Text></Press> : undefined}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: space.stack }}>
      <Animated.View entering={enter(0)} style={[styles.pad, { gap: space.snug }]}>
        <View style={styles.metrics}>
          <View style={styles.metricGrid}>
            <Metric compact k={`${cur.label} avg`}><View style={styles.countRow}>{arrow(cur.mean == null ? null : cur.mean > line)}{cur.mean == null ? <Text style={styles.metricNum}>–</Text> : <CountUp value={cur.mean} digits={2} style={styles.metricNum} />}</View></Metric>
            <Metric compact k={book ? "Line" : "Research line"}>{`${sideLetter} ${line}`}</Metric>
            <Metric compact text k="Prop">{label}</Metric>
            <Metric compact k="Hit rate"><View style={styles.countRow}>{arrow(cur.p == null ? null : cur.p >= 0.5)}{cur.p == null ? <Text style={styles.metricNum}>–</Text> : <CountUp value={Math.round(cur.p * 100)} suffix="%" style={styles.metricNum} />}</View></Metric>
            <Metric compact k="Fair price">{cur.p ? <CountUp value={1 / cur.p} digits={2} style={styles.metricNum} /> : "–"}</Metric>
            <Metric compact k="Opponent">{next?.opp ? <View style={styles.oppRow}><Text style={styles.metricTextSm}>{abbr(next.opp)}</Text><MatchStatus phase={next.phase || "upcoming"} start={next.start} /></View> : <Text style={styles.metricTextSm}>–</Text>}</Metric>
          </View>
          <View style={styles.gaugeCard}>
            {slices.length >= 3 ? <OutcomeDonut caption={`${cur.label} hit rate`} center={cur.p == null ? "–" : `${Math.round(cur.p * 100)}%`} slices={slices} /> : <Gauge p={cur.p} caption={`${cur.label} hit rate`} />}
          </View>
        </View>
      </Animated.View>
      <View style={styles.rule} />

      {!book ? <View style={styles.pad}><Unpriced label={label} /></View> : null}

      <View style={[styles.pad, { gap: space.snug }]}>
        <View style={styles.controls}>
          <Segmented<"over" | "under"> items={[["over", "Over"], ["under", "Under"]]} value={side} onChange={setSide} label="Side" width={150} />
          <View style={styles.controlsRight}>
            <LineStepper value={line} label={sideLetter} onStep={step} />
            <PropStar idx={idx} stat={stat} line={line} fmt={fmtIndex(fmt)} />
          </View>
        </View>
        {book && book.lines.length > 1 ? (
          <Accordion title="Alt lines" badge={book.lines.length} value={edge != null ? `Edge ${edge >= 0 ? "+" : ""}${Math.round(edge * 100)}%` : undefined}>
            <View style={{ paddingBottom: space.snug }}>
              <View style={styles.altHead}><View style={styles.altBadge} /><Text style={[styles.altCol, styles.altPrice]}>Over</Text><Text style={[styles.altCol, styles.altPrice]}>Under</Text></View>
              {book.lines.map((l: any) => {
                const hist = windowRate(entries, cur.n, l.line, "over");
                const bestO = Math.max(0, ...l.books.map((b: any) => b.over || 0));
                return (
                  <Press scale={1} key={l.line} onPress={() => { void Haptics.selectionAsync(); setLine(l.line); }} accessibilityRole="button" accessibilityLabel={`Use line ${l.line}`} style={({ pressed }) => [styles.altRow, line === l.line && styles.altOn, pressed && { opacity: 0.6 }]}>
                    <View style={styles.altTop}>
                      <Text style={styles.altLine}>O/U {l.line}{l === book.main ? <Text style={styles.main}>  MAIN</Text> : null}</Text>
                      <Text style={styles.altRates}>MKT <Text style={styles.strong}>{l.prob == null ? "–" : pc(l.prob)}</Text>   {cur.label.toUpperCase()} <Text style={styles.strong}>{hist.p == null ? "–" : pc(hist.p)}</Text></Text>
                    </View>
                    {l.books.map((b: any) => (
                      <View key={b.source} style={styles.altBook}>
                        <View style={styles.altBadge}><BookBadge source={b.source} /></View>
                        <Tick value={b.over} style={{ ...styles.altPrice, color: l.books.length > 1 && b.over === bestO ? color.primary : color.foreground }}>{odds(b.over)}</Tick>
                        <Text style={[styles.altPrice, { color: color["muted-foreground"] }]}>{odds(b.under)}</Text>
                      </View>
                    ))}
                  </Press>
                );
              })}
            </View>
          </Accordion>
        ) : null}
      </View>

      <View style={[styles.pad, { gap: space.snug }]}>
        <ChartBars entries={shown} line={line} side={side} height={240} onSelect={(e, st) => onGame(e, st, `${label} ${side} ${line}`, c.auxLabel)} />
        <View style={styles.windowRow}>
          <View style={{ flex: 1 }}><WindowPills items={ws.map((w: any) => ({ n: w.n, label: w.label, p: w.p }))} value={cur.n} onChange={setWin} /></View>
          <RoundButton label="Filters" active={filtersOpen || active.length > 0} onPress={() => setFiltersOpen((o) => !o)}>
            <Ionicons name="options-outline" size={20} color={active.length ? color.primary : color.foreground} />
          </RoundButton>
        </View>
        {mix.out > 0 || cur.played < 5 ? (
          <View style={styles.counted}>
            <Text style={[styles.sub, cur.played < 5 && { color: color.amber }]}>
              {mix.out > 0 ? <><Text style={styles.strong}>{mix.out}</Text> void or not in the XI left out · <Text style={styles.strong}>{cur.played}</Text> {res.sample?.unit || "games"} counted.</> : null}
              {cur.played < 5 ? `${mix.out > 0 ? " " : ""}Too few for a steady read.` : ""}
            </Text>
            {mix.out > 0 ? <InfoButton topic="chart" label="About this chart" /> : null}
          </View>
        ) : null}
        {book && !(bookAt && next?.priced) ? (bookAt ? (
          <View style={styles.bookRow}>
            {bookAt.books.map((b: any) => <View key={b.source} style={styles.altBook}><BookBadge source={b.source} /><Tick value={b.over} style={{ ...type.callout, color: color.foreground }}>{odds(b.over)}</Tick><Text style={styles.sub}>/ {odds(b.under)}</Text></View>)}
          </View>
        ) : <Text style={styles.sub}>The books price {book.main.line}, not {line}.</Text>) : null}
      </View>

      {next ? (
        <View style={[styles.pad, { gap: space.snug }]}>
          <NextMatchCard next={next} entries={entries} line={line} side={side} book={next.priced ? book : null} statLabel={label} fmt={fmt} standing={standing} out={out} />
        </View>
      ) : null}

      <View style={styles.pad}>
        <Accordion title="Filters" badge={active.length || undefined} value={active.length ? `${active.length} on` : "All matches"} open={filtersOpen} onToggle={setFiltersOpen}>
          <View style={{ paddingBottom: space.snug, gap: space.snug }}>
            {next && (next.opp || next.known) ? <NextFilters next={next} filters={filters} onChange={onFilters} /> : null}
            {FILTER_GROUPS.map((g) => {
              const options = optionsFor(g.key);
              const chosen = options.find(([v]) => v === (filters[g.key] ?? ""));
              return (
                <Accordion key={g.key} title={g.label} value={chosen && chosen[0] ? chosen[1] : "any"} open={openGroup === g.key} onToggle={(o) => setOpenGroup(o ? g.key : null)}>
                  <ChoiceRow>
                    {options.map(([v, text]) => {
                      const on = (filters[g.key] ?? "") === v;
                      return (
                        <ChoiceChip key={v || "any"} label={text} on={on} onPress={() => { void Haptics.selectionAsync(); onFilters({ [g.key]: v }); }} />
                      );
                    })}
                  </ChoiceRow>
                </Accordion>
              );
            })}
            {active.length ? <Press scale={1} onPress={clearAll} style={[styles.button, { alignSelf: "flex-start", marginTop: space.snug }]} accessibilityRole="button"><Text style={styles.buttonText}>Clear filters</Text></Press> : null}
          </View>
        </Accordion>
      </View>

      <View style={[styles.pad, { gap: space.snug }]}>
        <Text style={styles.cap}>At a glance</Text>
        {all ? (
          <View style={styles.glanceCard}>
            <View style={styles.glance}>
              <View style={styles.glanceCell}><Text style={styles.glanceKey}>Cleared</Text><Text style={styles.glanceNum} numberOfLines={1}>{all.hits}<Text style={styles.glanceOf}>/{all.played}</Text></Text></View>
              <View style={styles.glanceRule} />
              <View style={styles.glanceCell}><Text style={styles.glanceKey}>Hit rate</Text><Text style={[styles.glanceNum, { color: all.p == null ? color.foreground : all.p >= 0.6 ? color.primary : all.p <= 0.4 ? color.miss : color.amber }]}>{all.p == null ? "–" : `${(all.p * 100).toFixed(1)}%`}</Text></View>
              <View style={styles.glanceRule} />
              <View style={styles.glanceCell}><Text style={styles.glanceKey}>Fair price</Text><Text style={styles.glanceNum}>{all.p ? odds(1 / all.p) : "–"}</Text></View>
            </View>
            <Text style={styles.glanceFoot}>{name} · {fmt} {label.toLowerCase()} {side} {line} over all {all.played} {res.sample?.unit || "innings"} in this sample.</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.pad, { gap: space.stack }]}>
        <Segmented<string> items={[["lines", "Lines"], ["logs", "Game log"], ["splits", "Splits"]]} value={tab} onChange={setTab} label="Sections" />
        {tab === "lines" ? (
          <Animated.View entering={enter(0)} style={{ gap: space.stack }}>
            {(() => {
              const ladder = (res.ladder as any[]).filter((l) => l.n);
              return (
                <DataTable
                  bleed
                  columns={["Line", "Over", "Fair", "Under", "Fair"]}
                  flex={[0.9, 1.5, 1, 1.5, 1]}
                  highlight={ladder.findIndex((l) => Math.abs(l.line - line) < 0.01)}
                  rows={ladder.map((l) => [`${l.line}`, <HitCell key="o" p={l.pOver} />, odds(l.fairOver), <HitCell key="u" p={l.pUnder} />, odds(l.fairUnder)])} />
              );
            })()}
            {res.corr ? (
              <View style={{ gap: space.snug }}>
                <Text style={styles.h3}>When {label.toLowerCase()} {res.plan?.side || "over"} {c?.line ?? res.line} hits</Text>
                <Text style={styles.noteText}>{res.corr.n} of {res.corr.of} {res.sample.unit}: how often his other props also clear in those games.</Text>
                <DataTable bleed columns={["Prop", "Normal", "When it hits", "Lift"]} flex={[2.3, 1, 1.2, 1.1]}
                  rows={res.corr.rows.map((x: any) => [`${x.label} over ${x.line}`, pc(x.base), pc(x.cond), <Pill key="l" text={`${x.lift >= 0 ? "+" : ""}${Math.round(x.lift * 100)}`} tone={x.lift >= 0.1 ? "up" : x.lift <= -0.1 ? "down" : "none"} width={48} />])} />
              </View>
            ) : null}
          </Animated.View>
        ) : null}
        {tab === "logs" ? (
          <Animated.View entering={enter(0)}>
            <Bleed>
            {[...entries].reverse().slice(0, logCount).map((e, i) => {
              const st = barState(e, line, side) as string;
              const tone = st === "hit" ? color.primary : st === "miss" ? color.miss : st === "push" ? color.amber : color["muted-foreground"];
              const bg = st === "hit" ? "rgba(39,218,142,0.2)" : st === "miss" ? "rgba(255,0,0,0.2)" : st === "push" ? "rgba(245,165,36,0.2)" : color.secondary;
              return (
                <Press scale={1} key={i} onPress={() => onGame(e, st, `${label} ${side} ${line}`, c.auxLabel)} accessibilityRole="button" style={({ pressed }) => [styles.logRow, i > 0 && styles.sep, pressed && { opacity: 0.6 }]}>
                  <TeamBadge name={e.opp} size={32} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.logOpp} numberOfLines={1}>{e.opp}</Text>
                    <Text style={styles.sub} numberOfLines={1}>{e.date}{e.venueName ? ` · ${e.venueName}` : ""}</Text>
                  </View>
                  <View style={[styles.valuePill, { backgroundColor: bg }]}><Text style={[styles.valueText, { color: tone }]}>{e.value == null ? (st === "void" ? "VOID" : st === "na" ? "N/A" : "DNP") : e.value}</Text></View>
                </Press>
              );
            })}
            </Bleed>
            {entries.length > logCount ? <Press scale={1} onPress={() => setLogCount(logCount + 30)} style={[styles.button, { alignSelf: "center", marginTop: space.snug }]} accessibilityRole="button"><Text style={styles.buttonText}>Show more ({entries.length - logCount} left)</Text></Press> : null}
          </Animated.View>
        ) : null}
        {tab === "splits" ? (
          <Animated.View entering={enter(0)}>
            {Object.entries(res.splits as Record<string, any[]>).filter(([, rows]) => rows.length).map(([kind, rows]) => {
              const title = kind.replace("_", " ");
              return (
                <Accordion key={kind} title={`Split by ${title}`} badge={rows.length} defaultOpen={kind === "opposition" || kind === "venue_type"}>
                  <View style={{ paddingBottom: space.snug }}>
                    <DataTable bleed columns={[title, "n", "Med", "Mean", "Over", "Fair"]} flex={[2.1, 0.7, 0.9, 1, 1.5, 1]}
                      rows={rows.map((x) => [x.label, String(x.n), num(x.median), num(x.mean), <HitCell key="p" p={x.pOver} />, odds(x.fairOver)])} />
                  </View>
                </Accordion>
              );
            })}
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

/** Shown when this stat has no listed book line: the chart still uses history so a fair line is readable. */
function Unpriced({ label }: { label: string }) {
  return (
    <View style={styles.unpriced} accessibilityRole="alert">
      <Ionicons name="information-circle-outline" size={16} color={color["muted-foreground"]} style={{ marginTop: 1 }} />
      <Text style={styles.unpricedText}><Text style={{ color: color.foreground, fontFamily: font.medium }}>No book is offering odds for {label}</Text> on this match. Hit rates and fair prices are from his history, not a listed market.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  bar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  sub2: { overflow: "hidden" },
  subInner: { gap: space.snug, paddingHorizontal: space.gutter, paddingBottom: space.snug },
  pad: { paddingHorizontal: space.gutter },
  empty: { ...type.callout, color: color["muted-foreground"], paddingTop: space.stack },
  hero: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.snug, paddingTop: space.snug, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  heroLeft: { flex: 1, gap: space.tight, alignSelf: "flex-start" },
  name: { ...type.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.42, color: color.foreground },
  profile: { ...type.callout, fontFamily: font.data, fontSize: 15, color: color.foreground },
  sub: { ...type.callout, color: color["muted-foreground"] },
  strong: { color: color.foreground, fontFamily: font.data, fontVariant: ["tabular-nums"] },
  teamLine: { alignItems: "flex-start", gap: 2 },
  logoCrop: { width: 44, height: 44, overflow: "hidden", alignItems: "center", justifyContent: "center" }, // the logo files carry transparent padding: crop it so the mark sits tight to the name
  metrics: { flexDirection: "row", alignItems: "center", gap: space.snug },
  metricGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap", rowGap: space.snug + 2 },
  facts: { flexDirection: "row", alignItems: "center", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline, paddingVertical: space.tight },
  fact: { flex: 1, gap: 2, paddingHorizontal: space.tight },
  factSep: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: color.hairline },
  factKey: { ...type.footnote, color: color["muted-foreground"], ...cap },
  factVal: { ...type.callout, color: color.foreground, flexShrink: 1 },
  oppRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 6 },
  factRow: { flexDirection: "row", alignItems: "center", gap: space.snug },
  countRow: { flexDirection: "row", alignItems: "center" },
  metricNum: { fontSize: 16, lineHeight: 20, fontFamily: font.data, color: color.foreground, fontVariant: ["tabular-nums"] },
  metricText: { ...type.body, color: color.foreground },
  metricTextSm: { ...type.callout, fontFamily: font.data, fontSize: 17, lineHeight: 20, color: color.foreground },
  gaugeCard: { width: 84, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, backgroundColor: color.card, paddingVertical: space.tight },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: color.hairline, marginHorizontal: space.gutter },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.snug },
  controlsRight: { flexDirection: "row", alignItems: "center", gap: space.snug },
  altRow: { gap: 6, paddingHorizontal: space.snug, paddingVertical: space.snug + 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, borderLeftWidth: 2, borderLeftColor: "transparent" },
  altOn: { backgroundColor: "rgba(255,255,255,0.05)", borderLeftColor: color.primary },
  altTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.snug },
  altRates: { ...type.footnote, ...cap, color: color["muted-foreground"] },
  altPrice: { ...type.callout, fontFamily: font.data, width: 52, textAlign: "right" },
  altLine: { ...type.body, fontFamily: font.data, fontSize: 18, color: color.foreground },
  main: { ...type.caption, ...cap, color: color.primary },
  altBook: { flexDirection: "row", alignItems: "center", gap: space.snug },
  altBadge: { flex: 1 },
  altHead: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.snug + 2, paddingBottom: 6 },
  altCol: { ...cap, fontSize: 10, color: color["muted-foreground"] },
  bookRow: { flexDirection: "row", flexWrap: "wrap", gap: space.stack },
  windowRow: { flexDirection: "row", alignItems: "center", gap: space.snug },
  counted: { flexDirection: "row", alignItems: "center", gap: space.tight },
  cap: { ...type.callout, color: color["muted-foreground"], ...cap },
  cap2: { ...type.callout, color: "rgba(255,255,255,0.8)", ...cap },
  glanceCard: { ...tonal, borderRadius: radius.card, padding: space.stack, gap: space.snug },
  glance: { flexDirection: "row", alignItems: "center" },
  glanceCell: { flex: 1, alignItems: "center", gap: 2 },
  glanceRule: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: color.hairline },
  glanceKey: { ...type.footnote, color: color["muted-foreground"], ...cap },
  glanceNum: { fontSize: 22, lineHeight: 26, letterSpacing: -0.44, fontFamily: font.dataLight, color: color.foreground, fontVariant: ["tabular-nums"] },
  glanceOf: { fontSize: 14, fontFamily: font.data, letterSpacing: 0, color: color["muted-foreground"] },
  glanceFoot: { ...type.footnote, color: color["muted-foreground"], textAlign: "center" },
  noteText: { ...type.footnote, lineHeight: 17, color: color["muted-foreground"] },
  h3: { ...type.body, color: color.foreground },
  cell: { ...type.callout, color: color.foreground },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.tight, paddingBottom: space.snug },
  option: { height: 32, paddingHorizontal: space.snug + 2, borderRadius: radius.chip, backgroundColor: color.secondary, alignItems: "center", justifyContent: "center", maxWidth: "100%" },
  optionOn: { backgroundColor: color.foreground },
  optionText: { ...type.callout, color: color.foreground },
  optionTextOn: { color: color.background },
  button: { backgroundColor: color.secondary, borderRadius: radius.chip, paddingHorizontal: space.stack, height: control, alignItems: "center", justifyContent: "center" },
  buttonText: { ...type.callout, color: color.foreground },
  logRow: { flexDirection: "row", alignItems: "center", gap: space.snug, minHeight: 56, paddingVertical: space.tight },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  logOpp: { ...type.body, color: color.foreground },
  valuePill: { minWidth: 56, borderRadius: 8, paddingHorizontal: space.snug, paddingVertical: space.tight, alignItems: "center" },
  valueText: { ...type.callout, fontFamily: font.data, fontVariant: ["tabular-nums"] },
  unpriced: { flexDirection: "row", gap: space.snug, backgroundColor: "rgba(44,44,46,0.6)", borderRadius: 12, padding: space.snug },
  unpricedText: { ...type.callout, flex: 1, color: color["muted-foreground"] },
});
