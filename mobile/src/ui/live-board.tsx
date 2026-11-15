/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ballsToOvers, formatBall, liveBoard, liveCard, namesMatch, ongoingOverBalls, oversToBalls } from "@cricket/engine/live.js";
import { abbr } from "@site/lib/format";
import { storeQuery } from "@/lib/data";
import { push } from "@/lib/nav";
import { Accordion } from "@/ui/accordion";
import { Bleed } from "@/ui/bleed";
import { Press } from "@/ui/press";
import { Segmented } from "@/ui/segmented";
import { Text } from "@/ui/text";
import { cap, color, font, num, radius, space, tint, type } from "@/ui/tokens";

type Side = [string, number];

/** Read-only peek — fixture page already runs useStore; do not start a second store load from scorecard links. */
const useStorePeek = () => useQuery({ ...storeQuery, enabled: false }).data;

/** Initial + surname for the live strip ("D Warner"); particles kept. */
function shortName(n: string) {
  const p = String(n).trim().split(/\s+/);
  if (p.length < 2) return n;
  const last = p[p.length - 1], particle = p[p.length - 2];
  const head = p[0][0]?.toUpperCase() || "";
  if (/^(de|den|van|von|el|al|la|le|da|di)$/i.test(particle)) return `${head} ${particle} ${last}`;
  return `${head} ${last}`;
}

function usePlayerIdx(name: string, team?: string, sides?: Side[]): number | null {
  const stats = useStorePeek();
  const rz: any = stats?.rz;
  const teamIdx = sides?.find(([n]) => n === team)?.[1];
  return useMemo(() => {
    if (!rz) return null;
    const hits = rz.players(name, teamIdx != null && teamIdx >= 0 ? { team: teamIdx } : {}, 2) as { idx: number; score: number }[];
    return hits.length && hits[0].score >= 8 ? hits[0].idx : null;
  }, [rz, name, teamIdx]);
}

function Who({ name, team, sides, short, strike, style }: { name: string; team?: string; sides?: Side[]; short?: boolean; strike?: boolean; style?: object }) {
  const idx = usePlayerIdx(name, team, sides);
  const text = (short ? shortName(name) : name) + (strike ? "*" : "");
  const t = <Text style={[styles.name, strike && { color: color.primary }, style]} numberOfLines={1}>{text}</Text>;
  return idx != null ? <Press scale={0.97} onPress={() => push(`/player/${idx}`)} accessibilityRole="link" accessibilityLabel={name}>{t}</Press> : t;
}

const ov = (p: any) => {
  const n = ballsToOvers(p?.ballsBowled);
  return n == null ? null : Number.isInteger(n) ? n.toFixed(1) : String(n);
};
const fmtOv = (o: number | null | undefined) => (o == null ? "—" : Number.isInteger(o) ? o.toFixed(1) : String(o));
const innScore = (inn: any) => (inn?.runs == null ? "" : `${inn.runs}${inn.wkts != null ? `/${inn.wkts}` : ""}${inn.overs != null ? ` ${fmtOv(inn.overs)} ov` : ""}`);

function ballTone(b: string): "wicket" | "boundary" | "extra" | "plain" {
  const s = formatBall(b);
  if (/^W$/i.test(s)) return "wicket";
  if (/^[456]$/.test(s)) return "boundary";
  if (/\d*(WD|NB|LB|B|PEN)$/i.test(s)) return "extra";
  return "plain";
}

/** One delivery chip — circular; extras use formatBall (NB / 1LB / WD). */
function Ball({ b }: { b: string }) {
  const label = formatBall(b);
  const tone = ballTone(label);
  const long = label.length > 1;
  const bg = tone === "wicket" ? "rgba(255,0,0,0.25)" : tone === "boundary" ? color.foreground : tone === "extra" ? color.muted : color.secondary;
  const fg = tone === "wicket" ? color.miss : tone === "boundary" ? color.background : color.foreground;
  return (
    <View style={[styles.ball, long && styles.ballLong, { backgroundColor: bg }]}>
      <Text style={[styles.ballText, { color: fg }]}>{label}</Text>
    </View>
  );
}

/**
 * Live strip under the scoreboard (site Hotstar-style): bowler O-R-W + ongoing over balls | batters with strike dot.
 * No faces, partnership, last wkt or CRR here — those stay off the strip.
 * `flat`: fixture flush shell — full-bleed border-t + secondary wash + gutter (web `bg-secondary/40 px-gutter`).
 */
