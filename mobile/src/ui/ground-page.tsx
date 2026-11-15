/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { layoutWidth } from "@/lib/fit";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { sameFixture } from "@cricket/engine/lines.js";
import { MATCH_MARKETS, marketReport, selectMatches, topBatters } from "@cricket/engine/markets.js";
import { FORMATS } from "@cricket/engine/util.js";
import { matchDateLabel, odds, pc } from "@site/lib/format";
import { genderFilterLabel, groundGames, groundSummary, MARKET_CHIPS, seriesName, tourDatesAtGround, tourStatusAtGround, venueParts, type GenderFilter } from "@site/lib/ground";
import { fetchVenueWx, groundClock } from "@site/lib/venue-wx";
import { groundMatchFilters } from "@/lib/ground-filters";
import { useStore } from "@/lib/use-store";
import { openFixture, openPlayer } from "@/lib/nav";
import { fixturesQuery, linesQuery, liveQuery } from "@/lib/queries";
import { fixtureState, liveMatchFor, type RailItem } from "@/lib/rail";
import { useNow } from "@/lib/use-now";
import { Chips } from "@/ui/chips";
import { DataTable, Metric } from "@/ui/data-table";
import { EmptyState } from "@/ui/empty-state";
import { FixtureCard } from "@/ui/fixture-card";
import { useScreenInsets } from "@/ui/insets";
import { MiniBars } from "@/ui/mini-bars";
import { Working } from "@/ui/motion";
import { PageHeader } from "@/ui/page-header";
import { PageAtmosphere } from "@/ui/page-atmosphere";
import { Press } from "@/ui/press";
import { LineTabs } from "@/ui/line-tabs";
import { TeamBadge } from "@/ui/team-badge";
import { Text } from "@/ui/text";
import { Bleed } from "@/ui/bleed";
import { cap, color, font, num, radius, space, type, fs, surface, rhythm, t } from "@/ui/tokens";

/** Past games listed before "Show more": a busy ground has hundreds, and each is a card. */
const PAGE = 8;
const pct1 = (n: number | null) => (n == null ? "–" : `${(n * 100).toFixed(1)}%`);
const short = (n: number | null | undefined, d = 1) => (n == null ? "–" : Number.isInteger(n) ? String(n) : n.toFixed(d));

/**
 * The site's ground page (`site/src/components/app/fixture-ground.tsx`): the ground and its weather, the series here (when opened from a match), the games played and
 * scheduled there by format and gender, then Markets (match runs, sixes … from the games at this ground). The rules are `site/src/lib/ground.ts`, shared with the site.
 */
