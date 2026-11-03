/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ballsToOvers, liveBoard, liveCard, namesMatch, oversToBalls } from "@cricket/engine/live.js";
import { abbr } from "@site/lib/format";
import { storeQuery } from "@/lib/data";
import { push } from "@/lib/nav";
import { Accordion } from "@/ui/accordion";
import { PlayerAvatar } from "@/ui/player-avatar";
import { Press } from "@/ui/press";
import { RecentForm, FormHeadline } from "@/ui/recent-form";
import { Segmented } from "@/ui/segmented";
import { Text } from "@/ui/text";
import { cap, color, font, num, numLg, radius, space, tonal, type } from "@/ui/tokens";
import { recentForms } from "@/lib/form";

type Side = [string, number];

/** "Smith" for "Jason Smith"; "van der Dussen" keeps its particle. */
function shortName(n: string) {
  const p = String(n).trim().split(/\s+/);
  if (p.length < 2) return n;
  const last = p[p.length - 1], particle = p[p.length - 2];
  return /^(de|den|van|von|el|al|la|le|da|di)$/i.test(particle) ? `${particle} ${last}` : last;
}

/** Who a live feed's name is in the data: the resolver, within the side when it is known; a name it is not sure of (a debutant) stays plain text. */
function usePlayerIdx(name: string, team?: string, sides?: Side[]): number | null {
  const stats = useQuery(storeQuery);
  const rz: any = stats.data?.rz;
  const teamIdx = sides?.find(([n]) => n === team)?.[1];
  return useMemo(() => {
    if (!rz) return null;
    const hits = rz.players(name, teamIdx != null && teamIdx >= 0 ? { team: teamIdx } : {}, 2) as { idx: number; score: number }[];
    return hits.length && hits[0].score >= 8 ? hits[0].idx : null;
  }, [rz, name, teamIdx]);
}

/** A face: the player's picture in his team's shirt when he is in the data, else the feed's own photo, else a silhouette. */
function Face({ name, photo, team, sides, size = 36 }: { name: string; photo?: string; team?: string; sides?: Side[]; size?: number }) {
  const idx = usePlayerIdx(name, team, sides);
  const stats = useQuery(storeQuery);
  const store: any = stats.data?.store;
  if (idx != null && store) return <PlayerAvatar pid={store.P.id[idx]} team={team ?? store.teamName(store.P.tm[idx])} size={size} />;
  return (
    <View style={[styles.face, { width: size, height: size, borderRadius: size / 2 }]}>
      {photo ? <Image source={{ uri: photo }} style={{ width: size, height: size }} contentFit="cover" contentPosition="top" /> : <Ionicons name="person" size={size * 0.55} color="rgba(142,142,147,0.5)" />}
    </View>
  );
}

