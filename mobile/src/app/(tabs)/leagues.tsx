import { mark } from "@/lib/perf";
import { HScroll } from "@/ui/h-scroll";
import { lazyTab } from "@/ui/lazy-tab";
import { push } from "@/lib/nav";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { LiquidScroll } from "@/ui/liquid-refresh";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";
import { featuredEvents } from "@cricket/engine/tournament.js";
import { DEFAULT_RAIL } from "@site/lib/priority";
import { fixturesQuery } from "@/lib/queries";
import { useStore } from "@/lib/use-store";
import { AppHeader } from "@/ui/brand";
import { EmptyState, ErrorState } from "@/ui/empty-state";
import { useScreenInsets } from "@/ui/insets";
import { ChevronRight } from "@/ui/icons";
import { Working } from "@/ui/motion";
import { LeagueBadge } from "@/ui/team-badge";
import { TournamentStats } from "@/ui/tournament-stats";
import { cap, color, font, radius, space, type, fs, rhythm, t, w, icon } from "@/ui/tokens";
import { TabFade } from "@/ui/tab-fade";
import { hitSlopFor } from "@/ui/platform";

/** Listed first, in this order, when they are live or due to start: Big Bash on top (the women's season live, the men's due). */
const PIN_FIRST = ["big bash"];

/** Leagues: pick one (live ones and those about to start first, Big Bash on top), then its season's leaders, lists and trends. Any other league is under "All competitions". */
function Leagues() {
  mark("render:Leagues");
  const inset = useScreenInsets();
  const stats = useStore(), fx = useQuery(fixturesQuery);
  const store: any = stats.data?.store;
  const matchesReady = stats.matchesReady;
  const [picked, setPicked] = useState<number>();
  const [season, setSeason] = useState("");
  const featured = useMemo(() => (store && matchesReady ? (featuredEvents(store, { big: DEFAULT_RAIL.bigEvent, pin: PIN_FIRST, fixtures: fx.data || [] }) as { e: number; name: string; tag: "live" | "soon" | "" }[]) : []), [store, matchesReady, fx.data]);
  const e = picked ?? featured[0]?.e;

  return (
    <View style={[styles.root, { paddingTop: inset.top }]}>
      <AppHeader title="Leagues" action={
        <Press onPress={() => push("/competitions")} accessibilityRole="button" hitSlop={hitSlopFor(120, 20)} style={styles.all}>
          <Text style={styles.allText}>All competitions</Text><ChevronRight color={color["muted-foreground"]} size={icon.sm} />
        </Press>
      } />
      <LiquidScroll contentContainerStyle={{ paddingBottom: inset.bottom + 24 }} onRefresh={() => Promise.all([stats.refetch(), fx.refetch()])}>
        {stats.isError && !matchesReady ? <ErrorState title="Could not load history" onRetry={() => void stats.refetch()} /> : !store || !matchesReady ? <Working label="Loading leagues…" fill shape="league" /> : e == null ? <View style={styles.emptyPad}><EmptyState title="No leagues to show yet" body="Live and upcoming competitions appear here once the schedule and data are in." /></View> : (
          <>
            <HScroll contentContainerStyle={styles.chips}>
              {(featured.some((x) => x.e === e) ? featured : [{ e, name: store.events[e], tag: "" as const }, ...featured]).map((x) => {
                const on = x.e === e;
                return (
                  <Press key={x.e} onPress={() => { if (!on) { void Haptics.selectionAsync(); setPicked(x.e); setSeason(""); } }} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.chip, on && styles.chipOn]}>
                    <LeagueBadge name={x.name} size={24} />
                    <Text style={[styles.chipText, on && { color: color["primary-foreground"] }]} numberOfLines={1}>{x.name}</Text>
                    {x.tag ? <View style={[styles.tag, { backgroundColor: x.tag === "live" ? (on ? color["primary-foreground"] : color.primary) : color.amber }]}><Text style={[styles.tagText, on && x.tag === "live" && { color: color.primary }]}>{x.tag === "live" ? "Live" : "Soon"}</Text></View> : null}
                  </Press>
                );
              })}
            </HScroll>
            <View style={styles.body}>
              <View style={styles.leagueHead}>
                <LeagueBadge name={store.events[e]} size={40} />
                <Text style={styles.leagueName} numberOfLines={1}>{store.events[e]}</Text>
                <Press onPress={() => push(`/league/${e}`)} accessibilityRole="button" hitSlop={hitSlopFor(80, 20)} style={styles.all}>
                  <Text style={styles.allText}>More</Text><ChevronRight color={color["muted-foreground"]} size={icon.sm} />
                </Press>
              </View>
              <TournamentStats eventIdx={e} season={season} onSeason={setSeason} />
            </View>
          </>
        )}
      </LiquidScroll>
      <TabFade />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  all: { flexDirection: "row", alignItems: "center", gap: 2 },
  allText: { ...t.calloutLabel, color: color["muted-foreground"] },
  emptyPad: { padding: space.gutter },
  chips: { gap: space.tight, paddingHorizontal: space.gutter, paddingVertical: space.snug },
  chip: { height: 40, flexDirection: "row", alignItems: "center", gap: space.tight, paddingLeft: 8, paddingRight: space.snug + 2, borderRadius: radius.chip, backgroundColor: color.card },
  chipOn: { backgroundColor: color.primary },
  chipText: { ...t.calloutLabel, color: color.foreground, maxWidth: 180 },
  tag: { borderRadius: 999, paddingHorizontal: 6, height: 16, justifyContent: "center" },
  tagText: { ...cap, ...w.dataStrong, fontSize: fs.caption, color: color.background },
  body: { gap: rhythm.between, paddingHorizontal: rhythm.inline, paddingTop: rhythm.top },
  leagueHead: { flexDirection: "row", alignItems: "center", gap: space.snug },
  leagueName: { ...type.title, color: color.foreground, flex: 1 },
});

export default lazyTab(Leagues, "Leagues");
