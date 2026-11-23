import { StyleSheet, View } from "react-native";
import { bookName } from "@cricket/engine/lines.js";
import { tossMarket } from "@cricket/engine/toss.js";
import { odds } from "@site/lib/format";
import { Text } from "@/ui/text";
import { TeamBadge } from "@/ui/team-badge";
import { color, space, t, type } from "@/ui/tokens";

type TossMarketT = { default: boolean; sides: { name: string; price: number; book: string | null }[]; books: { source: string; prices: number[] }[] };
export const tossFor = tossMarket as (doc: any, fx: { a: string; b: string; fmt?: string; startMs?: number }) => TossMarketT;

/** The toss-winner market on the Match scope of Match Fancy (twin of the site's `toss-winner.tsx`): both sides' prices, no history edge. A side price is a book's, else the 1.95 default, which the heading says. */
export function TossWinner({ market }: { market: TossMarketT }) {
  const note = market.default ? "Default price, no book lists the toss" : market.books.length > 1 ? `Best of ${market.books.length} books` : bookName(market.books[0]!.source);
  return (
    <View style={styles.root} accessibilityLabel="Toss winner">
      <View style={styles.head}>
        <Text style={styles.h2}>Toss winner</Text>
        <Text style={styles.note}>{note}</Text>
      </View>
      <View style={styles.bleed}>
        {market.sides.map((s, i) => (
          <View key={s.name} style={[styles.row, i > 0 && styles.sep]}>
            <TeamBadge name={s.name} size={32} />
            <View style={styles.name}>
              <Text style={styles.title} numberOfLines={1}>{s.name}</Text>
              {!market.default && market.books.length > 1 && s.book ? <Text style={styles.note}>{bookName(s.book)}</Text> : null}
            </View>
            <Text style={styles.price}>{odds(s.price)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.snug },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space.snug },
  h2: { ...type.heading, color: color.foreground },
  note: { ...type.footnote, color: color["muted-foreground"] },
  bleed: { marginHorizontal: -space.gutter },
  row: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.gutter, paddingVertical: space.snug },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  name: { flex: 1, minWidth: 0 },
  title: { ...t.bodyLabel, color: color.foreground },
  price: { ...t.bodyLabel, color: color.primary, fontVariant: ["tabular-nums"] },
});
