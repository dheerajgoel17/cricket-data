import { fancyMarketPath, push } from "@/lib/nav";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Button } from "@/ui/button";
import { Reflow } from "@/ui/motion";
import { HScroll } from "@/ui/h-scroll";
import { FilterSection, FilterSheet } from "@/ui/sheet";
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { Press } from "@/ui/press";
import { RoundButton } from "@/ui/round-button";
import { Text } from "@/ui/text";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fancyByLine, fancyFor, fancyHeadline } from "@cricket/engine/lines.js";
import { BAT_FIRST_TAG, FANCY_INNS, MATCH_KEYS, TEAM_KEYS, batFirstBooked, buildOverview, fancyFm, fancySample, firstInnsMs, innTag, parseFm, peerFancyFm, scoreLiveOuRow, scoreMarket } from "@cricket/engine/fancy-edge.js";
import { fancyStanding } from "@cricket/engine/live.js";
import { MATCH_MARKETS, TEAM_TOTAL_MARKETS, topBatters, venueIndices } from "@cricket/engine/markets.js";
import { fancyShareText } from "@cricket/engine/share-text.js";
import { FORMATS } from "@cricket/engine/util.js";
import { abbr, odds, pc } from "@site/lib/format";
import { shareFixtureUrl } from "@site/lib/share";
import { SITE_URL } from "@/lib/config";
import { fxInfoOf } from "@/lib/fancy";
import { useStore } from "@/lib/use-store";
import { liveQuery } from "@/lib/queries";
import { liveMatchFor } from "@/lib/rail";
import { BookBadge } from "@/ui/book-badge";
import { ChartBars } from "@/ui/charts";
import { ActiveChip, ChoiceChip, ChoiceRow, Chips, FilterButton } from "@/ui/chips";
import { Bleed } from "@/ui/bleed";
import { EmptyState } from "@/ui/empty-state";
import { BookList, OverviewRow } from "@/ui/fancy-row";
import { LiveMarketRow } from "@/ui/live-market-row";
import { TeamSpot } from "@/ui/live-spot";
import { liveRows } from "@cricket/engine/inplay-lines.js";
import { LineStepper } from "@/ui/line-stepper";
import { Working } from "@/ui/motion";
import { PlayerAvatar } from "@/ui/player-avatar";
import { StandingMark, type Standing } from "@/ui/tick";
import { cap, color, control, font, num, numLg, radius, space, type, tint, fs, rhythm, duration, t, w, state, icon } from "@/ui/tokens";


/** Width of the ladder's Line column: fits the longest line a Test total can have (1100.5) at the figure size. */
const LINE_W = 60;
const fancyLines = fancyFor as (doc: any, fixture: any, key: string, team?: string | null, inn?: number) => any[]; // the engine is plain JS: give its result the shape this view reads
const WINDOWS = [5, 10, 20, 30];
const HERE_MIN = 3;
const DIFFERS = 0.3; // how far (as a share of matches) the ground's hit rate must sit from the teams' form to be called out
const stepOf = (key: string) => (/runs$|score$|^overs_/.test(key) ? 5 : 1);
const pct1 = (r: number | null) => (r == null ? "–" : `${(r * 100).toFixed(1)}%`);
const short = (n: number | null | undefined, d = 1) => (n == null ? "–" : Number.isInteger(n) ? String(n) : n.toFixed(d));

/**
 * Match Fancy: whole-match and team-total markets over the teams' last N matches (the site's `MatchFancy`). List mode shows bookmaker lines; tapping one opens
 * `/fixture/:id/fancy`. Detail mode is that page: chart, over/under and ladder. Filters use the Props pattern (scope chips + Filters sheet for window / ground).
 */