export function LiveBoard({ match, teams, flat }: { match: any; teams?: Side[]; flat?: boolean }) {
  const board = liveBoard(match);
  if (!board || (!board.batters.length && !board.bowler && !board.overs.length)) return null;
  const bw = board.bowler;
  const balls = ongoingOverBalls(board);
  const batters = (board.batters || []).slice(0, 2);
  return (
    <View
      style={flat ? styles.stripFlat : [styles.strip, styles.stripCard]}
      accessibilityLabel="Live scoreboard"
    >
      <View style={[styles.stripCol, styles.stripLeft]}>
        {bw ? (
          <View style={styles.rowBetween}>
            <Who name={bw.name} team={bw.team} sides={teams} short style={styles.stripName} />
            <Text style={styles.figures}>{[ov(bw) ?? "–", bw.conceded ?? 0, bw.wickets ?? 0].join("-")}</Text>
          </View>
        ) : (
          <Text style={styles.muted}>—</Text>
        )}
        {balls.length ? (
          <View style={styles.balls} accessibilityLabel={`This over ${balls.join(" ")}`}>
            {balls.map((b: string, i: number) => <Ball key={`${b}-${i}`} b={b} />)}
          </View>
        ) : null}
      </View>
      <View style={styles.stripCol}>
        {batters.length ? batters.map((p: any) => (
          <View key={p.name} style={styles.rowBetween}>
            <View style={styles.batterName}>
              <View style={[styles.strikeDot, p.strike ? styles.strikeOn : null]} />
              <Who name={p.name} team={p.team} sides={teams} short style={styles.stripName} />
            </View>
            <Text style={styles.batFigs}>
              <Text style={styles.batRuns}>{p.runs ?? 0}</Text>
              {" "}
              <Text style={styles.muted}>{p.balls ?? 0}</Text>
            </Text>
          </View>
        )) : (
          <Text style={styles.muted}>—</Text>
        )}
      </View>
    </View>
  );
}

const ORD = ["1st", "2nd", "3rd", "4th"];
const cardInns = (match: any) => liveCard(match).filter((inn: any) => (inn.batters || []).length || (inn.bowlers || []).length || inn.runs != null);
const innId = (i: any) => `${i.n}-${i.team}`;
const innLabel = (card: any[], k: number) => {
  const team = card[k].team, nth = card.slice(0, k + 1).filter((i) => i.team === team).length;
  return card.some((i, j) => j !== k && i.team === team) ? `${abbr(team)} ${ORD[nth - 1] ?? `${nth}th`}` : abbr(team);
};
const extrasText = (e: any) => {
  const bits = ([["b", e.byes], ["lb", e.legByes], ["w", e.wides], ["nb", e.noBalls], ["pen", e.penalty]] as [string, number][]).filter(([, v]) => v);
  return bits.length ? bits.map(([k, v]) => `${k} ${v}`).join(", ") : "";
};

const BAT = { r: 34, b: 34, f: 30, s: 30, sr: 52 }, BOWL = { o: 40, m: 30, r: 36, w: 30, e: 52 };
const Cell = ({ w, children, strong }: { w: number; children: ReactNode; strong?: boolean }) => <Text style={[styles.cell, { width: w }, strong && { color: color.foreground }]}>{children}</Text>;

/**
 * Full scorecard: MarketTape-style segmented team categories → batting (bleed) → FOW / yet to bat → bowling.
 * No partnership / CRR strip (live strip only).
 */
