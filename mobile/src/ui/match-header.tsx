import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { LinearGradient } from "expo-linear-gradient";
import { Text } from "@/ui/text";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { scoreLabel } from "@cricket/engine/live.js";
import { shortVenue } from "@site/lib/format";
import { cardModel } from "@/lib/card";
import { countdown, dayLabel, localTime, seriesName } from "@/lib/format";
import type { RailItem } from "@/lib/rail";
import { useNow } from "@/lib/use-now";
import { LiveDot } from "@/ui/motion";
import { TeamBadge } from "@/ui/team-badge";
import { cap, color, font, num, numLg, radius, space, type, tonal } from "@/ui/tokens";

/**
 * The match at the top of its page, in a container (the site's `MatchHeader`): its state and format with a share button, both sides with their crests and, when it is on or
 * over, their scores, otherwise the kick-off and a live countdown; then the status line, and the series and ground.
 */
export function MatchHeader({ item, onShare }: { item: RailItem; onShare?: () => void }) {
  const now = useNow(1000); // only this header ticks every second; the page under it does not re-render
  const f = item.fixture, m = cardModel(item, now);
  const place = shortVenue(f.venue) || f.venue;
  const ms = m.when.getTime() - now;
  return (
    <View style={styles.box}>
      {m.live ? <LinearGradient pointerEvents="none" colors={["rgba(255,69,58,0.18)", "rgba(255,69,58,0)"]} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 0.6 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.card }]} /> : null}
      <View style={styles.top}>
        <View style={styles.state}>
          {m.session ? <Text style={[styles.cap, { color: color.destructive }]}>{m.session}</Text>
            : m.live ? <><LiveDot /><Text style={[styles.cap, { color: color.destructive }]}>Live</Text></>
            : <Text style={styles.cap}>{m.final ? "Final" : m.delayed ? "Delayed" : m.started ? "Started" : "Upcoming"}</Text>}
          <Text style={styles.cap}>· {f.fmt || "T20"} · {f.gender === "female" ? "Women" : "Men"}</Text>
        </View>
        {onShare ? (
          <Press accessibilityRole="button" accessibilityLabel="Share" onPress={() => { void Haptics.selectionAsync(); onShare(); }} style={({ pressed }) => [styles.round, pressed && { opacity: 0.6 }]}>
            <Ionicons name="share-outline" size={18} color={color.foreground} />
          </Press>
        ) : null}
      </View>

      <View style={styles.sides}>
        <View style={{ flex: 1, gap: space.snug }}>
          {m.sides.map((s) => (
            <View key={s.name} style={styles.side}>
              <TeamBadge name={s.name} size={34} />
              <Text style={[styles.team, s.lost && { color: color["muted-foreground"] }]} numberOfLines={1}>{s.name}</Text>
              {m.hasScore || m.live ? (
                <View style={styles.score}>
                  <Text style={[styles.total, s.lost && { opacity: 0.6 }]}>{s.score?.display ? scoreLabel(s.score) : "Yet to bat"}</Text>
                  {s.score?.overs != null ? <Text style={styles.overs}>{`${Number.isInteger(s.score.overs) ? Number(s.score.overs).toFixed(1) : s.score.overs} ov`}</Text> : null}
                </View>
              ) : null}
            </View>
          ))}
        </View>
        {!m.hasScore && !m.live && !m.final ? (
          <View style={styles.when}>
            <Text style={styles.whenDay}>{dayLabel(m.when, now)}{m.timed ? `, ${localTime(m.when).toLowerCase()}` : ""}</Text>
            {m.timed && ms > 0 ? <Text style={styles.clock}>{countdown(ms)}</Text> : null}
          </View>
        ) : null}
      </View>

      {m.live || m.final || m.delayed || m.started ? <Text style={styles.status}>{m.status}</Text> : null}
      <Text style={styles.series}>{seriesName(f)}{place ? ` · ${place}` : ""}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { ...tonal, borderRadius: radius.card, padding: space.inset, gap: space.snug },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  state: { flexDirection: "row", alignItems: "center", gap: space.tight },
  cap: { ...type.footnote, color: color["muted-foreground"], ...cap },
  round: { width: 34, height: 34, borderRadius: 17, backgroundColor: color.secondary, alignItems: "center", justifyContent: "center" },
  sides: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.snug },
  side: { flexDirection: "row", alignItems: "center", gap: space.snug },
  team: { ...type.body, fontFamily: font.medium, color: color.foreground, flexShrink: 1 },
  score: { marginLeft: "auto", flexDirection: "row", alignItems: "baseline", gap: space.tight },
  total: { fontSize: 18, letterSpacing: -0.36, fontFamily: font.data, color: color.foreground, fontVariant: ["tabular-nums"] },
  overs: { ...type.footnote, color: color["muted-foreground"] },
  when: { alignItems: "flex-end", gap: 2 },
  whenDay: { ...type.callout, color: color["muted-foreground"] },
  clock: { ...numLg, fontSize: 24, letterSpacing: -0.48, lineHeight: 28, color: color.foreground },
  status: { ...type.callout, color: color.foreground },
  series: { ...type.footnote, color: color["muted-foreground"] },
});
