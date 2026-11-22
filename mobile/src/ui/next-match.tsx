/* eslint-disable @typescript-eslint/no-explicit-any */
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { push, fixturePath } from "@/lib/nav";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import * as Haptics from "expo-haptics";
import { nextMatchRates } from "@cricket/engine/next-match.js";
import { abbr, odds } from "@site/lib/format";
import { dayLabel, localTime } from "@/lib/format";
import { ChoiceChip, ChoiceRow } from "@/ui/chips";
import { StatusLabel } from "@/ui/status-label";
import { StandingMark, type Standing } from "@/ui/tick";
import { TeamBadge } from "@/ui/team-badge";
import { cap, color, icon, numLg, radius, space, type, fs, surface, t, d, state } from "@/ui/tokens";

export type NextInfo = { match: string; start: string; competition: string; team?: string; opp: string; ground: string; known?: string; priced?: boolean; phase?: "upcoming" | "live" | "final"; id?: string };

/** When a match starts in the viewer's own zone: "10:30 AM" today, "Tomorrow 10:30 AM", else "Mon, 2 Nov 10:30 AM" (the site's `localWhen`). */
export function startText(iso: string, now = Date.now()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = dayLabel(d, now);
  return `${day === "Today" ? "" : `${day} `}${localTime(d)}`.trim();
}

/** A match's status beside a side's name (site MatchStatus / StatusLabel). */
export function MatchStatus({ phase, start }: { phase: "upcoming" | "live" | "final"; start?: string }) {
  if (phase === "live") return <StatusLabel tone="live" surface="dot" />;
  if (phase === "final") return <StatusLabel tone="muted" surface="plain">Completed</StatusLabel>;
  return <Text style={styles.when}>{start ? startText(start) : ""}</Text>;
}

const tone = (p: number | null) => (p == null ? color["muted-foreground"] : p >= 0.6 ? color.primary : p <= 0.25 ? color.miss : color.foreground);

