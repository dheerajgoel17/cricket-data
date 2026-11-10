/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import Animated from "react-native-reanimated";
import { SCOPE_LABEL } from "@cricket/engine/lines.js";
import { STATS } from "@cricket/engine/rules.js";
import { odds, shortVenue } from "@site/lib/format";
import { groundNote } from "@cricket/engine/props-view.js";
import type { Quote, Row } from "@/lib/hot";
import { openPlayer } from "@/lib/nav";
import { BookBadge } from "@/ui/book-badge";
import { Collapsible, TurnChevron } from "@/ui/collapsible";
import { MiniBars } from "@/ui/mini-bars";
import { enter } from "@/ui/motion";
import { PlayerAvatar } from "@/ui/player-avatar";
import { TeamBadge } from "@/ui/team-badge";
import { LiveBadge, LiveOpened, LineProgress } from "@/ui/live-bits";
import { BatterSpot } from "@/ui/live-spot";
import { StandingMark, Tick, type Standing } from "@/ui/tick";
import { cap, color, font, num, numLg, space, type } from "@/ui/tokens";

const pct = (p: number | null) => (p == null ? "–" : `${Math.round(p * 100)}%`);

const byOver = (quotes: Quote[]) => quotes.filter((q) => q.over != null).sort((a, b) => (b.over ?? 0) - (a.over ?? 0));

/**
 * The best book's logo and price on one line (the price in the accent colour when it is the best among the books, and it flashes when it moves), then "+N" for the other books that price
 * the line: tapping it opens `AllBooks` under the row. When only an under is listed, that; when no book is listed, the row's own best price.
 */
function PriceLine({ quotes, line, price, open, onToggle }: { quotes: Quote[]; line: number; price: number; open: boolean; onToggle: () => void }) {
  const priced = byOver(quotes);
  const top = priced[0] ?? quotes[0];
  if (!top) return price > 1 ? <View style={styles.prices}><Text style={styles.price}>{odds(price)}</Text></View> : null;
  const more = priced.length - 1;
  return (
    <View style={styles.prices}>
      <BookBadge source={top.source} />
      {top.over != null
        ? <>
            <Tick value={top.over} style={{ ...type.callout, ...num, fontSize: 16, color: top.best ? color.primary : color.foreground }}>{`${top.line !== line ? `${top.line} @ ` : ""}O ${odds(top.over)}`}</Tick>
            {top.under != null ? <Text style={styles.priceUnder}>U {odds(top.under)}</Text> : null}
          </>
        : <Text style={styles.price}>{`U ${top.line} ${odds(top.under)}`}</Text>}
      {top.live ? <LiveOpened opened={top.opened} line={top.line} /> : null}
      {more > 0 ? (
        <Press scale={1} onPress={onToggle} hitSlop={10} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={open ? "Hide other books" : `Show ${more} more books`} style={styles.moreBtn}>
          <Text style={styles.more}>{open ? "Hide" : `+${more}`}</Text>
          <TurnChevron open={open} />
        </Press>
      ) : null}
    </View>
  );
}

/** Every book that prices the line, best first, the full width of the row: its logo, its over and its under (the page's own books table has the same list). */
function AllBooks({ quotes, line }: { quotes: Quote[]; line: number }) {
  return (
    <View style={styles.all}>
      <View style={styles.allRow}><View style={styles.allBook} /><Text style={[styles.allCol, styles.allNum]}>Over</Text><Text style={[styles.allCol, styles.allNum]}>Under</Text></View>
      {byOver(quotes).map((q) => (
        <View key={q.source} style={styles.allRow}>
          <View style={styles.allBook}><BookBadge source={q.source} />{q.line !== line ? <Text style={styles.more}>{q.line}</Text> : null}</View>
          <Text style={[styles.allNum, { color: q.best ? color.primary : color.foreground }]}>{odds(q.over)}</Text>
          <Text style={[styles.allNum, { color: color["muted-foreground"] }]}>{q.under != null ? odds(q.under) : "–"}</Text>
        </View>
      ))}
    </View>
  );
}

