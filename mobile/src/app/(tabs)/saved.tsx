/* eslint-disable @typescript-eslint/no-explicit-any */
import { ScrollView, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { STATS } from "@cricket/engine/rules.js";
import { FORMATS } from "@cricket/engine/util.js";
import { storeQuery } from "@/lib/data";
import { openPlayer, push } from "@/lib/nav";
import { parsePropKey, useRecents, useSaved } from "@/lib/saved";
import { AppHeader } from "@/ui/brand";
import { useScreenInsets } from "@/ui/insets";
import { ListRow, Section } from "@/ui/list";
import { Working } from "@/ui/motion";
import { PlayerAvatar } from "@/ui/player-avatar";
import { TeamBadge } from "@/ui/team-badge";
import { color, space, type, tonal } from "@/ui/tokens";
import { TabFade } from "@/ui/tab-fade";

/** Everything kept on this device (no account): watchlist props, saved players and teams, and the players opened lately. */
export default function Saved() {
  const inset = useScreenInsets();
  const stats = useQuery(storeQuery);
  const { list, toggle } = useSaved();
  const { recents } = useRecents();
  const store: any = stats.data?.store;

  const body = () => {
    if (!store) return <Working label="Loading…" fill />;
    const players = store.P.id.length;
    const props = list.map((k) => ({ k, p: parsePropKey(k) })).filter((x): x is { k: string; p: NonNullable<ReturnType<typeof parsePropKey>> } => !!x.p && x.p.idx >= 0 && x.p.idx < players);
    const people = list.filter((k) => k.startsWith("player:") || k.startsWith("team:")).map((k) => ({ k, kind: k.split(":")[0], i: Number(k.split(":")[1]) }))
      .filter((x) => (x.kind === "player" ? x.i >= 0 && x.i < players : x.i >= 0 && x.i < store.teams.length));
    const seen = recents.filter((k) => k.startsWith("player:")).map((k) => Number(k.split(":")[1])).filter((i) => i >= 0 && i < players);
    const none = !props.length && !people.length;
    const team = (i: number) => store.teamName(store.P.tm[i]);
    const remove = (k: string) => (
      <Press accessibilityRole="button" accessibilityLabel="Remove" hitSlop={8} onPress={() => toggle(k)} style={({ pressed }) => [styles.remove, pressed && { opacity: 0.5 }]}>
        <Ionicons name="close" size={20} color={color["muted-foreground"]} />
      </Press>
    );
    return (
      <View style={styles.sections}>
        {none ? <Text style={styles.intro}>Nothing saved yet. Tap the star on a prop row to watch it, or the star on a player or team page to keep it. Everything stays on this phone: there is no account.</Text> : null}
        <Section title="Watchlist" count={props.length} empty="Tap the star on a prop row to track that line here.">
          {props.map(({ k, p }, n) => (
            <ListRow key={k} first={n === 0} chevron={false}
              left={<PlayerAvatar pid={store.P.id[p.idx]} team={team(p.idx)} size={44} />}
              title={store.playerName(p.idx)}
              sub={<><Text style={styles.line}>O {p.line}</Text> {(STATS as any)[p.stat]?.label ?? p.stat} · {FORMATS[p.fmt] ?? ""}</>}
              right={remove(k)}
              onPress={() => openPlayer({ idx: p.idx, stat: p.stat, line: p.line, fmt: FORMATS[p.fmt] ?? "T20" })} label={`${store.playerName(p.idx)}, over ${p.line}`} />
          ))}
        </Section>
        <Section title="Players and teams" count={people.length} empty="Tap the star on a player or team page to keep it here.">
          {people.map(({ k, kind, i }, n) => kind === "player" ? (
            <ListRow key={k} first={n === 0} left={<PlayerAvatar pid={store.P.id[i]} team={team(i)} size={44} />} title={store.playerName(i)} sub={team(i)} onPress={() => push(`/player/${i}`)} />
          ) : (
            <ListRow key={k} first={n === 0} left={<TeamBadge name={store.teams[i].n} size={44} />} title={store.teamName(i)} sub="Team" onPress={() => push(`/team/${i}`)} />
          ))}
        </Section>
        <Section title="Recently viewed" count={seen.length} empty="Players you open show up here.">
          {seen.map((i, n) => <ListRow key={i} first={n === 0} left={<PlayerAvatar pid={store.P.id[i]} team={team(i)} size={44} />} title={store.playerName(i)} sub={team(i)} onPress={() => push(`/player/${i}`)} />)}
        </Section>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: inset.top }]}>
      <AppHeader title="Saved" />
      <ScrollView contentContainerStyle={{ paddingBottom: inset.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {body()}
      </ScrollView>
      <TabFade />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  sections: { gap: space.group, paddingHorizontal: space.gutter, paddingTop: space.snug },
  intro: { ...type.callout, color: color["muted-foreground"], ...tonal, borderRadius: 16, padding: space.stack },
  line: { color: color.primary },
  remove: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
});
