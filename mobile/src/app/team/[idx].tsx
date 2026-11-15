/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/text";
import Animated, { useSharedValue } from "react-native-reanimated";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { FORMATS } from "@cricket/engine/util.js";
import { STATS } from "@cricket/engine/rules.js";
import { runPlan } from "@cricket/engine/plan.js";
import { odds, pc } from "@site/lib/format";
import { collectGrid } from "@site/lib/grid";
import { useStore } from "@/lib/use-store";
import { useLater } from "@/lib/use-later";
import { DataTable, Pill } from "@/ui/data-table";
import { Chips } from "@/ui/chips";
import { EmptyState } from "@/ui/empty-state";
import { GridFilters, GridTable } from "@/ui/grid-table";
import { useScreenInsets } from "@/ui/insets";
import { Working } from "@/ui/motion";
import { PageHeader } from "@/ui/page-header";
import { Segmented } from "@/ui/segmented";
import { StarButton } from "@/ui/star";
import { TeamBadge } from "@/ui/team-badge";
import { EntityHeroWash, PageAtmosphere, useEntityAccent } from "@/ui/page-atmosphere";
import { useChromeScrim, useCollapseOnScroll } from "@/ui/blur-bar";
import { color, font, space, type } from "@/ui/tokens";
import { TabFade } from "@/ui/tab-fade";

const MARKETS: [string, string][] = [["", "All markets"], ["match_sixes", "Sixes"], ["match_fours", "Fours"], ["match_runs", "Runs"], ["match_30s", "30s"], ["match_50s", "50s"], ["highest_over", "Highest runs in an over"], ["max_conceded", "Most conceded"], ["top_score", "Top score"]];
const HEADER_H = 56;

