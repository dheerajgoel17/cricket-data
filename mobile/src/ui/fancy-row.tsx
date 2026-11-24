/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { odds } from "@site/lib/format";
import { bookName } from "@cricket/engine/lines.js";
import { BookBadge } from "@/ui/book-badge";
import { Collapsible, TurnChevron } from "@/ui/collapsible";
import { MiniBars } from "@/ui/mini-bars";
import { FormChips } from "@/ui/recent-form";
import { ResultStamp, sideStamp } from "@/ui/result-stamp";
import { TeamBadge } from "@/ui/team-badge";
import { InPlayBadge } from "@/ui/live-bits";
import type { Standing } from "@/ui/tick";
import { color, control, figure, font, space, type, tint, t, d, w, icon } from "@/ui/tokens";

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

/** Toss rows (`kind: "toss"`, engine `tossRows`): the side's record against this opponent and at this ground, as the site's `tossSub`. */
const wonOf = (x: { won: number; n: number }) => `${x.won} of ${x.n}`;
export const tossSub = (r: any) => [r.vsOpp ? `vs ${r.vsOpp.opp} ${wonOf(r.vsOpp)}` : "", r.atGround ? `At ground ${wonOf(r.atGround)}` : ""].filter(Boolean).join(" · ");

/**
 * Scan list row (site OverviewRow / PropLines-compact twin): crest · label · one priced side · Edge · MiniBars.
 * `inset`: pad with card inset (Fancy MatchCard) instead of page gutter (full-bleed lists).
 */
export function OverviewRow({ r, onOpen, active, standing, sub, extra, inset, separated = true }: { r: any; onOpen?: () => void; active?: boolean; standing?: Standing | null; sub?: string; extra?: ReactNode; inset?: boolean; separated?: boolean }) {
  const under = r.side === "under";
  const lean = under ? "U" : "O";
  const leanLine = under && r.underLine != null ? r.underLine : r.overLine != null ? r.overLine : r.line;
  const price = under ? r.under : r.over;
  const mark = standing ?? r.standing;
  const stamp = sideStamp(r.side, mark?.verdict ?? null);
  const edgeColor = r.edge == null ? color["muted-foreground"] : r.edge > 0 ? color.primary : color.miss;
  const padX = inset ? space.inset : space.gutter;
  const toss = r.kind === "toss";
  const subText = sub ?? (toss ? tossSub(r) : undefined);
  return (
    <View style={[separated && styles.row, active && styles.active]}>
      <Press onPress={onOpen} disabled={!onOpen || !!r.static} accessibilityRole="button" accessibilityLabel={`Open ${r.label}`} style={[styles.main, { paddingHorizontal: padX }]}>
        {r.team
          ? <TeamBadge name={r.team} size={control} />
          : <View style={styles.icon} accessibilityElementsHidden><Ionicons name="stats-chart-outline" size={icon.md} color={color["muted-foreground"]} /></View>}
        <View style={styles.left}>
          <View style={styles.titleRow}>
            <Text style={styles.label} numberOfLines={1}>{r.label}</Text>
            {r.live ? <InPlayBadge /> : null}
          </View>
          {subText ? <Text style={styles.sub} numberOfLines={toss ? 2 : 1}>{subText}</Text> : null}
          {toss ? (
            <View style={styles.priceRow}>
              <Text style={styles.priceLine} numberOfLines={1}>{odds(r.over)}<Text style={styles.odds}>{` ${r.default ? "Default price" : bookName(r.overBook)}`}</Text></Text>
            </View>
          ) : mark?.state !== "void" ? (
            <View style={styles.priceRow}>
              <Text style={styles.priceLine} numberOfLines={1}>
                <Text style={{ color: under ? color.miss : color.primary }}>{lean}</Text>
                {" "}
                <Text>{leanLine}</Text>
                {typeof r.innScope === "string" && r.innScope ? <Text> {r.innScope}</Text> : null}
                {price > 1 ? <Text style={styles.odds}> {odds(price)}</Text> : null}
              </Text>
              {stamp ? <ResultStamp kind={stamp} /> : null}
            </View>
          ) : null}
        </View>
        {toss || mark?.state === "void" ? <View style={styles.edge} /> : (
          <View style={styles.edge}>
            <Text style={styles.edgeLabel}>Edge</Text>
            <Text style={[styles.edgeValue, { color: edgeColor }]}>{r.edge == null ? "–" : `${r.edge > 0 ? "+" : ""}${(r.edge * 100).toFixed(0)}`}</Text>
          </View>
        )}
        {toss ? (
          r.form?.length ? <FormChips compact results={r.form.slice(-5)} /> : <View style={styles.statusSlot}><Text style={styles.sub}>–</Text></View>
        ) : mark?.state === "void" ? (
          <View style={styles.statusSlot}><Text style={styles.voidMark}>VOID</Text></View>
        ) : (
          <MiniBars last={r.last} line={r.line} width={72} />
        )}
      </Press>
      {extra}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  active: { backgroundColor: color.card },
  main: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.gutter, paddingVertical: space.snug },
  icon: { width: control, height: control, borderRadius: control / 2, alignItems: "center", justifyContent: "center", backgroundColor: color.secondary },
  left: { flex: 1, minWidth: 0, gap: space.hair },
  // the name keeps its width and the tag ("In Play Market") drops to the next line when they do not fit, so the market is never cut to "25 o..."
  titleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.tight, rowGap: 2 },
  label: { ...t.bodyStrong, color: color.foreground, maxWidth: "100%" },
  sub: { ...type.footnote, color: color["muted-foreground"] },
  priceRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.hair, rowGap: 2 },
  priceLine: { ...t.calloutLabel, color: color.foreground, flexShrink: 1 },
  odds: { ...w.data, fontVariant: ["tabular-nums"], color: color["muted-foreground"] },
  edge: { width: 44, alignItems: "center", gap: space.hair, paddingHorizontal: space.tight },
  edgeLabel: { ...type.caption, textTransform: "uppercase", letterSpacing: 0.4, color: color["muted-foreground"] },
  edgeValue: { ...figure },
  statusSlot: { width: 72, minHeight: 36, alignItems: "center", justifyContent: "center" },
  voidMark: { ...type.caption, color: color.amber, borderWidth: StyleSheet.hairlineWidth, borderColor: tint.amber(0.6), borderStyle: "dashed", borderRadius: 4, paddingHorizontal: space.hair, overflow: "hidden" },
  moreBtn: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", paddingHorizontal: space.gutter },
  more: { ...t.footnoteLabel, color: color["muted-foreground"] },
  bookRow: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.gutter },
  bookPrice: { ...d.footnote, color: color["muted-foreground"] },
});
