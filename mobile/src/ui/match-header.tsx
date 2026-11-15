import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { scoreLabel } from "@cricket/engine/live.js";
import { abbr, shortVenue } from "@site/lib/format";
import { cardModel } from "@/lib/card";
import { countdown, dayLabel, localTime, seriesName } from "@/lib/format";
import type { RailItem } from "@/lib/rail";
import { useNow } from "@/lib/use-now";
import { StatusLabel } from "@/ui/status-label";
import { TeamBadge } from "@/ui/team-badge";
import { Tick } from "@/ui/tick";
import { cap, color, font, num, numLg, space, type } from "@/ui/tokens";

/** One side: crest · abbr · large score · Over N (mirrored on the right). Twin of web MatchScoreboard SideBlock. */
function SideBlock({
  name,
  score,
  mirror,
  live,
  pending,
}: {
  name: string;
  score?: { display?: string; runs?: number | null; wkts?: number | null; overs?: number | null } | null;
  mirror?: boolean;
  live?: boolean;
  pending?: boolean;
}) {
  const total = score?.display ? scoreLabel(score) : null;
  const overs = score?.overs != null ? `Over ${Number.isInteger(score.overs) ? score.overs : score.overs}` : null;
  const change = score?.runs == null ? null : score.runs + (score.wkts ?? 0) / 100;
  return (
    <View style={[styles.sideBlock, mirror && styles.sideMirror]}>
      <View style={styles.crestCol}>
        <TeamBadge name={name} size={36} />
        <Text style={styles.code}>{abbr(name)}</Text>
      </View>
      <View style={[styles.figures, mirror && styles.figuresEnd]}>
        {pending && !total ? (
          <View style={styles.pending} />
        ) : total ? (
          live ? (
            <Tick arrow={false} value={change} style={styles.total}>{total}</Tick>
          ) : (
            <Text style={styles.total}>{total}</Text>
          )
        ) : (
          <Text style={styles.dash}>—</Text>
        )}
        {overs ? <Text style={styles.overs}>{overs}</Text> : <View style={{ height: 14 }} />}
      </View>
    </View>
  );
}

/**
 * Fixture header (site MatchScoreboard): series · mirrored crest/score · centre StatusLabel · status / venue.
 * `bare`: inside the fixture flush `scoreShell` — internal gutter (web MatchScoreboard `px-gutter`); Fancy detail keeps outer pad + non-bare.
 */
export function MatchHeader({ item, onShare, onGround, bare }: { item: RailItem; onShare?: () => void; onGround?: () => void; bare?: boolean }) {
  const now = useNow(1000);
  const f = item.fixture, m = cardModel(item, now);
  const place = shortVenue(f.venue) || f.venue;
  const ms = m.when.getTime() - now;
  const livePulse = m.live && !m.session;
  const badge = m.session || (m.live ? "LIVE" : m.final ? "Final" : m.delayed ? "Delayed" : m.started ? "Started" : "Upcoming");
  const tone = livePulse ? "live" as const : m.session ? "session" as const : "muted" as const;
  const a = m.sides[0], b = m.sides[1];
  return (
    <View style={bare ? styles.bare : styles.box}>
      <View style={styles.top}>
        <Text style={styles.series} numberOfLines={1}>{seriesName(f)}</Text>
        <View style={styles.topRight}>
          <Text style={styles.meta}>{f.fmt || "T20"} · {f.gender === "female" ? "Women" : "Men"}</Text>
          {onShare ? (
            <Press accessibilityRole="button" accessibilityLabel="Share" onPress={() => { void Haptics.selectionAsync(); onShare(); }} style={({ pressed }) => [styles.round, pressed && { opacity: 0.6 }]}>
              <Ionicons name="share-outline" size={18} color={color.foreground} />
            </Press>
          ) : null}
        </View>
      </View>

      <View style={styles.board}>
        <SideBlock name={a?.name || f.a} score={a?.score} live={livePulse} pending={m.live && !item.live} />
        <StatusLabel tone={tone} surface="pill">{badge}</StatusLabel>
        <SideBlock name={b?.name || f.b} score={b?.score} mirror live={livePulse} pending={m.live && !item.live} />
      </View>

      {!m.hasScore && !m.live && !m.final ? (
        <View style={styles.whenRow}>
          <Text style={styles.whenDay}>{dayLabel(m.when, now)}{m.timed ? `, ${localTime(m.when).toLowerCase()}` : ""}</Text>
          {m.timed && ms > 0 ? <Text style={styles.clock}>{countdown(ms)}</Text> : null}
        </View>
      ) : null}

      {!m.live || m.session || m.final || m.delayed || m.started ? (
        m.live && !m.session ? null : <Text style={styles.status}>{m.status}</Text>
      ) : null}

      {place && onGround ? (
        <Press scale={1} onPress={() => { void Haptics.selectionAsync(); onGround(); }} accessibilityRole="link" accessibilityLabel={`Ground: ${f.venue}`} style={({ pressed }) => [styles.ground, pressed && { opacity: 0.6 }]}>
          <Ionicons name="location-outline" size={14} color={color["muted-foreground"]} />
          <Text style={styles.meta} numberOfLines={1}>{place}</Text>
          <Ionicons name="chevron-forward" size={14} color={color["muted-foreground"]} />
        </Press>
      ) : place && !m.live ? (
        <Text style={styles.meta}>{place}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.snug },
  bare: { gap: space.snug, paddingHorizontal: space.gutter, paddingTop: space.snug, paddingBottom: space.snug },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.snug },
  topRight: { flexDirection: "row", alignItems: "center", gap: space.snug, flexShrink: 0 },
  series: { ...type.footnote, fontFamily: font.medium, color: color.foreground, flex: 1 },
  meta: { ...type.footnote, color: color["muted-foreground"] },
  round: { width: 34, height: 34, borderRadius: 17, backgroundColor: color.secondary, alignItems: "center", justifyContent: "center" },
  board: { flexDirection: "row", alignItems: "center", gap: space.snug },
  sideBlock: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: space.snug },
  sideMirror: { flexDirection: "row-reverse" },
  crestCol: { alignItems: "center", gap: 2 },
  code: { ...cap, color: color["muted-foreground"] },
  figures: { flex: 1, minWidth: 0, gap: 2 },
  figuresEnd: { alignItems: "flex-end" },
  total: { fontSize: 22, letterSpacing: -0.4, fontFamily: font.data, color: color.foreground, fontVariant: ["tabular-nums"] },
  overs: { ...type.footnote, color: color["muted-foreground"] },
  dash: { ...type.body, color: color["muted-foreground"] },
  pending: { width: 72, height: 28, borderRadius: 6, backgroundColor: color.secondary },
  whenRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.snug },
  whenDay: { ...type.callout, color: color["muted-foreground"] },
  clock: { ...numLg, fontSize: 22, letterSpacing: -0.44, lineHeight: 26, color: color.foreground },
  status: { ...type.callout, color: color.foreground },
  ground: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", maxWidth: "100%" },
});
