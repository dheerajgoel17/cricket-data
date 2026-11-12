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
import { cap, color, control, font, numLg, radius, space, type, tonal } from "@/ui/tokens";

export type TapeRow = { idx: number; pid: string; name: string; stat: string; line: number; over: number; fmt: string; inn?: number; verdict: "cleared" | "missed" | "push" | null; v?: number };

/** Perforated tear across a ticket — page-coloured notches bite the sides (ticket must not clip). */
function TicketTear() {
  return (
    <View style={styles.tearWrap} accessible={false}>
      <View style={styles.tearLine} />
      <View style={[styles.notch, styles.notchLeft]} />
      <View style={[styles.notch, styles.notchRight]} />
    </View>
  );
}

/** One card for the two sharp-tape lists (the site's `MarketTape`). High odds hits render as a theme-coloured ticket. */
export function MarketTape({ rows }: { rows: TapeRow[] }) {
  const { hits, misses } = marketTape(rows) as { hits: TapeRow[]; misses: TapeRow[] };
  const [tab, setTab] = useState<"hit" | "miss">("hit");
  if (!hits.length && !misses.length) return null;
  const kind: "hit" | "miss" = tab === "hit" ? (hits.length ? "hit" : "miss") : (misses.length ? "miss" : "hit");
  const list = kind === "hit" ? hits : misses, hit = kind === "hit";

  if (hit) {
    return (
      <View style={styles.ticket} accessibilityLabel="High odds hits and low odds misses">
        <View style={styles.ticketHead}>
          {hits.length && misses.length ? (
            <View style={styles.segRow}>
              <View style={{ flex: 1 }}>
                <Segmented<"hit" | "miss"> items={[["hit", `Hits ${hits.length}`], ["miss", `Misses ${misses.length}`]]} value={kind} onChange={setTab} label="Market tape" />
              </View>
              <InfoButton topic="tape" />
            </View>
          ) : (
            <View style={styles.headRow}>
              <View style={styles.titleRow}>
                <TrendingUp color={color["primary-foreground"]} />
                <Text style={styles.titleHit}>High odds hits</Text>
              </View>
              <Text style={styles.countBadge}>{list.length} cleared</Text>
            </View>
          )}
          <Text style={styles.noteHit}>Over at {odds(HIGH_ODDS)} or longer that has already cleared.</Text>
        </View>

        <TicketTear />

        <View style={styles.ticketBody}>
          {list.slice(0, 4).map((r, k) => (
            <Press
              scale={1}
              key={`${r.idx}${r.stat}${r.line}${r.fmt}`}
              onPress={() => openPlayer(r)}
              accessibilityRole="link"
              style={({ pressed }) => [styles.ticketRow, k > 0 && styles.ticketSep, pressed && { opacity: 0.7 }]}
            >
              <PlayerFace pid={r.pid} size={control} />
              <View style={styles.who}>
                <Text style={styles.nameHit} numberOfLines={1}>{r.name}</Text>
                <Text style={styles.whatHit} numberOfLines={1}>O {r.line} {(STATS as Record<string, { label: string }>)[r.stat]?.label}</Text>
              </View>
              <View style={styles.stub}>
                <Tick value={r.over} style={styles.oddsHit}>{odds(r.over)}</Tick>
                <Text style={styles.verdictHit}>Cleared{r.v != null ? ` · ${r.v}` : ""}</Text>
              </View>
            </Press>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.missCard]} accessibilityLabel="High odds hits and low odds misses">
      {hits.length && misses.length ? (
        <View style={styles.segRow}>
          <View style={{ flex: 1 }}>
            <Segmented<"hit" | "miss"> items={[["hit", `Hits ${hits.length}`], ["miss", `Misses ${misses.length}`]]} value={kind} onChange={setTab} label="Market tape" />
          </View>
          <InfoButton topic="tape" />
        </View>
      ) : (
        <View style={styles.head}>
          <TrendingDown color={color.miss} />
          <Text style={styles.title}>Low odds misses</Text>
          <View style={{ marginLeft: "auto" }}><InfoButton topic="tape" /></View>
        </View>
      )}
      <Text style={styles.note}>Over at {odds(LOW_ODDS)} or shorter that has already missed.</Text>
      {list.slice(0, 4).map((r, k) => (
        <Press scale={1} key={`${r.idx}${r.stat}${r.line}${r.fmt}`} onPress={() => openPlayer(r)} accessibilityRole="link" style={({ pressed }) => [styles.row, k > 0 && styles.sep, pressed && { opacity: 0.6 }]}>
          <PlayerFace pid={r.pid} size={control} />
          <View style={styles.who}>
            <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
            <Text style={styles.what} numberOfLines={1}>O {r.line} {(STATS as Record<string, { label: string }>)[r.stat]?.label}</Text>
          </View>
          <View style={styles.price}>
            <Tick value={r.over} style={{ color: color.miss, ...type.callout }}>{odds(r.over)}</Tick>
            <Text style={[styles.verdict, { color: color.miss }]}>Missed{r.v != null ? ` · ${r.v}` : ""}</Text>
          </View>
        </Press>
      ))}
    </View>
  );
}

const NOTCH = 16;

const styles = StyleSheet.create({
  ticket: {
    backgroundColor: color.primary,
    borderRadius: radius.card,
  },
  ticketHead: { paddingHorizontal: space.inset, paddingTop: space.inset, paddingBottom: space.snug, gap: space.tight },
  ticketBody: { paddingHorizontal: space.inset, paddingTop: space.snug, paddingBottom: space.snug },
  tearWrap: { height: 0, zIndex: 1, justifyContent: "center" },
  tearLine: { borderStyle: "dashed", borderTopWidth: StyleSheet.hairlineWidth, borderColor: "rgba(15, 15, 15, 0.45)", marginHorizontal: space.stack },
  notch: { position: "absolute", top: -NOTCH / 2, width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: color.background },
  notchLeft: { left: -NOTCH / 2 },
  notchRight: { right: -NOTCH / 2 },
  headRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: space.snug },
  titleRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: space.snug },
  titleHit: { ...type.title, color: color["primary-foreground"] },
  countBadge: { ...cap, borderWidth: StyleSheet.hairlineWidth, borderColor: "rgba(15, 15, 15, 0.35)", borderRadius: radius.chip, paddingHorizontal: space.snug, paddingVertical: 2, color: color["primary-foreground"], overflow: "hidden" },
  noteHit: { ...type.footnote, color: "rgba(15, 15, 15, 0.7)" },
  ticketRow: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingVertical: space.snug, minHeight: 52 },
  ticketSep: { borderStyle: "dashed", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(15, 15, 15, 0.25)" },
  stub: { alignItems: "flex-end", gap: 2, borderStyle: "dashed", borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: "rgba(15, 15, 15, 0.3)", paddingLeft: space.stack },
  nameHit: { fontFamily: font.bold, fontSize: 15, lineHeight: 19, letterSpacing: -0.15, color: color["primary-foreground"] },
  whatHit: { ...type.footnote, color: "rgba(15, 15, 15, 0.65)" },
  oddsHit: { ...numLg, fontSize: 22, lineHeight: 24, color: color["primary-foreground"] },
  verdictHit: { ...cap, color: color["primary-foreground"] },
  who: { flex: 1, minWidth: 0, gap: 2 },
  card: { borderRadius: radius.card, padding: space.inset, gap: space.snug },
  missCard: { ...tonal },
  segRow: { flexDirection: "row", alignItems: "center", gap: space.snug },
  head: { flexDirection: "row", alignItems: "center", gap: space.tight },
  title: { ...type.body, color: color.foreground },
  note: { ...type.footnote, color: color["muted-foreground"] },
  row: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingVertical: space.tight, minHeight: 56 },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  name: { ...type.callout, color: color.foreground },
  what: { ...type.footnote, color: color["muted-foreground"] },
  price: { alignItems: "flex-end", gap: 2 },
  verdict: { ...type.footnote },
});
