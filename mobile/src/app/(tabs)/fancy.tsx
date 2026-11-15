import { mark } from "@/lib/perf";
import { lazyTab } from "@/ui/lazy-tab";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Press } from "@/ui/press";
import { Text } from "@/ui/text";
import { fancyFm } from "@cricket/engine/fancy-edge.js";
import { hotDay, hotDayLabels, matchChipId } from "@site/lib/hot-lines";
import { cardModel } from "@/lib/card";
import { city, dayLabel, localTime, seriesName } from "@/lib/format";
import { useFancyCards, type FancyCard as Card } from "@/lib/fancy";
import { fancyMarketPath, fixturePath, push } from "@/lib/nav";
import { useNow } from "@/lib/use-now";
import { AppHeader } from "@/ui/brand";
import { Chips } from "@/ui/chips";
import { EmptyState } from "@/ui/empty-state";
import { OverviewRow } from "@/ui/fancy-row";
import { LiveScore } from "@/ui/fixture-card";
import { useScreenInsets } from "@/ui/insets";
import { ChevronRight } from "@/ui/icons";
import { MatchChips } from "@/ui/match-chip";
import { Working } from "@/ui/motion";
import { StatusLabel } from "@/ui/status-label";
import { TeamBadge } from "@/ui/team-badge";
import { color, font, radius, space, type } from "@/ui/tokens";
import { TabFade } from "@/ui/tab-fade";

const SHOWN_ROWS = 4; // the best-edge markets on the card; the rest are one tap away on the match's Fancy tab
const fxChip = (f: any) => matchChipId(`${f.a} vs ${f.b}`, f.start, f.fmt);

/** Fancy: every priced match with its best-edge markets (the book's line, the edge and the last ten results against it), each match linking to its own Fancy tab. Matches in play lead, as on the Home rail. Day + match chips mirror Props. */
function Fancy() {
  mark("render:Fancy");
  const inset = useScreenInsets();
  const { cards, ready, error } = useFancyCards();
  const [day, setDay] = useState("0");
  const [match, setMatch] = useState("all");
  const days = useMemo(() => (hotDayLabels() as [string, string][]).map(([id, label]) => [id, label] as [string, string]), []);
  const scored = useMemo(() => cards.filter((c) => c.rows.length > 0), [cards]);
  const dayCards = useMemo(() => scored.filter((c) => hotDay(c.f.start, c.f.fmt) === Number(day)), [scored, day]);
  const matchChips = useMemo(() => dayCards.map((c) => ({ id: fxChip(c.f), a: c.f.a, b: c.f.b, start: c.f.start, fmt: c.f.fmt })), [dayCards]);
  const pick = matchChips.some((c) => c.id === match) ? match : "all";
  const shown = useMemo(() => (pick === "all" ? dayCards : dayCards.filter((c) => fxChip(c.f) === pick)), [dayCards, pick]);
  const otherDay = useMemo(() => scored.some((c) => { const d = hotDay(c.f.start, c.f.fmt); return d >= 0 && d !== Number(day); }), [scored, day]);
  const matchTags = useMemo(() => {
    const t: Record<string, { text: string; session: boolean }> = {};
    for (const c of dayCards) if (c.match?.status === "live") t[fxChip(c.f)] = { text: "Live", session: false };
    return t;
  }, [dayCards]);
  // Chips bleed to the screen edge; cards keep gutter via contentContainerStyle.
  const header = scored.length ? (
    <View style={styles.filters}>
      <Chips items={days} value={day} onChange={(d) => { setDay(d); setMatch("all"); }} />
      {matchChips.length ? <MatchChips all items={matchChips} tags={matchTags} value={pick} onChange={setMatch} /> : null}
    </View>
  ) : null;
  return (
    <View style={[styles.root, { paddingTop: inset.top }]}>
      <AppHeader title="Fancy" />
      <FlashList
        data={ready ? shown : []}
        keyExtractor={(c) => c.f.id || `${c.f.a}${c.f.b}${c.f.start}`}
        renderItem={({ item }) => <MatchCard {...item} />}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: space.gutter, paddingTop: space.snug, paddingBottom: inset.bottom + 24 }}
        ListEmptyComponent={
          !ready
            ? (error ? <View style={styles.emptyPad}><EmptyState title="Could not score fancy lines" body="Try again in a moment." /></View> : <Working label="Scoring the fancy lines…" shape="fancy" />)
            : !scored.length
              ? <View style={styles.emptyPad}><EmptyState title="No fancy lines yet" body="They open a day or two before a match, once there are past matches to score them on." /></View>
              : <View style={styles.emptyPad}><EmptyState title={day === "0" ? "No fancy lines today" : "No fancy lines for this day"} body={otherDay ? "Lines are priced on other days — pick another chip above." : "Lines usually land a day or two before the toss."} /></View>
        }
        showsVerticalScrollIndicator={false}
        drawDistance={Platform.OS === "android" ? 280 : 480}
        removeClippedSubviews={Platform.OS === "android"}
      />
      <TabFade />
    </View>
  );
}

