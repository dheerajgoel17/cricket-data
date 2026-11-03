import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { router } from "expo-router";
import type { HomePhase } from "@site/lib/home-phase";
import { EMPTY_PHASE } from "@/lib/rail";
import { fancyFm } from "@cricket/engine/fancy-edge.js";
import { liveForFixture } from "@cricket/engine/live.js";
import { useQuery } from "@tanstack/react-query";
import { hotOrder } from "@site/lib/hot-lines";
import { phaseOf } from "@site/lib/home-phase";
import { liveQuery } from "@/lib/queries";
import { fixtureState } from "@/lib/rail";
import { useFancyCards } from "@/lib/fancy";
import { fixturePath, push } from "@/lib/nav";
import { homeProps } from "@cricket/engine/props-view.js";
import { useHotView } from "@/lib/use-hot";
import { OverviewRow } from "@/ui/fancy-row";
import { ChevronRight } from "@/ui/icons";
import { InfoButton } from "@/ui/info-button";
import { MarketTape, type TapeRow } from "@/ui/market-tape";
import { Working } from "@/ui/motion";
import { PropRow } from "@/ui/prop-row";
import { color, space, type } from "@/ui/tokens";

const SHOWN = 4; // fancy rows on Home; the Player props tab carries the rest (the props list is the shared `homeProps`: four, and more when more have an edge)

export function SectionHead({ title, to, info }: { title: string; to: string; info?: string }) {
  return (
    <View style={styles.head}>
      <View style={styles.titleRow}><Text style={styles.headTitle}>{title}</Text>{info ? <InfoButton topic={info} /> : null}</View>
      <Press onPress={() => router.navigate(to as never)} hitSlop={8} style={styles.seeAll} accessibilityRole="link">
        <Text style={styles.seeAllText}>See all</Text>
        <ChevronRight color={color.primary} />
      </Press>
    </View>
  );
}

/** Home below the match rail: the market tape (long shots that cleared), then "Hot props": a four-row teaser of the day's best player props (the site's `HotHome`). */
export function HotHome({ phase }: { phase: HomePhase }) {
  const { rows, isLoading, scoring, error, soFarOf, outOf } = useHotView({ day: 0 }, phase);
  const live = useQuery(liveQuery);
  const stateOf = (f: any) => fixtureState(f, liveForFixture(live.data, f)?.status);
  // Fancy waits until the props are scored, so the phone does one heavy job at a time
  const { cards, ready: fancyReady } = useFancyCards(!isLoading && !scoring);
  const fancy = useMemo(() => cards.flatMap(({ f, rows: rs }: any) => rs.map((r: any) => ({ r, f }))).filter(({ f }: any) => !phase || phaseOf(stateOf(f)) === phase)
    .sort((x: any, y: any) => hotOrder({ live: stateOf(x.f) === "live", p: 0, edge: x.r.edge }, { live: stateOf(y.f) === "live", p: 0, edge: y.r.edge })).slice(0, SHOWN), [cards, phase, live.data]);
  // the shared rule: undecided lines first, a resulted one for 12 hours after its match is expected to be over, four rows and more when more have an edge (`engine/props-view.js`)
  const props = useMemo(() => homeProps(rows.filter((r) => r.l10.played >= 6), soFarOf, { now: Date.now() }) as typeof rows, [rows, soFarOf]);
  const tape = useMemo<TapeRow[]>(() => rows.map((r) => {
    const s = soFarOf(r);
    return { idx: r.idx, pid: r.pid, name: r.name, stat: r.stat, line: r.line, over: r.over, fmt: r.fmt, inn: r.inn, verdict: s?.verdict ?? null, v: s?.v };
  }), [rows, soFarOf]);
  return (
    <View style={styles.wrap}>
      {!isLoading && tape.length ? <View style={styles.pad}><MarketTape rows={tape} /></View> : null}
      <Text style={[styles.display, styles.pad]}>Hot props</Text>
      <View style={styles.section}>
        <View style={styles.pad}><SectionHead title="Player props" to="/props" info="player-props" /></View>
        {isLoading ? (
          <Working label="Scoring today's lines…" rows={4} />
        ) : error && !props.length ? (
          <Text style={[styles.empty, styles.pad]}>Could not score today's lines. Pull to retry.</Text>
        ) : props.length ? (
          <View>
            {props.map((r, i) => <PropRow key={`${r.idx}${r.stat}${r.start}${r.inn}`} r={r} i={i} soFar={soFarOf(r)} out={outOf(r)} />)}
            {scoring ? <Working label="Scoring more lines…" /> : null}
          </View>
        ) : scoring ? (
          <Working label="Scoring today's lines…" />
        ) : (
          <Text style={[styles.empty, styles.pad]}>{EMPTY_PHASE[phase]}</Text>
        )}
      </View>
      <View style={styles.section}>
        <View style={styles.pad}><SectionHead title="Fancy" to="/fancy" /></View>
        {!fancyReady ? (
          <Working label="Scoring the fancy lines…" rows={3} />
        ) : fancy.length ? (
          <View>
            {fancy.map(({ r, f }: any, k: number) => (
              <View key={`${f.id}${r.id || r.key}`} style={k > 0 && styles.sep}>
                <OverviewRow r={r} sub={`${f.a} v ${f.b}`} onOpen={() => push(`${fixturePath(f.id)}?tab=fancy&fm=${encodeURIComponent(fancyFm(r.key, r.inn || 0))}${r.scope >= 0 ? `&sc=${r.scope}` : ""}`)} />
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.empty, styles.pad]}>{phase ? EMPTY_PHASE[phase] : "No fancy lines are live yet."}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.group, paddingTop: space.group },
  pad: { paddingHorizontal: space.gutter },
  section: { gap: space.snug },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  display: { ...type.title, fontSize: 22, lineHeight: 26, color: color.foreground },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.tight },
  headTitle: { ...type.title, color: color.foreground },
  seeAll: { flexDirection: "row", alignItems: "center" },
  seeAllText: { ...type.footnote, color: color.primary },
  empty: { ...type.callout, color: color["muted-foreground"] },
});
