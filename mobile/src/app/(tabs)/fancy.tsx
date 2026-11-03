/* eslint-disable @typescript-eslint/no-explicit-any */
import { ScrollView, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { router } from "expo-router";
import Animated from "react-native-reanimated";
import { fancyFm } from "@cricket/engine/fancy-edge.js";
import { dayKey, dayLabel } from "@site/lib/format";
import { fixtureStart } from "@/lib/rail";
import { localTime } from "@/lib/format";
import { useFancyCards, type FancyCard as Card } from "@/lib/fancy";
import { fixturePath, push } from "@/lib/nav";
import { AppHeader } from "@/ui/brand";
import { OverviewRow } from "@/ui/fancy-row";
import { useScreenInsets } from "@/ui/insets";
import { ChevronRight } from "@/ui/icons";
import { enter, Working } from "@/ui/motion";
import { TeamBadge } from "@/ui/team-badge";
import { cap, color, font, radius, space, type, tonal } from "@/ui/tokens";
import { TabFade } from "@/ui/tab-fade";

const SHOWN_ROWS = 4; // the best-edge markets on the card; the rest are one tap away on the match's Fancy tab

/** Fancy: every priced match with its best-edge markets (the book's line, the edge and the last ten results against it), each match linking to its own Fancy tab. Matches in play lead, as on the Home rail. */
export default function Fancy() {
  const inset = useScreenInsets();
  const { cards, ready, error } = useFancyCards();
  const shown = cards.filter((c) => c.rows.length > 0); // a match with lines up but nothing to show (no past matches to score them on) is left out
  return (
    <View style={[styles.root, { paddingTop: inset.top }]}>
      <AppHeader title="Fancy" />
      <ScrollView contentContainerStyle={{ paddingBottom: inset.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {!ready ? (
          error ? <Text style={styles.empty}>Could not score the fancy lines. Try again in a moment.</Text> : <Working label="Scoring the fancy lines…" rows={4} />
        ) : !shown.length ? (
          <Text style={styles.empty}>No fancy lines with history to show yet. They open a day or two before a match, once there are past matches to score them on.</Text>
        ) : (
          <View style={styles.list}>
            {shown.map((c, i) => <Animated.View key={c.f.id || `${c.f.a}${c.f.b}${c.f.start}`} entering={i < 6 ? enter(i) : undefined}><MatchCard {...c} /></Animated.View>)}
          </View>
        )}
      </ScrollView>
      <TabFade />
    </View>
  );
}

/** One match's fancy markets, laid out like the fixture card (format and ground on top, the two sides with the start time) with the best-edge market rows of the Match Fancy tab under them. */
function MatchCard({ f, ms, rows }: Card) {
  const when = fixtureStart(f);
  const ground = String(f.venue || "").split(",")[0].replace(/\(.*\)/, "").trim();
  const to = (fm?: string, sc?: number) => `${fixturePath(f.id)}?tab=fancy${fm ? `&fm=${encodeURIComponent(fm)}` : ""}${sc != null && sc >= 0 ? `&sc=${sc}` : ""}`;
  return (
    <View style={styles.card}>
      <Press onPress={() => push(to())} accessibilityRole="button" accessibilityLabel={`${f.a} v ${f.b}`} style={styles.top}>
        <View style={styles.meta}>
          <Text style={styles.cap}>{f.fmt || "T20"}{f.gender === "female" ? " · W" : ""}</Text>
          {ground ? <Text style={styles.ground} numberOfLines={1}>{ground}</Text> : null}
        </View>
        <View style={styles.sides}>
          <View style={{ flex: 1, gap: space.snug }}>
            {[f.a, f.b].map((t: string) => <View key={t} style={styles.side}><TeamBadge name={t} size={36} /><Text style={styles.team} numberOfLines={1}>{t}</Text></View>)}
          </View>
          <View style={styles.when}>
            <Text style={styles.whenDay}>{dayLabel(dayKey(f))}</Text>
            {f.start.length > 10 ? <Text style={styles.whenTime}>{localTime(when)}</Text> : null}
          </View>
        </View>
      </Press>
      <View style={styles.rows}>
        {rows.slice(0, SHOWN_ROWS).map((r: any, k: number) => (
          <View key={r.id} style={k > 0 && styles.sep}>
            <OverviewRow r={r} onOpen={() => push(to(fancyFm(r.key, r.inn || 0), r.scope))} />
          </View>
        ))}
      </View>
      <Press onPress={() => push(to())} accessibilityRole="button" style={styles.foot}>
        <Text style={styles.series} numberOfLines={1}>{f.series || ""}{ms.length ? ` · last ${ms.length} matches` : ""}</Text>
        <View style={styles.linkRow}><Text style={styles.link}>{rows.length > SHOWN_ROWS ? `All ${rows.length} markets` : "Fancy"}</Text><ChevronRight color={color.primary} size={14} /></View>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  empty: { ...type.callout, color: color["muted-foreground"], paddingHorizontal: space.gutter, paddingTop: space.snug },
  list: { gap: space.stack, paddingHorizontal: space.gutter },
  card: { ...tonal, borderRadius: radius.card, overflow: "hidden" },
  top: { padding: space.stack, gap: space.snug },
  meta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.snug },
  cap: { ...type.footnote, ...cap, color: color["muted-foreground"] },
  ground: { ...type.footnote, color: color["muted-foreground"], flexShrink: 1 },
  sides: { flexDirection: "row", alignItems: "center", gap: space.snug },
  side: { flexDirection: "row", alignItems: "center", gap: space.snug },
  team: { ...type.body, fontFamily: font.medium, color: color.foreground, flexShrink: 1 },
  when: { alignItems: "flex-end" },
  whenDay: { ...type.footnote, color: color["muted-foreground"] },
  whenTime: { ...type.callout, color: color.foreground, fontFamily: font.data, fontVariant: ["tabular-nums"] },
  rows: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.snug, paddingHorizontal: space.stack, paddingVertical: space.snug + 2, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  series: { ...type.caption, color: color["muted-foreground"], flex: 1 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  link: { ...type.footnote, fontFamily: font.medium, color: color.primary },
});
