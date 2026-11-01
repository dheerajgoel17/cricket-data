/* eslint-disable @typescript-eslint/no-explicit-any */
import { StyleSheet, Text, View } from "react-native";
import { namesMatch } from "@cricket/engine/live.js";
import { fixtureStart, type RailItem } from "@/lib/rail";
import { color, radius, space, type } from "@/ui/tokens";

/** The kick-off as the viewer's own clock shows it; a date-only fixture shows the day. */
export function kickoff(f: { start: string }): string {
  const d = fixtureStart(f);
  return f.start.length > 10
    ? d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

/** Each side of the fixture with its live score, when the live feed has the match (the feed's team order can differ from the schedule's). */
export function sides(f: any, live: any): { name: string; score: string; batting: boolean }[] {
  return [f.a, f.b].map((name: string) => {
    const t = (live?.teams || []).find((x: any) => namesMatch(x.name, name));
    return { name: t?.name ?? name, score: t?.display ?? "", batting: !!t?.batting };
  });
}

export function FixtureCard({ item }: { item: RailItem }) {
  const { fixture: f, state, live, noProps } = item;
  const rows = sides(f, live);
  const foot = live?.summary || (state === "final" ? f.result : "") || (noProps ? "No props live yet" : "");
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.series} numberOfLines={1}>{f.series || f.venue}</Text>
        {f.fmt ? <View style={styles.chip}><Text style={styles.chipText}>{f.fmt}</Text></View> : null}
        {state === "live" ? (
          <View style={[styles.chip, styles.liveChip]}><View style={styles.dot} /><Text style={[styles.chipText, { color: color.miss }]}>LIVE</Text></View>
        ) : state === "final" ? (
          <View style={styles.chip}><Text style={styles.chipText}>FINAL</Text></View>
        ) : null}
      </View>
      {rows.map((r) => (
        <View key={r.name} style={styles.row}>
          <Text style={[styles.team, r.batting && styles.batting]} numberOfLines={1}>{r.name}</Text>
          <Text style={styles.score}>{r.score}</Text>
        </View>
      ))}
      {foot ? <Text style={styles.foot} numberOfLines={2}>{foot}</Text> : null}
      <Text style={styles.when}>{kickoff(f)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.card, borderRadius: radius.card, padding: space.stack, gap: space.tight, borderWidth: StyleSheet.hairlineWidth, borderColor: color.border },
  head: { flexDirection: "row", alignItems: "center", gap: space.tight, marginBottom: space.hair },
  series: { ...type.footnote, color: color["muted-foreground"], flex: 1 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: color.pill, borderRadius: radius.chip, paddingHorizontal: 8, paddingVertical: 3 },
  liveChip: { backgroundColor: "rgba(255,0,0,0.14)" },
  chipText: { ...type.caption, color: color.foreground },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.miss },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.snug },
  team: { ...type.body, color: color.foreground, flex: 1 },
  batting: { fontWeight: "700" },
  score: { ...type.body, color: color.foreground, fontVariant: ["tabular-nums"] },
  foot: { ...type.callout, color: color["muted-foreground"], marginTop: space.hair },
  when: { ...type.footnote, color: color["muted-foreground"] },
});