export function GroundPage({ venue, fixtureId, from }: { venue?: string; fixtureId?: string; from?: any }) {
  const inset = useScreenInsets(false);
  const stats = useStore(), fixtures = useQuery(fixturesQuery);
  const store: any = stats.data?.store;
  const matchesReady = stats.matchesReady;
  // History at the ground needs matches.json; schedule-only still paints once fixtures are in.
  const g = useMemo(() => (store && matchesReady ? groundGames(store, fixtures.data, venue) : null), [store, matchesReady, fixtures.data, venue]);
  const [fmt, setFmt] = useState(from?.fmt ?? ""), [gender, setGender] = useState<GenderFilter>("");
  // From a fixture: open on Markets (Fancy rhythm). Venue list entry keeps Matches first.
  const [section, setSection] = useState<"matches" | "markets">(fixtureId ? "markets" : "matches");
  const filters = useMemo(() => g && groundMatchFilters(g.atGround, fmt, gender), [g, fmt, gender]);
  const name = g?.label || venue || "Ground";
  const { ground, city } = venueParts(name);
  const wx = useQuery({ queryKey: ["venue-wx", name], queryFn: () => fetchVenueWx(name), staleTime: 10 * 60_000, enabled: !!venue });
  const head = <PageHeader title={venue ? ground : "Ground"} subtitle={venue && city ? city : undefined} />;

  if (!venue) return <PageAtmosphere style={{ paddingTop: inset.top }}>{head}<View style={styles.pad}><EmptyState title="No venue" body="This fixture has no ground listed." /></View></PageAtmosphere>;
  if ((!g && stats.isError) || (fixtures.isError && !fixtures.data)) return (
    <PageAtmosphere style={{ paddingTop: inset.top }}>{head}<View style={[styles.pad, styles.stack]}>
      <EmptyState title="Could not load ground" body="Try again to see the matches and market history." />
      <Press accessibilityRole="button" onPress={() => { void stats.refetch(); void fixtures.refetch(); }} style={styles.more}><Text style={styles.moreText}>Try again</Text></Press>
    </View></PageAtmosphere>
  );
  if (!store || !matchesReady || !g || !filters || fixtures.isLoading) return <PageAtmosphere style={{ paddingTop: inset.top }}>{head}<Working label="Loading…" shape="ground" /></PageAtmosphere>;
  if (!g.known) return <PageAtmosphere style={{ paddingTop: inset.top }}>{head}<View style={styles.pad}><EmptyState title="Ground not in data" body={`We could not match “${venue}” to fixtures or stats.`} /></View></PageAtmosphere>;

  const { activeFmt, formats, list, both } = filters;
  const activeSection = g.primary < 0 ? "matches" : section;
  return (
    <PageAtmosphere style={{ paddingTop: inset.top }}>
      {head}
      <ScrollView stickyHeaderIndices={g.primary >= 0 ? [1] : undefined} contentContainerStyle={{ paddingBottom: inset.bottom + space.section }} showsVerticalScrollIndicator={false}>
        <View style={[styles.pad, styles.stack, styles.intro]}>
          <View style={styles.hero}>
            <GroundConditions count={g.atGround.length} weather={wx.data} loading={wx.isLoading} unavailable={wx.isError} />
          </View>
          {from && fixtureId ? <TourChip from={from} fixtureId={fixtureId} atGround={g.atGround} /> : null}
        </View>

        {/* Sticky only the short Matches/Markets control — pinning format+gender chips with it is too tall for phone. */}
        {g.primary >= 0 ? <View style={styles.sectionBar}>
          <LineTabs<"matches" | "markets"> label="Ground sections" value={activeSection} onChange={setSection} items={[["matches", "Matches"], ["markets", "Markets"]]} />
        </View> : null}

        <View style={styles.filters}>
          <View style={[styles.pad, styles.titleRow]}><Text style={styles.kicker}>Match filters</Text><Text style={styles.note}>{activeFmt} · {genderFilterLabel(gender)}</Text></View>
          <Chips items={formats} value={activeFmt} onChange={setFmt} />
          {both ? <Chips items={[["", genderFilterLabel("")], ["male", genderFilterLabel("male")], ["female", genderFilterLabel("female")]] as [GenderFilter, string][]} value={gender} onChange={(g) => setGender(g as GenderFilter)} /> : null}
        </View>

        {g.primary >= 0 ? <GroundStats store={store} venueIndexes={g.venueIndices} fmt={activeFmt} gender={gender} /> : null}

        {activeSection === "markets"
          ? <GroundMarkets store={store} venueIndexes={g.venueIndices} fmt={activeFmt} gender={gender} />
          : <GroundMatches key={`${activeFmt}|${gender}`} list={list} />}
      </ScrollView>
    </PageAtmosphere>
  );
}

const num0 = (n: number | null | undefined) => (n == null ? "–" : String(Math.round(n)));
const num1 = (n: number | null | undefined) => (n == null ? "–" : n.toFixed(1));

