/* eslint-disable @typescript-eslint/no-explicit-any */
import { mark } from "@/lib/perf";
import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { scoreLabel } from "@cricket/engine/live.js";
import { cardModel } from "@/lib/card";
import { city, dayLabel, localTime, seriesName } from "@/lib/format";
import { openFixture } from "@/lib/nav";
import type { RailItem } from "@/lib/rail";
import { ChevronRight } from "@/ui/icons";
import { Skeleton } from "@/ui/motion";
import { StatusLabel } from "@/ui/status-label";
import { TeamBadge } from "@/ui/team-badge";
import { Tick } from "@/ui/tick";
import { color, font, radius, space, type, fs } from "@/ui/tokens";

/** One team's live total, right-aligned on the same row as the name. Empty means they have not batted. */
export function LiveScore({ s, dim, pending, live }: { s: any | null; dim?: boolean; pending?: boolean; live?: boolean }) {
  if (pending && !s?.display) return <Skeleton style={styles.pendingScore} />; // the scores are still on their way: not "Yet to bat"
  if (!s?.display) return <Text style={styles.yet}>Yet to bat</Text>;
  const total = scoreLabel(s);
  const overs = s.overs != null ? `${Number.isInteger(s.overs) ? Number(s.overs).toFixed(1) : s.overs} ov` : "";
  // Include wickets so a dismissal can animate the score even when no runs were scored (site LiveScore).
  const change = s.runs == null ? null : s.runs + (s.wkts ?? 0) / 100;
  return (
    <View style={[styles.score, dim && { opacity: 0.6 }]}>
      {live ? <Tick value={change} style={styles.total}>{total}</Tick> : <Text style={styles.total}>{total}</Text>}
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
      <View style={styles.meta}>
        {m.session ? (
          <StatusLabel tone="session" surface="plain">{m.session}</StatusLabel>
        ) : m.live ? (
          <StatusLabel tone="live" surface="dot" />
        ) : (
          <StatusLabel tone="muted" surface="plain">{m.final ? "Final" : m.started ? "Started" : "Upcoming"}</StatusLabel>
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
              <LiveScore s={s.score} dim={s.lost} pending={m.live && !item.live} live={m.live && !m.session} />
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
        {item.noProps ? <Text style={styles.noProps}>{m.final ? "Match" : "No props live yet"}</Text> : link ? <View style={styles.propsLink}><Text style={styles.props}>Props</Text><ChevronRight color={color.primary} /></View> : null}
      </View>
    </Press>
  );
}

const styles = StyleSheet.create({
  // Its own height by default; in the Home rail the cell is held to the tallest card and the card grows to fill it (the site's `h-full`), the foot staying at the bottom.
  card: { flexGrow: 1, backgroundColor: color.card, borderRadius: radius.card, padding: space.inset, gap: space.snug },
  pressed: { backgroundColor: color["surface-hover"] },
  meta: { flexDirection: "row", alignItems: "center", gap: space.tight },
  metaText: { ...type.footnote, color: color["muted-foreground"] },
  place: { marginLeft: "auto", flexShrink: 1 },
  sides: { gap: space.snug },
  side: { flexDirection: "row", alignItems: "center", gap: space.snug },
  team: { ...type.body, fontFamily: font.bold, color: color.foreground, flex: 1 },
  lost: { color: color["muted-foreground"] },
  score: { flexDirection: "row", alignItems: "baseline", gap: space.tight },
  total: { fontFamily: font.data, fontSize: fs.title, color: color.foreground, letterSpacing: -0.36, fontVariant: ["tabular-nums"] },
  overs: { ...type.footnote, color: color["muted-foreground"], fontFamily: font.data, fontVariant: ["tabular-nums"] },
  pendingScore: { width: 64, height: 16, borderRadius: 8 },
  yet: { ...type.callout, color: color["muted-foreground"] },
  when: { alignItems: "flex-end" },
  whenDay: { ...type.footnote, color: color["muted-foreground"] },
  whenTime: { ...type.callout, color: color.foreground, fontFamily: font.data, fontVariant: ["tabular-nums"] },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.snug, paddingTop: space.tight, marginTop: "auto" },
  status: { flex: 1, minWidth: 0 },
  statusText: { ...type.footnote, color: color.foreground },
  series: { ...type.caption, color: color["muted-foreground"] },
  propsLink: { flexDirection: "row", alignItems: "center" },
  props: { ...type.footnote, color: color.primary },
  noProps: { maxWidth: "32%", textAlign: "right", ...type.footnote, color: color["muted-foreground"] },
});
