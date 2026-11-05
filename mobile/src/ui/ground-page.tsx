/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { MATCH_MARKETS, marketReport, selectMatches, topBatters } from "@cricket/engine/markets.js";
import { FORMATS } from "@cricket/engine/util.js";
import { odds, pc } from "@site/lib/format";
import { filterGames, genderFilterLabel, groundGames, majorityFormat, MARKET_CHIPS, seriesName, tourDatesAtGround, tourStatusAtGround, venueParts, type GenderFilter } from "@site/lib/ground";
import { fetchVenueWx, groundClock } from "@site/lib/venue-wx";
import { storeQuery } from "@/lib/data";
import { openFixture, openPlayer } from "@/lib/nav";
import { fixturesQuery } from "@/lib/queries";
import { fixtureState, type RailItem } from "@/lib/rail";
import { useNow } from "@/lib/use-now";
import { Chips } from "@/ui/chips";
import { DataTable, Metric } from "@/ui/data-table";
import { EmptyState } from "@/ui/empty-state";
import { FixtureCard } from "@/ui/fixture-card";
import { useScreenInsets } from "@/ui/insets";
import { MiniBars } from "@/ui/mini-bars";
import { Working } from "@/ui/motion";
import { PageHeader } from "@/ui/page-header";
import { Press } from "@/ui/press";
import { Segmented } from "@/ui/segmented";
import { TeamBadge } from "@/ui/team-badge";
import { Text } from "@/ui/text";
import { cap, color, font, num, radius, space, type, tonal } from "@/ui/tokens";

/** Past games listed before "Show more": a busy ground has hundreds, and each is a card. */
const PAGE = 20;
const pct1 = (n: number | null) => (n == null ? "–" : `${(n * 100).toFixed(1)}%`);
const short = (n: number | null | undefined, d = 1) => (n == null ? "–" : Number.isInteger(n) ? String(n) : n.toFixed(d));

/**
 * The site's ground page (`site/src/components/app/fixture-ground.tsx`): the ground and its weather, the series here (when opened from a match), the games played and
 * scheduled there by format and gender, then Markets (match runs, sixes … from the games at this ground). The rules are `site/src/lib/ground.ts`, shared with the site.
 */
