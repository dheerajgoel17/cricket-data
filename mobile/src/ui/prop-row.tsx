/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { scopeTag } from "@cricket/engine/lines.js";
import { STATS } from "@cricket/engine/rules.js";
import { odds } from "@site/lib/format";
import type { Quote, Row } from "@/lib/hot";
import { openPlayer } from "@/lib/nav";
import { MiniBars } from "@/ui/mini-bars";
import { PlayerAvatar } from "@/ui/player-avatar";
import { ResultStamp, sideStamp } from "@/ui/result-stamp";
import { TeamBadge } from "@/ui/team-badge";
import { InPlayBadge } from "@/ui/live-bits";
import type { Standing } from "@/ui/tick";
import { color, control, figure, font, space, type } from "@/ui/tokens";

/**
 * Compact PropLines twin (native has no dense table): avatar · name · O/U sideLetter + price · Edge · MiniBars.
 * Not in XI / Score unavailable replace MiniBars. Match Live stays on fixtures; In Play Market = in-play line/odds.
 */
function PropRowView({ r, i, soFar, out, bars = true }: { r: Row; i: number; soFar: Standing | null; out: boolean; bars?: boolean }) {
  const label = (STATS as any)[r.stat]?.label as string;
  const inPlay = !out && r.quotes.some((q: Quote) => q.live);
  const under = r.side === "under";
  const sideLetter = under ? "U" : "O";
  const price = under ? r.under : r.over;
  const scope = (scopeTag as any)(r.fmt, r.inn) as string;
  const edgeColor = out || r.edge == null ? color["muted-foreground"] : r.edge > 0 ? color.primary : color.miss;
  const stamp = !out ? sideStamp(r.side, soFar?.verdict ?? null) : null;
  const scoreGap = !out && inPlay && (soFar == null || (soFar.v == null && soFar.state !== "void"));
  return (
    <View style={i > 0 ? styles.sep : undefined}>
      <Press
        scale={1}
        onPress={() => openPlayer(r)}
        accessibilityRole="link"
        accessibilityLabel={`${r.name}, ${sideLetter} ${r.line} ${label}${price > 1 ? `, ${odds(price)}` : ""}${r.edge != null ? `, edge ${(r.edge * 100).toFixed(0)}` : ""}`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <PlayerAvatar pid={r.pid} team={r.team} test={r.fmt === "Test"} size={control} />
        <View style={styles.main}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
            <TeamBadge name={r.team} size={18} bare />
            {inPlay ? <InPlayBadge /> : null}
          </View>
          {!out ? (
            <View style={styles.priceRow}>
              <Text style={styles.priceLine} numberOfLines={1}>
                <Text style={{ color: under ? color.miss : color.primary, fontFamily: font.bold }}>{sideLetter}</Text>
                {" "}
                <Text style={{ fontFamily: font.bold }}>{r.line}</Text>
                {" "}
                <Text style={{ fontFamily: font.medium }}>{label}{scope ? ` · ${scope}` : ""}</Text>
                {price > 1 ? <Text style={styles.odds}> {odds(price)}</Text> : null}
              </Text>
              {stamp ? <ResultStamp kind={stamp} /> : null}
            </View>
          ) : (
            <Text style={styles.outLine}>{r.line} <Text style={styles.outStat}>{label}</Text></Text>
          )}
        </View>
        {!out ? (
          <View style={styles.edge}>
            <Text style={styles.edgeLabel}>Edge</Text>
            <Text style={[styles.edgeValue, { color: edgeColor }]}>{r.edge == null ? "–" : `${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(0)}`}</Text>
          </View>
        ) : <View style={styles.edge} />}
        {out ? (
          <View style={styles.statusSlot}><Text style={styles.statusMark}>Not in XI</Text></View>
        ) : scoreGap ? (
          <View style={styles.statusSlot}><Text style={styles.statusMark}>Score unavailable</Text></View>
        ) : bars ? (
          <MiniBars last={r.last} line={r.line} max={r.max} width={72} />
        ) : (
          <View />
        )}
      </Press>
    </View>
  );
}

export const pct = (p: number | null) => (p == null ? "–" : `${Math.round(p * 100)}%`);

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.gutter, paddingVertical: space.snug },
  sep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  pressed: { backgroundColor: color["surface-hover"] },
  main: { flex: 1, minWidth: 0, gap: space.hair },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.tight },
  name: { ...type.body, fontFamily: font.bold, color: color.foreground, flexShrink: 1 },
  statusSlot: { width: 72, minHeight: 36, alignItems: "center", justifyContent: "center" },
  statusMark: { ...type.caption, fontFamily: font.medium, color: color["muted-foreground"], textAlign: "center", textTransform: "uppercase", letterSpacing: 0.4 },
  priceRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.hair, rowGap: 2 },
  priceLine: { ...type.callout, fontFamily: font.bold, color: color.foreground, flexShrink: 1 },
  odds: { fontFamily: font.dataLight, fontVariant: ["tabular-nums"], color: color["muted-foreground"] },
  outLine: { ...type.callout, fontFamily: font.dataLight, fontVariant: ["tabular-nums"], color: color["muted-foreground"] },
  outStat: { textTransform: "uppercase", letterSpacing: 0.4 },
  edge: { width: 44, alignItems: "center", gap: space.hair, paddingHorizontal: space.tight },
  edgeLabel: { ...type.caption, textTransform: "uppercase", letterSpacing: 0.4, color: color["muted-foreground"] },
  edgeValue: { ...figure },
});

type PropRowProps = Parameters<typeof PropRowView>[0];
/** Re-rendered only when its row, place, or the live standing on it changed. */
export const PropRow = memo(PropRowView, (a: PropRowProps, b: PropRowProps) => a.r === b.r && a.i === b.i && a.out === b.out && a.bars === b.bars && JSON.stringify(a.soFar) === JSON.stringify(b.soFar));