function ScorecardBody({ match, teams }: { match: any; teams?: Side[] }) {
  const [pick, setPick] = useState<string>();
  const card = cardInns(match);
  if (!card.length) return null;
  const at = pick && card.some((i: any) => innId(i) === pick) ? card.findIndex((i: any) => innId(i) === pick) : card.length - 1;
  const inn = card[at];
  const balls = inn.overs != null ? oversToBalls(inn.overs) : null;
  const rr = inn.runs != null && balls ? (inn.runs / (balls / 6)).toFixed(2) : null;
  const onStrike = (name: string) => (match?.players || []).some((p: any) => p.strike && namesMatch(p.name, name));
  const yet: string[] = (inn.yetToBat || []).filter((n: string) => n && !/^[A-Z0-9]{1,4}$/.test(n));
  const multi = card.length > 1;
  const tabs = card.map((i: any, j: number) => [innId(i), `${innLabel(card, j)} · ${innScore(i) || "—"}`] as [string, string]);
  return (
    <View style={{ gap: space.snug, paddingBottom: space.snug }}>
      {multi ? (
        <Segmented items={tabs} value={innId(inn)} onChange={setPick} label="Innings" />
      ) : (
        <View style={styles.rowBetween}>
          <Text style={styles.innTitle} numberOfLines={1}>{inn.team || `Innings ${inn.n}`}</Text>
          <Text style={styles.innScore}>{innScore(inn) || "—"}{rr ? ` · RR ${rr}` : ""}</Text>
        </View>
      )}
      {multi && rr ? <Text style={styles.muted}>RR {rr}</Text> : null}

      {inn.batters?.length ? (
        <Bleed style={styles.tableBleed}>
          <View style={styles.th}><Text style={[styles.cap, { flex: 1 }]}>Batter</Text><Cell w={BAT.r}>R</Cell><Cell w={BAT.b}>B</Cell><Cell w={BAT.f}>4s</Cell><Cell w={BAT.s}>6s</Cell><Cell w={BAT.sr}>SR</Cell></View>
          {inn.batters.map((p: any) => (
            <View key={p.id || p.name} style={styles.tr}>
              <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                <Who name={p.name} team={p.team} sides={teams} strike={onStrike(p.name)} />
                <Text style={styles.muted} numberOfLines={1}>{p.dismissal || (p.out ? "out" : "not out")}</Text>
              </View>
              <Cell w={BAT.r} strong>{p.runs ?? 0}</Cell><Cell w={BAT.b}>{p.balls ?? 0}</Cell><Cell w={BAT.f}>{p.fours ?? 0}</Cell><Cell w={BAT.s}>{p.sixes ?? 0}</Cell><Cell w={BAT.sr}>{p.sr != null ? Number(p.sr).toFixed(2) : "—"}</Cell>
            </View>
          ))}
          {inn.extras ? <View style={styles.tr}><Text style={[styles.muted, { flex: 1 }]}>Extras{extrasText(inn.extras) ? ` (${extrasText(inn.extras)})` : ""}</Text><Cell w={BAT.r} strong>{inn.extras.total}</Cell></View> : null}
          {inn.runs != null ? <View style={styles.tr}><Text style={[styles.name, { flex: 1 }]}>Total</Text><Text style={styles.cell}>{inn.runs}{inn.wkts != null ? `/${inn.wkts}` : ""}{inn.overs != null ? ` · ${fmtOv(inn.overs)} ov` : ""}</Text></View> : null}
        </Bleed>
      ) : null}

      {inn.fow?.length ? (
        <Text style={styles.muted}><Text style={styles.strongMuted}>FOW </Text>{inn.fow.map((w: any, k: number) => `${k > 0 ? " · " : ""}${w.wkts}–${w.runs} (${w.name}${w.balls != null ? `, ${fmtOv(ballsToOvers(w.balls))}` : ""})`).join("")}</Text>
      ) : null}
      {yet.length ? (
        <Text style={styles.muted}><Text style={styles.strongMuted}>Yet to bat </Text>{yet.map((n, k) => <Fragment key={n}>{k > 0 ? ", " : ""}{n}</Fragment>)}</Text>
      ) : null}

      {inn.bowlers?.length ? (
        <View style={{ gap: space.tight }}>
          <Text style={styles.bowlHead}>Bowling</Text>
          <Bleed style={styles.tableBleed}>
            <View style={styles.th}><Text style={[styles.cap, { flex: 1 }]}>Bowler</Text><Cell w={BOWL.o}>O</Cell><Cell w={BOWL.m}>M</Cell><Cell w={BOWL.r}>R</Cell><Cell w={BOWL.w}>W</Cell><Cell w={BOWL.e}>Econ</Cell></View>
            {inn.bowlers.map((p: any) => (
              <View key={p.id || p.name} style={styles.tr}>
                <View style={{ flex: 1, minWidth: 0 }}><Who name={p.name} team={p.team} sides={teams} /></View>
                <Cell w={BOWL.o}>{fmtOv(p.overs)}</Cell><Cell w={BOWL.m}>{p.maidens ?? 0}</Cell><Cell w={BOWL.r}>{p.conceded ?? 0}</Cell><Cell w={BOWL.w} strong>{p.wickets ?? 0}</Cell><Cell w={BOWL.e}>{p.econ != null ? Number(p.econ).toFixed(2) : "—"}</Cell>
              </View>
            ))}
          </Bleed>
        </View>
      ) : null}
      <Text style={styles.muted}>So far this match. Not used for settlement.</Text>
    </View>
  );
}

