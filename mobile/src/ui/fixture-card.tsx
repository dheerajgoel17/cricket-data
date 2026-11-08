/* eslint-disable @typescript-eslint/no-explicit-any */
import { mark } from "@/lib/perf";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { scoreLabel } from "@cricket/engine/live.js";
import { cardModel } from "@/lib/card";
import { city, dayLabel, localTime, seriesName } from "@/lib/format";
import { openFixture } from "@/lib/nav";
import type { RailItem } from "@/lib/rail";
import { ChevronRight } from "@/ui/icons";
import { LiveDot } from "@/ui/motion";
import { TeamBadge } from "@/ui/team-badge";
import { cap, color, font, radius, space, type, tonal } from "@/ui/tokens";

/** One team's live total, right-aligned on the same row as the name. Empty means they have not batted. */
function LiveScore({ s, dim }: { s: any | null; dim?: boolean }) {
  if (!s?.display) return <Text style={styles.yet}>Yet to bat</Text>;
  const overs = s.overs != null ? `${Number.isInteger(s.overs) ? Number(s.overs).toFixed(1) : s.overs} ov` : "";
  return (
    <View style={[styles.score, dim && { opacity: 0.6 }]}>
      <Text style={styles.total}>{scoreLabel(s)}</Text>
      {overs ? <Text style={styles.overs}>{overs}</Text> : null}
    </View>
  );
}

/** The site's match card: state and format, venue; the two sides with crests and scores (or the start time); the status line, the series, and Props. */
export function FixtureCard({ item, now, link = true }: { item: RailItem; now: number; link?: boolean }) {
  mark("first-fixture-card");
  const f = item.fixture, m = cardModel(item, now);
  const place = city(f.venue);
  return (
    <Press disabled={!link || !f.id} onPress={() => openFixture(f)} accessibilityRole="link" accessibilityLabel={`${f.a} v ${f.b}`} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {m.live ? <LinearGradient pointerEvents="none" colors={["rgba(255,69,58,0.2)", "rgba(255,69,58,0)"]} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 0.65 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.card }]} /> : null}
      <View style={styles.meta}>
        {m.session ? (
          <Text style={[styles.cap, styles.red]}>{m.session}</Text>
        ) : m.live ? (
          <View style={styles.liveRow}><LiveDot /><Text style={[styles.cap, styles.red]}>Live</Text></View>
        ) : (
          <Text style={styles.cap}>{m.final ? "Final" : m.started ? "Started" : "Upcoming"}</Text>
        )}
        <Text style={styles.metaText}>·</Text>
        <Text style={styles.metaText}>{f.fmt || "T20"}{f.gender === "female" ? " · W" : ""}</Text>
        {place ? <Text style={[styles.metaText, styles.place]} numberOfLines={1}>{place}</Text> : null}
      </View>
      <View style={styles.sides}>
        {m.sides.map((s, k) => (
          <View key={s.name} style={styles.side}>
            <TeamBadge name={s.name} />
            <Text style={[styles.team, s.lost && styles.lost]} numberOfLines={1}>{s.name}</Text>
            {m.hasScore || m.live ? (
              <LiveScore s={s.score} dim={s.lost} />
            ) : k === 0 && !m.final ? (
              <View style={styles.when}>
                <Text style={styles.whenDay}>{dayLabel(m.when, now)}</Text>
                {m.timed ? <Text style={styles.whenTime}>{localTime(m.when)}</Text> : null}
              </View>
            ) : null}
          </View>
        ))}
      </View>
      <View style={styles.foot}>
        <View style={styles.status}>
          <Text style={styles.statusText} numberOfLines={2}>{m.status}</Text>
          <Text style={styles.series} numberOfLines={1}>{seriesName(f)}</Text>
        </View>
        {item.noProps ? <Text style={styles.noProps}>No props live yet</Text> : link ? <View style={styles.propsLink}><Text style={styles.props}>Props</Text><ChevronRight color={color.primary} /></View> : null}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, ...tonal, borderRadius: radius.card, padding: space.inset, gap: space.snug, justifyContent: "space-between" },
  pressed: { backgroundColor: color["surface-hover"] },
  meta: { flexDirection: "row", alignItems: "center", gap: space.tight },
  cap: { ...type.footnote, color: color.foreground, ...cap },
  red: { color: color.destructive },
  liveRow: { flexDirection: "row", alignItems: "center", gap: space.tight },
  metaText: { ...type.footnote, color: color["muted-foreground"] },
  place: { marginLeft: "auto", flexShrink: 1 },
  sides: { gap: space.snug },
  side: { flexDirection: "row", alignItems: "center", gap: space.snug },
  team: { ...type.body, color: color.foreground, flex: 1 },
  lost: { color: color["muted-foreground"] },
  score: { flexDirection: "row", alignItems: "baseline", gap: space.tight },
  total: { fontFamily: font.data, fontSize: 18, color: color.foreground, letterSpacing: -0.36, fontVariant: ["tabular-nums"] },
  overs: { ...type.footnote, color: color["muted-foreground"], fontFamily: font.data, fontVariant: ["tabular-nums"] },
  yet: { ...type.callout, color: color["muted-foreground"] },
  when: { alignItems: "flex-end" },
  whenDay: { ...type.footnote, color: color["muted-foreground"] },
  whenTime: { ...type.callout, color: color.foreground, fontFamily: font.data, fontVariant: ["tabular-nums"] },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.snug, paddingTop: space.tight },
  status: { flex: 1, minWidth: 0 },
  statusText: { ...type.footnote, color: color.foreground },
  series: { ...type.caption, color: color["muted-foreground"] },
  propsLink: { flexDirection: "row", alignItems: "center" },
  props: { ...type.footnote, color: color.primary },
  noProps: { maxWidth: "32%", textAlign: "right", ...type.footnote, color: color["muted-foreground"] },
});
