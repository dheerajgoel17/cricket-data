import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/text";
import { odds } from "@site/lib/format";
import { BookBadge } from "@/ui/book-badge";
import { Tick } from "@/ui/tick";
import { color, font, space, type, dStrong } from "@/ui/tokens";

export type LadderBook = { source: string; over: number | null; under: number | null };
export type LadderPriced = {
  line: number;
  over: number | null;
  under: number | null;
  books: LadderBook[];
};

/** Best book for one side at a line: price + that book's mark (web `SideBook` twin). */
export function SideBook({ priced, side }: { priced?: LadderPriced | null; side: "over" | "under" }) {
  const face = priced?.[side] != null ? priced.books.find((x) => x[side] === priced[side]) : null;
  const p = face?.[side] ?? null;
  if (p == null) return <Text style={styles.empty}>—</Text>;
  return (
    <View style={styles.row}>
      <Tick value={p} style={styles.price}>{odds(p)}</Tick>
      <BookBadge source={face!.source} />
    </View>
  );
}

/** Face best over/under prices from a player book line (`books` at one line). */
export function pricedFromBooks(line: number, books: LadderBook[]): LadderPriced {
  const over = Math.max(0, ...books.map((b) => b.over || 0)) || null;
  const under = Math.max(0, ...books.map((b) => b.under || 0)) || null;
  return { line, over: over && over > 1 ? over : null, under: under && under > 1 ? under : null, books };
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.tight, maxWidth: "100%", overflow: "hidden" },
  price: { ...dStrong.body, color: color.primary, flexShrink: 0 },
  empty: { ...type.footnote, color: color["muted-foreground"] },
});
