/* eslint-disable @typescript-eslint/no-explicit-any */
import { StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import * as Haptics from "expo-haptics";
import { bookQuotes } from "@cricket/engine/lines.js";
import { nextMatchRates } from "@cricket/engine/next-match.js";
import { odds } from "@site/lib/format";
import { dayLabel, localTime } from "@/lib/format";
import { BookBadge } from "@/ui/book-badge";
import { DataTable } from "@/ui/data-table";
import { LiveDot } from "@/ui/motion";
import { StandingMark, Tick, type Standing } from "@/ui/tick";
import { TeamBadge } from "@/ui/team-badge";
import { cap, color, num, numLg, radius, space, type, tonal, font } from "@/ui/tokens";

export type NextInfo = { match: string; start: string; competition: string; team?: string; opp: string; ground: string; known?: string; priced?: boolean; phase?: "upcoming" | "live" | "final" };

/** When a match starts in the viewer's own zone: "10:30 AM" today, "Tomorrow 10:30 AM", else "Mon, 2 Nov 10:30 AM" (the site's `localWhen`). */
export function startText(iso: string, now = Date.now()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = dayLabel(d, now);
  return `${day === "Today" ? "" : `${day} `}${localTime(d)}`.trim();
}

/** A match's status beside a side's name: the start time while it is to come, a red pulsing LIVE while it is on, a muted COMPLETED once it is over (the site's `MatchStatus`). */
export function MatchStatus({ phase, start }: { phase: "upcoming" | "live" | "final"; start?: string }) {
  if (phase === "live") return <View style={styles.statusRow}><LiveDot /><Text style={[styles.cap, { color: color.destructive }]}>Live</Text></View>;
  if (phase === "final") return <Text style={styles.cap}>✓ Completed</Text>;
  return <Text style={styles.when}>{start ? startText(start) : ""}</Text>;
}

const tone = (p: number | null) => (p == null ? color["muted-foreground"] : p >= 0.6 ? color.primary : p <= 0.25 ? color.miss : color.foreground);

/** How he has gone over / under the line in one context (at this ground, against this side): the rate big, then hits of games and the fair decimal odds. */
function RateTile({ label, r, side, line }: { label: string; r: { p: number | null; hits: number; played: number; fair: number | null }; side: string; line: number }) {
  return (
    <View style={styles.tile} accessibilityLabel={`${label}: fair ${side} ${line}`}>
      <Text style={styles.cap} numberOfLines={1}>{label}</Text>
      {r.played < 1 ? <Text style={styles.noSample}>No data</Text> : (
        <>
          <Text style={[styles.tileNum, { color: tone(r.p) }]}>{r.p == null ? "–" : `${Math.round(r.p * 100)}%`}</Text>
          <Text style={styles.tileSub} numberOfLines={1}>{r.hits} of {r.played} · fair {odds(r.fair)}</Text>
        </>
      )}
    </View>
  );
}

/**
 * The match the player plays next (or is playing, or just played), in a container: who and when, the books' prices on this line, and how he has gone over / under it at that
 * ground and against that side, from the games on the chart (the site's `NextMatch`). A match that has started stays here with the listed line and whether it cleared.
 */
export function NextMatchCard({ next, entries, line, side, book, statLabel, standing, out }: {
  next: NextInfo; entries: any[]; line: number; side: string; book?: any; statLabel: string; fmt?: string; standing?: Standing | null; out?: boolean;
}) {
  const { here, versus } = nextMatchRates(entries, next, line, side);
  const bookAt = book?.lines?.find((l: any) => l.line === line) || null;
  const quotes: any[] = bookQuotes(bookAt ? [bookAt] : []);
  const best = bookAt ? Math.max(0, ...bookAt.books.map((b: any) => b[side] || 0)) : 0;
  const ground = next.ground.split(",")[0];
  const heading = next.phase && next.phase !== "upcoming" ? "This match" : "Next match";
  const sideLetter = side === "over" ? "O" : "U";
  const place = [next.ground, /[A-Za-z0-9]/.test(next.competition) ? next.competition : ""].filter(Boolean).join(" · ");
  return (
    <View style={[styles.card, out && { opacity: 0.6 }]}>
      <View style={styles.headRow}>
        <Text style={styles.cap}>{heading}</Text>
        <MatchStatus phase={next.phase || "upcoming"} start={next.start} />
      </View>
      <View style={styles.teams}>
        {next.team ? (
          <View style={styles.side}>
            <TeamBadge name={next.team} size={32} />
            <Text style={styles.opp} numberOfLines={1}>{next.team}</Text>
          </View>
        ) : null}
        {next.team && next.opp ? <Text style={styles.vs}>vs</Text> : null}
        {next.opp ? (
          <View style={styles.side}>
            <TeamBadge name={next.opp} size={32} />
            <Text style={styles.opp} numberOfLines={1}>{next.opp}</Text>
          </View>
        ) : <Text style={styles.opp} numberOfLines={1}>{next.match}</Text>}
        {out ? <Text style={styles.notIn}>Not in XI</Text> : null}
      </View>
      {place ? <Text style={styles.ground} numberOfLines={2}>{place}</Text> : null}

      <View style={styles.block}>
        <View style={styles.lineRow}>
          <Text style={styles.lineText}>{sideLetter} {line} <Text style={styles.statLabel}>{statLabel}</Text></Text>
          {standing != null ? <StandingMark standing={standing} line={line} /> : null}
          {best > 1 ? <View style={{ marginLeft: "auto" }}><Tick value={best} style={{ ...type.body, ...numLg, fontSize: 20, letterSpacing: -0.4, color: color.primary }}>{odds(best)}</Tick></View> : null}
        </View>
        {book ? (
          quotes.length ? (
            <DataTable columns={["Books", "Line", "Over", "Under"]} flex={[2, 1, 1, 1.4]}
              rows={quotes.map((q) => [<BookBadge key={q.source} source={q.source} />, String(q.line), odds(q.over), q.underAt ? `U ${q.underAt.line} ${odds(q.underAt.price)}` : odds(q.under)])} />
          ) : book.main && book.main.line !== line ? <Text style={styles.statLabel}>Books price {book.main.line} on this match, not {line}.</Text> : null
        ) : <Text style={styles.statLabel}>No book is offering {statLabel} on this match; the rates are from his history.</Text>}
      </View>

      <View style={styles.tiles}>
        {next.ground ? <RateTile label={`At ${ground}`} r={here} side={side} line={line} /> : null}
        {next.opp ? <RateTile label={`Vs ${next.opp}`} r={versus} side={side} line={line} /> : null}
      </View>
    </View>
  );
}

/** Quick picks inside Filters: only games against his next opponent, only games at its ground. */
export function NextFilters({ next, filters, onChange }: { next: NextInfo; filters: { opp?: string; venue?: string }; onChange: (patch: Record<string, string>) => void }) {
  const chips: [string, string, string][] = [];
  if (next.opp) chips.push(["opp", next.opp, `vs ${next.opp}`]);
  if (next.known) chips.push(["venue", next.known, `At ${next.ground.split(",")[0]}`]);
  if (!chips.length) return null;
  return (
    <View style={{ gap: space.snug }}>
      <Text style={styles.chartFilters}>This match</Text>
      <View style={styles.chipRow}>
        {chips.map(([k, v, label]) => {
          const on = (filters as any)[k] === v;
          return (
            <Press scale={1} key={k} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { void Haptics.selectionAsync(); onChange({ [k]: on ? "" : v }); }} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{on ? `${label} ✓` : `Only ${label}`}</Text>
            </Press>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...tonal, borderRadius: radius.card, padding: space.stack, gap: space.snug },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cap: { ...type.footnote, color: color["muted-foreground"], ...cap },
  when: { ...type.footnote, color: color["muted-foreground"], fontFamily: font.data, fontVariant: ["tabular-nums"] },
  statusRow: { flexDirection: "row", alignItems: "center", gap: space.tight },
  teams: { flexDirection: "row", alignItems: "center", gap: space.snug, flexWrap: "wrap" },
  side: { flexDirection: "row", alignItems: "center", gap: space.tight, flexShrink: 1, maxWidth: "46%" },
  vs: { ...type.footnote, color: color["muted-foreground"] },
  opp: { ...type.body, fontFamily: font.medium, color: color.foreground, flexShrink: 1 },
  notIn: { ...type.caption, color: color["muted-foreground"], borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderRadius: 999, paddingHorizontal: space.snug, paddingVertical: 1 },
  ground: { ...type.callout, color: color["muted-foreground"] },
  block: { gap: space.snug, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, paddingTop: space.snug },
  lineRow: { flexDirection: "row", alignItems: "center", gap: space.snug },
  lineText: { ...type.body, color: color.foreground, fontFamily: font.data, fontVariant: ["tabular-nums"] },
  statLabel: { ...type.callout, color: color["muted-foreground"] },
  tiles: { flexDirection: "row", gap: space.snug },
  tile: { flex: 1, minWidth: 0, backgroundColor: "rgba(44,44,46,0.6)", borderRadius: 14, padding: space.snug + 2, gap: 2 },
  tileNum: { ...numLg, fontSize: 30, letterSpacing: -0.6, lineHeight: 34 },
  tileSub: { ...type.footnote, color: color["muted-foreground"], fontFamily: font.data, fontVariant: ["tabular-nums"] },
  noSample: { ...type.callout, color: color["muted-foreground"], paddingTop: space.tight },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: space.snug },
  chartFilters: { ...type.footnote, color: color["muted-foreground"], ...cap },
  chip: { height: 34, paddingHorizontal: space.stack - 2, borderRadius: radius.chip, borderWidth: 1, borderColor: color.hairline, backgroundColor: "rgba(28,28,30,0.6)", alignItems: "center", justifyContent: "center" },
  chipOn: { backgroundColor: color.foreground },
  chipText: { ...type.callout, color: color.foreground },
  chipTextOn: { color: color.background },
});
