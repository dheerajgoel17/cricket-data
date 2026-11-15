/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/ui/button";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Share, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import Animated, { useSharedValue } from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { liveForFixture } from "@cricket/engine/live.js";
import { fixtureBooks, sameFixture } from "@cricket/engine/lines.js";
import { STATS } from "@cricket/engine/rules.js";
import { FORMATS } from "@cricket/engine/util.js";
import { collectGrid } from "@site/lib/grid";
import { matchShareText } from "@cricket/engine/share-text.js";
import { shortVenue } from "@site/lib/format";
import { fixtureHasGround } from "@site/lib/ground";
import { shareFixtureUrl } from "@site/lib/share";
import { SITE_URL } from "@/lib/config";
import { dayLabel, localTime, seriesName } from "@/lib/format";
import { MAX_ROWS } from "@/lib/hot";
import { fancyMarketPath, goBack, groundPath, push } from "@/lib/nav";
import { linesQuery, liveQuery } from "@/lib/queries";
import { useFixtureBooks } from "@/lib/archive";
import { fixtureState, fixtureStart, liveMatchFor, type RailItem } from "@/lib/rail";
import { useHotView } from "@/lib/use-hot";
import { useNow } from "@/lib/use-now";
import { useLater } from "@/lib/use-later";
import { useStore } from "@/lib/use-store";
import { BlurBar, BlurTargetView, useChromeScrim, useCollapseOnScroll } from "@/ui/blur-bar";
import { PageAtmosphere } from "@/ui/page-atmosphere";
import { CapsuleTabs } from "@/ui/capsule";
import { Chips } from "@/ui/chips";
import { EmptyState } from "@/ui/empty-state";
import { InfoButton } from "@/ui/info-button";
import { GridFilters, GridTable, TrendList } from "@/ui/grid-table";
import { useScreenInsets } from "@/ui/insets";
import { MatchAccordions, ScorecardCard } from "@/ui/live-board";
import { MatchFancy } from "@/ui/match-fancy";
import { TeamBadge } from "@/ui/team-badge";
import { MatchHeader } from "@/ui/match-header";
import { enter, Working } from "@/ui/motion";
import { MatchHeaderSkeleton } from "@/ui/skeletons";
import { PageHeader, RoundButton } from "@/ui/page-header";
import { PropRow } from "@/ui/prop-row";
import { abbr } from "@site/lib/format";
import { color, font, radius, space, type, rhythm, t } from "@/ui/tokens";
import { TabFade } from "@/ui/tab-fade";