export function MatchFancy({ fx, teams, fmt, doc, start, mode = "list" }: { fx: any; teams: [string, number][]; fmt: string; doc: any; start?: { fm?: string; sc?: string; mw?: string; mv?: string }; mode?: "list" | "detail" }) {
  const stats = useStore(), live = useQuery(liveQuery);
  const store: any = stats.data?.store;
  const matchesReady = stats.matchesReady;
  const liveMatch = liveMatchFor(live.data, doc, fx);
  const insets = useSafeAreaInsets();
  const [sc, setSc] = useState(start?.sc ?? "-1"), [fmId, setFmId] = useState(start?.fm ?? ""), [win, setWin] = useState(WINDOWS.includes(Number(start?.mw)) ? Number(start?.mw) : 10), [here, setHere] = useState(start?.mv === "1"), [ml, setMl] = useState<number>();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftWin, setDraftWin] = useState(win), [draftHere, setDraftHere] = useState(here);
  const fxInfo = useMemo(() => fxInfoOf(fx), [fx]);
  const fmtIdx = FORMATS.indexOf(fmt);
  const gender = fx.gender === "female" ? 1 : 0;
  const venueName = String(fx.venue || "").split(",")[0].trim();
  useEffect(() => { if (filtersOpen) { setDraftWin(win); setDraftHere(here); } }, [filtersOpen, win, here]);

  const booked = (k: string, teamName: string | null, inn = 0) => k !== "top_batter" && fancyLines(doc, fxInfo, k, teamName, inn).length > 0;
  const anyBooked = (list: [string, string][], teamName: string | null) => list.some(([k]) => (FANCY_INNS as number[]).some((inn) => booked(k, teamName, inn)));
  const scopes = [["-1", "Match", (MATCH_KEYS as [string, string][]).some(([k]) => booked(k, null))] as const, ...teams.map(([name, i]) => [String(i), name, anyBooked(TEAM_KEYS as [string, string][], name)] as const)].filter(([, , on]) => on);
  const scope = scopes.some(([v]) => v === sc) ? Number(sc) : scopes.length ? Number(scopes[0][0]) : -1;
  const team = teams.find(([, i]) => i === scope);
  const keysFor = (scNum: number) => {
    const t = teams.find(([, i]) => i === scNum);
    return ((scNum < 0 ? MATCH_KEYS : TEAM_KEYS) as [string, string][]).flatMap(([k, lab]) => (scNum < 0 ? [0] : (FANCY_INNS as number[])).filter((inn) => booked(k, t?.[0] ?? null, inn)).map((inn) => [fancyFm(k, inn), [innTag(inn, fx.fmt === "Test", k), batFirstBooked(fancyLines(doc, fxInfo, k, t?.[0] ?? null, inn), inn, scNum) ? BAT_FIRST_TAG : "", lab].filter(Boolean).join(" · ")] as [string, string]));
  };
  const keyList = keysFor(scope);
  const fm = keyList.some(([k]) => k === fmId) ? fmId : peerFancyFm(fmId, keyList) || keyList[0]?.[0] || "";
  const { key, inn } = parseFm(fm) as { key: string; inn: number };
  const marketLabel = (k: string) => ((scope < 0 ? MATCH_KEYS : TEAM_KEYS) as [string, string][]).find(([id]) => id === k)?.[1] ?? (k === "top_batter" ? "Top batter" : (((scope < 0 ? MATCH_MARKETS : TEAM_TOTAL_MARKETS) as any)[k]?.label as string));

  // the ground: the matches played there (the data spells one ground several ways), for the sample switch and the note under the over / under cards
  const hist = !!(store && matchesReady && store.M);
  const venueIdx = useMemo(() => (hist ? ((venueIndices as any)(store, fx.venue) as number[]) : []), [hist, store, fx.venue]);
  const hereMatches = (n: number): number[] => (hist ? fancySample(store, { fmt: fmtIdx, gender, teams, scope, lastN: n, venue: venueIdx }) as number[] : []);
  const useHere = here && venueIdx.length > 0;
  const ms = useMemo(() => (hist ? fancySample(store, { fmt: fmtIdx, gender, teams, scope, lastN: win, venue: useHere ? venueIdx : undefined }) as number[] : []), [hist, store, teams, scope, fmtIdx, win, useHere, venueIdx]);
  const bookedNow = useMemo(() => (!key || key === "top_batter" ? [] : fancyLines(doc, fxInfo, key, team?.[0] ?? null, inn)), [doc, fxInfo, key, team, inn]);
  const batFirstNow = batFirstBooked(bookedNow, inn, scope) as boolean;
  const scoredMs = useMemo(() => (hist && batFirstNow ? (firstInnsMs(store, ms, scope) as number[]) : ms), [ms, batFirstNow, hist, store, scope]);
  const run = (k: string, line?: number | null, from = scoredMs): any => (scoreMarket as any)(store, from, scope, k, line, inn);

  // every market the books price, scored on the same matches and ranked by the better side's edge
  const overview = useMemo(() => {
    if (!hist) return [] as any[];
    const ground = venueIdx.length ? hereMatches(10) : undefined;
    const inns = scope < 0 ? [0] : (FANCY_INNS as number[]);
    return inns.flatMap((n) => (buildOverview as any)({ store, doc, fxInfo, ms, scope, teamName: team?.[0] ?? null, keys: scope < 0 ? MATCH_KEYS : TEAM_KEYS, label: marketLabel, ground, inn: n }))
      .map((r: any) => ({ ...r, venue: fx.venue, standing: fancyStanding(liveMatch, r) }))
      .sort((x: any, y: any) => (y.edge ?? -9) - (x.edge ?? -9));
  }, [doc, ms, fxInfo, team, scope, hist, store, liveMatch, venueIdx, fx.venue]); // eslint-disable-line react-hooks/exhaustive-deps

  const liveList = useMemo(() => (mode === "list" ? (liveRows as (d: any, f: any) => any[])(doc, { a: fx.a, b: fx.b }) : []), [doc, fx.a, fx.b, mode]);
  // same Edge + L10 as scored fancy: overs tape vs the live OU line
  const liveScored = useMemo(() => {
    if (!hist || !liveList.length) return [] as { m: any; r: any }[];
    const ground = venueIdx.length ? hereMatches(10) : undefined;
    return liveList.map((m: any) => ({
      m,
      r: (scoreLiveOuRow as any)({
        store, m, sides: [fx.a, fx.b], teams, fmt: fmtIdx, gender, lastN: win, ground, test: fx.fmt === "Test",
      }),
    }));
  }, [hist, liveList, store, teams, fx.a, fx.b, fx.fmt, fmtIdx, gender, win, venueIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const book = useMemo(() => (fancyByLine(bookedNow) as { line: number; over: number | null; under: number | null; books: { over: number | null; under: number | null; source: string }[] }[]), [bookedNow]);
  const base = useMemo(() => (!hist || !key || key === "top_batter" ? null : run(key)), [hist, store, scoredMs, key, scope, inn]); // eslint-disable-line react-hooks/exhaustive-deps
  const line: number = ml ?? (book.find((l) => l.over != null && l.under != null) ?? book.find((l) => l.over != null) ?? book[0])?.line ?? base?.ladder[2]?.line ?? base?.ladder[0]?.line ?? 0.5;
  const liveSoFar = (key && key !== "top_batter" ? fancyStanding(liveMatch, { key, team: team?.[0] ?? null, inn, line, batFirst: batFirstNow }) : null) as Standing | null;
  const rep = useMemo(() => (key === "top_batter" || !base ? null : run(key, line)), [base, store, scoredMs, key, scope, line]); // eslint-disable-line react-hooks/exhaustive-deps
  // ladder rows: the engine's lines around the median plus the bookmaker's own line(s), computed on the same matches
  const ladder = useMemo(() => {
    if (!rep) return [] as any[];
    const have = new Set(rep.ladder.map((l: any) => l.line));
    const extra = book.filter((b) => !have.has(b.line)).map((b) => run(key, b.line).summary);
    return [...rep.ladder, ...extra].sort((a: any, b: any) => a.line - b.line);
  }, [rep, book, store, scoredMs, key, scope]); // eslint-disable-line react-hooks/exhaustive-deps
  const bookHere = book.find((b) => b.line === line);
  const bookMain = book.find((l) => l.over != null && l.under != null) ?? book.find((l) => l.over != null) ?? book[0];
  const head = useMemo(() => fancyHeadline(book) as { over: (typeof book)[number] | null; under: (typeof book)[number] | null }, [book]);
  const faceBook = (lane: (typeof book)[number] | null | undefined, side: "over" | "under") => (lane && lane[side] != null ? lane.books.find((x) => x[side] === lane[side]) : null);
  const overFace = faceBook(head.over, "over"), underFace = faceBook(head.under, "under");
  const headBooks = useMemo(() => [...new Map([...(head.over?.books ?? []), ...(head.under?.books ?? [])].map((x) => [x.source, x])).values()], [head]);
  const lineOn = (fmNext: string, scNum: number, at: number) => {
    const { key: k, inn: i } = parseFm(fmNext) as { key: string; inn: number };
    if (!fmNext || k === "top_batter") return false;
    const t = teams.find(([, ix]) => ix === scNum);
    return (fancyByLine(fancyLines(doc, fxInfo, k, scNum < 0 ? null : t?.[0] ?? null, i)) as { line: number }[]).some((b) => b.line === at);
  };
  const choose = (p: { sc?: string; fm?: string }) => {
    if (p.sc !== undefined) {
      const next = Number(p.sc), nextFm = peerFancyFm(fm, keysFor(next)) || p.fm || "";
      setSc(p.sc);
      setFmId(nextFm);
      setMl(nextFm && lineOn(nextFm, next, line) ? line : undefined);
    } else if (p.fm !== undefined) {
      setFmId(p.fm);
      setMl(lineOn(p.fm, scope, line) ? line : undefined);
    } else setMl(undefined);
  };
  useEffect(() => {
    if (fmId && fm && fmId !== fm && peerFancyFm(fmId, keyList) === fm) setFmId(fm);
  }, [fmId, fm]); // eslint-disable-line react-hooks/exhaustive-deps
  const openMarket = (k: string) => {
    if (mode === "list") {
      push(fancyMarketPath(fx.id, { fm: k, sc: scope, mw: win, mv: here ? "1" : "" }));
      return;
    }
    choose({ fm: k });
  };
  const activeN = (win !== 10 ? 1 : 0) + (here ? 1 : 0);

  // how this market has gone at the ground, set against the sample on screen
  const ground = useMemo(() => {
    if (!store || !rep || key === "top_batter" || venueIdx.length === 0) return null;
    const vms = batFirstNow ? (firstInnsMs(store, hereMatches(10), scope) as number[]) : hereMatches(10);
    if (vms.length < HERE_MIN) return null;
    const r = run(key, line, vms).summary, n = vms.length;
    const share = (hit: number, total: number) => (total ? hit / total : 0);
    return { n, under: r.under as number, over: r.over as number, max: r.max as number | null, differs: !useHere && Math.abs(share(r.under, n) - share(rep.summary.under, rep.n)) >= DIFFERS };
  }, [rep, key, line, venueIdx, scope, fmtIdx, store, useHere]); // eslint-disable-line react-hooks/exhaustive-deps

  // the date and side of each match under its bar (the values are the matches of `scoredMs`, oldest first)
  const entries = useMemo(() => (!store || !rep ? [] : scoredMs.map((m, i) => {
    const M = store.M, a = M.a[m], b = M.b[m], opp = scope >= 0 ? (a === scope ? b : a) : -1;
    return { value: rep.values[i] as number, date: M.d[m] as string, opp: "", tag: scope >= 0 ? abbr(store.teamName(opp, true)) : "", m };
  })), [scoredMs, store, scope, rep]);

  const shareLine = () => {
    if (!rep) return;
    const pO = rep.summary.pOver, pU = rep.summary.pUnder;
    const lean = pO != null && pU != null && pO !== pU ? (pO > pU ? "over" : "under") : null;
    const vms = venueIdx.length ? (batFirstNow ? (firstInnsMs(store, hereMatches(10), scope) as number[]) : hereMatches(10)) : [];
    const url = shareFixtureUrl(SITE_URL, fx.id);
    const text = (fancyShareText as any)({ a: fx.a, b: fx.b, label: [innTag(inn, fx.fmt === "Test", key), batFirstNow ? BAT_FIRST_TAG : "", team ? `${team[0]} ` : "", marketLabel(key)].filter(Boolean).join(" ").replace(/\s+/g, " "), line, side: lean, price: lean ? (bookHere as any)?.[lean] : null, values: rep.values, ground: venueName, groundValues: vms.length ? run(key, line, vms).values : [], url });
    void Share.share({ message: text || url, title: `${fx.a} v ${fx.b}` });
  };

  if (stats.isError && !matchesReady) return <EmptyState title="Could not load history" body="Check your connection and reopen this page to retry." />;
  if (!store || !matchesReady) return <Working label="Loading…" shape="rows" />;

  return (
    <View style={mode === "detail" ? styles.root : undefined}>
      <View style={styles.filterRow}>
        {scopes.length > 1 ? (
          <View style={styles.chipFlex}><Chips flush items={scopes.map(([v, label]) => [v, v === "-1" ? "Match" : abbr(label)] as [string, string])} value={String(scope)} onChange={(v) => choose({ sc: v })} /></View>
        ) : <View style={styles.chipFlex} />}
        <FilterButton label={`L${win}`} count={activeN} onPress={() => setFiltersOpen(true)} />
      </View>
      {activeN > 0 ? (
        <HScroll contentContainerStyle={styles.activeRow} accessibilityLabel="Active filters">
          {win !== 10 ? <ActiveChip label={`Window L${win}`} onClear={() => { setWin(10); setMl(undefined); }} /> : null}
          {here ? <ActiveChip label={`At ${venueName}`} onClear={() => { setHere(false); setMl(undefined); }} /> : null}
          <Press onPress={() => { setWin(10); setHere(false); setMl(undefined); }} accessibilityRole="button"><Text style={styles.clearAll}>Clear all</Text></Press>
        </HScroll>
      ) : null}
      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        onClear={() => { setDraftWin(10); setDraftHere(false); }}
        onApply={() => { setWin(draftWin); setHere(draftHere); setMl(undefined); setFiltersOpen(false); }}
      >
        <FilterSection label="Hit-rate window">
          <ChoiceRow>{WINDOWS.map((n) => <ChoiceChip key={n} label={`L${n}`} on={draftWin === n} onPress={() => setDraftWin(n)} />)}</ChoiceRow>
        </FilterSection>
        {venueIdx.length > 0 ? (
          <FilterSection label="Matches from">
            <ChoiceRow>
              <ChoiceChip label="Teams' form" on={!draftHere} onPress={() => setDraftHere(false)} />
              <ChoiceChip label={`At ${venueName}`} on={draftHere} onPress={() => setDraftHere(true)} />
            </ChoiceRow>
          </FilterSection>
        ) : null}
      </FilterSheet>

      {!ms.length ? <EmptyState title="Not enough history" body={`No ${fmt} matches to base these markets on yet.`} /> : (
    <>
      {mode === "list" && overview.length === 0 && liveScored.length === 0 ? (
        <EmptyState title="No bookmaker lines" body="No priced fancy markets for this scope yet." />
      ) : null}
      {mode === "list" && (overview.length > 0 || liveScored.length > 0) ? (
        <View style={styles.bleed}>
          {overview.map((r: any, i: number) => (
            <Reflow key={r.id || fancyFm(r.key, r.inn || 0)}>
              <OverviewRow separated={i > 0} r={r} onOpen={() => openMarket(fancyFm(r.key, r.inn || 0))} extra={r.live && r.key === "team_total_runs" ? <TeamSpot r={r} fx={fx} teams={teams} /> : undefined} />
            </Reflow>
          ))}
          {liveScored.map(({ m, r }, i) => (
            <LiveMarketRow key={`live-${i}-${m.market}`} m={m} scored={r} separated={overview.length > 0 || i > 0} />
          ))}
        </View>
      ) : null}

      {mode === "detail" ? <View style={{ gap: space.snug }}>
        {keyList.length > 1 ? <View style={styles.bleed}><Chips items={keyList} value={fm} onChange={(v) => choose({ fm: v })} /></View> : null}
        {key === "top_batter" ? <TopBatters ms={ms} scope={scope} teamName={team?.[0]} /> : rep ? (
          <View style={{ gap: space.stack }}>
            <View style={styles.titleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.h3}>{[innTag(inn, fx.fmt === "Test", key), batFirstNow ? BAT_FIRST_TAG : "", marketLabel(key)].filter(Boolean).join(" · ")}</Text>
                <Text style={styles.note}>{useHere ? `Last ${rep.n} at ${venueName}` : `Last ${rep.n} matches`} · void excluded</Text>
              </View>
              <RoundButton label="Share this line" onPress={shareLine}><Ionicons name="share-outline" size={icon.md} color={color.foreground} /></RoundButton>
            </View>
            {liveSoFar != null ? <Text style={styles.live}><StandingMark standing={liveSoFar} line={line} /></Text> : null}
            <View style={styles.stats}>
              <Stat k="Typical" v={short(rep.summary.median)} big />
              <Stat k="Average" v={rep.summary.mean == null ? "–" : rep.summary.mean.toFixed(1)} />
              <Stat k="Low–high" v={`${short(rep.summary.min, 0)}–${short(rep.summary.max, 0)}`} />
            </View>
            <ChartBars entries={entries} line={line} side="over" height={200} />
            <View style={styles.stepRow}>
              <LineStepper value={line} label="O/U" min={0} onStep={(d) => setMl(d < 0 ? Math.max(0, Math.round((line - stepOf(key)) * 2) / 2) : Math.round((line + stepOf(key)) * 2) / 2)} />
              {bookMain && bookMain.line !== line ? (
                <Button variant="secondary" size="sm" icon={bookMain.books[0] ? <BookBadge source={bookMain.books[0].source} /> : undefined} label={`main ${bookMain.line}`} onPress={() => setMl(bookMain.line)} />
              ) : null}
            </View>
            <View style={styles.cards}>
              {(["over", "under"] as const).map((side) => {
                const p: number | null = rep.summary[side === "over" ? "pOver" : "pUnder"], fair = rep.summary[side === "over" ? "fairOver" : "fairUnder"], hit = rep.summary[side];
                const lane = side === "over" ? head.over : head.under;
                const face = side === "over" ? overFace : underFace;
                const jump = !!(lane && lane.line !== line);
                const price = face ? (
                  <View style={styles.sideBook}>
                    <BookBadge source={face.source} />
                    <Text style={styles.sidePrice}>{jump ? `${side[0]!.toUpperCase()} ${lane!.line} ` : ""}{odds(face[side])}</Text>
                  </View>
                ) : <Text style={styles.note}>—</Text>;
                return (
                  <View key={side} style={styles.side}>
                    <Text style={styles.sideKey}>{side} {line}</Text>
                    <Text style={[styles.sideNum, side === "over" && { color: color.primary }]}>{pct1(p)}</Text>
                    <Meter value={p ?? 0} tone={side === "over" ? color.primary : tint.white(0.7)} />
                    <Text style={styles.note}>{hit} of {rep.n} · fair {odds(fair)}</Text>
                    {jump ? <Press onPress={() => setMl(lane!.line)} accessibilityRole="button" accessibilityLabel={`Use ${side} line ${lane!.line}`}>{price}</Press> : price}
                  </View>
                );
              })}
            </View>
            {ground ? (
              <Text style={[styles.note, ground.differs && { color: color.amber }]}>
                {ground.differs ? <Text style={{ ...w.label }}>Ground differs. </Text> : null}At {venueName}, last {ground.n} {fmt} {scope >= 0 ? `of ${team?.[0]}` : "matches"}: {ground.under} under {line}, {ground.over} over{ground.max != null ? ` · highest ${ground.max}` : ""}
                {useHere ? "" : ` (teams' form: ${rep.summary.under} of ${rep.n} under)`}.
              </Text>
            ) : null}
            {headBooks.length > 0 ? <BookList books={headBooks} shown={[overFace?.source, underFace?.source]} /> : null}
            {rep.n < 10 ? <Text style={[styles.note, { color: color.amber }]}>Small sample ({rep.n} matches): treat these with caution.</Text> : null}

            <Bleed style={styles.ladder}>
              <View style={styles.ladderHead}>
                <Text style={[styles.th, { width: LINE_W }]}>Line</Text>
                <Text style={[styles.th, { flex: 1 }]}>Book</Text>
                <Text style={[styles.th, styles.col]}>Over</Text>
                <Text style={[styles.th, styles.col]}>Under</Text>
              </View>
              {ladder.map((l: any) => {
                const priced = book.find((b) => b.line === l.line);
                const overB = priced?.over != null ? priced.books.find((x) => x.over === priced.over) : null;
                const underB = priced?.under != null ? priced.books.find((x) => x.under === priced.under) : null;
                const face = overB || underB;
                return (
                <Press scale={1} key={l.line} onPress={() => setMl(l.line)} accessibilityRole="button" style={({ pressed }) => [styles.ladderRow, l.line === line && styles.ladderOn, pressed && state.pressed]}>
                  <Text style={[styles.ladderLine, { width: LINE_W }]}>{l.line}</Text>
                  <View style={[styles.lineCell, { flex: 1, flexDirection: "column", alignItems: "flex-start", gap: 2 }]}>
                    {priced && face ? (
                      <>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.tight }}>
                          <BookBadge source={face.source} />
                          <Text style={styles.fair}>O {odds(priced.over)} · U {odds(priced.under)}</Text>
                        </View>
                        <BookList books={priced.books} shown={[overB?.source, underB?.source]} />
                      </>
                    ) : <Text style={styles.fair}>—</Text>}
                  </View>
                  <Text style={[styles.col, styles.cellNum]}><Text style={{ color: color.primary }}>{pc(l.pOver)}</Text> <Text style={styles.fair}>{odds(l.fairOver)}</Text></Text>
                  <Text style={[styles.col, styles.cellNum]}>{pc(l.pUnder)} <Text style={styles.fair}>{odds(l.fairUnder)}</Text></Text>
                </Press>
                );
              })}
            </Bleed>
          </View>
        ) : null}
      </View> : null}
        </>
      )}
    </View>
  );
}