/** Same 2x2 + hairline secondary rows as the site ground page (`groundSummary`). */
function GroundStats({ store, venueIndexes, fmt, gender }: { store: any; venueIndexes: number[]; fmt: string; gender: GenderFilter }) {
  const fmtName = FORMATS.includes(fmt) ? fmt : "T20";
  const ms = useMemo(() => selectMatches(store, {
    fmt: FORMATS.indexOf(fmtName),
    venue: venueIndexes,
    gender: gender === "female" ? 1 : gender === "male" ? 0 : null,
  }) as number[], [store, venueIndexes, fmtName, gender]);
  const s = useMemo(() => groundSummary(store, ms, fmtName), [store, ms, fmtName]);
  if (!s.counted) return null;
  const hi = s.highestFirst;
  const showPp = s.powerplayOvers != null;
  const primary: [string, string][] = [
    ["1st inns avg", num0(s.avgFirst)],
    ["2nd inns avg", num0(s.avgSecond)],
    ["Chase win", s.chaseWinPct == null ? "–" : `${num0(s.chaseWinPct)}%`],
    showPp
      ? [`PP 1–${s.powerplayOvers}`, s.avgPowerplay == null ? "–" : num0(s.avgPowerplay)]
      : ["Extras / match", num1(s.avgExtras)],
  ];
  // One labelled figure per row (same as site) — not a jammed 4s · 6s · % string.
  const secondary: [string, string][] = [
    ["Fours / inns", num1(s.foursPerInns)],
    ["Sixes / inns", num1(s.sixesPerInns)],
  ];
  if (s.boundaryRunPct != null) secondary.push(["Boundary runs", `${num0(s.boundaryRunPct)}%`]);
  if (showPp) secondary.push(["Extras / match", num1(s.avgExtras)]);
  secondary.push(["Highest 1st", hi ? `${hi.runs} · ${hi.a} vs ${hi.b}, ${matchDateLabel(hi.date)}` : "–"]);
  return (
    <View style={[styles.pad, { gap: space.snug }]}>
      <View style={styles.titleRow}>
        <Text style={styles.h2} accessibilityRole="header">Ground stats</Text>
        <Text style={styles.note}>{s.counted} · {fmtName} · void excluded</Text>
      </View>
      {/* One continuous block — no gap between 2x2 and secondary rows (matches site / Fancy). */}
      <View style={styles.factsBlock}>
        <View style={styles.grid2}>
          {primary.map(([k, v], i) => (
            <View key={k} style={[styles.gridCell, i % 2 === 1 && styles.gridCellR, i >= 2 && styles.gridCellB]}>
              <Text style={styles.kpiK} numberOfLines={1}>{k}</Text>
              <Text style={styles.kpiV}>{v}</Text>
            </View>
          ))}
        </View>
        <View style={styles.secList}>
          {secondary.map(([k, v], i) => (
            <View key={k} style={[styles.secRow, i === 0 && { borderTopWidth: 0 }]}>
              <Text style={styles.kpiK}>{k}</Text>
              <Text style={styles.secVal} numberOfLines={2}>{v}</Text>
            </View>
          ))}
        </View>
      </View>
      {s.counted < 10 ? <Text style={styles.warn}>Small sample ({s.counted} matches): treat these with caution.</Text> : null}
    </View>
  );
}

function GroundConditions({ count, weather, loading, unavailable }: { count: number; weather?: Awaited<ReturnType<typeof fetchVenueWx>>; loading: boolean; unavailable: boolean }) {
  const now = useNow(30_000);
  const local = weather?.timeZone ? groundClock(weather.timeZone, now) : weather?.localTime;
  return (
    <View style={styles.conditions}>
      <View style={styles.metrics}>
        <Metric k="Listed matches">{count}</Metric>
        <Metric k="Temperature" sub={weather?.label || (unavailable ? "Weather unavailable" : undefined)}>{loading ? "…" : weather ? `${weather.temp}°` : "–"}</Metric>
        <Metric k="Local time" sub={weather?.city || undefined}>{loading ? "…" : local || "–"}</Metric>
      </View>
    </View>
  );
}

function GroundMatches({ list }: { list: any[] }) {
  const [shown, setShown] = useState(PAGE);
  const scores = useQuery(liveQuery), lines = useQuery(linesQuery);
  const now = useNow(30_000);
  return (
    <View style={[styles.pad, styles.stack, styles.section]}>
      <View style={styles.titleRow}><Text style={styles.h2} accessibilityRole="header">Matches at this ground</Text><Text style={styles.count}>{list.length}</Text></View>
      {!list.length ? <EmptyState compact title="No matches" body="Try another format or gender filter." /> : list.slice(0, shown).map((f) => {
        const historical = f.source === "history";
        const match = historical ? null : liveMatchFor(scores.data, lines.data, f);
        // The live lookup can fall back to a different game between the same teams.
        const live = match?.start && sameFixture({ match: `${f.a} vs ${f.b}`, start_utc: match.start, fmt: match.fmt }, f) ? match : null;
        const item: RailItem = { fixture: f, state: fixtureState(f, live?.status, now), live, noProps: !historical && !!f.noProps };
        return <View key={f.id || f._key || `${f.a}-${f.b}-${f.start}`} style={styles.match}>
          <Text style={styles.note}>{matchDateLabel(f.start)}</Text>
          <FixtureCard item={item} now={now} link={!historical} />
        </View>;
      })}
      {list.length > shown ? <Press accessibilityRole="button" onPress={() => setShown((n) => n + PAGE)} style={styles.more}>
        <Text style={styles.moreText}>Show more matches · {list.length - shown} left</Text>
      </Press> : null}
    </View>
  );
}

