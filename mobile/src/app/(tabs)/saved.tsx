import { RoundButton } from "@/ui/round-button";
import { Button } from "@/ui/button";
import { Reflow } from "@/ui/motion";
import { mark } from "@/lib/perf";
import { lazyTab } from "@/ui/lazy-tab";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ScrollView, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { Ionicons } from "@expo/vector-icons";
import { STATS } from "@cricket/engine/rules.js";
import { FORMATS } from "@cricket/engine/util.js";
import { useAuth } from "@/lib/auth";
import { playerLabel } from "@/lib/player-label";
import { useStore } from "@/lib/use-store";
import { openPlayer, push } from "@/lib/nav";
import { parsePropKey, useRecents, useSaved } from "@/lib/saved";
import { AppHeader } from "@/ui/brand";
import { EmptyState } from "@/ui/empty-state";
import { useScreenInsets } from "@/ui/insets";
import { ListRow, Section } from "@/ui/list";
import { Working } from "@/ui/motion";
import { PlayerAvatar } from "@/ui/player-avatar";
import { TeamBadge } from "@/ui/team-badge";
import { color, font, space, type, rhythm, t, w } from "@/ui/tokens";
import { TabFade } from "@/ui/tab-fade";

/** Account Saved (server). Recently viewed stays on this device. */
function Saved() {
  mark("render:Saved");
  const inset = useScreenInsets();
  const stats = useStore();
  const { user, loading, openSignIn, signOut } = useAuth();
  const { list, toggle } = useSaved();
  const { recents } = useRecents();
  const store: any = stats.data?.store, names = stats.data?.names;
  const label = (i: number) => playerLabel(store, names, i);

  const account = user ? (
    <RoundButton label="Sign out" onPress={() => void signOut()}>
      <Ionicons name="person-circle" size={22} color={color.primary} />
    </RoundButton>
  ) : (
    <RoundButton label="Sign in" onPress={openSignIn}>
      <Ionicons name="person-circle-outline" size={22} color={color.foreground} />
    </RoundButton>
  );

  const body = () => {
    if (loading) return <Working label="Loading…" fill shape="list" />;
    if (!user) {
      return (
        <View style={styles.gate}>
          <EmptyState title="Sign in to sync Saved" body="Create a free account or continue with Google. Your watchlist, players and teams are stored on the server." />
          <Button label="Sign in" onPress={openSignIn} style={styles.signBtn} />
        </View>
      );
    }
    if (!store) return <Working label="Loading…" fill shape="list" />;
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
        {none ? <EmptyState title="Nothing saved yet" body="Tap the star on a prop, player or team. They sync to your account." /> : null}
        <Section title="Watchlist" count={props.length} emptyTitle="No watchlist props" empty="Tap the star on a prop row to track that line here.">
          {props.map(({ k, p }, n) => (
            <Reflow key={k}><ListRow first={n === 0} chevron={false}
              left={<PlayerAvatar pid={store.P.id[p.idx]} team={team(p.idx)} size={44} />}
              title={label(p.idx)}
              sub={<><Text style={styles.line}>O {p.line}</Text> {(STATS as any)[p.stat]?.label ?? p.stat} · {FORMATS[p.fmt] ?? ""}</>}
              right={remove(k)}
              onPress={() => openPlayer({ idx: p.idx, stat: p.stat, line: p.line, fmt: FORMATS[p.fmt] ?? "T20" })} label={`${label(p.idx)}, over ${p.line}`} /></Reflow>
          ))}
        </Section>
        <Section title="Players and teams" count={people.length} emptyTitle="No saved players or teams" empty="Tap the star on a player or team page to keep it here.">
          {people.map(({ k, kind, i }, n) => (
            <Reflow key={k}>{kind === "player" ? (
              <ListRow first={n === 0} left={<PlayerAvatar pid={store.P.id[i]} team={team(i)} size={44} />} title={label(i)} sub={team(i)} onPress={() => push(`/player/${i}`)} />
            ) : (
              <ListRow first={n === 0} left={<TeamBadge name={store.teams[i].n} size={44} />} title={store.teamName(i)} sub="Team" onPress={() => push(`/team/${i}`)} />
            )}</Reflow>
          ))}
        </Section>
        <Section title="Recently viewed" count={seen.length} emptyTitle="No recent players" empty="Players you open show up here on this device.">
          {seen.map((i, n) => <ListRow key={i} first={n === 0} left={<PlayerAvatar pid={store.P.id[i]} team={team(i)} size={44} />} title={label(i)} sub={team(i)} onPress={() => push(`/player/${i}`)} />)}
        </Section>
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: inset.top }]}>
      <AppHeader title="Saved" action={account} />
      <ScrollView contentContainerStyle={{ paddingBottom: inset.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {body()}
      </ScrollView>
      <TabFade />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  sections: { gap: rhythm.between, paddingTop: rhythm.top },
  line: { color: color.primary, ...w.data },
  remove: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  gate: { flex: 1, justifyContent: "center", gap: rhythm.between, paddingHorizontal: rhythm.inline, paddingBottom: space.section * 2 },
  signBtn: { alignSelf: "center", minWidth: 160 },
});

export default lazyTab(Saved, "Saved");