/** Header + Hotstar live strip + Full scorecard in place (site ScorecardCard). Lives inside fixture `scoreShell`. */
export function ScorecardCard({ match, teams, header }: { match: any; teams?: Side[]; header: ReactNode }) {
  const [open, setOpen] = useState(false);
  const full = cardInns(match).length > 0;
  const board = liveBoard(match);
  const strip = !!board && (!!board.batters.length || !!board.bowler || !!board.overs.length);
  return (
    <View style={styles.cardBox} accessibilityLabel="Scorecard">
      {header}
      {strip ? <LiveBoard match={match} teams={teams} flat /> : null}
      {full ? (
        <>
          <Press scale={1} onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.fullRow}>
            <Ionicons name="grid-outline" size={18} color={color["muted-foreground"]} />
            <Text style={styles.fullText}>{open ? "Hide scorecard" : "Full scorecard"}</Text>
            <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={color["muted-foreground"]} />
          </Press>
          {open ? (
            <View style={styles.fullBody}>
              <ScorecardBody match={match} teams={teams} />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/** Scorecard accordion for finished / non-live matches — lives inside fixture `scoreShell` (`flush`). Form stays a web-only tab. */
export function MatchAccordions({ match, teams, noCard }: { match?: any; teams: Side[]; noCard?: boolean }) {
  const card = match && !noCard ? cardInns(match) : [];
  if (!card.length) return null;
  const last = card[card.length - 1];
  return (
    <Accordion flush title="Scorecard" right={<Text style={styles.sum} numberOfLines={1}>{last.team} {innScore(last)}</Text>}>
      <View style={styles.fullBody}>
        <ScorecardBody match={match} teams={teams} />
      </View>
    </Accordion>
  );
}

const styles = StyleSheet.create({
  name: { ...type.callout, fontFamily: font.medium, color: color.foreground },
  cap: { ...type.caption, ...cap, color: color["muted-foreground"] },
  muted: { ...type.footnote, color: color["muted-foreground"] },
  strongMuted: { fontFamily: font.medium, color: color.foreground },
  cardBox: {},
  fullRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.tight,
    minHeight: 44,
    paddingHorizontal: space.gutter,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
  },
  fullBody: { paddingHorizontal: space.gutter, paddingBottom: space.snug },
  fullText: { ...type.callout, fontFamily: font.medium, color: color.foreground, flex: 1 },
  strip: {
    flexDirection: "row",
    gap: space.snug,
    paddingVertical: space.snug,
    backgroundColor: tint.hex(color.secondary, 0.4),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
  },
  /** Fixture flush path — full width of scoreShell; content guttered (web twin). */
  stripFlat: {
    flexDirection: "row",
    gap: space.snug,
    paddingVertical: space.snug,
    paddingHorizontal: space.gutter,
    backgroundColor: tint.hex(color.secondary, 0.4),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.hairline,
  },
  stripCard: { marginHorizontal: space.gutter, borderRadius: radius.card, paddingHorizontal: space.inset },
  stripCol: { flex: 1, minWidth: 0, gap: space.tight },
  stripLeft: { borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: color.hairline, paddingRight: space.snug },
  stripName: { ...type.callout, flexShrink: 1 },
  figures: { ...num, fontSize: 14, color: color["muted-foreground"], fontFamily: font.data },
  balls: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  ball: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  ballLong: { minWidth: 28, paddingHorizontal: 6, width: undefined },
  ballText: { ...num, fontSize: 11, fontFamily: font.data },
  batterName: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1, minWidth: 0 },
  strikeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "transparent" },
  strikeOn: { backgroundColor: color.foreground },
  batFigs: { ...num, fontSize: 14 },
  batRuns: { fontFamily: font.data, color: color.foreground },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.snug },
  innTitle: { ...type.body, fontFamily: font.bold, color: color.foreground, flex: 1 },
  innScore: { ...num, fontSize: 18, color: color.foreground },
  bowlHead: { ...cap, color: color["muted-foreground"] },
  tableBleed: { paddingVertical: 0 },
  th: { flexDirection: "row", alignItems: "center", paddingVertical: space.tight },
  tr: { flexDirection: "row", alignItems: "center", gap: 0, minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, paddingVertical: space.tight },
  cell: { ...num, fontSize: 14, color: color["muted-foreground"], textAlign: "right" },
  sum: { ...type.callout, color: color["muted-foreground"], maxWidth: "60%", fontFamily: font.data, fontVariant: ["tabular-nums"] },
});
