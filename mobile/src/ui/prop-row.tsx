/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { scopeTag } from "@cricket/engine/lines.js";
import { STATS } from "@cricket/engine/rules.js";
import { odds, shortVenue } from "@site/lib/format";
import { edgeTag, groundNote } from "@cricket/engine/props-view.js";
import { fmtIndex } from "@cricket/engine/util.js";
import type { Quote, Row } from "@/lib/hot";
import { openPlayer } from "@/lib/nav";
import { BookBadge } from "@/ui/book-badge";
import { BookTable } from "@/ui/book-table";
import { MiniBars } from "@/ui/mini-bars";
import { PlayerAvatar } from "@/ui/player-avatar";
import { TeamBadge } from "@/ui/team-badge";
import { LiveBadge, LiveOpened, LineProgress } from "@/ui/live-bits";
import { BatterSpot } from "@/ui/live-spot";
import { PropStar } from "@/ui/star";
import { StandingMark, Tick, type Standing } from "@/ui/tick";
import { cap, color, control, figure, font, metric, space, type } from "@/ui/tokens";

const pct = (p: number | null) => (p == null ? "–" : `${Math.round(p * 100)}%`);
/** The site's `pctClass`: a window's hit rate reads green from 70%, red up to 40%. */
const rateColor = (p: number | null | undefined) => (p == null ? color["muted-foreground"] : p >= 0.7 ? color.primary : p <= 0.4 ? color.miss : color.foreground);

/**
 * The best Over and the best Under, each with the book that offers it (the site's `BookQuotes`): the usual player prop has both at the row's line; a side quoted at another line
 * says which. The other books sit behind "+N books" (`BookTable`). A live line says where it opened.
 */
function Lanes({ quotes, line }: { quotes: Quote[]; line: number }) {
  let overQ: Quote | null = null, underQ: Quote | null = null;
  for (const q of quotes) {
    if (q.over != null && (!overQ || q.over > (overQ.over ?? 0) || (q.over === overQ.over && q.line < overQ.line))) overQ = q;
    const price = q.underAt?.price ?? q.under, at = q.underAt?.line ?? q.line;
    if (price == null) continue;
    const best = underQ ? (underQ.underAt?.price ?? underQ.under) : null, bestAt = underQ ? (underQ.underAt?.line ?? underQ.line) : Infinity;
    if (best == null || price > best || (price === best && at > bestAt)) underQ = q;
  }
  const overLine = overQ?.line, underLine = underQ ? (underQ.underAt?.line ?? underQ.line) : undefined;
  const underPrice = underQ ? (underQ.underAt?.price ?? underQ.under) : null;
  const split = overLine != null && underLine != null && overLine !== underLine;
  const live = quotes.find((q) => q.live);
  return (
    <View style={styles.books}>
      <View style={styles.lanes}>
        {overQ?.over != null ? (
          <View style={styles.lane}>
            <Text style={styles.laneTag}>O{split || overLine !== line ? ` ${overLine}` : ""}</Text>
            <Tick value={overQ.over} style={styles.lanePrice}>{odds(overQ.over)}</Tick>
            <BookBadge source={overQ.source} />
          </View>
        ) : null}
        {underQ && underPrice != null ? (
          <View style={styles.lane}>
            <Text style={styles.laneTag}>U{split || underLine !== line ? ` ${underLine}` : ""}</Text>
            <Tick value={underPrice} style={styles.lanePrice}>{odds(underPrice)}</Tick>
            <BookBadge source={underQ.source} />
          </View>
        ) : null}
        {live ? <LiveOpened opened={live.opened} line={live.line} /> : null}
      </View>
      <BookTable books={quotes.map((q) => ({ source: q.source, over: q.over, under: q.underAt?.price ?? q.under }))} shown={[overQ?.source, underQ?.source]} />
    </View>
  );
}

/**
 * One priced line, laid out as the site's `PropRow`: the face; the name with the team's crest; the line in the condensed bold face with the stat in caps; the best Over and Under
 * with their books; where it stands so far; the ground note and the L10 count; at the right the watchlist star, the model edge and the last-ten bars. The whole row opens the player.
 */