/** The series' games at this ground as one row back to the match: crests, dates here, status. */
function TourChip({ from, fixtureId, atGround }: { from: any; fixtureId: string; atGround: any[] }) {
  const now = useNow(30_000);
  const series = seriesName(from);
  const same = useMemo(() => {
    const hits = atGround.filter((f) => seriesName(f) === series);
    return hits.length ? hits : from.start ? [{ ...from, source: "schedule" }] : [];
  }, [atGround, series, from]);
  const status = tourStatusAtGround(same, now), dates = tourDatesAtGround(same);
  const sub = dates ? (same.length > 1 ? `${dates} · ${same.length} here` : dates) : `${from.a} v ${from.b}`;
  const tone = status === "In progress" ? color.miss : color["muted-foreground"];
  return (
    <Press accessibilityRole="link" accessibilityLabel={`Back to ${from.a} v ${from.b}`} onPress={() => openFixture({ id: fixtureId })} style={({ pressed }) => [styles.tour, pressed && { opacity: 0.7 }]}>
      <View style={styles.crests}><TeamBadge name={from.a} size={28} /><View style={{ marginLeft: -8 }}><TeamBadge name={from.b} size={28} /></View></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.tourName} numberOfLines={1}>{series}</Text>
        <Text style={styles.note} numberOfLines={1}>{sub}</Text>
      </View>
      <Text style={[styles.status, { color: tone }]}>{status === "In progress" ? "Live" : status === "Completed" ? "Done" : "Upcoming"}</Text>
      <Ionicons name="chevron-forward" size={16} color={color["muted-foreground"]} />
    </Press>
  );
}

