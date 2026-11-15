import { push } from "@/lib/nav";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Share, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import Animated, { interpolate, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { SCOPE_LABEL } from "@cricket/engine/lines.js";
import { lineNotIn, lineStanding, liveForFixture } from "@cricket/engine/live.js";
import { shareText } from "@cricket/engine/share-text.js";
import { barState, windowRate } from "@cricket/engine/windows.js";
import { fmtIndex } from "@cricket/engine/util.js";
import { abbr, num, odds, pc } from "@site/lib/format";
import { sharePlayerUrl } from "@site/lib/share";
import { SITE_URL } from "@/lib/config";
import { deriveChart, STAT_OPTIONS, usePlayerScreen, type Filters } from "@/lib/player";
import { useLater } from "@/lib/use-later";
import { useQuery } from "@tanstack/react-query";
import { profileParts } from "@/lib/profile";
import { profilesQuery } from "@/lib/queries";
import { Accordion } from "@/ui/accordion";
import { BlurBar, BlurTargetView, useChromeScrim, useCollapseOnScroll } from "@/ui/blur-bar";
import { BookTable } from "@/ui/book-table";
import { ChartBars } from "@/ui/charts";
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
import { LineTabs } from "@/ui/line-tabs";
import { PageHeader, RoundButton } from "@/ui/page-header";
import { PlayerPortrait } from "@/ui/player-avatar";
import { Segmented } from "@/ui/segmented";
import { pricedFromBooks, SideBook } from "@/ui/side-book";
import { pushRecentPlayer } from "@/lib/saved";
import { PropStar, StarButton } from "@/ui/star";
import { TeamBadge } from "@/ui/team-badge";
import { EntityHeroWash, PageAtmosphere, useEntityAccent } from "@/ui/page-atmosphere";
import { color, control, font, radius, space, type, fs, tint, t, d, dStrong, w, state, icon } from "@/ui/tokens";
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
 * A player, Match Fancy / web Player shape: sticky stat + format bar; identity hero; metrics (no gauge on phone); chart first; centred O/U + stepper; quiet look-back windows;
 * O/U hit-rate meters + book lanes; next match; filters; Lines | Game log | Splits | When it hits. Opened from a prop row (`?stat=&line=&fmt=&scope=&start=`).
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
  useEffect(() => { if (s.indexed) pushRecentPlayer(idx); }, [idx, s.indexed]);
  const pricedSet = useMemo(() => new Set(s.pricedStats), [s.pricedStats]);

  const target = useRef<ComponentRef<typeof View>>(null);
  const { collapsed, onScroll, y } = useCollapseOnScroll();
  const [barH, setBarH] = useState(0), [subH, setSubH] = useState(0);
  const accent = useEntityAccent(s.side || params.team);
  const sub = useAnimatedStyle(() => ({ height: subH ? subH * (1 - collapsed.value) : undefined, opacity: 1 - collapsed.value }));
  // the hero: the portrait rides slower than the page and fades as it goes, and swells when the page is pulled down past the top; the name follows more gently
  const portraitFx = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [0, 240], [1, 0.15], "clamp"), transform: [{ translateY: y.value * 0.35 }, { scale: 1 + Math.max(-y.value, 0) / 520 }] }));
  const nameFx = useAnimatedStyle(() => ({ transform: [{ translateY: y.value * 0.12 }] }));
  // sticky title fades in as the hero name scrolls away — avoids a doubled name at the top of the page
  const headerTitleFx = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [40, 120], [0, 1], "clamp") }));
  const headerSubFx = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [40, 120], [0, 1], "clamp") }));
  // solid elevated once the hero band (incl. under-sticky overlap) has scrolled past
  const scrimThreshold = useSharedValue(136);
  const barScrim = useChromeScrim(y, scrimThreshold);

  const res = s.res.data;
  // Hero paints first; plan body mounts as a transition once the index is known.
  const bodyReady = useLater(s.indexed);
  // cached plan / lines: never blank the page on a background refetch; wait for matches.json before first plan
  const loading = !bodyReady || s.loadingStore || !s.matchesReady || (!res && !s.res.isError);
  const patch = (p: Record<string, string>) => { setFilters((f) => ({ ...f, ...p })); setLineQ(undefined); };
  const share = () => {
    const entries = res?.ok ? res.chart?.entries : [];
    const line = lineQ ?? (s.book ? s.book.main.line : null);
    const price = Math.max(0, ...(s.book?.lines?.find((l: any) => line != null && Math.abs(l.line - line) < 0.01)?.books || []).map((b: any) => b.over || 0)) || null;
    const url = sharePlayerUrl(SITE_URL, idx, s.stat, line);
    void Share.share({ message: shareText({ entries, line, side: "over", fmt: s.fmt, price, ground: s.next?.ground, opp: s.next?.opp, url }) || url, title: s.name });
  };
  const game = (e: any, st: string, label: string, auxLabel?: string) => push({ pathname: "/info/[topic]", params: { topic: "game", d: e.date, o: e.opp, v: e.venueName ?? "", x: e.value == null ? ({ void: "VOID: in the XI, did not bat/bowl", na: "N/A: XI not recorded", dnp: "DNP: not in the XI" } as any)[st] ?? "–" : String(e.value), l: label, a: auxLabel && e.value != null ? `${auxLabel}: ${e.aux ?? "–"}` : "", p: e.pos ? `No. ${e.pos}` : "", n: s.name } });
  const chromePad = Math.max(barH, 1);

  return (
    <PageAtmosphere>
      <BlurTargetView ref={target} style={styles.root}>
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: chromePad, paddingBottom: inset.bottom + space.section }}>
          {s.storeError ? <View style={styles.pad}><EmptyState title="Could not load history" body="Check your connection and reopen this page to retry." /></View> : !s.loadingStore && !s.indexed ? <View style={styles.pad}><EmptyState title="Unknown player" body="This player is not in the stats data." /></View> : (
            <>
              {/* Hero wash scrolls with identity; negative margin pulls tint under clear sticky chrome at rest. */}
              <EntityHeroWash
                accent={accent}
                style={{ marginTop: -chromePad, paddingTop: chromePad }}
                onLayout={(e) => { scrimThreshold.value = Math.max(48, e.nativeEvent.layout.height - 64); }}
              >
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
              </EntityHeroWash>
              {loading ? (
                <View style={{ paddingTop: space.stack }} accessibilityRole="progressbar" accessibilityLabel="Reading his games…"><PlayerSkeleton /></View>
              ) : !res?.ok ? (
                <View style={styles.pad}><EmptyState title="Could not load games" body={String(res?.error || "Try again in a moment.")} /></View>
              ) : (
                <Loaded key={`${s.stat}-${s.fmtVal}-${JSON.stringify(s.plan.filters)}-${s.plan.venue}-${s.book ? 1 : 0}`} s={s} filters={filters} onFilters={patch} onGame={game} />
              )}
            </>
          )}
        </Animated.ScrollView>
      </BlurTargetView>

      <View style={styles.bar} onLayout={(e) => setBarH(Math.round(e.nativeEvent.layout.height))}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, barScrim]} />
        {/* merge = clear at rest; scrim goes solid when hero has scrolled past */}
        <BlurBar merge blurTarget={target} style={{ paddingTop: inset.top }}>
          <PageHeader title={s.name || "Player"} subtitle={s.side || undefined} titleStyle={headerTitleFx} subtitleStyle={headerSubFx} buttons={2} right={s.indexed ? (
            <>
              <StarButton idx={idx} />
              <RoundButton label="Share" onPress={share}><Ionicons name="share-outline" size={icon.md} color={color.foreground} /></RoundButton>
            </>
          ) : undefined} />
          {s.fmts.length > 1 ? <LineTabs<string> label="Format" items={s.fmts.map(([i, f]) => [String(i), f] as [string, string])} value={String(s.fmtVal)} onChange={(v) => { setFmt(Number(v)); setLineQ(undefined); setScope(undefined); }} /> : null}
          <CapsuleTabs label="Stat" items={STAT_OPTIONS.map(([k, l]) => [k, l, !pricedSet.has(k)] as [string, string, boolean])} value={s.stat} onChange={(k) => { setStat(k); setLineQ(undefined); }} />
          <Animated.View style={[styles.sub2, sub]}>
            <View onLayout={(e) => { const h = Math.round(e.nativeEvent.layout.height); if (h !== subH) setSubH(h); }} style={[styles.subInner, { position: "absolute", left: 0, right: 0, top: 0 }]}>
              {s.testBat ? <Segmented<string> items={[0, 1, 2].map((n) => [String(n), (SCOPE_LABEL as any)[n]] as [string, string])} value={String(s.scope)} onChange={(v) => { setScope(Number(v)); setLineQ(undefined); }} label="Innings" /> : null}
            </View>
          </Animated.View>
        </BlurBar>
      </View>
      <TabFade withTabBar={false} />
    </PageAtmosphere>
  );
}

