/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useRef, useState, type ComponentRef } from "react";
import { Share, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { liveForFixture } from "@cricket/engine/live.js";
import { fixtureBooks, sameFixture } from "@cricket/engine/lines.js";
import { STATS } from "@cricket/engine/rules.js";
import { FORMATS } from "@cricket/engine/util.js";
import { collectGrid } from "@site/lib/grid";
import { matchShareText } from "@cricket/engine/share-text.js";
import { shortVenue } from "@site/lib/format";
import { shareFixtureUrl } from "@site/lib/share";
import { SITE_URL } from "@/lib/config";
import { dayLabel, localTime, seriesName } from "@/lib/format";
import { MAX_ROWS } from "@/lib/hot";
import { goBack } from "@/lib/nav";
import { linesQuery, liveQuery } from "@/lib/queries";
import { useFixtureBooks } from "@/lib/archive";
import { fixtureState, fixtureStart, liveMatchFor, type RailItem } from "@/lib/rail";
import { useHotView } from "@/lib/use-hot";
import { useNow } from "@/lib/use-now";
import { storeQuery } from "@/lib/data";
import { BlurBar, BlurTargetView, useCollapseOnScroll } from "@/ui/blur-bar";
import { CapsuleTabs } from "@/ui/capsule";
import { InfoButton } from "@/ui/info-button";
import { GridFilters, GridTable, TrendList } from "@/ui/grid-table";
import { useScreenInsets } from "@/ui/insets";
import { LiveBoard, MatchAccordions } from "@/ui/live-board";
import { MatchFancy } from "@/ui/match-fancy";
import { Segmented } from "@/ui/segmented";
import { TeamBadge } from "@/ui/team-badge";
import { MatchHeader } from "@/ui/match-header";
import { enter, Skeleton, Working } from "@/ui/motion";
import { PageHeader, RoundButton } from "@/ui/page-header";
import { PropRow } from "@/ui/prop-row";
import { abbr } from "@site/lib/format";
import { color, font, radius, space, type } from "@/ui/tokens";
import { TabFade } from "@/ui/tab-fade";

/** A match, as on the site: its header in a container (state, sides, kick-off with a live countdown or the score) and the player props priced for it, scored against each player's games. The stat chips sit in a blurred bar that tucks away while you scroll down. */
export default function FixturePage() {
  const { id, tab: tabParam, fm: fmParam, sc: scParam } = useLocalSearchParams<{ id: string; tab?: string; fm?: string; sc?: string }>();
  const inset = useScreenInsets(false);
  const now = useNow(60_000);
  const lines = useQuery(linesQuery), live = useQuery(liveQuery);
  // the schedule's row and the live book file while the match is on or to come; a finished match the feed has let go is read from its permanent archive file
  const { fx: f, doc, archived, isLoading: fxLoading } = useFixtureBooks(id);
  const item: RailItem | null = f ? { fixture: f, state: fixtureState(f, liveForFixture(live.data, f)?.status, now), live: liveMatchFor(live.data, doc, f), noProps: false } : null;
  const books = useMemo(() => (f ? fixtureBooks(doc, f) : { props: false, fancy: false }), [doc, f]);
  const tabs = useMemo(() => ([["props", "Props"], ["fancy", "Fancy"], ["grid", "Grid"], ["trends", "Trends"]] as [string, string][]).filter(([k]) => (k === "props" ? books.props : k === "fancy" ? books.fancy : true)), [books]);
  const [tabAsked, setTab] = useState<string | undefined>(tabParam);
  const tab = tabs.some(([k]) => k === tabAsked) ? tabAsked! : tabs[0][0];
  const scope = useMemo(() => (f && f.fmt !== "FC" && tab === "props" ? { teams: [f.a, f.b] as [string, string], archive: archived } : undefined), [f, tab, archived]);
  const { rows, isLoading, scoring, error, soFarOf, outOf } = useHotView(scope, undefined, archived ? doc : undefined);
  // this match: the same two sides, a Test on any of its days, not the series' next game
  const here = useMemo(() => (f ? rows.filter((r) => sameFixture({ match: r.match, start_utc: r.start, fmt: r.fmt }, { a: f.a, b: f.b, start: f.start, fmt: f.fmt })) : []), [rows, f]);
  const [stat, setStat] = useState("all");
  const statKeys = useMemo(() => [...new Set(here.map((r) => r.stat))], [here]);
  const shown = useMemo(() => (stat === "all" || !statKeys.includes(stat) ? here : here.filter((r) => r.stat === stat)).slice(0, MAX_ROWS), [here, stat, statKeys]);

  const stats = useQuery(storeQuery);
  const store: any = stats.data?.store;
  const [gStat, setGStat] = useState("sixes"), [gLine, setGLine] = useState(0.5), [games, setGames] = useState(10), [hit, setHit] = useState(0.6), [gTeam, setGTeam] = useState<number>();
  const fmt = f && FORMATS.includes(f.fmt) ? f.fmt : "T20";
  const teams: [string, number][] = f ? [[f.a, f.a_ix], [f.b, f.b_ix]] : [];
  const known = teams.filter(([, i]) => i >= 0);
  const gridTeam = known.some(([, i]) => i === gTeam) ? gTeam! : known[0]?.[1];
  const grids = useQuery({
    queryKey: ["fx-grids", id, fmt, gStat, games], enabled: !!store && !!f && f.fmt !== "FC" && (tab === "grid" || tab === "trends"),
    queryFn: async () => Promise.all(known.map(async ([name, i]) => ({ name, team: i, g: await collectGrid(store, i, fmt, gStat, games) }))),
  });
  const shownGrid = grids.data?.find((x) => x.team === gridTeam) ?? grids.data?.[0];

  const target = useRef<ComponentRef<typeof View>>(null);
  const { collapsed, onScroll } = useCollapseOnScroll(60);
  const [barH, setBarH] = useState(0), [subH, setSubH] = useState(0);
  const sub = useAnimatedStyle(() => ({ height: subH ? subH * (1 - collapsed.value) : undefined, opacity: 1 - collapsed.value }));
  const share = () => {
    if (!f) return;
    const url = shareFixtureUrl(SITE_URL, f.id);
    const when = f.start.length > 10 ? `${dayLabel(fixtureStart(f), now)}, ${localTime(fixtureStart(f))}` : dayLabel(fixtureStart(f), now);
    void Share.share({ message: matchShareText({ a: f.a, b: f.b, when, venue: shortVenue(f.venue) || f.venue || "", series: seriesName(f), url }) || url, title: `${f.a} v ${f.b}` });
  };

  return (
    <View style={styles.root}>
      <BlurTargetView ref={target} style={styles.root}>
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: barH, paddingBottom: inset.bottom + space.section }}>
          {fxLoading ? (
            <View style={styles.pad}><Skeleton style={{ height: 200 }} /></View>
          ) : !f || !item ? (
            <View style={[styles.pad, { gap: space.snug, alignItems: "flex-start" }]}>
              <Text style={styles.empty}>That fixture is no longer in the schedule.</Text>
              <Press onPress={goBack} style={styles.button} accessibilityRole="button"><Text style={styles.buttonText}>Back to fixtures</Text></Press>
            </View>
          ) : (
            <>
              <Animated.View entering={enter(0)} style={styles.pad}><MatchHeader item={item} /></Animated.View>
              {item.live?.status === "live" ? <View style={{ paddingTop: space.snug }}><LiveBoard match={item.live} teams={known} /></View> : null}
              {f.fmt !== "FC" ? <MatchAccordions match={item.live} teams={known} fmt={fmt} store={store} /> : null}
              {f.fmt === "FC" ? (
                <Text style={[styles.empty, styles.pad]}>First-class cricket is not part of the stats here, so there are no player props for this match.</Text>
              ) : tab === "props" ? (
                <>
                  <View style={[styles.pad, styles.titleRow]}><Text style={styles.title}>Player props</Text><InfoButton topic="player-props" /></View>
                  {isLoading ? (
                    <Working label="Scoring this match's lines…" rows={4} />
                  ) : error && !here.length ? (
                    <Text style={[styles.empty, styles.pad]}>Could not score this match's lines. Go back and try again.</Text>
                  ) : shown.length ? (
                    <View>
                      {shown.map((r, i) => <PropRow key={`${r.idx}${r.stat}${r.start}${r.inn}`} r={r} i={i} soFar={soFarOf(r)} out={outOf(r)} />)}
                      {scoring ? <Working label="Scoring more lines…" /> : null}
                    </View>
                  ) : scoring ? (
                    <Working label="Scoring this match's lines…" />
                  ) : (
                    <Text style={[styles.empty, styles.pad]}>No player props are priced for this match yet.</Text>
                  )}
                </>
              ) : tab === "fancy" ? (
                <View style={[styles.pad, { paddingTop: space.stack }]}><MatchFancy key={`${f.id}`} fx={f} teams={known} fmt={fmt} doc={doc} start={{ fm: fmParam, sc: scParam }} /></View>
              ) : (
                <View style={[styles.pad, { gap: space.stack, paddingTop: space.stack }]}>
                  <GridFilters stat={gStat} line={gLine} games={games} hit={tab === "trends" ? hit : undefined} onStat={setGStat} onLine={setGLine} onGames={setGames} onHit={setHit} />
                  {tab === "grid" ? (
                    <>
                      {known.length > 1 ? <Segmented<string> items={known.map(([name, i]) => [String(i), abbr(name)] as [string, string])} value={String(gridTeam)} onChange={(v) => setGTeam(Number(v))} label="Team" /> : null}
                      {grids.isLoading || !shownGrid ? <Working label="Reading the players' games…" /> : (
                        <View style={{ gap: space.snug }}>
                          <View style={styles.gridHead}><TeamBadge name={shownGrid.name} size={24} /><Text style={styles.gridTitle}>{shownGrid.name}</Text><Text style={styles.empty}>{(STATS as any)[gStat].label} over {gLine}</Text></View>
                          <GridTable g={shownGrid.g} teamIdx={shownGrid.team} line={gLine} />
                          <Text style={styles.empty}>Clears {gLine} in green, under it in red. VOID: in the XI, did not bat or bowl, so the bet is void. A dash: not in the XI.</Text>
                        </View>
                      )}
                    </>
                  ) : grids.data ? <TrendList grids={grids.data} line={gLine} minHit={hit} stat={gStat} /> : <Working label="Reading the players' games…" />}
                </View>
              )}
            </>
          )}
        </Animated.ScrollView>
      </BlurTargetView>

      <View style={styles.bar} onLayout={(e) => setBarH((h) => Math.max(h, Math.round(e.nativeEvent.layout.height)))}>
        <BlurBar blurTarget={target} style={{ paddingTop: inset.top }}>
          <PageHeader title={f ? `${f.a} v ${f.b}` : "Match"} subtitle={f ? seriesName(f) : undefined} right={f ? <RoundButton label="Share" onPress={share}><Ionicons name="share-outline" size={20} color={color.foreground} /></RoundButton> : undefined} />
          {f && f.fmt !== "FC" ? <View style={styles.tabs}><Segmented<string> items={tabs} value={tab} onChange={setTab} label="Sections" /></View> : null}
          {tab === "props" && statKeys.length > 1 ? (
            <Animated.View style={[styles.sub, sub]}>
              <View style={styles.measure} onLayout={(e) => { const h = Math.round(e.nativeEvent.layout.height); if (h && h !== subH) setSubH(h); }}>
                <CapsuleTabs label="Stat" items={[["all", "All props"], ...statKeys.map((k) => [k, (STATS as any)[k]?.label ?? k] as [string, string])]} value={stat} onChange={setStat} />
              </View>
            </Animated.View>
          ) : null}
        </BlurBar>
      </View>
      <TabFade />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  bar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  sub: { overflow: "hidden" },
  // measured out of flow: inside a parent that is being squeezed, a scroller shrinks with it and would report the squeezed height
  measure: { position: "absolute", left: 0, right: 0, top: 0 },
  pad: { paddingHorizontal: space.gutter, paddingTop: space.snug },
  tabs: { paddingHorizontal: space.gutter, paddingBottom: space.snug },
  gridHead: { flexDirection: "row", alignItems: "center", gap: space.tight },
  gridTitle: { ...type.body, fontFamily: font.medium, color: color.foreground },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.tight, paddingTop: space.group, paddingBottom: space.snug },
  title: { ...type.title, color: color.foreground },
  empty: { ...type.callout, color: color["muted-foreground"] },
  button: { backgroundColor: color.secondary, borderRadius: radius.chip, paddingHorizontal: space.stack, height: 36, alignItems: "center", justifyContent: "center" },
  buttonText: { ...type.callout, color: color.foreground },
});