/** Match-Fancy-shaped markets: Typical / Average / Low–high, bars, O/U, edge-to-edge line ladder. One format (the chips above). */
function GroundMarkets({ store, venueIndexes, fmt, gender }: { store: any; venueIndexes: number[]; fmt: string; gender: GenderFilter }) {
  const width = layoutWidth(useWindowDimensions().width, Platform.OS);
  const [market, setMarket] = useState("match_runs"), [line, setLine] = useState<number | null>(null);
  const fmtName = FORMATS.includes(fmt) ? fmt : "T20";
  useEffect(() => { setLine(null); }, [venueIndexes, fmtName, gender, market]);
  const ms = useMemo(() => selectMatches(store, { fmt: FORMATS.indexOf(fmtName), venue: venueIndexes, gender: gender === "female" ? 1 : gender === "male" ? 0 : null }) as number[], [store, venueIndexes, fmtName, gender]);
  const isTop = market === "top_batter";
  const rep = useMemo(() => (isTop || !ms.length ? null : marketReport(store, ms, market)), [store, ms, market, isTop]);
  const tops = useMemo(() => (isTop && ms.length ? (topBatters as any)(store, ms, { scope: "match" }) : null), [store, ms, isTop]);
  const ladder: any[] = rep?.ladder?.filter((l: any) => l.n) || [];
  const active = (ladder.some((l) => l.line === line) ? line : ladder[Math.floor(ladder.length / 2)]?.line) ?? null;
  const at = active == null ? null : ladder.find((l) => l.line === active);
  const s = rep?.summary;
  return (
    <View style={{ gap: space.stack }}>
      <View style={[styles.pad, styles.titleRow]}><Text style={styles.h2} accessibilityRole="header">Ground markets</Text><Text style={styles.note}>Historical results</Text></View>
      <Chips items={MARKET_CHIPS.map(([k, l]) => [k, l])} value={market} onChange={setMarket} />
      <View style={[styles.pad, { gap: space.stack }]}>
        {!ms.length ? (
          <EmptyState compact title="No matches" body={`Nothing in ${fmtName} at this ground for these filters.`} />
        ) : isTop && tops ? (
          <Bleed style={styles.topBleed}>
            <Text style={[styles.note, styles.topNote]}>Highest score in the match · last {tops.n} {fmtName}</Text>
            {tops.rows.map((r: any) => (
              <Press key={r.player} accessibilityRole="link" onPress={() => openPlayer({ idx: r.player, stat: "runs", line: 0.5, fmt: fmtName })} style={({ pressed }) => [styles.topRow, pressed && { opacity: 0.6 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.topName} numberOfLines={1}>{r.name}</Text>
                  <Text style={styles.note}>{r.sole} sole{r.tied ? ` + ${r.tied} tied` : ""} of {tops.n}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.big, { color: color.primary }]}>{pct1(r.pSole)}</Text>
                  <Text style={styles.note}>fair {odds(r.fairSole)}</Text>
                </View>
              </Press>
            ))}
            {!tops.rows.length ? <Text style={[styles.note, styles.topNote]}>Not enough matches.</Text> : null}
          </Bleed>
        ) : rep && s && active != null && at ? (
          <View style={{ gap: space.stack }}>
            <View style={styles.marketCard}>
              <View style={styles.titleRow}>
                <Text style={styles.h3}>{(MATCH_MARKETS as any)[market]?.label || market}</Text>
                <Text style={styles.note}>{rep.n} matches · void excluded</Text>
              </View>
              <View style={styles.stats}>
                <Stat k="Typical" v={short(s.median)} big />
                <Stat k="Average" v={s.mean == null ? "–" : s.mean.toFixed(1)} />
                <Stat k="Low–high" v={s.min == null || s.max == null ? "–" : `${Math.round(s.min)}–${Math.round(s.max)}`} />
              </View>
              <MiniBars last={(rep.values as number[]).slice(-40).map((v) => ({ v, s: v > active ? "hit" : "miss" }))} line={active} width={width - 2 * (space.gutter + space.inset + 1)} />
              <View style={styles.cards}>
                {(["over", "under"] as const).map((side) => {
                  const p: number | null = at[side === "over" ? "pOver" : "pUnder"] ?? null, fair = at[side === "over" ? "fairOver" : "fairUnder"], hit = at[side];
                  return (
                    <View key={side} style={styles.side}>
                      <Text style={styles.sideKey}>{side} {active}</Text>
                      <Text style={[styles.big, side === "over" && { color: color.primary }]}>{pct1(p)}</Text>
                      <Text style={styles.note}>{hit != null ? `${hit} of ${rep.n}` : "–"} · fair {odds(fair)}</Text>
                    </View>
                  );
                })}
              </View>
              {rep.n < 10 ? <Text style={[styles.note, { color: color.amber }]}>Small sample ({rep.n} matches): treat these with caution.</Text> : null}
              <Text style={styles.h3}>Compare lines</Text>
            </View>
            <DataTable
              bleed
              columns={["Line", "Over", "Under"]}
              flex={[1, 1.3, 1.3]}
              highlight={ladder.findIndex((l) => l.line === active)}
              rows={ladder.map((l) => [
                <Press key={l.line} scale={1} onPress={() => setLine(l.line)} accessibilityRole="button" accessibilityLabel={`Line ${l.line}`}><Text style={styles.lineNum}>{l.line}</Text></Press>,
                <Text key="o" style={styles.cellNum}><Text style={{ color: color.primary }}>{pc(l.pOver)}</Text> <Text style={styles.fair}>{odds(l.fairOver)}</Text></Text>,
                <Text key="u" style={styles.cellNum}>{pc(l.pUnder)} <Text style={styles.fair}>{odds(l.fairUnder)}</Text></Text>,
              ])}
            />
          </View>
        ) : (
          <EmptyState compact title="No sample" body={`Not enough ${fmtName} matches for this market.`} />
        )}
      </View>
    </View>
  );
}