const arrow = (up: boolean | null) => (up == null ? null : <Text style={{ color: up ? color.primary : color.miss, fontSize: fs.footnote }}>{up ? "▲ " : "▼ "}</Text>);

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
  const { ws, cur, shown, mix } = d;
  const bookAt = book ? book.lines.find((l: any) => Math.abs(l.line - line) < 0.01) : null;
  const pricedAt = bookAt ? pricedFromBooks(bookAt.line, bookAt.books) : null;
  const overFace = pricedAt?.over != null ? pricedAt.books.find((b) => b.over === pricedAt.over) : null;
  const underFace = pricedAt?.under != null ? pricedAt.books.find((b) => b.under === pricedAt.under) : null;
  const active = (res.filters || []).filter(([k]: [string]) => !["Player", "Stat", "Format", "Line", "Side", "Test innings"].includes(k));
  const sideLetter = side === "over" ? "O" : "U";
  const label = res.statLabel as string;
  const tabItems: [string, string][] = [
    ["lines", "Lines"],
    ["logs", "Game log"],
    ["splits", "Splits"],
    ...(res.corr ? [["corr", "When it hits"] as [string, string]] : []),
  ];
  const tabValue = tabItems.some(([k]) => k === tab) ? tab : tabItems[0][0];

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
          body={active.length ? "No games match these filters. Relax a filter to see a sample." : "No games match this selection. Relax a filter to see a sample."}
          action={active.length ? <Press scale={1} onPress={clearAll} style={styles.button} accessibilityRole="button"><Text style={styles.buttonText}>Clear filters</Text></Press> : undefined}
        />
      </View>
    );
  }

  return (
    <View style={{ gap: space.stack }}>
      <Animated.View entering={enter(0)} style={[styles.pad, styles.metricsBand]}>
        <View style={styles.metricGrid}>
          <Metric compact k={`${cur.label} avg`}><View style={styles.countRow}>{arrow(cur.mean == null ? null : cur.mean > line)}{cur.mean == null ? <Text style={styles.metricNum}>–</Text> : <CountUp value={cur.mean} digits={2} style={styles.metricNum} />}</View></Metric>
          <Metric compact k={book ? "Line" : "Research line"}>{`${sideLetter} ${line}`}</Metric>
          <Metric compact k="Hit rate"><View style={styles.countRow}>{arrow(cur.p == null ? null : cur.p >= 0.5)}{cur.p == null ? <Text style={styles.metricNum}>–</Text> : <CountUp value={Math.round(cur.p * 100)} suffix="%" style={styles.metricNum} />}</View></Metric>
          <Metric compact k="Fair price">{cur.p ? <CountUp value={1 / cur.p} digits={2} style={styles.metricNum} /> : "–"}</Metric>
          <Metric compact k="Opponent">{next?.opp ? <View style={styles.oppRow}><Text style={styles.metricTextSm}>{abbr(next.opp)}</Text><MatchStatus phase={next.phase || "upcoming"} start={next.start} /></View> : <Text style={styles.metricTextSm}>–</Text>}</Metric>
          <Metric compact text k="Prop">{book ? label : <View style={{ gap: 2 }}><Text style={styles.metricTextSm}>{label}</Text><Text style={styles.notListed}>Not listed</Text></View>}</Metric>
        </View>
      </Animated.View>

      {!book ? <View style={styles.pad}><Unpriced label={label} /></View> : null}

      <View style={[styles.pad, { gap: space.snug }]}>
        <ChartBars entries={shown} line={line} side={side} height={240} onSelect={(e, st) => onGame(e, st, `${label} ${side} ${line}`, c.auxLabel)} />
        <View style={styles.controls}>
          <Segmented<"over" | "under"> items={[["over", "O"], ["under", "U"]]} value={side} onChange={setSide} label="Side" width={112} />
          <LineStepper value={line} label="O/U" onStep={step} />
          <PropStar idx={idx} stat={stat} line={line} fmt={fmtIndex(fmt)} />
          {book?.main && Math.abs(book.main.line - line) >= 0.01 ? (
            <Press scale={1} onPress={() => { void Haptics.selectionAsync(); setLine(book.main.line); }} accessibilityRole="button" accessibilityLabel={`Use main line ${book.main.line}`} style={({ pressed }) => [styles.mainChip, pressed && state.pressed]}>
              <Text style={styles.mainChipText}>main {book.main.line}</Text>
            </Press>
          ) : null}
        </View>
        <WindowPills items={ws.map((w: any) => ({ n: w.n, label: w.label, p: w.p }))} value={cur.n} onChange={setWin} />
        {mix.out > 0 || cur.played < 5 ? (
          <View style={styles.counted}>
            <Text style={[styles.sub, { textAlign: "center", flex: 1 }, cur.played < 5 && { color: color.amber }]}>
              {mix.out > 0 ? <><Text style={styles.strong}>{mix.out}</Text> void or not in the XI left out · <Text style={styles.strong}>{cur.played}</Text> {res.sample?.unit || "games"} counted.</> : null}
              {cur.played < 5 ? `${mix.out > 0 ? " " : ""}Too few for a steady read.` : ""}
            </Text>
            {mix.out > 0 ? <InfoButton topic="chart" label="About this chart" /> : null}
          </View>
        ) : null}

        <View style={styles.laneBlock}>
          <View style={styles.laneRow}>
            {(["over", "under"] as const).map((lane, i) => {
              const hist = windowRate(entries, cur.n, line, lane);
              const p = hist.p, fair = p ? 1 / p : null;
              const on = side === lane;
              return (
                <Press
                  key={lane}
                  scale={1}
                  onPress={() => { void Haptics.selectionAsync(); setSide(lane); }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${lane} ${line}`}
                  style={({ pressed }) => [styles.lane, i === 0 && styles.laneSplit, on && styles.laneOn, pressed && state.pressed]}
                >
                  <Text style={styles.laneCap}>{lane} {line}</Text>
                  <Text style={[styles.laneRate, lane === "over" && { color: color.primary }]}>{p == null ? "–" : `${(p * 100).toFixed(1)}%`}</Text>
                  <View style={styles.meterTrack}><View style={[styles.meterFill, lane === "over" ? styles.meterOver : styles.meterUnder, { width: `${Math.round((p ?? 0) * 100)}%` }]} /></View>
                  <Text style={styles.laneFoot}>{hist.hits} of {hist.played} · fair {odds(fair)}</Text>
                </Press>
              );
            })}
          </View>
          {pricedAt || (book && !bookAt) ? (
            <View style={styles.bookBand} accessibilityLabel="Book prices">
              {pricedAt ? (
                <>
                  <View style={styles.laneRow}>
                    {(["over", "under"] as const).map((lane, i) => (
                      <View key={lane} style={[styles.bookLane, i === 0 && styles.laneSplit]}>
                        <Text style={styles.laneCap}>{lane} {line}</Text>
                        <SideBook priced={pricedAt} side={lane} />
                      </View>
                    ))}
                  </View>
                  <View style={styles.bookExtras}>
                    <BookTable books={pricedAt.books} shown={[overFace?.source, underFace?.source]} />
                  </View>
                </>
              ) : (
                <Press scale={1} onPress={() => { void Haptics.selectionAsync(); setLine(book!.main.line); }} accessibilityRole="button" style={styles.wrongLine}>
                  <Text style={styles.sub}>The books price {book!.main.line}, not {line}. <Text style={styles.link}>Use {book!.main.line}</Text></Text>
                </Press>
              )}
            </View>
          ) : null}
        </View>
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

      <View style={[styles.pad, { gap: space.stack }]}>
        <Segmented<string> items={tabItems} value={tabValue} onChange={setTab} label="Sections" />
        {tabValue === "lines" ? (
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
          </Animated.View>
        ) : null}
        {tabValue === "corr" && res.corr ? (
          <Animated.View entering={enter(0)} style={{ gap: space.snug }}>
            <Text style={styles.h3}>When {label.toLowerCase()} {res.plan?.side || "over"} {c?.line ?? res.line} hits</Text>
            <Text style={styles.noteText}>{res.corr.n} of {res.corr.of} {res.sample.unit}: how often his other props also clear in those games.</Text>
            <DataTable bleed columns={["Prop", "Normal", "When it hits", "Lift"]} flex={[2.3, 1, 1.2, 1.1]}
              rows={res.corr.rows.map((x: any) => [`${x.label} over ${x.line}`, pc(x.base), pc(x.cond), <Pill key="l" text={`${x.lift >= 0 ? "+" : ""}${Math.round(x.lift * 100)}`} tone={x.lift >= 0.1 ? "up" : x.lift <= -0.1 ? "down" : "none"} width={48} />])} />
          </Animated.View>
        ) : null}
        {tabValue === "logs" ? (
          <Animated.View entering={enter(0)}>
            <Bleed>
            {[...entries].reverse().slice(0, logCount).map((e, i) => {
              const st = barState(e, line, side) as string;
              const tone = st === "hit" ? color.primary : st === "miss" ? color.miss : st === "push" ? color.amber : color["muted-foreground"];
              const bg = st === "hit" ? tint.primary(0.2) : st === "miss" ? tint.miss(0.2) : st === "push" ? tint.amber(0.2) : color.secondary;
              return (
                <Press scale={1} key={i} onPress={() => onGame(e, st, `${label} ${side} ${line}`, c.auxLabel)} accessibilityRole="button" style={({ pressed }) => [styles.logRow, i > 0 && styles.sep, pressed && state.pressed]}>
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
        {tabValue === "splits" ? (
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
      <Ionicons name="information-circle-outline" size={icon.sm} color={color["muted-foreground"]} style={{ marginTop: 1 }} />
      <Text style={styles.unpricedText}><Text style={{ color: color.foreground, ...w.label }}>No book is offering odds for {label}</Text> on this match. Hit rates and fair prices are from his history, not a listed market.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  sub2: { overflow: "hidden" },
  subInner: { gap: space.snug, paddingHorizontal: space.gutter, paddingBottom: space.snug },
  pad: { paddingHorizontal: space.gutter },
  hero: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.snug, paddingTop: space.snug, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  heroLeft: { flex: 1, gap: space.tight, alignSelf: "flex-start" },
  name: { ...type.display, fontSize: fs.display, lineHeight: 32, letterSpacing: -0.42, color: color.foreground },
  profile: { ...d.callout, fontSize: fs.body, color: color.foreground },
  sub: { ...type.callout, color: color["muted-foreground"] },
  strong: { color: color.foreground, ...w.data, fontVariant: ["tabular-nums"] },
  link: { color: color.primary, ...w.label },
  teamLine: { alignItems: "flex-start", gap: 2 },
  logoCrop: { width: 44, height: 44, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  metricsBand: {
    gap: space.snug,
    paddingTop: space.snug,
    paddingBottom: space.snug,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
  },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: space.snug + 2 },
  oppRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 6 },
  countRow: { flexDirection: "row", alignItems: "center" },
  metricNum: { fontSize: fs.body, lineHeight: 20, ...w.dataStrong, color: color.foreground, fontVariant: ["tabular-nums"] },
  metricTextSm: { ...dStrong.callout, fontSize: fs.title, lineHeight: 20, color: color.foreground },
  notListed: { ...t.captionLabel, color: color["muted-foreground"] },
  controls: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: space.snug },
  mainChip: { height: control, paddingHorizontal: space.snug + 2, borderRadius: radius.chip, backgroundColor: color.secondary, alignItems: "center", justifyContent: "center" },
  mainChipText: { ...type.callout, color: color.foreground },
  counted: { flexDirection: "row", alignItems: "center", gap: space.tight },
  laneBlock: { overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  laneRow: { flexDirection: "row" },
  lane: { flex: 1, minWidth: 0, gap: space.tight, paddingHorizontal: space.snug, paddingVertical: space.snug },
  laneSplit: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: color.hairline },
  laneOn: { backgroundColor: tint.hex(color.secondary, 0.4) },
  laneCap: { ...type.caption, color: color["muted-foreground"], textTransform: "uppercase", letterSpacing: 0.4 },
  laneRate: { ...dStrong.title, color: color.foreground },
  laneFoot: { ...type.footnote, color: color["muted-foreground"] },
  meterTrack: { height: 6, borderRadius: 999, backgroundColor: color.hairline, overflow: "hidden" },
  meterFill: { height: "100%", borderRadius: 999 },
  meterOver: { backgroundColor: color.primary },
  meterUnder: { backgroundColor: color["text-soft"] },
  bookBand: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  bookLane: { flex: 1, minWidth: 0, gap: 2, paddingHorizontal: space.snug, paddingVertical: space.snug, alignItems: "flex-start" },
  bookExtras: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, paddingHorizontal: space.snug, paddingVertical: space.snug },
  wrongLine: { paddingHorizontal: space.snug, paddingVertical: space.snug },
  noteText: { ...type.footnote, lineHeight: 17, color: color["muted-foreground"] },
  h3: { ...type.body, color: color.foreground },
  button: { backgroundColor: color.secondary, borderRadius: radius.chip, paddingHorizontal: space.stack, height: control, alignItems: "center", justifyContent: "center" },
  buttonText: { ...type.callout, color: color.foreground },
  logRow: { flexDirection: "row", alignItems: "center", gap: space.snug, minHeight: 56, paddingVertical: space.tight },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  logOpp: { ...type.body, color: color.foreground },
  valuePill: { minWidth: 56, borderRadius: radius.sm, paddingHorizontal: space.snug, paddingVertical: space.tight, alignItems: "center" },
  valueText: { ...d.callout },
  unpriced: { flexDirection: "row", gap: space.snug, backgroundColor: color.tile, borderRadius: radius.control, padding: space.snug },
  unpricedText: { ...type.callout, flex: 1, color: color["muted-foreground"] },
});