function PropRowView({ r, i, soFar, out, bars = true }: { r: Row; i: number; soFar: Standing | null; out: boolean; bars?: boolean }) {
  const label = (STATS as any)[r.stat]?.label;
  const edgeColor = out || r.edge == null ? color["muted-foreground"] : r.edge > 0 ? color.primary : color.miss;
  const live = r.quotes.find((q: Quote) => q.live); // a line the books are pricing in play: the Live mark, where it opened, and the bar against it
  const ground = groundNote(r.ven) as { hits: number; played: number; tone: "good" | "bad" | "plain" } | null;
  const scope = (scopeTag as any)(r.fmt, r.inn) as string;
  // No entering animation: FlashList recycles rows; layout animations on recycled cells hitch scroll (animate-expo).
  return (
    <View style={[i > 0 && styles.sep, out && styles.out]}>
      <Press scale={1} onPress={() => openPlayer(r)} accessibilityRole="link" accessibilityLabel={`${r.name}, ${r.line} ${label}${r.over > 1 ? `, over ${odds(r.over)}` : ""}${r.under > 1 ? `, under ${odds(r.under)}` : ""}${r.edge != null ? `, model edge ${(r.edge * 100).toFixed(0)} percent on the ${r.side}` : ""}`} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <PlayerAvatar pid={r.pid} team={r.team} test={r.fmt === "Test"} size={control + 4} />
        <View style={styles.main}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
            <TeamBadge name={r.team} size={18} bare />
            {live && !out ? <LiveBadge /> : null}
            {out ? <Text style={styles.notIn}>Not in XI</Text> : null}
          </View>
          <View style={styles.descRow}>
            <Text style={styles.line}>{out ? r.line : `O/U ${r.line}`}</Text>
            <Text style={styles.statCap}>{label}{scope ? <Text style={styles.scope}> · {scope}</Text> : null}</Text>
          </View>
          {out ? null : r.quotes.length ? <Lanes quotes={r.quotes} line={r.line} /> : (
            <Text style={styles.plain}>Over <Text style={styles.plainNum}>{odds(r.over)}</Text> · Under <Text style={styles.plainNum}>{odds(r.under)}</Text></Text>
          )}
          {live && !out ? <LineProgress standing={soFar} live line={r.line} opened={live.opened} /> : null}
          {!live && !out && soFar ? <StandingMark standing={soFar} line={r.line} /> : null}
          {live && !out && (!soFar || soFar.state === "live") ? <BatterSpot r={r} /> : null}
          <View style={styles.foot}>
            {ground ? (
              <Text style={[styles.context, ground.tone === "good" && styles.good, ground.tone === "bad" && styles.bad]} numberOfLines={1}>{ground.hits}/{ground.played} at {shortVenue(r.venue)}</Text>
            ) : null}
            <Text style={[styles.l10, { color: rateColor(r.l10?.p) }]}>{r.l10?.hits ?? 0} in L10</Text>
          </View>
        </View>
        <View style={styles.side}>
          {out ? null : (
            <View style={styles.edgeBlock}>
              <View style={styles.edgePill}>
                <Text style={styles.edgeLabel}>Model</Text>
                <Text style={[styles.edgeValue, { color: edgeColor }]}>{r.edge == null ? "–" : `${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(0)}%`}</Text>
              </View>
              {r.edge != null ? <Text style={styles.edgeSide}>{(edgeTag as any)(r.edge, r.side)}</Text> : null}
            </View>
          )}
          {bars ? <MiniBars last={r.last} line={r.line} max={r.max} width={76} /> : null}
        </View>
      </Press>
      <View style={styles.star}><PropStar idx={r.idx} stat={r.stat} line={r.line} fmt={fmtIndex(r.fmt)} /></View>
    </View>
  );
}

export { pct };

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.tight, paddingHorizontal: space.gutter, paddingVertical: space.snug },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  out: { opacity: 0.6 },
  pressed: { backgroundColor: color["surface-hover"] },
  main: { flex: 1, minWidth: 0, gap: space.hair },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.tight, paddingRight: control },
  name: { ...type.body, fontFamily: font.bold, color: color.foreground, flexShrink: 1 },
  notIn: { ...type.caption, fontFamily: font.medium, color: color["muted-foreground"], borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderRadius: 999, paddingHorizontal: space.snug, paddingVertical: 1 },
  descRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: space.snug, rowGap: space.hair },
  line: { ...metric, color: color.foreground },
  statCap: { ...cap, color: color.primary },
  scope: { color: color["muted-foreground"] },
  books: { gap: space.hair },
  lanes: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.snug, rowGap: space.hair },
  lane: { flexDirection: "row", alignItems: "center", gap: space.tight },
  laneTag: { ...type.callout, fontFamily: font.dataLight, color: color["muted-foreground"] },
  lanePrice: { ...type.body, fontFamily: font.data, fontVariant: ["tabular-nums"], color: color.foreground },
  plain: { ...type.callout, fontFamily: font.dataLight, color: color["muted-foreground"] },
  plainNum: { fontFamily: font.data, color: color.foreground },
  foot: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: space.snug, rowGap: space.hair },
  context: { ...type.footnote, color: color["muted-foreground"], flexShrink: 1 },
  good: { fontFamily: font.medium, color: color.primary },
  bad: { fontFamily: font.medium, color: color.miss },
  l10: { ...type.footnote, fontFamily: font.dataLight, fontVariant: ["tabular-nums"] },
  // the right column starts under the star, as on the site (`self-start pt-control`)
  side: { alignSelf: "flex-start", alignItems: "flex-end", gap: space.hair, paddingTop: control - space.snug },
  edgeBlock: { alignItems: "flex-end", gap: space.hair },
  edgePill: { flexDirection: "row", alignItems: "baseline", gap: space.tight },
  edgeLabel: { ...type.caption, ...cap, color: color["muted-foreground"] },
  edgeSide: { ...type.caption, ...cap, color: color["muted-foreground"] },
  edgeValue: { ...figure },
  star: { position: "absolute", top: space.tight, right: space.gutter - space.tight },
});

type PropRowProps = Parameters<typeof PropRowView>[0];
/** Re-rendered only when its row, place, or the live standing on it changed: a live poll that moved some other match leaves it alone. */
export const PropRow = memo(PropRowView, (a: PropRowProps, b: PropRowProps) => a.r === b.r && a.i === b.i && a.out === b.out && a.bars === b.bars && JSON.stringify(a.soFar) === JSON.stringify(b.soFar));