/** A name that opens the player's page when he is in the data; the striker carries a green star. */
function Who({ name, team, sides, strike, short, style }: { name: string; team?: string; sides?: Side[]; strike?: boolean; short?: boolean; style?: object }) {
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

/** One delivery: a wicket in red, a boundary in green, the rest neutral. */
function Ball({ b }: { b: string }) {
  const w = /w/i.test(b), four = /[456]/.test(b);
  return <View style={[styles.ball, { backgroundColor: w ? "rgba(255,0,0,0.2)" : four ? "rgba(39,218,142,0.2)" : color.secondary }]}><Text style={[styles.ballText, { color: w ? color.miss : four ? color.primary : color.foreground }]}>{b}</Text></View>;
}

/** The last six deliveries in one row (the over in progress, and the end of the one before when it has just begun), with a thin line where an over ends. */
function Overs({ overs }: { overs: { balls: string[] }[] }) {
  const flat = (overs || []).filter((o) => o.balls.length).flatMap((o, over) => o.balls.map((b) => ({ b, over }))).slice(-6);
  if (!flat.length) return null;
  return (
    <View style={styles.overs} accessibilityLabel={`Last deliveries ${flat.map((x) => x.b).join(" ")}`}>
      {flat.map((x, i) => (
        <View key={i} style={styles.overGroup}>
          {i > 0 && x.over !== flat[i - 1].over ? <View style={styles.overBreak} /> : null}
          <Ball b={x.b} />
        </View>
      ))}
    </View>
  );
}

function BatterEnd({ p, sides, mirror }: { p: any; sides?: Side[]; mirror?: boolean }) {
  return (
    <View style={[styles.end, mirror && { flexDirection: "row-reverse" }]}>
      <Face name={p.name} photo={p.photo} team={p.team} sides={sides} size={38} />
      <View style={[styles.endText, mirror && { alignItems: "flex-end" }]}>
        <Who name={p.name} team={p.team} sides={sides} strike={!!p.strike} short />
        <Text style={styles.endScore}><Text style={styles.endRuns}>{p.runs ?? 0}</Text> ({p.balls ?? 0})</Text>
      </View>
    </View>
  );
}

function Stat({ k, v }: { k: string; v: ReactNode }) {
  return <View style={{ alignItems: "flex-end", gap: 2 }}><Text style={styles.cap}>{k}</Text><Text style={styles.statV}>{v}</Text></View>;
}

/** The match as it stands: the pair at the crease with their partnership, the last wicket, the bowler, this over's deliveries and the run rates. So far only, never used for settlement. */
export function LiveBoard({ match, teams }: { match: any; teams?: Side[] }) {
  const board = liveBoard(match);
  if (!board) return null;
  const bowlOv = ov(board.bowler);
  return (
    <View style={[styles.board, tonal, { borderRadius: radius.card }]} accessibilityLabel="Live scoreboard">
      {board.batters[0] ? (
        <View style={styles.pair}>
          <BatterEnd p={board.batters[0]} sides={teams} />
          <View style={styles.ship}>
            <Text style={styles.cap}>P’ship</Text>
            <Text style={styles.shipV}>{board.partnership ? board.partnership.runs ?? 0 : "—"}{board.partnership ? <Text style={styles.shipB}> ({board.partnership.balls ?? 0})</Text> : null}</Text>
          </View>
          {board.batters[1] ? <BatterEnd p={board.batters[1]} sides={teams} mirror /> : <View style={{ flex: 1 }} />}
        </View>
      ) : null}
      {board.lastWicket ? (
        <View style={styles.rowBetween}>
          <Text style={styles.muted}>Last wkt</Text>
          <View style={{ flexDirection: "row", gap: 4, flexShrink: 1 }}><Who name={board.lastWicket.name} team={board.lastWicket.team} sides={teams} style={{ fontSize: 12, lineHeight: 16 }} /><Text style={styles.muted}>{board.lastWicket.runs ?? 0}({board.lastWicket.balls ?? 0})</Text></View>
        </View>
      ) : null}
      {board.bowler ? (
        <View style={styles.bowler}>
          <Face name={board.bowler.name} photo={board.bowler.photo} team={board.bowler.team} sides={teams} size={32} />
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}><Who name={board.bowler.name} team={board.bowler.team} sides={teams} /><Text style={styles.muted}>Bowling</Text></View>
          <Stat k="W-R" v={`${board.bowler.wickets ?? 0}–${board.bowler.conceded ?? 0}`} />
          <Stat k="Overs" v={bowlOv ?? "—"} />
          <Stat k="Econ" v={board.bowler.econ != null ? Number(board.bowler.econ).toFixed(2) : "—"} />
        </View>
      ) : null}
      {board.overs.length ? <Overs overs={board.overs} /> : null}
      {board.crr != null || board.rrr != null ? (
        <View style={{ flexDirection: "row", gap: space.stack }}>
          {board.crr != null ? <Text style={styles.muted}>CRR {board.crr.toFixed(2)}</Text> : null}
          {board.rrr != null ? <Text style={styles.muted}>RRR {board.rrr.toFixed(2)}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const ORD = ["1st", "2nd", "3rd", "4th"];
const cardInns = (match: any) => liveCard(match).filter((inn: any) => (inn.batters || []).length || (inn.bowlers || []).length || inn.runs != null);
const innId = (i: any) => `${i.n}-${i.team}`;
/** "NZ" for a one-innings-a-side match, "NZ 2nd" once a side has batted twice (Tests). */
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

/** Batting and bowling tables, one innings at a time: a selector over the innings (two in a T20 or ODI, up to four in a Test) that follows the latest one until another is picked. */
function ScorecardBody({ match, teams }: { match: any; teams?: Side[] }) {
  const [pick, setPick] = useState<string>();
  const card = cardInns(match);
  if (!card.length) return null;
  const at = pick && card.some((i: any) => innId(i) === pick) ? card.findIndex((i: any) => innId(i) === pick) : card.length - 1, inn = card[at];
  const balls = inn.overs != null ? oversToBalls(inn.overs) : null, rr = inn.runs != null && balls ? (inn.runs / (balls / 6)).toFixed(2) : null;
  const onStrike = (name: string) => (match?.players || []).some((p: any) => p.strike && namesMatch(p.name, name));
  const yet: string[] = (inn.yetToBat || []).filter((n: string) => n && !/^[A-Z0-9]{1,4}$/.test(n));
  return (
    <View style={{ gap: space.snug, paddingBottom: space.snug }}>
      {card.length > 1 ? <Segmented<string> items={card.map((i: any, j: number) => [innId(i), `${innLabel(card, j)} ${innScore(i) || "—"}`] as [string, string])} value={innId(inn)} onChange={setPick} label="Innings" /> : null}
      <View style={styles.rowBetween}>
        <Text style={styles.innTitle} numberOfLines={1}>{inn.team || `Innings ${inn.n}`}</Text>
        <Text style={styles.innScore}>{innScore(inn) || "—"}{rr ? ` · RR ${rr}` : ""}</Text>
      </View>
      {inn.batters?.length ? (
        <View>
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
        </View>
      ) : null}
      {inn.fow?.length ? (
        <Text style={styles.muted}><Text style={styles.strongMuted}>FOW </Text>{inn.fow.map((w: any, k: number) => `${k > 0 ? " · " : ""}${w.wkts}–${w.runs} (${w.name}${w.balls != null ? `, ${fmtOv(ballsToOvers(w.balls))}` : ""})`).join("")}</Text>
      ) : null}
      {yet.length ? <Text style={styles.muted}><Text style={styles.strongMuted}>Yet to bat </Text>{yet.join(", ")}</Text> : null}
      {inn.bowlers?.length ? (
        <View>
          <View style={styles.th}><Text style={[styles.cap, { flex: 1 }]}>Bowler</Text><Cell w={BOWL.o}>O</Cell><Cell w={BOWL.m}>M</Cell><Cell w={BOWL.r}>R</Cell><Cell w={BOWL.w}>W</Cell><Cell w={BOWL.e}>Econ</Cell></View>
          {inn.bowlers.map((p: any) => (
            <View key={p.id || p.name} style={styles.tr}>
              <View style={{ flex: 1, minWidth: 0 }}><Who name={p.name} team={p.team} sides={teams} /></View>
              <Cell w={BOWL.o}>{fmtOv(p.overs)}</Cell><Cell w={BOWL.m}>{p.maidens ?? 0}</Cell><Cell w={BOWL.r}>{p.conceded ?? 0}</Cell><Cell w={BOWL.w} strong>{p.wickets ?? 0}</Cell><Cell w={BOWL.e}>{p.econ != null ? Number(p.econ).toFixed(2) : "—"}</Cell>
            </View>
          ))}
        </View>
      ) : null}
      <Text style={styles.muted}>So far this match. Not used for settlement.</Text>
    </View>
  );
}

/** The scorecard and each side's recent form, as two closed rows under the match so the props stay first. */
export function MatchAccordions({ match, teams, fmt, store }: { match?: any; teams: Side[]; fmt: string; store: any }) {
  const card = match ? cardInns(match) : [];
  const form = useMemo(() => (store ? recentForms(store, teams, fmt) : []), [store, teams, fmt]);
  const showForm = form.some((f) => f.games.length);
  if (!card.length && !showForm) return null;
  const last = card[card.length - 1];
  return (
    <View style={{ paddingHorizontal: space.gutter }}>
      {card.length ? (
        <Accordion title="Scorecard" right={<Text style={styles.sum} numberOfLines={1}>{last.team} {innScore(last)}</Text>}>
          <ScorecardBody match={match} teams={teams} />
        </Accordion>
      ) : null}
      {showForm ? (
        <Accordion title="Recent form" right={<FormHeadline forms={recentForms(store, teams, fmt, 3)} />}>
          <RecentForm forms={form} store={store} fmt={fmt} />
        </Accordion>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  face: { overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: color.pill },
  name: { ...type.callout, fontFamily: font.medium, color: color.foreground },
  cap: { ...type.caption, ...cap, color: color["muted-foreground"] },
  muted: { ...type.footnote, color: color["muted-foreground"] },
  strongMuted: { fontFamily: font.medium, color: color.foreground },
  board: { padding: space.inset, gap: space.snug, marginHorizontal: space.gutter },
  pair: { flexDirection: "row", alignItems: "stretch", gap: space.snug },
  end: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: space.snug },
  endText: { flex: 1, minWidth: 0, gap: 2 },
  endScore: { ...type.footnote, color: color["muted-foreground"], fontFamily: font.data, fontVariant: ["tabular-nums"] },
  endRuns: { ...num, fontSize: 17, lineHeight: 20, color: color.foreground },
  ship: { alignItems: "center", justifyContent: "space-between", paddingVertical: 2 },
  shipV: { ...num, fontSize: 17, color: color.foreground },
  shipB: { ...type.caption, color: color["muted-foreground"] },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.snug },
  bowler: { flexDirection: "row", alignItems: "center", gap: space.snug },
  statV: { ...num, fontSize: 15, color: color.foreground },
  overs: { flexDirection: "row", flexWrap: "nowrap", alignItems: "center", gap: 6 },
  overGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  overBreak: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: "rgba(142,142,147,0.5)", marginRight: 3 },
  ball: { minWidth: 34, height: 30, paddingHorizontal: 5, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  ballText: { ...num, fontSize: 13 },
  innTitle: { ...type.callout, fontFamily: font.medium, color: color.foreground, flex: 1 },
  innScore: { ...type.footnote, color: color.foreground, fontFamily: font.data, fontVariant: ["tabular-nums"] },
  th: { flexDirection: "row", alignItems: "center", paddingVertical: space.tight },
  tr: { flexDirection: "row", alignItems: "center", gap: 0, minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, paddingVertical: space.tight },
  cell: { ...num, fontSize: 14, color: color["muted-foreground"], textAlign: "right" },
  sum: { ...type.callout, color: color["muted-foreground"], maxWidth: "60%", fontFamily: font.data, fontVariant: ["tabular-nums"] },
});