/** Same chrome as Match Fancy's OverviewRow: title, condensed line, books, model edge (site PropRow). */
function PropRowView({ r, i, soFar, out }: { r: Row; i: number; soFar: Standing | null; out: boolean }) {
  const label = (STATS as any)[r.stat]?.label;
  const edgeColor = r.edge == null ? color["muted-foreground"] : r.edge > 0 ? color.primary : color.miss;
  const [open, setOpen] = useState(false);
  const live = r.quotes.find((q: Quote) => q.live); // a line the books are pricing in play: the Live mark, "was", and the bar against it
  const ground = groundNote(r.ven) as { hits: number; played: number; tone: "good" | "bad" | "plain" } | null;
  // Rise-in only for the first rows; Android keeps fewer to hold 60 fps (AGENTS.md).
  const rise = i < (Platform.OS === "android" ? 4 : 8);
  return (
    <Animated.View entering={rise ? enter(i) : undefined}>
      <Press scale={1} onPress={() => openPlayer(r)} accessibilityRole="link" accessibilityLabel={`${r.name}, ${r.line} ${label}${r.over > 1 ? `, over ${odds(r.over)}` : ""}${r.under > 1 ? `, under ${odds(r.under)}` : ""}${r.edge != null ? `, model edge ${(r.edge * 100).toFixed(0)} percent on the ${r.side}` : ""}`} style={({ pressed }) => [styles.row, i > 0 && styles.sep, out && styles.out, pressed && styles.pressed]}>
        <View style={styles.top}>
          <PlayerAvatar pid={r.pid} team={r.team} test={r.fmt === "Test"} size={44} />
          <View style={styles.main}>
            <View style={styles.titleRow}>
              <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
              <TeamBadge name={r.team} size={18} bare />
              {live ? <LiveBadge /> : null}
              {out ? <Text style={styles.notIn}>Not in XI</Text> : null}
            </View>
            <View style={styles.descRow}>
              <Text style={styles.line}>{r.side === "under" ? "U" : "O"} {r.line}</Text>
              <Text style={styles.statCap}>{label}{r.inn ? ` · ${(SCOPE_LABEL as any)[r.inn]}` : ""}</Text>
            </View>
            <PriceLine quotes={r.quotes} line={r.line} price={r.over} open={open} onToggle={() => setOpen((o) => !o)} />
            <View style={styles.foot}>
              {!live && soFar ? <StandingMark standing={soFar} line={r.line} /> : null}
              {ground ? (
                <Text style={styles.context} numberOfLines={1}>
                  <Text style={[styles.contextStrong, ground.tone === "good" && { color: color.primary }, ground.tone === "bad" && { color: color.miss }]}>{ground.hits}/{ground.played}</Text> at {shortVenue(r.venue)}
                </Text>
              ) : null}
              <Text style={styles.l10}>{r.l10?.hits ?? 0} in L10</Text>
            </View>
            {live && !out ? <LineProgress standing={soFar} live line={r.line} opened={live.opened} /> : null}
            {live && !out && (!soFar || soFar.state === "live") ? <BatterSpot r={r} /> : null}
          </View>
          <View style={styles.side}>
            <View style={styles.edgeBlock}>
              <View style={styles.edgePill}>
                <Text style={styles.edgeLabel}>Model</Text>
                <Text style={[styles.edgeValue, { color: edgeColor }]}>{r.edge == null ? "–" : `${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(0)}%`}</Text>
              </View>
              {r.edge != null ? <Text style={styles.edgeSide}>{r.edge > 0 ? (r.side === "under" ? "Under" : "Over") : "No edge"}</Text> : null}
            </View>
            <MiniBars last={r.last} line={r.line} max={r.max} width={76} />
          </View>
        </View>
        <Collapsible open={open}><AllBooks quotes={r.quotes} line={r.line} /></Collapsible>
      </Press>
    </Animated.View>
  );
}

export { pct };

const styles = StyleSheet.create({
  row: { paddingHorizontal: space.gutter, paddingVertical: space.snug },
  top: { flexDirection: "row", alignItems: "center", gap: space.snug },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  out: { opacity: 0.6 },
  pressed: { backgroundColor: color.card },
  main: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.tight },
  name: { ...type.body, fontSize: 15, fontFamily: font.medium, color: color.foreground, flexShrink: 1 },
  notIn: { ...type.caption, color: color["muted-foreground"], borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderRadius: 999, paddingHorizontal: space.snug, paddingVertical: 1 },
  descRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: space.snug, rowGap: 2 },
  line: { ...numLg, fontSize: 22, letterSpacing: -0.4, lineHeight: 24, color: color.foreground },
  statCap: { ...cap, color: color.primary },
  price: { ...type.callout, ...num, fontSize: 16, color: color.foreground },
  priceUnder: { ...type.callout, ...num, fontSize: 15, color: color["muted-foreground"] },
  context: { ...type.footnote, color: color["muted-foreground"] },
  contextStrong: { fontFamily: font.data, fontSize: 13, color: color.foreground },
  foot: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: space.snug, rowGap: 2 },
  l10: { ...type.footnote, ...num, color: color["muted-foreground"] },
  prices: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.snug, rowGap: 2, minHeight: 20 },
  more: { ...type.footnote, color: color["muted-foreground"] },
  moreBtn: { flexDirection: "row", alignItems: "center", gap: 2 },
  all: { gap: 8, paddingTop: space.snug, paddingLeft: 44 + space.snug },
  allRow: { flexDirection: "row", alignItems: "center", gap: space.snug },
  allBook: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.tight },
  allCol: { ...cap, color: color["muted-foreground"] },
  allNum: { ...type.callout, ...num, fontSize: 15, width: 52, textAlign: "right" },
  side: { alignItems: "flex-end", gap: space.hair },
  edgeBlock: { alignItems: "flex-end", gap: 2 },
  edgePill: { flexDirection: "row", alignItems: "baseline", gap: space.tight },
  edgeLabel: { ...type.caption, ...cap, color: color["muted-foreground"] },
  edgeSide: { ...type.footnote, ...cap, fontSize: 10, color: color["muted-foreground"] },
  edgeValue: { ...numLg, fontSize: 20, letterSpacing: -0.4, lineHeight: 22 },
});

type PropRowProps = Parameters<typeof PropRowView>[0];
/** Re-rendered only when its row, place, or the live standing on it changed: a live poll that moved some other match leaves it alone. */
export const PropRow = memo(PropRowView, (a: PropRowProps, b: PropRowProps) => a.r === b.r && a.i === b.i && a.out === b.out && JSON.stringify(a.soFar) === JSON.stringify(b.soFar));
