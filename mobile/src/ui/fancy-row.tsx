/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { odds, shortVenue } from "@site/lib/format";
import { BookBadge } from "@/ui/book-badge";
import { Collapsible, TurnChevron } from "@/ui/collapsible";
import { MiniBars } from "@/ui/mini-bars";
import { TeamBadge } from "@/ui/team-badge";
import { LiveBadge, LiveOpened, LineProgress } from "@/ui/live-bits";
import { StandingMark, Tick, type Standing } from "@/ui/tick";
import { cap, color, font, num, numLg, space, type } from "@/ui/tokens";

const bookSrc = (preferred?: string, books?: { source: string }[]) => preferred || books?.[0]?.source;

/** "+N books": the books not already shown up front for a line, each with its over and under price. */
export function BookList({ books, shown }: { books: { source: string; over: number | null; under: number | null }[]; shown: (string | undefined)[] }) {
  const [open, setOpen] = useState(false);
  const rest = books.filter((b) => !shown.includes(b.source));
  if (!rest.length) return null;
  return (
    <View style={{ gap: 2 }}>
      <Press onPress={() => setOpen((v) => !v)} hitSlop={8} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.moreBtn}>
        <Text style={styles.more}>{open ? "Hide" : `+${rest.length} book${rest.length > 1 ? "s" : ""}`}</Text>
        <TurnChevron open={open} />
      </Press>
      <Collapsible open={open}>
        <View style={{ gap: 6, paddingTop: 4 }}>
          {rest.map((b) => (
            <View key={b.source} style={styles.bookRow}><BookBadge source={b.source} /><Text style={styles.bookPrice}>O {odds(b.over)}</Text><Text style={styles.bookPrice}>U {odds(b.under)}</Text></View>
          ))}
        </View>
      </Collapsible>
    </View>
  );
}

/**
 * One market's row, in the props-list style: its name, how the ground has gone, the available over/under lines
 * (named when they differ so a side listed elsewhere is never a dash), one face book per side (+N accordion for the rest),
 * the model's edge on the better side. `standing` is the 15 s live so-far, the same words as a player prop.
 */
