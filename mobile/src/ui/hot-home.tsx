import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/text";
import type { HomePhase } from "@site/lib/home-phase";
import { EMPTY_PHASE } from "@/lib/rail";
import { mark } from "@/lib/perf";
import { push } from "@/lib/nav";
import { useHotHome } from "@/lib/use-hot-home";
import { EmptyState } from "@/ui/empty-state";
import { OverviewRow } from "@/ui/fancy-row";
import { MatchChips } from "@/ui/match-chip";
import { SkeletonGroup, Working } from "@/ui/motion";
import { PropRow } from "@/ui/prop-row";
import { color, space, type, rhythm } from "@/ui/tokens";

/** Home below the match rail: fixture hashtags, mixed props for the chosen match. */
export function HotHome({ phase }: { phase: HomePhase }) {
  const {
    fixtures, tags, items, sel, setPick, block,
    loading, scoring, error, soFarOf, outOf, openFancy,
  } = useHotHome(phase);
  if (items.length) mark("first-props", `n=${items.length}`);
  if (block) mark("first-prop-block", `n=${block.items.length}`);
  if (items.length && !scoring) mark("scoring-done", `rows=${items.length}`);
  if (!loading && fixtures.length) mark("fancy-ready");

  return (
    <View style={styles.wrap}>
      <View style={styles.pad}><Text style={styles.headTitle}>Props</Text></View>
      {loading && !block ? (
        <Working label="Scoring today's lines…" rows={4} />
      ) : error && !block ? (
        <View style={styles.pad}><EmptyState title="Could not score today's lines" body="Pull to retry." /></View>
      ) : block ? (
        <View style={styles.body}>
          <MatchChips items={fixtures} tags={tags} value={sel} onChange={setPick} />
          <View>
            {items.map((item, i) => item.kind === "player"
              ? <PropRow key={item.key} r={item.r} i={i} soFar={soFarOf(item.r)} out={outOf(item.r)} />
              : (
                <View key={item.key} style={i > 0 ? styles.sep : undefined}>
                  <OverviewRow r={item.r} onOpen={() => push(openFancy(item))} />
                </View>
              ))}
          </View>
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

/** The Props section before the schedule is in: title + rows. */
export function HotHomeSkeleton() {
  return (
    <SkeletonGroup style={styles.wrap}>
      <View style={styles.pad}><Text style={styles.headTitle}>Props</Text></View>
      <Working label="Loading today's lines…" rows={4} />
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: rhythm.between, paddingTop: rhythm.top },
  pad: { paddingHorizontal: space.gutter },
  body: { gap: rhythm.between },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  headTitle: { ...type.heading, color: color.foreground },
});
