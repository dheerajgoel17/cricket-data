/* eslint-disable @typescript-eslint/no-explicit-any */
import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { Image } from "expo-image";
import Animated from "react-native-reanimated";
import { SCOPE_LABEL } from "@cricket/engine/lines.js";
import { STATS } from "@cricket/engine/rules.js";
import { flagUrl } from "@site/lib/assets";
import { odds } from "@site/lib/format";
import type { Quote, Row } from "@/lib/hot";
import { openPlayer } from "@/lib/nav";
import { MiniBars } from "@/ui/mini-bars";
import { enter } from "@/ui/motion";
import { PlayerAvatar } from "@/ui/player-avatar";
import { StandingMark, Tick, type Standing } from "@/ui/tick";
import { cap, color, font, num, space, type } from "@/ui/tokens";

const pct = (p: number | null) => (p == null ? "–" : `${Math.round(p * 100)}%`);

function TeamFlag({ name }: { name: string }) {
  const uri = flagUrl(name, 80);
  return uri ? <Image source={{ uri }} style={styles.flag} contentFit="cover" accessibilityLabel={name} /> : null;
}

/** The line's best price, in the accent colour when it is the best among the books (it moves with a flash); the under when that is all the books list. */
function BestPrice({ quotes, price }: { quotes: Quote[]; price: number }) {
  const top = quotes.find((q) => q.best) ?? quotes[0];
  if (!top) return price > 1 ? <Text style={styles.price}>{odds(price)}</Text> : null;
  return top.over != null
    ? <Tick value={top.over} style={{ ...type.callout, ...num, fontSize: 16, color: top.best ? color.primary : color.foreground }}>{odds(top.over)}</Tick>
    : <Text style={styles.price}>{`U ${top.line} ${odds(top.under)}`}</Text>;
}

/** One priced line, compact as in the reference app: the player in his team's shirt; his name and flag; the line, stat and best price; how often he cleared it; and on the right the edge over the books with the last games as bars. */
export function PropRow({ r, i, soFar, out }: { r: Row; i: number; soFar: Standing | null; out: boolean }) {
  const label = (STATS as any)[r.stat]?.label;
  const edgeColor = r.edge == null ? color["muted-foreground"] : r.edge > 0 ? color.primary : color.miss;
  return (
    <Animated.View entering={i < 8 ? enter(i) : undefined}>
      <Press scale={1} onPress={() => openPlayer(r)} accessibilityRole="link" accessibilityLabel={`${r.name}, over ${r.line} ${label}${r.over > 1 ? `, best price ${odds(r.over)}` : ""}`} style={({ pressed }) => [styles.row, i > 0 && styles.sep, out && styles.out, pressed && styles.pressed]}>
        <PlayerAvatar pid={r.pid} team={r.team} test={r.fmt === "Test"} size={44} />
        <View style={styles.main}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
            <TeamFlag name={r.team} />
            {out ? <Text style={styles.notIn}>Not in XI</Text> : null}
          </View>
          <View style={styles.descRow}>
            <Text style={styles.desc}>
              <Text style={styles.line}>O {r.line} </Text>
              {label}{r.inn ? ` · ${(SCOPE_LABEL as any)[r.inn]}` : ""}
            </Text>
            <BestPrice quotes={r.quotes} price={r.over} />
            {soFar ? <StandingMark standing={soFar} line={r.line} /> : null}
          </View>
        </View>
        <View style={styles.side}>
          <View style={styles.edge}>
            <Text style={styles.edgeLabel}>Edge</Text>
            <Text style={[styles.edgeValue, { color: edgeColor }]}>{r.edge == null ? "–" : `${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(0)}%`}</Text>
          </View>
          <MiniBars last={r.last} line={r.line} max={r.max} width={76} />
        </View>
      </Press>
    </Animated.View>
  );
}

export { pct };

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.gutter, paddingVertical: space.snug },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  out: { opacity: 0.6 },
  pressed: { backgroundColor: color.card },
  main: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.tight },
  name: { ...type.body, fontSize: 15, fontFamily: font.medium, color: color.foreground, flexShrink: 1 },
  flag: { width: 20, height: 14, borderRadius: 3 },
  notIn: { ...type.caption, color: color["muted-foreground"], borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderRadius: 999, paddingHorizontal: space.snug, paddingVertical: 1 },
  descRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.snug, rowGap: 2 },
  desc: { ...type.callout, color: color["muted-foreground"] },
  line: { color: color.foreground, fontFamily: font.medium },
  price: { ...type.callout, ...num, fontSize: 15, color: color.foreground },
  side: { flexDirection: "row", alignItems: "center", gap: space.snug },
  edge: { alignItems: "flex-end", minWidth: 46 },
  edgeLabel: { ...type.caption, ...cap, color: color["muted-foreground"] },
  edgeValue: { ...num, fontSize: 20, lineHeight: 22 },
});