/** A team: its players' last fixtures in a format against a line (the site's team page, Player grid tab). */
export default function Team() {
  const { idx } = useLocalSearchParams<{ idx: string }>();
  const i = Number(idx);
  const inset = useScreenInsets(false);
  const stats = useStore();
  const store: any = stats.data?.store;
  const matchesReady = stats.matchesReady;
  const known = !!store && Number.isInteger(i) && i >= 0 && i < store.teams.length;
  const bodyReady = useLater(known && matchesReady); // header + skeleton paint first; the grid and format scan mount as a transition
  const valid = known && matchesReady && bodyReady;
  // the format it has played most (needs matches.json)
  const main = useMemo(() => {
    if (!valid || !store.M) return "T20";
    const c = FORMATS.map(() => 0);
    for (let m = 0; m < store.n; m++) if (store.M.a[m] === i || store.M.b[m] === i) c[store.M.f[m]]++;
    return FORMATS[c.indexOf(Math.max(...c))] ?? "T20";
  }, [store, i, valid]);
  const [fmtAsked, setFmt] = useState<string>();
  const fmt = fmtAsked ?? main;
  const [stat, setStat] = useState("sixes"), [line, setLine] = useState(0.5), [games, setGames] = useState(10);
  const [tab, setTab] = useState("grid"), [market, setMarket] = useState("");
  const rz: any = stats.data?.rz;
  // the team's match markets and top batter, run by the engine over this team's matches in the format (team markets use the side batting first)
  const plan = useMemo(() => ({ kind: "match_market", market: market || null, line: null, side: "over", filters: { format: fmt, gender: known ? (store.genderOfTeam(i) ? "female" : "male") : null } }), [market, fmt, known, store, i]);
  const mk = useQuery({ queryKey: ["team-plan", i, fmt, market, "m"], enabled: valid && tab === "markets", queryFn: (): Promise<any> => (runPlan as any)(store, rz, plan, { teamIdx: i }) });
  const top = useQuery({ queryKey: ["team-plan", i, fmt, "top"], enabled: valid && tab === "top", queryFn: (): Promise<any> => (runPlan as any)(store, rz, { ...plan, kind: "top_batter", market: null }, { teamIdx: i }) });
  const grid = useQuery({ queryKey: ["team-grid", i, fmt, stat, games], enabled: valid, queryFn: () => collectGrid(store, i, fmt, stat, games) });
  const name = known ? store.teamName(i) : "Team";
  const accent = useEntityAccent(known ? store.teams[i].n : null);
  const chromePad = inset.top + HEADER_H;
  const { onScroll, y } = useCollapseOnScroll();
  const scrimThreshold = useSharedValue(HEADER_H + 40);
  const barScrim = useChromeScrim(y, scrimThreshold);

  return (
    <PageAtmosphere>
      {stats.isError && !matchesReady ? (
        <View style={{ paddingTop: chromePad }}><EmptyState title="Could not load history" body="Check your connection and reopen this page to retry." /></View>
      ) : !store ? (
        <View style={{ paddingTop: chromePad }}><Working label="Loading…" fill shape="grid" /></View>
      ) : !known ? (
        <View style={{ paddingTop: chromePad }}><EmptyState title="Unknown team" body="This team is not in the stats data." /></View>
      ) : !matchesReady || !bodyReady ? (
        <View style={{ paddingTop: chromePad }}><Working label="Loading matches…" fill shape="grid" /></View>
      ) : (
        <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={[styles.body, { paddingTop: chromePad, paddingBottom: inset.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          {/* Wash underlaps clear PageHeader at rest (player EntityHeroWash twin). */}
          <EntityHeroWash
            accent={accent}
            style={[styles.heroBand, { marginTop: -chromePad, paddingTop: chromePad + space.stack }]}
            onLayout={(e) => { scrimThreshold.value = Math.max(48, e.nativeEvent.layout.height - 40); }}
          >
            <View style={styles.hero}><TeamBadge name={store.teams[i].n} size={56} /><Text style={styles.name}>{name}</Text></View>
          </EntityHeroWash>
          <Segmented<string> items={FORMATS.map((f: string) => [f, f] as [string, string])} value={fmt} onChange={setFmt} label="Format" />
          <Segmented<string> items={[["grid", "Player grid"], ["markets", "Markets"], ["top", "Top batter"]]} value={tab} onChange={setTab} label="Sections" />
          {tab === "grid" ? (
            <>
              <GridFilters stat={stat} line={line} games={games} onStat={setStat} onLine={setLine} onGames={setGames} />
              {grid.isLoading && !grid.data ? <Working label="Reading the players' games…" shape="grid" /> : !grid.data ? (
                <EmptyState compact title="Could not load grid" body="Try again in a moment." />
              ) : (
                <View style={{ gap: space.snug }}>
                  <GridTable g={grid.data} teamIdx={i} line={line} />
                  <Text style={styles.note}>{(STATS as any)[stat].label} over {line} across this team's last {grid.data.fx.length} {fmt} fixtures. A dash: not in the XI. VOID: in the XI, did not {(STATS as any)[stat].side === "bat" ? "bat" : "bowl"}, so the bet is void.</Text>
                </View>
              )}
            </>
          ) : tab === "markets" ? (
            <>
              <View style={styles.bleed}><Chips items={MARKETS} value={market} onChange={setMarket} /></View>
              {mk.isLoading && !mk.data ? <Working label="Working out the markets…" shape="list" rows={4} /> : !mk.data ? (
                <EmptyState compact title="Could not load markets" body="Try again in a moment." />
              ) : !mk.data.ok ? (
                <EmptyState compact title="Markets unavailable" body={String(mk.data.error || "Try another format.")} />
              ) : (
                <View style={{ gap: space.stack }}>
                  <Text style={styles.headline}>{mk.data.headline}</Text>
                  {mk.data.tables.filter((t: any) => t.n).map((t: any) => (
                    <View key={t.label} style={{ gap: space.snug }}>
                      <Text style={styles.tableTitle}>{t.label}</Text>
                      <Text style={styles.note}>n {t.n} · median {t.summary.median} · mean {t.summary.mean == null ? "–" : Math.round(t.summary.mean * 10) / 10} · range {t.summary.min}–{t.summary.max}</Text>
                      <DataTable bleed columns={["Line", "Over", "Fair", "Under", "Fair"]} flex={[0.9, 1.5, 1, 1.5, 1]}
                        rows={t.ladder.filter((l: any) => l.n).map((l: any) => [`${l.line}`, <Pill key="o" text={pc(l.pOver)} tone={l.pOver == null ? "none" : l.pOver >= 0.6 ? "up" : l.pOver <= 0.4 ? "down" : "mid"} />, odds(l.fairOver), <Pill key="u" text={pc(l.pUnder)} tone={l.pUnder == null ? "none" : l.pUnder >= 0.6 ? "up" : l.pUnder <= 0.4 ? "down" : "mid"} />, odds(l.fairUnder)])} />
                    </View>
                  ))}
                  <Text style={styles.note}>{mk.data.freshness}</Text>
                </View>
              )}
            </>
          ) : (
            top.isLoading && !top.data ? <Working label="Working out the top batters…" shape="list" rows={4} /> : !top.data ? (
              <EmptyState compact title="Could not load top batters" body="Try again in a moment." />
            ) : !top.data.ok ? (
              <EmptyState compact title="Top batters unavailable" body={String(top.data.error || "Try another format.")} />
            ) : (
              <View style={{ gap: space.snug }}>
                <Text style={styles.tableTitle}>Top batter (team batting first)</Text>
                <DataTable bleed columns={["Batter", "Sole", "Tied", "Share", "Fair"]} flex={[2.4, 0.8, 0.8, 1, 1]}
                  rows={top.data.rows.map((x: any) => [x.name, String(x.sole), String(x.tied), pc(x.pSole), odds(x.fairSole)])} />
              </View>
            )
          )}
        </Animated.ScrollView>
      )}
      <View style={[styles.chrome, { paddingTop: inset.top }]}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, barScrim]} />
        <PageHeader title={name} subtitle={known ? (store.teams[i].g ? "Women's cricket" : "Men's cricket") : undefined} right={known ? <StarButton idx={i} kind="team" /> : undefined} />
      </View>
      <TabFade withTabBar={false} />
    </PageAtmosphere>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.stack, paddingHorizontal: space.gutter },
  heroBand: { marginHorizontal: -space.gutter, paddingHorizontal: space.gutter, paddingBottom: space.stack },
  hero: { flexDirection: "row", alignItems: "center", gap: space.stack },
  name: { ...type.display, color: color.foreground, flex: 1 },
  bleed: { marginHorizontal: -space.gutter },
  headline: { ...type.body, color: color.foreground },
  tableTitle: { ...type.body, fontFamily: font.medium, color: color.foreground },
  note: { ...type.footnote, color: color["muted-foreground"] },
  chrome: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
});