export function OverviewRow({ r, onOpen, active, standing, sub, extra }: { r: any; onOpen?: () => void; active?: boolean; standing?: Standing | null; sub?: string; extra?: ReactNode }) {
  const overSrc = bookSrc(r.overBook, r.books), underSrc = bookSrc(r.underBook, r.books);
  const split = r.overLine != null && r.underLine != null && r.overLine !== r.underLine;
  const mark = standing ?? r.standing;
  const edgeColor = r.edge == null ? color["muted-foreground"] : r.edge > 0 ? color.primary : color.miss;
  const lean = r.side === "under" ? "U" : "O";
  const leanLine = r.side === "under" && r.underLine != null ? r.underLine : r.overLine != null ? r.overLine : r.line;
  return (
    <View style={[styles.row, active && styles.active]}>
      <Press onPress={onOpen} disabled={!onOpen} accessibilityRole="button" accessibilityLabel={`Open ${r.label}`} style={styles.main}>
        {r.team
          ? <TeamBadge name={r.team} size={44} />
          : <View style={styles.icon} accessibilityElementsHidden><Ionicons name="stats-chart-outline" size={20} color={color["muted-foreground"]} /></View>}
        <View style={styles.left}>
          <View style={styles.titleRow}><Text style={[styles.label, styles.titleText]} numberOfLines={2}>{r.label}</Text>{r.live ? <LiveBadge /> : null}</View>
          {sub ? <Text style={styles.at} numberOfLines={1}>{sub}</Text> : null}
          <View style={styles.hero}>
            <Text style={styles.heroLine}>{split ? `${lean} ${leanLine}` : `O/U ${r.line}`}</Text>
            {r.at ? (() => {
              const ground = shortVenue(r.venue);
              const hits = r.at.side === "over" ? r.at.over : r.at.under;
              const leanAt = r.at.side === r.side && r.edge != null;
              return <Text style={[styles.at, leanAt && { color: color.primary, fontFamily: font.medium }]} numberOfLines={1}>{hits}/{r.at.n} {r.at.side}{ground ? ` at ${ground}` : ""}</Text>;
            })() : null}
          </View>
          <View style={styles.prices}>
            {split ? (
              <>
                <View style={styles.price}>{overSrc ? <BookBadge source={overSrc} /> : null}<Text style={styles.sideTag}>O {r.overLine}</Text><Tick value={r.over} style={styles.odds}>{odds(r.over)}</Tick></View>
                <View style={styles.price}>{underSrc ? <BookBadge source={underSrc} /> : null}<Text style={styles.sideTag}>U {r.underLine}</Text><Tick value={r.under} style={styles.odds}>{odds(r.under)}</Tick></View>
              </>
            ) : (
              <>
                <View style={styles.price}>{overSrc ? <BookBadge source={overSrc} /> : null}<Text style={styles.sideTag}>O</Text><Tick value={r.over} style={styles.odds}>{odds(r.over)}</Tick></View>
                <View style={styles.price}>{underSrc && underSrc !== overSrc ? <BookBadge source={underSrc} /> : null}<Text style={styles.sideTag}>U</Text><Tick value={r.under} style={styles.odds}>{odds(r.under)}</Tick></View>
              </>
            )}
            {r.live ? <LiveOpened opened={r.opened} line={r.line} /> : null}
            {mark != null && !r.live ? <StandingMark standing={mark} line={r.line} /> : null}
          </View>
          {r.live ? <LineProgress standing={mark} live line={r.line} opened={r.opened} /> : null}
        </View>
        <View style={styles.side}>
          <View style={styles.edgeBlock}>
            <View style={styles.edgePill}>
              <Text style={styles.edgeLabel}>Model</Text>
              <Text style={[styles.edgeValue, { color: edgeColor }]}>{r.edge == null ? "–" : `${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(0)}%`}</Text>
            </View>
            {r.edge != null ? <Text style={styles.edgeSide}>{r.edge > 0 ? (r.side === "under" ? "Under" : "Over") : "No edge"}</Text> : null}
          </View>
          <MiniBars last={r.last} line={r.line} width={76} />
        </View>
      </Press>
      {extra}
      <BookList books={r.books} shown={[r.overBook, r.underBook]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: space.gutter, paddingVertical: space.snug + 2, gap: space.tight },
  active: { backgroundColor: "rgba(44,44,46,0.7)" },
  main: { flexDirection: "row", alignItems: "center", gap: space.snug },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: color.pill },
  left: { flex: 1, minWidth: 0, gap: 3 },
  label: { ...type.body, fontFamily: font.medium, color: color.foreground },
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: space.tight },
  titleText: { flexShrink: 1 },
  hero: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: space.snug, rowGap: 2 },
  heroLine: { ...numLg, fontSize: 22, letterSpacing: -0.4, lineHeight: 24, color: color.foreground },
  at: { ...type.footnote, color: color["muted-foreground"] },
  prices: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.snug, rowGap: 2 },
  price: { flexDirection: "row", alignItems: "center", gap: space.tight },
  sideTag: { ...type.callout, color: color["muted-foreground"] },
  odds: { ...type.callout, ...num, fontSize: 15, color: color.foreground },
  side: { alignItems: "flex-end", gap: space.hair },
  edgeBlock: { alignItems: "flex-end", gap: 2 },
  edgePill: { flexDirection: "row", alignItems: "baseline", gap: space.tight },
  edgeLabel: { ...type.caption, ...cap, color: color["muted-foreground"] },
  edgeSide: { ...type.footnote, ...cap, fontSize: 10, color: color["muted-foreground"] },
  edgeValue: { ...numLg, fontSize: 20, letterSpacing: -0.4, lineHeight: 22 },
  moreBtn: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
  more: { ...type.footnote, fontFamily: font.medium, color: "rgba(255,255,255,0.7)" },
  bookRow: { flexDirection: "row", alignItems: "center", gap: space.snug },
  bookPrice: { ...type.footnote, color: color["muted-foreground"], fontFamily: font.data, fontVariant: ["tabular-nums"] },
});