export function GroundPage({ venue, fixtureId, from }: { venue?: string; fixtureId?: string; from?: any }) {
  const inset = useScreenInsets(false);
  const now = useNow(30_000);
  const stats = useQuery(storeQuery), fixtures = useQuery(fixturesQuery);
  const store: any = stats.data?.store;
  const g = useMemo(() => (store ? groundGames(store, fixtures.data, venue) : null), [store, fixtures.data, venue]);
  const [fmt, setFmt] = useState(""), [gender, setGender] = useState<GenderFilter>(""), [shown, setShown] = useState(PAGE);
  const name = g?.label || venue || "Ground";
  const { ground, city } = venueParts(name);
  const wx = useQuery({ queryKey: ["venue-wx", name], queryFn: () => fetchVenueWx(name), staleTime: 10 * 60_000, enabled: !!venue });
  const head = <PageHeader title={ground} subtitle="Ground" />;

  if (!venue) return <View style={[styles.root, { paddingTop: inset.top }]}>{head}<View style={styles.pad}><EmptyState title="No venue" body="This fixture has no ground listed." /></View></View>;
  if (!g || fixtures.isLoading) return <View style={[styles.root, { paddingTop: inset.top }]}>{head}<Working label="Loading…" /></View>;
  if (!g.known) return <View style={[styles.root, { paddingTop: inset.top }]}>{head}<View style={styles.pad}><EmptyState title="Ground not in data" body={`We could not match “${venue}” to fixtures or stats.`} /></View></View>;

  const activeFmt = FORMATS.includes(fmt) ? fmt : majorityFormat(g.atGround);
  const list = filterGames(g.atGround, activeFmt, gender);
  const formats = FORMATS.map((f) => [f, g.atGround.filter((x: any) => (x.fmt || "T20") === f && (!gender || x.gender === gender || (!x.gender && gender === "male"))).length] as const).filter(([, n]) => n > 0);
  const both = g.atGround.some((f: any) => f.gender !== "female") && g.atGround.some((f: any) => f.gender === "female");
  const w = wx.data;
  const local = w?.timeZone ? groundClock(w.timeZone, now) : w?.localTime || "";

  return (
    <View style={[styles.root, { paddingTop: inset.top }]}>
      {head}
      <ScrollView contentContainerStyle={{ paddingBottom: inset.bottom + 24, gap: space.section }} showsVerticalScrollIndicator={false}>
        <View style={[styles.pad, { gap: space.stack }]}>
          <View style={styles.hero}>
            <View style={styles.pin}><Ionicons name="location" size={28} color={color.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>Ground</Text>
              <Text style={styles.name} numberOfLines={2}>{ground}</Text>
              {city ? <Text style={styles.city} numberOfLines={1}>{city}</Text> : null}
            </View>
          </View>
          <View style={styles.metrics}>
            <Metric k="Matches">{g.atGround.length}</Metric>
            <Metric k="Weather">{wx.isLoading ? "…" : w ? `${w.temp}°` : "–"}</Metric>
            <Metric k="Local">{wx.isLoading ? "…" : local || "–"}</Metric>
          </View>
          {w ? <Text style={styles.note}>{w.label} · ground local time{w.city && w.city !== city ? ` · ${w.city}` : ""}</Text> : wx.isError ? <Text style={styles.note}>Weather unavailable for this ground</Text> : null}
          {from && fixtureId ? <TourChip from={from} fixtureId={fixtureId} atGround={g.atGround} now={now} /> : null}
        </View>

        <View style={{ gap: space.snug }}>
          <Chips items={formats.map(([f, n]) => [f, f, n])} value={activeFmt} onChange={(v) => { setFmt(v); setShown(PAGE); }} />
          {both ? (
            <View style={styles.pad}>
              <Segmented<GenderFilter> label="Gender" value={gender} onChange={(v) => { setGender(v); setShown(PAGE); }} items={[["", genderFilterLabel("")], ["male", genderFilterLabel("male")], ["female", genderFilterLabel("female")]]} />
            </View>
          ) : null}
        </View>

        <View style={[styles.pad, { gap: space.snug }]}>
          <View style={styles.titleRow}><Text style={styles.h2}>Matches</Text><Text style={styles.count}>{list.length}</Text></View>
          {!list.length ? (
            <EmptyState compact title="No matches" body="Nothing at this ground for the filters you picked." />
          ) : (
            <>
              {list.slice(0, shown).map((f: any) => {
                const item: RailItem = { fixture: f, state: fixtureState(f, undefined, now), live: null, noProps: !!f.noProps };
                return <FixtureCard key={f.id || f._key || `${f.a}-${f.b}-${f.start}`} item={item} now={now} link={f.source !== "history"} />;
              })}
              {list.length > shown ? (
                <Press accessibilityRole="button" onPress={() => setShown((n) => n + PAGE)} style={styles.more}>
                  <Text style={styles.moreText}>Show more · {list.length - shown} left</Text>
                </Press>
              ) : null}
            </>
          )}
        </View>

        {g.primary >= 0 ? <GroundMarkets store={store} venueIdx={g.primary} fmt={activeFmt} gender={gender} /> : null}
      </ScrollView>
    </View>
  );
}

/** The series' games at this ground as one row back to the match: crests, dates here, status. */
function TourChip({ from, fixtureId, atGround, now }: { from: any; fixtureId: string; atGround: any[]; now: number }) {
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

/** Match-Fancy-shaped markets from the games at this ground: median / mean / range, bars, over / under at a line, and the ladder. One format (the chips above). */
function GroundMarkets({ store, venueIdx, fmt, gender }: { store: any; venueIdx: number; fmt: string; gender: GenderFilter }) {
  const { width } = useWindowDimensions();
  const [market, setMarket] = useState("match_runs"), [line, setLine] = useState<number | null>(null);
  const fmtName = FORMATS.includes(fmt) ? fmt : "T20";
  useEffect(() => { setLine(null); }, [fmtName, market]);
  const ms = useMemo(() => selectMatches(store, { fmt: FORMATS.indexOf(fmtName), venue: venueIdx, gender: gender === "female" ? 1 : gender === "male" ? 0 : null }) as number[], [store, venueIdx, fmtName, gender]);
  const isTop = market === "top_batter";
  const rep = useMemo(() => (isTop || !ms.length ? null : marketReport(store, ms, market)), [store, ms, market, isTop]);
  const tops = useMemo(() => (isTop && ms.length ? (topBatters as any)(store, ms, { scope: "match" }) : null), [store, ms, isTop]);
  const ladder: any[] = rep?.ladder?.filter((l: any) => l.n) || [];
  const active = line ?? ladder[Math.floor(ladder.length / 2)]?.line ?? ladder[0]?.line ?? null;
  const at = active == null ? null : ladder.find((l) => l.line === active);
  const s = rep?.summary;
  return (
    <View style={{ gap: space.stack }}>
      <View style={[styles.pad, styles.titleRow]}><Text style={styles.h2}>Markets</Text><Text style={styles.note}>{ms.length} matches</Text></View>
      <Chips items={MARKET_CHIPS.map(([k, l]) => [k, l])} value={market} onChange={setMarket} />
      <View style={[styles.pad, { gap: space.stack }]}>
        {!ms.length ? (
          <EmptyState compact title="No matches" body={`Nothing in ${fmtName} at this ground for these filters.`} />
        ) : isTop && tops ? (
          <View>
            <Text style={styles.note}>Highest score in the match · last {tops.n} {fmtName}</Text>
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
            {!tops.rows.length ? <Text style={styles.note}>Not enough matches.</Text> : null}
          </View>
        ) : rep && s && active != null && at ? (
          <View style={{ gap: space.stack }}>
            <View style={styles.titleRow}>
              <Text style={styles.h3}>{(MATCH_MARKETS as any)[market]?.label || market}</Text>
              <Text style={styles.note}>{rep.n} matches · void excluded</Text>
            </View>
            <View style={styles.stats}>
              <Stat k="Median" v={short(s.median)} big />
              <Stat k="Mean" v={s.mean == null ? "–" : s.mean.toFixed(1)} />
              <Stat k="Range" v={s.min == null || s.max == null ? "–" : `${Math.round(s.min)}–${Math.round(s.max)}`} />
            </View>
            <MiniBars last={(rep.values as number[]).slice(-40).map((v) => ({ v, s: v > active ? "hit" : "miss" }))} line={active} width={width - space.gutter * 2} />
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
            <DataTable
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
  return <View style={{ gap: 2 }}><Text style={styles.statKey}>{k}</Text><Text style={[styles.statNum, big && { fontSize: 34, lineHeight: 38 }]}>{v}</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  pad: { paddingHorizontal: space.gutter },
  hero: { ...tonal, borderRadius: radius.card, padding: space.inset, flexDirection: "row", alignItems: "center", gap: space.snug },
  pin: { width: 56, height: 56, borderRadius: 16, backgroundColor: color.secondary, alignItems: "center", justifyContent: "center" },
  kicker: { ...type.footnote, ...cap, color: color.primary },
  name: { ...type.display, color: color.foreground },
  city: { ...type.body, color: color["muted-foreground"] },
  metrics: { flexDirection: "row" },
  note: { ...type.footnote, color: color["muted-foreground"] },
  tour: { ...tonal, borderRadius: radius.card, padding: space.snug, flexDirection: "row", alignItems: "center", gap: space.snug },
  crests: { flexDirection: "row", alignItems: "center" },
  tourName: { ...type.callout, fontFamily: font.medium, color: color.foreground },
  status: { ...cap },
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.snug },
  h2: { ...type.title, color: color.foreground },
  h3: { ...type.body, fontFamily: font.medium, color: color.foreground },
  count: { ...num, fontSize: 15, color: color["muted-foreground"] },
  more: { ...tonal, borderRadius: radius.card, height: 44, alignItems: "center", justifyContent: "center" },
  moreText: { ...type.callout, color: color.foreground },
  stats: { flexDirection: "row", alignItems: "flex-end", gap: space.group },
  statKey: { ...type.footnote, color: color["muted-foreground"] },
  statNum: { ...num, fontSize: 22, color: color.foreground },
  cards: { flexDirection: "row", gap: space.snug },
  side: { flex: 1, gap: space.tight, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, paddingTop: space.snug },
  sideKey: { ...type.footnote, fontFamily: font.medium, color: color["muted-foreground"], textTransform: "capitalize" },
  big: { ...num, fontSize: 20, color: color.foreground },
  topRow: { flexDirection: "row", alignItems: "center", gap: space.snug, minHeight: 52, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  topName: { ...type.body, fontFamily: font.medium, color: color.foreground },
  lineNum: { ...num, fontSize: 17, color: color.foreground },
  cellNum: { ...num, fontSize: 15, color: color.foreground },
  fair: { ...type.footnote, color: color["muted-foreground"] },
});