/** A match, as on the site's phone page: the match flat on the page (state, sides, kick-off with a live countdown or the score, the pair at the crease, ball by ball, the scorecard), then the page's sections as chips (Props / Match Fancy / Grid / Custom line) with the open one's stat chips and rows under them. */
export default function FixturePage() {
  const { id, tab: tabParam, fm: fmParam, sc: scParam, mw: mwParam, mv: mvParam } = useLocalSearchParams<{ id: string; tab?: string; fm?: string; sc?: string; mw?: string; mv?: string }>();
  // old links opened a market with ?tab=fancy&fm=…; send them to the market page
  useEffect(() => {
    if (fmParam && id) router.replace(fancyMarketPath(id, { fm: Array.isArray(fmParam) ? fmParam[0] : fmParam, sc: scParam, mw: mwParam, mv: mvParam }) as never);
  }, [fmParam, id, scParam, mwParam, mvParam]);
  const inset = useScreenInsets(false);
  const now = useNow(60_000);
  const lines = useQuery(linesQuery), live = useQuery(liveQuery);
  // the schedule's row and the live book file while the match is on or to come; a finished match the feed has let go is read from its permanent archive file
  const { fx: f, doc, archived, isLoading: fxLoading } = useFixtureBooks(id);
  const item: RailItem | null = f ? { fixture: f, state: fixtureState(f, liveForFixture(live.data, f)?.status, now), live: liveMatchFor(live.data, doc, f), noProps: false } : null;
  const books = useMemo(() => (f ? fixtureBooks(doc, f) : { props: false, fancy: false }), [doc, f]);
  const tabs = useMemo(() => ([["props", "Props"], ["fancy", "Match Fancy"], ["grid", "Grid"], ["trends", "Custom line"]] as [string, string][]).filter(([k]) => (k === "props" ? books.props : k === "fancy" ? books.fancy : true)), [books]);
  const [tabAsked, setTab] = useState<string | undefined>(tabParam);
  useEffect(() => { setTab(tabParam); }, [id, tabParam]);
  const tab = tabs.some(([k]) => k === tabAsked) ? tabAsked! : tabs[0][0];
  const scope = useMemo(() => (f && f.fmt !== "FC" && tab === "props" ? { teams: [f.a, f.b] as [string, string], archive: archived } : undefined), [f, tab, archived]);
  const { rows, isLoading, scoring, error, soFarOf, outOf } = useHotView(scope, undefined, archived ? doc : undefined);
  // this match: the same two sides, a Test on any of its days, not the series' next game
  const here = useMemo(() => (f ? rows.filter((r) => sameFixture({ match: r.match, start_utc: r.start, fmt: r.fmt }, { a: f.a, b: f.b, start: f.start, fmt: f.fmt })) : []), [rows, f]);
  const [stat, setStat] = useState("all");
  const statKeys = useMemo(() => [...new Set(here.map((r) => r.stat))], [here]);
  const shown = useMemo(() => (stat === "all" || !statKeys.includes(stat) ? here : here.filter((r) => r.stat === stat)).slice(0, MAX_ROWS), [here, stat, statKeys]);

  const stats = useStore();
  const store: any = stats.data?.store;
  const matchesReady = stats.matchesReady;
  const [gStat, setGStat] = useState("sixes"), [gLine, setGLine] = useState(0.5), [games, setGames] = useState(10), [hit, setHit] = useState(0.6), [gTeam, setGTeam] = useState<number>();
  const fmt = f && FORMATS.includes(f.fmt) ? f.fmt : "T20";
  const teams: [string, number][] = f ? [[f.a, f.a_ix], [f.b, f.b_ix]] : [];
  const known = teams.filter(([, i]) => i >= 0);
  const gridTeam = known.some(([, i]) => i === gTeam) ? gTeam! : known[0]?.[1];
  const grids = useQuery({
    queryKey: ["fx-grids", id, fmt, gStat, games], enabled: !!store && matchesReady && !!f && f.fmt !== "FC" && (tab === "grid" || tab === "trends"),
    queryFn: async () => Promise.all(known.map(async ([name, i]) => ({ name, team: i, g: await collectGrid(store, i, fmt, gStat, games) }))),
  });
  const shownGrid = grids.data?.find((x) => x.team === gridTeam) ?? grids.data?.[0];

  const target = useRef<ComponentRef<typeof View>>(null);
  const [barH, setBarH] = useState(0);
  const { onScroll, y } = useCollapseOnScroll();
  const scrimThreshold = useSharedValue(56);
  const barScrim = useChromeScrim(y, scrimThreshold);
  const share = () => {
    if (!f) return;
    const url = shareFixtureUrl(SITE_URL, f.id);
    const when = f.start.length > 10 ? `${dayLabel(fixtureStart(f), now)}, ${localTime(fixtureStart(f))}` : dayLabel(fixtureStart(f), now);
    void Share.share({ message: matchShareText({ a: f.a, b: f.b, when, venue: shortVenue(f.venue) || f.venue || "", series: seriesName(f), url }) || url, title: `${f.a} v ${f.b}` });
  };
  // Header paints first; props / fancy / grid mount as an interruptible transition (same pattern as tab opens).
  const bodyReady = useLater(!!f && !fxLoading);

  return (
    <PageAtmosphere>
      <BlurTargetView ref={target} style={styles.root}>
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: barH, paddingBottom: inset.bottom + space.section }}>
          {fxLoading ? (
            <MatchHeaderSkeleton />
          ) : !f || !item ? (
            <View style={styles.pad}>
              <EmptyState
                title="Fixture gone"
                body="That match is no longer in the schedule."
                action={<Button variant="secondary" size="sm" label="Back to fixtures" onPress={goBack} />}
              />
            </View>
          ) : (
            <>
              {item.live?.status === "live" ? (
                <View style={styles.scoreShell}>
                  <ScorecardCard
                    match={item.live}
                    teams={known}
                    header={<MatchHeader bare item={item} onGround={store && fixtureHasGround(store, f?.venue) ? () => push(groundPath(f.id)) : undefined} />}
                  />
                </View>
              ) : (
                <Animated.View entering={enter(0)} style={styles.scoreShell}>
                  <MatchHeader bare item={item} onGround={store && fixtureHasGround(store, f?.venue) ? () => push(groundPath(f.id)) : undefined} />
                  {bodyReady && f.fmt !== "FC" ? <MatchAccordions match={item.live} teams={known} /> : null}
                </Animated.View>
              )}
              {!bodyReady ? <Working label="Loading…" rows={4} /> : null}
              {/* CapsuleTabs scroll with content — sticky under BlurBar hides the band on native. */}
              {bodyReady && f.fmt !== "FC" ? (
                <View style={styles.sections}><CapsuleTabs label="Sections" items={tabs} value={tab} onChange={setTab} /></View>
              ) : null}
              {!bodyReady ? null : f.fmt === "FC" ? (
                <View style={styles.pad}><EmptyState title="No props for first-class" body="First-class cricket is not part of the stats here, so there are no player props for this match." /></View>
              ) : tab === "props" ? (
                <>
                  {statKeys.length > 1 ? <CapsuleTabs label="Stat" items={[["all", "All props"], ...statKeys.map((k) => [k, (STATS as any)[k]?.label ?? k] as [string, string])]} value={stat} onChange={setStat} /> : null}
                  {isLoading ? (
                    <Working label="Scoring this match's lines…" rows={4} />
                  ) : error && !here.length ? (
                    <View style={styles.pad}><EmptyState title="Could not score lines" body="Go back and try again." /></View>
                  ) : shown.length ? (
                    <View>
                      {shown.map((r, i) => <PropRow key={`${r.idx}${r.stat}${r.start}${r.inn}${r.quotes?.some((q: any) => q.live) ? "L" : ""}`} r={r} i={i} soFar={soFarOf(r)} out={outOf(r)} />)}
                      {scoring ? <Working label="Scoring more lines…" /> : null}
                    </View>
                  ) : scoring ? (
                    <Working label="Scoring this match's lines…" />
                  ) : (
                    <View style={styles.pad}><EmptyState title="No props yet" body="No player props are priced for this match yet." /></View>
                  )}
                </>
              ) : tab === "fancy" ? (
                <View style={[styles.pad, { paddingTop: space.stack }]}><MatchFancy key={`${f.id}`} fx={f} teams={known} fmt={fmt} doc={doc} mode="list" /></View>
              ) : (
                <View style={[styles.pad, { gap: space.stack, paddingTop: space.stack }]}>
                  <GridFilters stat={gStat} line={gLine} games={games} hit={tab === "trends" ? hit : undefined} onStat={setGStat} onLine={setGLine} onGames={setGames} onHit={setHit} />
                  {tab === "grid" ? (
                    <>
                      {known.length > 1 ? <View style={styles.bleed}><Chips items={known.map(([name, i]) => [String(i), abbr(name)] as [string, string])} value={String(gridTeam)} onChange={(v) => setGTeam(Number(v))} /></View> : null}
                      {!matchesReady || (grids.isLoading && !shownGrid) ? <Working label="Reading the players' games…" shape="grid" /> : !shownGrid ? (
                        <EmptyState compact title="No grid yet" body="Could not load player games for this match." />
                      ) : (
                        <View style={{ gap: space.snug }}>
                          <View style={styles.gridHead}><TeamBadge name={shownGrid.name} size={24} /><Text style={styles.gridTitle}>{shownGrid.name}</Text><Text style={styles.empty}>{(STATS as any)[gStat].label} over {gLine}</Text></View>
                          <GridTable g={shownGrid.g} teamIdx={shownGrid.team} line={gLine} />
                          <Text style={styles.empty}>Clears {gLine} in green, under it in red. VOID: in the XI, did not bat or bowl, so the bet is void. A dash: not in the XI.</Text>
                        </View>
                      )}
                    </>
                  ) : grids.data ? <TrendList grids={grids.data} line={gLine} minHit={hit} stat={gStat} /> : !matchesReady || grids.isLoading ? <Working label="Reading the players' games…" shape="list" /> : <EmptyState compact title="No trends" body="Could not load player games for this match." />}
                </View>
              )}
            </>
          )}
        </Animated.ScrollView>
      </BlurTargetView>

      <View
        style={styles.bar}
        onLayout={(e) => {
          const h = Math.round(e.nativeEvent.layout.height);
          setBarH((prev) => Math.max(prev, h));
          scrimThreshold.value = Math.max(48, h);
        }}
      >
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, barScrim]} />
        <BlurBar merge blurTarget={target} style={{ paddingTop: inset.top }}>
          <PageHeader title={f ? `${f.a} v ${f.b}` : "Match"} subtitle={f ? seriesName(f) : undefined} right={f ? <RoundButton label="Share" onPress={share}><Ionicons name="share-outline" size={20} color={color.foreground} /></RoundButton> : undefined} />
        </BlurBar>
      </View>
      <TabFade withTabBar={false} />
    </PageAtmosphere>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  bar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  /** Web twin: `-mx-gutter … bg-card border-b` — fill + bottom rule both full width. */
  scoreShell: {
    backgroundColor: color.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
  },
  pad: { paddingHorizontal: space.gutter, paddingTop: space.snug },
  bleed: { marginHorizontal: -space.gutter },
  sections: { paddingTop: rhythm.top },
  gridHead: { flexDirection: "row", alignItems: "center", gap: space.tight },
  gridTitle: { ...t.bodyLabel, color: color.foreground },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.tight, paddingTop: space.group, paddingBottom: space.snug },
  title: { ...type.heading, color: color.foreground },
  empty: { ...type.callout, color: color["muted-foreground"] },
});
