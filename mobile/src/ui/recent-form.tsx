/* eslint-disable @typescript-eslint/no-explicit-any */
import { StyleSheet, View } from "react-native";
import { shortDate } from "@site/lib/format";
import { push } from "@/lib/nav";
import { Press } from "@/ui/press";
import { TeamBadge } from "@/ui/team-badge";
import { Text } from "@/ui/text";
import { color, font, space, type } from "@/ui/tokens";
import { EmptyState } from "@/ui/empty-state";

const CHIP: Record<string, string> = { W: color.primary, L: color.miss, T: color["muted-foreground"], D: color["muted-foreground"], NR: color["muted-foreground"] };
const WORD: Record<string, string> = { W: "Won", L: "Lost", T: "Tied", D: "Drawn", NR: "No result" };

/** W / L / NR chips, oldest to newest; full size underlines the latest, compact is the closed row's size. */
export function FormChips({ results, compact }: { results: string[]; compact?: boolean }) {
  const s = compact ? 20 : 28;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: compact ? 3 : 6 }} accessibilityLabel={`Recent results, oldest first: ${results.map((r) => WORD[r]).join(", ")}`}>
      {results.map((r, i) => (
        <View key={i} style={{ alignItems: "center", gap: 3 }}>
          <View style={{ width: s, height: s, borderRadius: 7, backgroundColor: CHIP[r], alignItems: "center", justifyContent: "center" }}><Text style={[styles.chipText, { fontSize: compact ? 10.5 : 12 }]}>{r}</Text></View>
          {!compact ? <View style={{ width: 18, height: 2, borderRadius: 1, backgroundColor: i === results.length - 1 ? "rgba(255,255,255,0.6)" : "transparent" }} /> : null}
        </View>
      ))}
    </View>
  );
}

/** The closed row's right side: each side's last three results. */
export function FormHeadline({ forms }: { forms: { name: string; idx: number; games: any[] }[] }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.snug, maxWidth: "70%" }}>
      {forms.filter((f) => f.games.length).map(({ name, idx, games }) => (
        <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><TeamBadge name={name} size={20} /><FormChips compact results={games.map((g) => g.result)} /></View>
      ))}
    </View>
  );
}

/** Last results in this format, newest first under each side (the site's `RecentForm`). */
export function RecentForm({ forms, store, fmt }: { forms: { name: string; idx: number; games: any[] }[]; store: any; fmt: string }) {
  return (
    <View accessibilityLabel="Recent form" style={{ paddingBottom: space.snug }}>
      {forms.map(({ name, idx, games }) => (
        <View key={idx}>
          <View style={styles.team}>
            <TeamBadge name={name} size={28} />
            <Text style={styles.teamName} numberOfLines={1}>{name}</Text>
            {games.length ? <FormChips results={games.map((g) => g.result)} /> : <EmptyState compact title={`No ${fmt} results`} />}
          </View>
          {[...games].reverse().map((g) => (
            <View key={g.m} style={styles.game}>
              <View style={[styles.mark, { backgroundColor: CHIP[g.result] }]}><Text style={styles.chipText}>{g.result}</Text></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Press scale={0.98} onPress={() => push(`/team/${g.opp}`)} accessibilityRole="link"><Text style={styles.vs} numberOfLines={1}>vs {store.teamName(g.opp)}</Text></Press>
                <Text style={styles.muted} numberOfLines={1}>{shortDate(g.date)}{g.event != null && store.events[g.event] ? ` · ${store.events[g.event]}` : ""}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}><Text style={styles.own}>{g.own ?? "–"}</Text><Text style={styles.muted}>{g.theirs ?? "–"}</Text></View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chipText: { fontFamily: font.bold, color: color.background },
  team: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingVertical: space.snug },
  teamName: { ...type.callout, fontFamily: font.medium, color: color.foreground, flex: 1 },
  game: { flexDirection: "row", alignItems: "center", gap: space.snug, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, paddingVertical: space.snug },
  mark: { width: 28, height: 28, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  vs: { ...type.callout, fontFamily: font.medium, color: color.foreground },
  muted: { ...type.footnote, color: color["muted-foreground"] },
  own: { ...type.footnote, color: color.foreground, fontFamily: font.data, fontVariant: ["tabular-nums"] },
});
