import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { router } from "expo-router";
import type { HomePhase } from "@site/lib/home-phase";
import { EMPTY_PHASE } from "@/lib/rail";
import { fancyFm } from "@cricket/engine/fancy-edge.js";
import { sameFixture } from "@cricket/engine/lines.js";
import { liveForFixture } from "@cricket/engine/live.js";
import { useQuery } from "@tanstack/react-query";
import { mixHomeRows } from "@site/lib/hot-lines";
import { phaseOf } from "@site/lib/home-phase";
import { mark, timed } from "@/lib/perf";
import { liveQuery } from "@/lib/queries";
import { fixtureState } from "@/lib/rail";
import { useFancyCards } from "@/lib/fancy";
import { fancyMarketPath, push } from "@/lib/nav";
import { sideRate } from "@cricket/engine/props-view.js";
import { useHotView } from "@/lib/use-hot";
import { useRail } from "@/lib/use-rail";
import { EmptyState } from "@/ui/empty-state";
import { OverviewRow } from "@/ui/fancy-row";
import { ChevronRight } from "@/ui/icons";
import { MatchChips } from "@/ui/match-chip";
import { MarketTape, type TapeRow } from "@/ui/market-tape";
import { Working } from "@/ui/motion";
import { PropRow } from "@/ui/prop-row";
import { color, space, type } from "@/ui/tokens";

const PER = 6; // mixed player + fancy under the selected fixture hashtag

type MixItem =
  | { kind: "player"; key: string; live: boolean; edge: number | null; p: number; r: any }
  | { kind: "fancy"; key: string; live: boolean; edge: number | null; p: number; r: any; f: any };

type FxBlock = { f: any; items: MixItem[] };