function Stat({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return <View style={{ gap: 2 }}><Text style={styles.statKey}>{k}</Text><Text style={[styles.statNum, big && { fontSize: fs.stat, lineHeight: 38 }]}>{v}</Text></View>;
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: space.gutter },
  stack: { gap: rhythm.between },
  intro: { paddingTop: space.tight, paddingBottom: space.stack },
  hero: { ...surface.card, padding: space.inset, gap: space.stack },
  heroHead: { flexDirection: "row", alignItems: "flex-start", gap: space.snug },
  heroText: { flex: 1, minWidth: 0, gap: space.hair },
  sectionBar: { backgroundColor: color.background, paddingVertical: space.hair },
  filters: { paddingTop: space.stack, paddingBottom: space.group },
  conditions: { gap: space.hair },
  match: { gap: rhythm.within },
  section: { paddingTop: rhythm.section },
  marketCard: { ...surface.card, padding: space.inset, gap: space.stack },
  pin: { width: 42, height: 42, borderRadius: radius.control, backgroundColor: color.secondary, alignItems: "center", justifyContent: "center" },
  kicker: { ...type.footnote, ...cap, color: color.primary },
  name: { ...type.display, color: color.foreground },
  city: { ...type.body, color: color["muted-foreground"] },
  metrics: { flexDirection: "row" },
  factsBlock: { borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, overflow: "hidden" },
  grid2: { flexDirection: "row", flexWrap: "wrap" },
  gridCell: { width: "50%", gap: space.hair, paddingHorizontal: space.snug, paddingVertical: space.snug, borderBottomWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: color.hairline },
  gridCellR: { borderRightWidth: 0 },
  gridCellB: { borderBottomWidth: StyleSheet.hairlineWidth },
  secList: { borderTopWidth: 0 },
  secRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.snug, minHeight: 44, paddingHorizontal: space.snug, paddingVertical: space.snug, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  secVal: { flexShrink: 1, textAlign: "right", ...num, fontSize: fs.metric, color: color.foreground },
  kpiK: { ...cap, color: color["muted-foreground"] },
  kpiV: { ...num, fontSize: fs.figure, color: color.foreground },
  warn: { ...type.footnote, color: color.amber },
  note: { ...type.footnote, color: color["muted-foreground"] },
  tour: { ...surface.card, padding: space.snug, flexDirection: "row", alignItems: "center", gap: space.snug },
  crests: { flexDirection: "row", alignItems: "center" },
  tourName: { ...t.calloutLabel, color: color.foreground },
  status: { ...cap },
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.snug },
  h2: { ...type.heading, color: color.foreground },
  h3: { flexShrink: 1, ...t.bodyLabel, color: color.foreground },
  count: { ...num, fontSize: fs.body, color: color["muted-foreground"] },
  more: { ...surface.card, height: 44, alignItems: "center", justifyContent: "center" },
  moreText: { ...type.callout, color: color.foreground },
  stats: { flexDirection: "row", alignItems: "flex-end", gap: space.group },
  statKey: { ...type.footnote, color: color["muted-foreground"] },
  statNum: { ...num, fontSize: fs.figure, color: color.foreground },
  cards: { flexDirection: "row", gap: space.snug },
  side: { flex: 1, gap: space.tight, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, paddingTop: space.snug },
  sideKey: { ...t.footnoteLabel, color: color["muted-foreground"], textTransform: "capitalize" },
  big: { ...num, fontSize: fs.metric, color: color.foreground },
  /** Web twin: `-mx-gutter border-y` Top batter edge band. */
  topBleed: { marginTop: space.snug },
  topNote: { paddingHorizontal: space.gutter, paddingVertical: space.snug },
  topRow: { flexDirection: "row", alignItems: "center", gap: space.snug, minHeight: 52, paddingHorizontal: space.gutter, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  topName: { ...t.bodyLabel, color: color.foreground },
  lineNum: { ...num, fontSize: fs.title, color: color.foreground },
  cellNum: { ...num, fontSize: fs.body, color: color.foreground },
  fair: { ...type.footnote, color: color["muted-foreground"] },
});
