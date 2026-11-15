import { useId, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import * as Haptics from "expo-haptics";
import { odds } from "@site/lib/format";
import { BookBadge } from "@/ui/book-badge";
import { ChevronDown } from "@/ui/icons";
import { cap, color, font, space, type } from "@/ui/tokens";

type Priced = { source: string; over: number | null; under: number | null };

/** The books that are not already shown up front (`shown`: their sources) for one line — "+N books" toggle (web `BookTable` twin). */
export function BookTable({ books, shown }: { books: Priced[]; shown: (string | undefined)[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rest = books.filter((b) => !shown.includes(b.source));
  if (!rest.length) return null;
  return (
    <View style={styles.wrap} nativeID={id}>
      <Press
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? "Hide extra books" : `Show ${rest.length} more books`}
        onPress={() => { void Haptics.selectionAsync(); setOpen((v) => !v); }}
        style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.toggleText}>{open ? "Hide" : `+${rest.length} book${rest.length > 1 ? "s" : ""}`}</Text>
        <View style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}>
          <ChevronDown size={14} color={color["muted-foreground"]} />
        </View>
      </Press>
      {open ? (
        <View style={styles.table}>
          <View style={styles.head}>
            <Text style={[styles.headCell, styles.bookCol]}>Book</Text>
            <Text style={styles.headCell}>Over</Text>
            <Text style={styles.headCell}>Under</Text>
          </View>
          {rest.map((b) => (
            <View key={b.source} style={styles.row}>
              <View style={styles.bookCol}><BookBadge source={b.source} /></View>
              <Text style={styles.price}>{odds(b.over)}</Text>
              <Text style={styles.price}>{odds(b.under)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", paddingHorizontal: space.tight, borderRadius: 999 },
  toggleText: { ...type.footnote, fontFamily: font.medium, color: color["text-soft"] },
  table: { maxWidth: 320 },
  head: { flexDirection: "row", alignItems: "center", gap: space.snug },
  headCell: { ...type.footnote, ...cap, fontFamily: font.medium, color: color["muted-foreground"], width: 52, textAlign: "right" },
  bookCol: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingVertical: 2 },
  price: { ...type.footnote, fontFamily: font.dataLight, width: 52, textAlign: "right", color: color["muted-foreground"], fontVariant: ["tabular-nums"] },
});