/** Home below the match rail: market tape, fixture hashtags (crests + short names), then a flat mixed props list for the chosen match. */
export function HotHome({ phase }: { phase: HomePhase }) {
  // Today + tomorrow so a tomorrow chip (WBBL etc.) is not fancy-only.
  const d0 = useHotView({ day: 0 }, phase);
  const d1 = useHotView({ day: 1 }, phase);
  const rows = useMemo(() => [...d0.rows, ...d1.rows], [d0.rows, d1.rows]);
  const isLoading = d0.isLoading;
  const scoring = d0.scoring || d1.scoring;
  const error = d0.error;
  const soFarOf = d0.soFarOf;
  const outOf = d0.outOf;
  const live = useQuery(liveQuery);
  const { items: rail } = useRail();
  const stateOf = (f: any) => fixtureState(f, liveForFixture(live.data, f)?.status);
  const { cards, ready: fancyReady } = useFancyCards(!isLoading && !scoring);

  const props = useMemo(() => rows.filter((r) => r.l10.played >= 6), [rows]);

  const fancyById = useMemo(() => {
    const m = new Map<string, { r: any; f: any }[]>();
    for (const { f, rows: rs } of cards) {
      if (phase && phaseOf(stateOf(f)) !== phase) continue;
      m.set(f.id, rs.map((r: any) => ({ r, f })));
    }
    return m;
  }, [cards, phase, live.data]);

  const blocks = useMemo(() => timed("hotHome blocks", () => {
    const priced = rail.filter((i) => !i.noProps && (!phase || phaseOf(i.state) === phase)).map((i) => i.fixture);
    const out: FxBlock[] = [];
    for (const f of priced) {
      const players = props.filter((r) => sameFixture({ match: r.match, start_utc: r.start, fmt: r.fmt }, f));
      const fancy = fancyById.get(f.id) || [];
      const liveNow = stateOf(f) === "live";
      const items = mixHomeRows<MixItem>([
        ...players.map((r) => ({ kind: "player" as const, key: `p:${r.idx}:${r.stat}:${r.start}:${r.inn}`, live: liveNow, edge: r.edge ?? null, p: sideRate(r.l10.p, r.side) ?? 0, r })),
        ...fancy.map(({ r, f: fx }) => ({ kind: "fancy" as const, key: `f:${fx.id}:${r.id || r.key}:${r.inn || 0}`, live: liveNow, edge: r.edge ?? null, p: r.played ? r.hits / r.played : 0, r, f: fx })),
      ], PER);
      if (items.length) out.push({ f, items });
    }
    return out;
  }), [rail, props, fancyById, live.data, phase]);

  const [pick, setPick] = useState("");
  const sel = blocks.some((b) => b.f.id === pick) ? pick : (blocks[0]?.f.id || "");
  const block = blocks.find((b) => b.f.id === sel) || null;

  const tape = useMemo<TapeRow[]>(() => timed("hotHome tape", () => d0.rows.map((r) => {
    const s = soFarOf(r);
    return { idx: r.idx, pid: r.pid, name: r.name, stat: r.stat, line: r.line, over: r.over, fmt: r.fmt, inn: r.inn, verdict: s?.verdict ?? null, v: s?.v };
  })), [d0.rows, soFarOf]);

  const loading = isLoading || !fancyReady;
  if (rows.length) mark("first-hot-rows", `n=${rows.length}`);
  if (props.length) mark("first-props", `n=${props.length}`);
  if (blocks.length) mark("first-prop-block", `n=${blocks[0].items.length}`);
  if (rows.length && !scoring) mark("scoring-done", `rows=${rows.length}`);
  if (fancyReady) mark("fancy-ready");
  return (
    <View style={styles.wrap}>
      {!isLoading && tape.length ? <View style={styles.pad}><MarketTape rows={tape} /></View> : null}
      <View style={[styles.head, styles.pad]}>
        <Text style={styles.headTitle}>Props</Text>
        <View style={styles.links}>
          <Press onPress={() => router.navigate("/props" as never)} hitSlop={8} style={styles.seeAll} accessibilityRole="link">
            <Text style={styles.seeAllText}>Player props</Text>
            <ChevronRight color={color.primary} />
          </Press>
          <Press onPress={() => router.navigate("/fancy" as never)} hitSlop={8} style={styles.seeAll} accessibilityRole="link">
            <Text style={styles.seeAllText}>Fancy</Text>
            <ChevronRight color={color.primary} />
          </Press>
        </View>
      </View>
      {loading && !blocks.length ? (
        <Working label="Scoring today's lines…" rows={4} />
      ) : error && !blocks.length ? (
        <View style={styles.pad}><EmptyState title="Could not score today's lines" body="Pull to retry." /></View>
      ) : blocks.length ? (
        <View style={styles.body}>
          <MatchChips items={blocks.map(({ f }) => f)} value={sel} onChange={setPick} />
          {block ? (
            <View>
              {block.items.map((item, i) => item.kind === "player"
                ? <PropRow key={item.key} r={item.r} i={i} soFar={soFarOf(item.r)} out={outOf(item.r)} />
                : (
                  <View key={item.key} style={i > 0 ? styles.sep : undefined}>
                    <OverviewRow
                      r={item.r}
                      onOpen={() => push(fancyMarketPath(item.f.id, { fm: fancyFm(item.r.key, item.r.inn || 0), sc: item.r.scope >= 0 ? item.r.scope : null }))}
                    />
                  </View>
                ))}
            </View>
          ) : null}
          {scoring ? <Working label="Scoring more lines…" /> : null}
        </View>
      ) : scoring ? (
        <Working label="Scoring today's lines…" />
      ) : (
        <View style={styles.pad}><EmptyState title={EMPTY_PHASE[phase].title} body={EMPTY_PHASE[phase].body} /></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.group, paddingTop: space.group },
  pad: { paddingHorizontal: space.gutter },
  body: { gap: space.stack },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.snug },
  headTitle: { ...type.title, color: color.foreground },
  links: { flexDirection: "row", alignItems: "center", gap: space.stack },
  seeAll: { flexDirection: "row", alignItems: "center" },
  seeAllText: { ...type.footnote, color: color.primary },
});
