/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { odds } from "@site/lib/format";
import { BookBadge } from "@/ui/book-badge";
import { Collapsible, TurnChevron } from "@/ui/collapsible";
import { MiniBars } from "@/ui/mini-bars";
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
 * One market's row, in the props-list style: its name, how the ground has gone, the book's line and price(s), the model's edge on the better side (and which side) with the last ten results as bars, and the other
 * books behind "+N books". `standing` is the 15 s live so-far, the same words as a player prop.
 */
export function OverviewRow({ r, onOpen, active, standing, sub }: { r: any; onOpen?: () => void; active?: boolean; standing?: Standing | null; sub?: string }) {
  const overSrc = bookSrc(r.overBook, r.books), underSrc = bookSrc(r.underBook, r.books);
  const split = r.overLine != null && r.underLine != null && r.overLine !== r.underLine;
  const mark = standing ?? r.standing;
  const edgeColor = r.edge == null ? color["muted-foreground"] : r.edge > 0 ? color.primary : color.miss;
  return (
    <View style={[styles.row, active && styles.active]}>
      <Press onPress={onOpen} disabled={!onOpen} accessibilityRole="button" accessibilityLabel={`Open ${r.label}`} style={styles.main}>
        <View style={styles.left}>
          <Text style={styles.label} numberOfLines={2}>{r.label}</Text>
          {sub ? <Text style={styles.at} numberOfLines={1}>{sub}</Text> : null}
          {r.at ? <Text style={styles.at}>At the ground · <Text style={{ color: color.foreground, fontFamily: font.medium }}>{r.at.side === "over" ? r.at.over : r.at.under} of {r.at.n} {r.at.side}</Text></Text> : null}
          <View style={styles.prices}>
            {split ? (
              <>
                <View style={styles.price}><Text style={styles.line}>O {r.overLine}</Text>{overSrc ? <BookBadge source={overSrc} /> : null}<Tick value={r.over} style={styles.odds}>{odds(r.over)}</Tick></View>
                <View style={styles.price}><Text style={styles.line}>U {r.underLine}</Text>{underSrc ? <BookBadge source={underSrc} /> : null}<Tick value={r.under} style={styles.odds}>{odds(r.under)}</Tick></View>
              </>
            ) : (
              <View style={styles.price}>
                <Text style={styles.line}>O/U {r.line}</Text>{overSrc ? <BookBadge source={overSrc} /> : null}
                <Tick value={r.over} style={styles.odds}>O {odds(r.over)}</Tick>
                {underSrc && underSrc !== overSrc ? <BookBadge source={underSrc} /> : null}
                <Tick value={r.under} style={styles.odds}>U {odds(r.under)}</Tick>
              </View>
            )}
            {mark != null ? <StandingMark standing={mark} line={r.line} /> : null}
          </View>
        </View>
        <View style={styles.side}>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.edgeLabel}>Model</Text>
            <Text style={[styles.edgeValue, { color: edgeColor }]}>{r.edge == null ? "–" : `${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(0)}%`}</Text>
            {r.edge != null ? <Text style={styles.edgeSide}>{r.edge > 0 ? r.side : "No edge"}</Text> : null}
          </View>
          <MiniBars last={r.last} line={r.line} />
        </View>
      </Press>
      <BookList books={r.books} shown={[r.overBook, r.underBook]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: space.gutter, paddingVertical: space.snug + 2, gap: space.tight },
  active: { backgroundColor: "rgba(44,44,46,0.7)" },
  main: { flexDirection: "row", alignItems: "center", gap: space.snug },
  left: { flex: 1, minWidth: 0, gap: 3 },
  label: { ...type.body, fontFamily: font.medium, color: color.foreground },
  at: { ...type.footnote, color: color["muted-foreground"] },
  prices: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.snug, rowGap: 2 },
  price: { flexDirection: "row", alignItems: "center", gap: space.tight },
  line: { ...type.callout, color: color.foreground, fontFamily: font.data, fontVariant: ["tabular-nums"] },
  odds: { ...type.callout, ...num, fontSize: 15, color: color.foreground },
  side: { alignItems: "flex-end", gap: space.snug },
  edgeLabel: { ...type.caption, ...cap, color: color["muted-foreground"] },
  edgeSide: { ...type.footnote, ...cap, fontSize: 10, color: color["muted-foreground"] },
  edgeValue: { ...numLg, fontSize: 24, letterSpacing: -0.48, lineHeight: 26 },
  moreBtn: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start" },
  more: { ...type.footnote, fontFamily: font.medium, color: "rgba(255,255,255,0.7)" },
  bookRow: { flexDirection: "row", alignItems: "center", gap: space.snug },
  bookPrice: { ...type.footnote, color: color["muted-foreground"], fontFamily: font.data, fontVariant: ["tabular-nums"] },
});
