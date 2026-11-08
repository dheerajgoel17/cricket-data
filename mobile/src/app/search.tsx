/* eslint-disable @typescript-eslint/no-explicit-any */
import { useDeferredValue, useMemo, useState } from "react";
import { Keyboard, ScrollView, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text, TextInput } from "@/ui/text";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { norm } from "@cricket/engine/util.js";
import { dayKey, dayLabel } from "@site/lib/format";
import { storeQuery } from "@/lib/data";
import { fixturePath, goBack, push } from "@/lib/nav";
import { fixturesQuery } from "@/lib/queries";
import { useRecents } from "@/lib/saved";
import { EmptyState } from "@/ui/empty-state";
import { useScreenInsets } from "@/ui/insets";
import { ListRow, Section } from "@/ui/list";
import { PlayerAvatar } from "@/ui/player-avatar";
import { LeagueBadge, TeamBadge } from "@/ui/team-badge";
import { color, font, space, type } from "@/ui/tokens";
import { TabFade } from "@/ui/tab-fade";

const GO: [string, string][] = [["Player props", "/props"], ["Fancy lines", "/fancy"], ["Fixtures", "/"], ["Leagues", "/leagues"], ["Saved", "/saved"], ["Contact", "/contact"]];

/** Search players (typo tolerant, the engine's resolver), teams, matches and leagues. Two letters start it; with an empty field it offers the tabs and the players opened lately. */
export default function Search() {
  const inset = useScreenInsets(false);
  const stats = useQuery(storeQuery), fx = useQuery(fixturesQuery);
  const { recents } = useRecents();
  const [text, setText] = useState("");
  const query = useDeferredValue(text);
  const store: any = stats.data?.store, rz: any = stats.data?.rz;

  const found = useMemo(() => {
    const t = query.trim();
    if (!rz || t.length < 2) return null;
    const q = norm(t), now = Date.now(), gap = (f: any) => Math.abs((Date.parse(f.start) || now) - now);
    const team = rz.team(t);
    const games = (fx.data || []).filter((f: any) => f.id && (norm(f.a).includes(q) || norm(f.b).includes(q) || norm(f.series || "").includes(q))).sort((x: any, y: any) => gap(x) - gap(y)).slice(0, 4);
    return { matches: games as any[], teams: team ? [team] : [], players: rz.players(t, {}, 6) as any[], leagues: (rz.event(t) as number[]).slice(0, 4) };
  }, [query, rz, fx.data]);
  const seen = useMemo(() => (store ? recents.filter((k) => k.startsWith("player:")).map((k) => Number(k.split(":")[1])).filter((i) => i >= 0 && i < store.P.id.length).slice(0, 5) : []), [recents, store]);

  const open = (path: string) => { Keyboard.dismiss(); push(path); };
  const go = (path: string) => { Keyboard.dismiss(); router.navigate(path as never); };
  const none = found && !found.matches.length && !found.teams.length && !found.players.length && !found.leagues.length;
  const team = (i: number) => store.teamName(store.P.tm[i]);

  return (
    <View style={[styles.root, { paddingTop: inset.top }]}>
      <View style={styles.bar}>
        <View style={styles.field}>
          <Ionicons name="search" size={18} color={color["muted-foreground"]} />
          <TextInput value={text} onChangeText={setText} autoFocus autoCorrect={false} autoCapitalize="none" returnKeyType="search" clearButtonMode="while-editing" placeholder="Search players, teams, matches" placeholderTextColor={color["muted-foreground"]} style={styles.input} accessibilityLabel="Search" />
        </View>
        <Press scale={1} accessibilityRole="button" onPress={goBack} hitSlop={8}><Text style={styles.cancel}>Cancel</Text></Press>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={[styles.body, { paddingBottom: inset.bottom + 24 }]}>
        {!found ? (
          <>
            <Section title="Go to">
              {GO.map(([label, path], n) => <ListRow key={path} first={n === 0} title={label} onPress={() => go(path)} />)}
            </Section>
            {store && seen.length ? (
              <Section title="Recently viewed">
                {seen.map((i, n) => <ListRow key={i} first={n === 0} left={<PlayerAvatar pid={store.P.id[i]} team={team(i)} size={40} />} title={store.playerName(i)} sub={team(i)} onPress={() => open(`/player/${i}`)} />)}
              </Section>
            ) : null}
          </>
        ) : none ? (
          <EmptyState title="No matches" body={`No player, team, match or league matches “${query.trim()}”.`} />
        ) : (
          <>
            {found.matches.length ? (
              <Section title="Matches">
                {found.matches.map((f: any, n: number) => <ListRow key={f.id} first={n === 0} left={<TeamBadge name={f.a} size={40} />} title={`${f.a} v ${f.b}`} sub={`${dayLabel(dayKey(f))} · ${f.series || f.fmt || ""}`} onPress={() => open(fixturePath(f.id))} />)}
              </Section>
            ) : null}
            {found.players.length ? (
              <Section title="Players">
                {found.players.map((p: any, n: number) => <ListRow key={p.idx} first={n === 0} left={<PlayerAvatar pid={store.P.id[p.idx]} team={store.teamName(p.team)} size={40} />} title={store.playerName(p.idx)} sub={store.teamName(p.team)} onPress={() => open(`/player/${p.idx}`)} />)}
              </Section>
            ) : null}
            {found.teams.length ? (
              <Section title="Teams">
                {found.teams.map((t: any, n: number) => <ListRow key={t.idx} first={n === 0} left={<TeamBadge name={t.name} size={40} />} title={t.name} sub="Team" onPress={() => open(`/team/${t.idx}`)} />)}
              </Section>
            ) : null}
            {found.leagues.length ? (
              <Section title="Leagues">
                {found.leagues.map((e, n) => <ListRow key={e} first={n === 0} left={<LeagueBadge name={store.events[e]} size={40} />} title={store.events[e]} onPress={() => open(`/league/${e}`)} />)}
              </Section>
            ) : null}
          </>
        )}
      </ScrollView>
      <TabFade withTabBar={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  bar: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.gutter, paddingVertical: space.snug },
  field: { flex: 1, height: 40, flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.snug + 2, borderRadius: 12, backgroundColor: color.secondary },
  input: { flex: 1, ...type.body, fontFamily: font.regular, color: color.foreground, paddingVertical: 0 },
  cancel: { ...type.body, color: color.primary },
  body: { gap: space.group, paddingHorizontal: space.gutter, paddingTop: space.snug },
});
