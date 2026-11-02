import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { STATS } from "@cricket/engine/rules.js";
import { HIGH_ODDS, LOW_ODDS, marketTape } from "@cricket/engine/tape.js";
import { odds } from "@site/lib/format";
import { openPlayer } from "@/lib/nav";
import { TrendingDown, TrendingUp } from "@/ui/icons";
import { InfoButton } from "@/ui/info-button";
import { Segmented } from "@/ui/segmented";
import { PlayerFace } from "@/ui/player-avatar";
import { Tick } from "@/ui/tick";
import { color, control, radius, space, type, tonal } from "@/ui/tokens";

export type TapeRow = { idx: number; pid: string; name: string; stat: string; line: number; over: number; fmt: string; inn?: number; verdict: "cleared" | "missed" | "push" | null; v?: number };

/** One card for the two sharp-tape lists, a tab each: the long shots that cleared, the heavy favourites that missed (the site's `MarketTape`). */
export function MarketTape({ rows }: { rows: TapeRow[] }) {
  const { hits, misses } = marketTape(rows) as { hits: TapeRow[]; misses: TapeRow[] };
  const [tab, setTab] = useState<"hit" | "miss">("hit");
  if (!hits.length && !misses.length) return null;
  const kind: "hit" | "miss" = tab === "hit" ? (hits.length ? "hit" : "miss") : (misses.length ? "miss" : "hit");
  const list = kind === "hit" ? hits : misses, hit = kind === "hit";
  const tone = hit ? color.primary : color.miss;
  return (
    <View style={styles.card} accessibilityLabel="High odds hits and low odds misses">
      {hits.length && misses.length ? (
        <View style={styles.segRow}>
          <View style={{ flex: 1 }}>
            <Segmented<"hit" | "miss"> items={[["hit", `Hits ${hits.length}`], ["miss", `Misses ${misses.length}`]]} value={kind} onChange={setTab} label="Market tape" />
          </View>
          <InfoButton topic="tape" />
        </View>
      ) : (
        <View style={styles.head}>
          {hit ? <TrendingUp color={color.primary} /> : <TrendingDown color={color.miss} />}
          <Text style={styles.title}>{hit ? "High odds hits" : "Low odds misses"}</Text>
          <View style={{ marginLeft: "auto" }}><InfoButton topic="tape" /></View>
        </View>
      )}
      <Text style={styles.note}>{hit ? `Over at ${odds(HIGH_ODDS)} or longer that has already cleared.` : `Over at ${odds(LOW_ODDS)} or shorter that has already missed.`}</Text>
      {list.slice(0, 4).map((r, k) => (
        <Press scale={1} key={`${r.idx}${r.stat}${r.line}${r.fmt}`} onPress={() => openPlayer(r)} accessibilityRole="link" style={({ pressed }) => [styles.row, k > 0 && styles.sep, pressed && { opacity: 0.6 }]}>
          <PlayerFace pid={r.pid} size={control} />
          <View style={styles.who}>
            <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
            <Text style={styles.what} numberOfLines={1}>O {r.line} {(STATS as Record<string, { label: string }>)[r.stat]?.label}</Text>
          </View>
          <View style={styles.price}>
            <Tick value={r.over} style={{ color: tone }}>{odds(r.over)}</Tick>
            <Text style={[styles.verdict, { color: tone }]}>{hit ? "Cleared" : "Missed"}{r.v != null ? ` · ${r.v}` : ""}</Text>
          </View>
        </Press>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...tonal, borderRadius: radius.card, padding: space.inset, gap: space.snug },
  segRow: { flexDirection: "row", alignItems: "center", gap: space.snug },
  head: { flexDirection: "row", alignItems: "center", gap: space.tight },
  title: { ...type.body, color: color.foreground },
  note: { ...type.footnote, color: color["muted-foreground"] },
  row: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingVertical: space.tight, minHeight: 56 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  who: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...type.callout, color: color.foreground },
  what: { ...type.footnote, color: color["muted-foreground"] },
  price: { alignItems: "flex-end", gap: 2 },
  verdict: { ...type.footnote },
});
