/* eslint-disable @typescript-eslint/no-explicit-any */
import { StyleSheet, View } from "react-native";
import { Text } from "@/ui/text";
import { odds } from "@site/lib/format";
import { BookBadge } from "@/ui/book-badge";
import { LiveBadge } from "@/ui/live-bits";
import { color, font, num, numLg, space, type } from "@/ui/tokens";

/** One live market of the Match Fancy list (`liveRows`): an over / under line with both prices, or a pick with its outcomes. Prices only, no history, as on the site. */
export function LiveMarketRow({ m }: { m: any }) {
  return (
    <View style={styles.row}>
      <View style={styles.title}>
        <Text style={styles.name} numberOfLines={2}>{m.market}</Text>
        <LiveBadge />
        {m.book ? <BookBadge source={m.book} /> : null}
      </View>
      {m.kind === "ou" ? (
        <View style={styles.prices}>
          <Text style={styles.hero}>O/U {m.line}</Text>
          <Text style={styles.side}>O <Text style={styles.price}>{odds(m.over)}</Text></Text>
          <Text style={styles.side}>U <Text style={styles.price}>{odds(m.under)}</Text></Text>
        </View>
      ) : (
        <View style={styles.prices}>
          {(m.outcomes || []).map((o: any) => (
            <Text key={`${o.label}|${o.sub || ""}`} style={styles.side}>{o.label}{o.sub ? ` (${o.sub})` : ""} <Text style={styles.price}>{odds(o.price)}</Text></Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: space.gutter, paddingVertical: space.snug + 2, gap: 3 },
  title: { flexDirection: "row", alignItems: "baseline", gap: space.tight },
  name: { ...type.body, fontFamily: font.medium, color: color.foreground, flexShrink: 1 },
  prices: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: space.snug, rowGap: 2 },
  hero: { ...numLg, fontSize: 22, letterSpacing: -0.4, lineHeight: 24, color: color.foreground },
  side: { ...type.callout, ...num, color: color["muted-foreground"] },
  price: { ...type.callout, ...num, fontSize: 15, color: color.foreground },
});
