/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Text } from "@/ui/text";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { pc } from "@site/lib/format";
import { storeQuery } from "@/lib/data";
import { leagueData } from "@/lib/league";
import { DataTable } from "@/ui/data-table";
import { useScreenInsets } from "@/ui/insets";
import { ListRow } from "@/ui/list";
import { Working } from "@/ui/motion";
import { PageHeader } from "@/ui/page-header";
import { Segmented } from "@/ui/segmented";
import { LeagueBadge, TeamBadge } from "@/ui/team-badge";
import { TournamentStats } from "@/ui/tournament-stats";
import { color, space, type, tonal } from "@/ui/tokens";
import { TabFade } from "@/ui/tab-fade";

/** One competition: its season's stats, the summary markets, each side's record and the latest results (the site's `LeaguePage`). */
export default function League() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const e = Number(id);
  const inset = useScreenInsets(false);
  const stats = useQuery(storeQuery);
  const store: any = stats.data?.store;
  const [tab, setTab] = useState("stats");
  const [season, setSeason] = useState("");
  const valid = !!store && Number.isInteger(e) && e >= 0 && e < store.events.length;
  const data = useMemo(() => (valid ? leagueData(store, e) : null), [store, e, valid]);
  const name = valid ? store.events[e] : "Competition";

  return (
    <View style={[styles.root, { paddingTop: inset.top }]}>
      <PageHeader title={name} subtitle={data ? `${data.ms.length} matches · ${data.seasons[data.seasons.length - 1]}–${data.seasons[0]}` : undefined} />
      {!store ? <Working label="Loading…" fill /> : !valid || !data ? <Text style={styles.empty}>Unknown competition.</Text> : (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: inset.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <LeagueBadge name={name} size={56} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.sub}>{data.fmtName} · {data.tt.size} teams</Text>
            </View>
          </View>
          <Segmented<string> items={[["stats", "Stats"], ["markets", "Markets"], ["teams", "Teams"], ["results", "Results"]]} value={tab} onChange={setTab} label="Sections" />
          {tab === "stats" ? <TournamentStats eventIdx={e} season={season} onSeason={setSeason} /> : null}
          {tab === "markets" ? (
            <View style={{ gap: space.snug }}>
              <DataTable columns={["Market", "Median", "Mean", "Matches"]} flex={[2, 1, 1, 1]} rows={data.markets.map((m) => [m.label, m.median, m.mean, String(m.n)])} />
              <Text style={styles.note}>{data.fmtName} matches that count for summary markets (void games excluded).</Text>
            </View>
          ) : null}
          {tab === "teams" ? (
            <DataTable columns={["Team", "P", "W", "L", "Win %"]} flex={[2.4, 0.7, 0.7, 0.7, 1]}
              rows={data.teams.map(([t, r]) => [store.teamName(t), String(r.n), String(r.w), String(r.l), pc(r.n ? r.w / r.n : null)])} />
          ) : null}
          {tab === "results" ? (
            <View style={styles.box}>
              {data.results.map((r, n) => (
                <ListRow key={r.m} first={n === 0} chevron={false} left={<TeamBadge name={r.match.split(" v ")[0]} size={36} />} title={r.match}
                  sub={`${r.date} · ${r.score} · ${r.winner === "–" ? "no result" : `${r.winner} won`}`} />
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
      <TabFade withTabBar={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  body: { gap: space.stack, paddingHorizontal: space.gutter, paddingTop: space.snug },
  hero: { flexDirection: "row", alignItems: "center", gap: space.stack },
  name: { ...type.title, color: color.foreground },
  sub: { ...type.callout, color: color["muted-foreground"] },
  note: { ...type.footnote, color: color["muted-foreground"] },
  empty: { ...type.callout, color: color["muted-foreground"], padding: space.gutter },
  box: { ...tonal, borderRadius: 18, overflow: "hidden" },
});