/** How he has gone over / under the line in one context (at this ground, against this side): the rate big, then hits of games and the fair decimal odds. */
function RateTile({ label, r, side, line, flat }: { label: string; r: { p: number | null; hits: number; played: number; fair: number | null }; side: string; line: number; flat?: boolean }) {
  return (
    <View style={[styles.tile, flat && styles.tileFlat]} accessibilityLabel={`${label}: fair ${side} ${line}`}>
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

/** "29 Oct · 3:00 PM" in the viewer's zone (the date alone when the schedule has no time yet). */
export function whenLabel(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return String(iso).length > 10 ? `${day} · ${localTime(d)}` : day;
}

/**
 * The match card on the player page (the site's `NextMatch`): his side vs the opponent, then Live / Completed, or the date, time and ground.
 * The line's standing sits under it; the ground and opponent history is `MatchupRates`.
 */
export function NextMatchCard({ next, line, side, book, statLabel, standing, out }: {
  next: NextInfo; line: number; side: string; book?: any; statLabel: string; fmt?: string; standing?: Standing | null; out?: boolean; entries?: any[];
}) {
  const upcoming = !next.phase || next.phase === "upcoming";
  const when = upcoming ? whenLabel(next.start) : "";
  const sideLetter = side === "over" ? "O" : "U";
  const body = (
    <>
      <View style={styles.teams}>
        {next.opp ? <TeamBadge name={next.opp} size={icon.lg} /> : null}
        <Text style={styles.opp} numberOfLines={1}>
          {next.opp ? <><Text style={styles.vs}>vs </Text>{abbr(next.opp)}</> : next.match}
        </Text>
        <View style={styles.matchMeta}>
          {out ? <Text style={styles.notIn}>Not in XI</Text> : null}
          {upcoming ? (when ? <Text style={styles.when} numberOfLines={1}>{when}</Text> : null) : <MatchStatus phase={next.phase!} />}
          {next.id ? <Ionicons name="chevron-forward" size={icon.sm} color={color["muted-foreground"]} /> : null}
        </View>
      </View>
      {book && standing != null ? (
        <View style={styles.lineRow}>
          <Text style={styles.lineText}>{sideLetter} {line}</Text>
          <StandingMark standing={standing} line={line} />
        </View>
      ) : null}
      {!book ? <Text style={styles.statLabel}>No book is offering {statLabel} on this match; the rates are from his history.</Text> : null}
    </>
  );
  // the whole card is the link, not just its first row
  if (!next.id) return <View style={[styles.card, out && state.dim]} accessibilityLabel={upcoming ? "Next match" : "This match"}>{body}</View>;
  return (
    <Press scale={1} onPress={() => push(fixturePath(next.id!))} accessibilityRole="link" accessibilityLabel={`Open match: ${next.match}`} style={({ pressed }) => [styles.card, out && state.dim, pressed && state.pressed]}>
      {body}
    </Press>
  );
}

/**
 * How he has gone over / under the chart's line at this ground and against this side (history, never prices). Standalone it is its own section;
 * `inline` is just the two tiles, for the last row of the hit-rate / book-lane table above it.
 */
export function MatchupRates({ next, entries, line, side, inline }: { next: NextInfo; entries: any[]; line: number; side: string; inline?: boolean }) {
  if (!next.ground && !next.opp) return null;
  const { here, versus } = nextMatchRates(entries, next, line, side);
  const ground = next.ground.split(",")[0];
  const tiles = (
    <View style={styles.tiles}>
      {next.ground ? <RateTile label={`At ${ground}`} r={here} side={side} line={line} flat={inline} /> : null}
      {next.opp ? <RateTile label={`Vs ${next.opp}`} r={versus} side={side} line={line} flat={inline} /> : null}
    </View>
  );
  if (inline) return tiles;
  return (
    <View style={{ gap: space.snug }}>
      <Text style={styles.cap}>{side === "over" ? "Over" : "Under"} {line} · history</Text>
      {tiles}
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
      <ChoiceRow>
        {chips.map(([k, v, label]) => {
          const on = (filters as any)[k] === v;
          return (
            <ChoiceChip key={k} label={on ? `${label} ✓` : `Only ${label}`} on={on} onPress={() => { void Haptics.selectionAsync(); onChange({ [k]: on ? "" : v }); }} />
          );
        })}
      </ChoiceRow>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...surface.card, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, paddingHorizontal: space.gutter, paddingVertical: space.snug, gap: space.tight },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cap: { ...type.footnote, color: color["muted-foreground"], ...cap },
  when: { ...d.footnote, color: color["muted-foreground"] },
  teams: { flexDirection: "row", alignItems: "center", gap: space.tight },
  matchMeta: { flexShrink: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: space.tight },
  vs: { ...type.footnote, color: color["muted-foreground"] },
  opp: { ...t.bodyLabel, color: color.foreground, flex: 1, minWidth: 0 },
  notIn: { ...type.caption, color: color["muted-foreground"], borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderRadius: 999, paddingHorizontal: space.snug, paddingVertical: 1 },
  ground: { ...type.callout, color: color["muted-foreground"] },
  lineRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space.snug, rowGap: space.tight, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, paddingTop: space.tight },
  lineText: { ...d.body, color: color.foreground },
  statLabel: { ...type.callout, color: color["muted-foreground"] },
  tiles: { flexDirection: "row", gap: space.snug },
  tileFlat: { borderWidth: 0, borderRadius: 0, paddingHorizontal: space.snug, paddingVertical: space.snug },
  tile: { flex: 1, minWidth: 0, borderWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, borderRadius: radius.card, padding: space.snug + 2, gap: 2 },
  tileNum: { ...numLg, fontSize: fs.stat, letterSpacing: -0.6, lineHeight: 34 },
  tileSub: { ...d.footnote, color: color["muted-foreground"] },
  noSample: { ...type.callout, color: color["muted-foreground"], paddingTop: space.tight },
  chartFilters: { ...type.footnote, color: color["muted-foreground"], ...cap },
});