/** Desktop Fancy panel twin: FixtureCard shell + zoned header / rows / footer. */
function MatchCard({ f, ms, rows, match }: Card) {
  const stumps = /stumps|close of (?:play|day)|end of (?:the )?day/i.test(String(match?.summary || match?.session || ""));
  const now = useNow(stumps ? 1000 : 30_000);
  const model = cardModel({ fixture: f, live: match }, now);
  const place = city(f.venue);
  const to = (fm?: string, sc?: number) => (fm ? fancyMarketPath(f.id, { fm, sc: sc != null && sc >= 0 ? sc : null }) : `${fixturePath(f.id)}?tab=fancy`);
  return (
    <View style={styles.card}>
      <Press onPress={() => push(to())} accessibilityRole="button" accessibilityLabel={`${f.a} v ${f.b}`} style={styles.top}>
        <View style={styles.meta}>
          {model.session ? (
            <StatusLabel tone="session" surface="plain">{model.session}</StatusLabel>
          ) : model.live ? (
            <StatusLabel tone="live" surface="dot" />
          ) : (
            <StatusLabel tone="muted" surface="plain">{model.final ? "Final" : model.started ? "Started" : "Upcoming"}</StatusLabel>
          )}
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.cap}>{f.fmt || "T20"}{f.gender === "female" ? " · W" : ""}</Text>
          {place ? <Text style={styles.ground} numberOfLines={1}>{place}</Text> : null}
        </View>
        <View style={styles.sides}>
          {model.sides.map((s, k) => (
            <View key={s.name} style={styles.side}>
              <TeamBadge name={s.name} size={36} />
              <Text style={[styles.team, s.lost && styles.lost]} numberOfLines={1}>{s.name}</Text>
              {model.hasScore || model.live ? (
                <LiveScore s={s.score} dim={s.lost} pending={model.live && !match} live={model.live && !model.session} />
              ) : k === 0 && !model.final ? (
                <View style={styles.when}>
                  <Text style={styles.whenDay}>{dayLabel(model.when, now)}</Text>
                  {model.timed ? <Text style={styles.whenTime}>{localTime(model.when)}</Text> : null}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </Press>
      <View style={styles.rows}>
        {rows.slice(0, SHOWN_ROWS).map((r: any) => (
          <OverviewRow key={r.id} r={r} inset onOpen={() => push(to(fancyFm(r.key, r.inn || 0), r.scope))} />
        ))}
      </View>
      <Press onPress={() => push(to())} accessibilityRole="button" style={styles.foot}>
        <View style={styles.status}>
          <Text style={styles.statusText} numberOfLines={2}>{model.status}</Text>
          <Text style={styles.series} numberOfLines={1}>{seriesName(f)}{ms.length ? ` · last ${ms.length}` : ""}</Text>
        </View>
        <View style={styles.linkRow}><Text style={styles.link}>{rows.length > SHOWN_ROWS ? `All ${rows.length} markets` : "Fancy"}</Text><ChevronRight color={color.primary} size={14} /></View>
      </Press>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
  emptyPad: { paddingTop: space.snug },
  filters: { marginHorizontal: -space.gutter, marginBottom: space.snug },
  // Same shell as FixtureCard / web Fancy from md: card fill, radius, overflow for zoned header/footer.
  card: { backgroundColor: color.card, borderRadius: radius.card, overflow: "hidden", marginBottom: space.stack },
  top: { paddingHorizontal: space.inset, paddingVertical: space.inset, gap: space.snug, backgroundColor: color["surface-raised"] },
  meta: { flexDirection: "row", alignItems: "center", gap: space.tight },
  metaDot: { ...type.footnote, color: color["muted-foreground"] },
  cap: { ...type.footnote, color: color["muted-foreground"] },
  ground: { ...type.footnote, color: color["muted-foreground"], flexShrink: 1, marginLeft: "auto" },
  sides: { gap: space.snug },
  side: { flexDirection: "row", alignItems: "center", gap: space.snug },
  team: { ...type.body, fontFamily: font.bold, color: color.foreground, flex: 1 },
  lost: { color: color["muted-foreground"] },
  when: { alignItems: "flex-end" },
  whenDay: { ...type.footnote, color: color["muted-foreground"] },
  whenTime: { ...type.callout, color: color.foreground, fontFamily: font.data, fontVariant: ["tabular-nums"] },
  rows: {},
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.snug, paddingHorizontal: space.inset, paddingVertical: space.stack, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, backgroundColor: color.surface },
  status: { flex: 1, minWidth: 0 },
  statusText: { ...type.footnote, fontFamily: font.medium, color: color.foreground },
  series: { ...type.caption, color: color["muted-foreground"] },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  link: { ...type.footnote, fontFamily: font.medium, color: color.primary },
});

export default lazyTab(Fancy, "Fancy");