function Stat({ k, v, big }: { k: string; v: string; big?: boolean }) {
  return <View style={{ gap: 2 }}><Text style={styles.statKey}>{k}</Text><Text style={[styles.statNum, big && { fontSize: fs.stat, lineHeight: 38 }]}>{v}</Text></View>;
}

/** A share as a bar that fills from the left on the UI thread. */
function Meter({ value, tone }: { value: number; tone: string }) {
  const w = useSharedValue(0);
  useEffect(() => { w.value = withTiming(value, { duration: duration.moderate }); }, [value, w]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.max(w.value, 0.001) }] })); // scale, not width: no layout pass per frame
  return <View style={styles.meter}><Animated.View style={[styles.meterFill, { backgroundColor: tone, transformOrigin: "left" } as object, fill]} /></View>;
}

/** The chance of each batter making the highest score (of the match, or of the side batting first), from the matches on screen. */
function TopBatters({ ms, scope, teamName }: { ms: number[]; scope: number; teamName?: string }) {
  const stats = useStore();
  const store: any = stats.data?.store;
  const ready = !!(store && stats.matchesReady && store.M);
  const t = useMemo(() => (!ready ? { n: 0, rows: [] } : (scope < 0 ? (topBatters as any)(store, ms, { scope: "match" }) : (topBatters as any)(store, ms, { team: scope, scope: "team" })) as { n: number; rows: any[] }), [ready, store, ms, scope]);
  const max = Math.max(...t.rows.map((r) => r.pSole), 0.0001);
  if (!ready) return <Working label="Loading…" shape="rows" />;
  return (
    <View style={styles.top} accessibilityLabel="Top batter">
      <View style={styles.topHead}>
        <Text style={styles.h3}>Top batter</Text>
        <Text style={styles.note}>{scope < 0 ? `highest score in the match, last ${t.n} matches` : `${teamName} batting first, last ${t.n} matches`}</Text>
      </View>
      {t.rows.map((r) => (
        <Press scale={1} key={r.player} onPress={() => push(`/player/${r.player}`)} accessibilityRole="button" style={({ pressed }) => [styles.topRow, pressed && state.pressed]}>
          <View style={[styles.topFill, { width: `${(r.pSole / max) * 100}%` }]} />
          <PlayerAvatar pid={store.P.id[r.player]} team={store.teamName(store.P.tm[r.player])} size={36} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.topName} numberOfLines={1}>{r.name}</Text>
            <Text style={styles.note}>{r.sole} sole{r.tied ? ` + ${r.tied} tied` : ""} of {t.n}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}><Text style={styles.topPct}>{pct1(r.pSole)}</Text><Text style={styles.note}>fair {odds(r.fairSole)}</Text></View>
        </Press>
      ))}
      {!t.rows.length ? <View style={styles.topHead}><EmptyState compact title="Not enough matches" body="Need more history for this top-batter market." /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: rhythm.between },
  /** Edge-to-edge hairline under scope + L10 (site MatchFancy list twin). */
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.snug,
    marginHorizontal: -space.gutter,
    paddingHorizontal: space.gutter,
    paddingVertical: space.snug,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.hairline,
  },
  chipFlex: { flex: 1, minWidth: 0 },
  activeRow: { gap: space.snug, paddingVertical: space.snug },
  clearAll: { ...t.calloutLabel, color: color["muted-foreground"], paddingHorizontal: space.snug, lineHeight: control },
  h3: { ...t.bodyLabel, color: color.foreground },
  note: { ...type.footnote, color: color["muted-foreground"] },
  bleed: { marginHorizontal: -space.gutter },
  titleRow: { flexDirection: "row", alignItems: "center", gap: space.snug },
  live: { ...type.callout, color: color.primary },
  stats: { flexDirection: "row", alignItems: "flex-end", gap: space.group },
  statKey: { ...type.footnote, color: color["muted-foreground"] },
  statNum: { ...numLg, fontSize: fs.figure, letterSpacing: -0.48, lineHeight: 28, color: color.foreground },
  stepRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.snug },
  cards: { flexDirection: "row", gap: space.snug },
  side: { flex: 1, gap: space.tight, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, paddingTop: space.snug },
  sideKey: { ...t.footnoteLabel, color: color["muted-foreground"], textTransform: "capitalize" },
  sideNum: { ...numLg, fontSize: fs.display, letterSpacing: -0.56, lineHeight: 32, color: color.foreground },
  sideBook: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline, paddingTop: space.tight },
  sidePrice: { ...num, fontSize: fs.body, color: color.primary },
  meter: { height: 6, borderRadius: 3, backgroundColor: color.hairline, overflow: "hidden" },
  meterFill: { height: "100%", width: "100%", borderRadius: 3 },
  ladder: { borderTopWidth: 0 },
  ladderHead: { flexDirection: "row", alignItems: "center", paddingVertical: space.tight },
  /** Same recipe as web TABLE_HEAD: label-cap + footnote. */
  th: { ...type.footnote, ...cap, color: color["muted-foreground"] },
  col: { width: 112, textAlign: "right" },
  ladderRow: { flexDirection: "row", alignItems: "center", minHeight: 46, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  ladderOn: { backgroundColor: tint.row },
  lineCell: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.tight },
  ladderLine: { ...num, fontSize: fs.title, color: color.foreground },
  cellNum: { ...num, fontSize: fs.body, color: color.foreground },
  fair: { ...type.footnote, color: color["muted-foreground"] },
  /** Web twin: `border-y border-hairline` edge band (not rounded card). */
  top: { marginHorizontal: -space.gutter, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: color.hairline, overflow: "hidden" },
  topHead: { paddingHorizontal: space.gutter, paddingVertical: space.stack, gap: 2 },
  topRow: { flexDirection: "row", alignItems: "center", gap: space.snug, paddingHorizontal: space.gutter, paddingVertical: space.snug, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  topFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: tint.primary(0.1) },
  topName: { ...t.bodyLabel, color: color.foreground },
  topPct: { ...num, fontSize: fs.title, color: color.primary },
});
