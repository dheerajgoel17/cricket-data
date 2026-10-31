/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChevronRightIcon, MagnifyingGlassIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { RULES } from "@cricket/engine/rules.js";
import { useData } from "@/lib/data";
import { localWhen, num, odds, pc, tzName } from "@/lib/format";
import { Crumbs, DataTable, EmptyNote, Muted, OddsText, PageTitle, Panel } from "@/components/app/page";
import { Field, NativeSelect } from "@/components/app/forms";
import { PlayerBadge, TeamBadge } from "@/components/app/badges";
import { FORMATS } from "@cricket/engine/util.js";
import { useQ } from "@/components/app/forms";
import { Button } from "@/components/ui/button";
import { setTitle } from "@/lib/title";
void localWhen; void num; void tzName;

// ------------------------------------------------------------------ tools
const TOOLS: [string, string, string, string][] = [["trends", "Player trends", "Players whose recent games clear a line, for any upcoming match.", "Popular"],
  ["odds", "Price & probability calculator", "Decimal prices, implied probability, margin removal, EV and Kelly stake.", "New"], ["players", "Player stats", "Hit rates over any line with DNP-aware form charts.", ""],
  ["teams", "Team & venue stats", "Match totals, fancy markets and player grids.", ""], ["pair", "Partnerships", "Who gets out first for any pair of batters.", ""],
  ["competitions", "Competitions", "Markets, teams and results for every league and series.", ""], ["glossary", "Cricket stats explained", "What every market and rule means.", ""]];
export function ToolsPage() {
  setTitle("Free cricket stats tools");
  return (
    <div>
      <Crumbs items={[["Home", "/"], ["Tools"]]} />
      <PageTitle sub="Cricket stats and data, completely free: no login, no paywall, no betting.">Free cricket stats tools</PageTitle>
      <div className="flex flex-wrap gap-2">{["100% free", "No registration", "Ball-by-ball data"].map((x) => <Badge key={x} variant="secondary" className="rounded-full px-3 py-1 font-normal">{x}</Badge>)}</div>
      <div className="mt-4 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
        {TOOLS.map(([r, t, d, b], i) => (
          <motion.div key={r} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileHover={{ y: -3 }}>
            <Link to={`/${r}`}><Card className="h-full gap-1 px-4 py-4 shadow-none transition-colors hover:border-[#3a3a3a]">{b ? <Badge className="w-fit bg-[var(--color-primary)]/15 text-primary">{b}</Badge> : null}<h3 className="text-lg font-medium">{t}</h3><Muted>{d}</Muted><OddsText>Open →</OddsText></Card></Link>
          </motion.div>))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ odds calculator
export function OddsPage() {
  setTitle("Price calculator");
  const [v, setV] = useState({ dec: "1.90", opp: "1.90", p: "55", bank: "1000" });
  const d = Number(v.dec), o = Number(v.opp), p = Number(v.p) / 100, b = Number(v.bank);
  const imp = d > 1 ? 1 / d : null, impO = o > 1 ? 1 / o : null, over = imp && impO ? imp + impO : null;
  const fair = over ? imp! / over : null, ev = p && d > 1 ? p * d - 1 : null, kelly = ev != null && d > 1 ? Math.max(0, ev / (d - 1)) : null;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const T = ({ k, val, s }: { k: string; val: string; s?: string }) => <Card className="gap-0 px-4 py-3 shadow-none"><div className="font-condensed text-[13px] uppercase text-muted-foreground">{k}</div><div className="text-2xl font-medium">{val}</div>{s ? <div className="text-xs text-muted-foreground">{s}</div> : null}</Card>;
  return (
    <div>
      <Crumbs items={[["Home", "/"], ["Tools", "/tools"], ["Price calculator"]]} />
      <PageTitle sub="A stats calculator: turn a decimal price into a probability and strip the two-way margin. It does not place a bet.">Price &amp; probability calculator</PageTitle>
      <Card className="flex-row flex-wrap items-end gap-3 p-4 shadow-none">
        <Field label="Decimal price (this side)"><Input type="number" step="0.01" min="1.01" value={v.dec} onChange={set("dec")} className="w-36" /></Field>
        <Field label="Decimal price (other side)"><Input type="number" step="0.01" min="1.01" value={v.opp} onChange={set("opp")} className="w-36" /></Field>
        <Field label="Your probability %"><Input type="number" step="0.1" min="0" max="100" value={v.p} onChange={set("p")} className="w-36" /></Field>
        <Field label="Bankroll"><Input type="number" step="1" min="0" value={v.bank} onChange={set("bank")} className="w-36" /></Field>
      </Card>
      <div className="my-3 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <T k="Implied probability" val={imp ? pc(imp) : "–"} s="1 ÷ decimal price" />
        <T k="Margin (overround)" val={over ? `${((over - 1) * 100).toFixed(1)}%` : "–"} s="both sides of the market" />
        <T k="No-vig probability" val={fair ? pc(fair) : "–"} s={fair ? `fair price ${odds(1 / fair)}` : "enter both sides"} />
        <T k="Expected value" val={ev != null ? `${(ev * 100).toFixed(1)}%` : "–"} s="per 1 staked at your probability" />
        <T k="Kelly stake" val={kelly != null && b ? `${(kelly * b).toFixed(0)}` : "–"} s={kelly != null ? `full Kelly ${(kelly * 100).toFixed(1)}% · quarter ${(kelly * 25).toFixed(1)}%` : ""} />
      </div>
      <Muted>For reading prices as statistics only. Fair price on this site is 1 ÷ historical hit rate and ignores margin, form, pitch and XIs. Fancy.cash does not offer, promote or encourage gambling.</Muted>
    </div>
  );
}

// ------------------------------------------------------------------ glossary
const GLOSS: [string, string, string, string][] = [
  ["Hit rate", "Basic", "Prices", "Share of games where the stat cleared the line (over: strictly more than the line). Pushes on whole-number lines are void."],
  ["Fair decimal price", "Basic", "Prices", "1 ÷ hit rate. The price at which the historical rate breaks even, with no bookmaker margin."],
  ["Line", "Basic", "Prices", "The threshold in a prop, e.g. sixes over 0.5 or runs over 24.5."],
  ["DNP", "Basic", "Form", "Did not play: the team had a fixture but the player was not in the playing XI. Shown on charts, left out of hit rates."],
  ["VOID (did not bat / bowl)", "Intermediate", "Rules", "Named in the playing XI but never reached the crease (or never bowled): bets on that player's batting (or bowling) stats are void and the stake is returned. Left out of hit rates."],
  ["30s", "Basic", "Markets", "Innings of 30-49 runs. Counted per match as a fancy market."],
  ["50s", "Basic", "Markets", "Innings of 50-99 runs (100+ are centuries)."],
  ["Double-digit scores", "Basic", "Markets", "Batters reaching 10 or more."],
  ["Single-digit scores", "Basic", "Markets", "Scores of 1-9. Ducks (out for 0) are not single-digit."],
  ["Highest over", "Intermediate", "Markets", "Most runs conceded in a single over of the match."],
  ["Most runs conceded", "Intermediate", "Markets", "The largest number of runs conceded by one bowler in the match."],
  ["Top batter", "Intermediate", "Markets", "Highest scorer in the match, or for the team batting first. Ties are shown separately."],
  ["Void rules", "Intermediate", "Rules", "T20 and ODI summary markets are void unless 80% of the overs are bowled in both innings; Tests unless there is a result or 300 (5-day) / 200 (4-day) overs."],
  ["Team-specific markets", "Intermediate", "Rules", "Count only the team batting first."],
  ["Retired hurt", "Basic", "Rules", "Not a wicket. Penalty runs count. Super overs are ignored."],
  ["Batting position", "Intermediate", "Form", "Order in which a batter first appears at the crease (openers are 1 and 2)."],
  ["Home / away / neutral", "Intermediate", "Form", "Inferred from the series name, the venue's host nation and who plays there most; the base data has no home flag."],
  ["Correlated props", "Advanced", "Prices", "How often a player's other props clear when a given prop clears, versus his normal rate."],
  ["Overround", "Advanced", "Prices", "The sum of implied probabilities above 100%: the bookmaker's margin."],
  ["Kelly stake", "Advanced", "Prices", "Stake sized from your edge: (p × price - 1) ÷ (price - 1). Quarter Kelly is the usual cautious fraction."],
  ["Provisional matches", "Intermediate", "Data", "Scraped scorecards covering the gap until the base data is updated: player totals only, so no partnerships or batting order."],
];
export function GlossaryPage() {
  setTitle("Cricket stats explained");
  const [q] = useQ();
  const [t, setT] = useState(q.q || ""), [c, setC] = useState("All"), [l, setL] = useState("All");
  const cats = ["All", ...new Set(GLOSS.map((g) => g[2]))], levels = ["All", "Basic", "Intermediate", "Advanced"];
  const list = GLOSS.filter((g) => (c === "All" || g[2] === c) && (l === "All" || g[1] === l) && (!t || (g[0] + g[3]).toLowerCase().includes(t.toLowerCase())));
  return (
    <div>
      <Crumbs items={[["Home", "/"], ["Tools", "/tools"], ["Cricket stats explained"]]} />
      <PageTitle sub="Every market, rule and number on this site, in plain words.">Cricket stats explained</PageTitle>
      <Card className="mb-3 flex-row flex-wrap items-center gap-3 p-4 shadow-none">
        <Input type="search" placeholder="Search stats and rules" value={t} onChange={(e) => setT(e.target.value)} className="min-w-52 flex-1" />
        <NativeSelect name="c" options={cats.map((x) => [x, x])} defaultValue={c} onChange={(e) => setC(e.target.value)} />
        <NativeSelect name="l" options={levels.map((x) => [x, x])} defaultValue={l} onChange={(e) => setL(e.target.value)} />
      </Card>
      {list.length ? <Card className="px-4 shadow-none"><Accordion type="single" collapsible>{list.map(([title, lv, cat, d]) => (
        <AccordionItem key={title} value={title}><AccordionTrigger><span className="flex flex-1 items-center gap-2">{title}<span className="ml-auto flex gap-1.5"><Badge variant="outline">{lv}</Badge><Badge variant="secondary">{cat}</Badge></span></span></AccordionTrigger><AccordionContent><p className="text-muted-foreground">{d}</p></AccordionContent></AccordionItem>))}</Accordion></Card> : <EmptyNote>Nothing matches.</EmptyNote>}
    </div>
  );
}

// ------------------------------------------------------------------ about (rules & data)
const DEFS = [
  "Fair decimal price = 1 ÷ hit rate on the filtered sample. Pushes (whole-number lines) are void. A 90% interval shows how far small samples can mislead.",
  "Home / away / neutral is inferred from the event ('X tour of Y'), the venue's country and the team that plays most at the ground: the base data has no home flag.",
  "Batting position is the order batters first appear at the crease. Batting first / chasing is the player's team.",
  "Runs conceded include penalty runs, exclude byes and leg byes. Super overs are ignored.",
  "A player named in the XI who never batted or bowled shows as VOID (the bet is void); a player not named shows as DNP; an XI that was not recorded reliably shows N/A. None of the three counts in a hit rate.",
  "Provisional (scraped) matches fill the gap before the base data is updated: they carry player totals only, so they feed player props but not partnerships, batting position, innings order or match markets.",
];
export function AboutPage() {
  setTitle("Rules and data");
  const { store } = useData();
  const f = store.freshness();
  const list = (xs: string[]) => <ul className="list-disc pl-5">{xs.map((r) => <li key={r} className="my-1 text-muted-foreground">{r}</li>)}</ul>;
  return (
    <div>
      <Crumbs items={[["Home", "/"], ["Rules & data"]]} />
      <PageTitle>Rules, definitions and data</PageTitle>
      <Card className="px-4 shadow-none"><Accordion type="single" collapsible defaultValue="rules">
        <AccordionItem value="rules"><AccordionTrigger><span className="flex items-center gap-2">Settlement rules applied <Badge variant="secondary">{RULES.length}</Badge></span></AccordionTrigger><AccordionContent>{list(RULES)}</AccordionContent></AccordionItem>
        <AccordionItem value="defs"><AccordionTrigger><span className="flex items-center gap-2">Definitions <Badge variant="secondary">{DEFS.length}</Badge></span></AccordionTrigger><AccordionContent>{list(DEFS)}</AccordionContent></AccordionItem>
        <AccordionItem value="fresh"><AccordionTrigger>Data freshness</AccordionTrigger><AccordionContent><p className="text-muted-foreground">Ball-by-ball data through <b>{f.newestBase}</b>{f.provisionalIncluded ? <> · includes <b>{f.provisionalMatches}</b> provisional matches up to <b>{f.newestProvisional || "?"}</b></> : " · no provisional matches included"}.</p></AccordionContent></AccordionItem>
        <AccordionItem value="credits"><AccordionTrigger>Credits and how to use the site</AccordionTrigger><AccordionContent><p className="text-muted-foreground">We count page views and which buttons are used; analytics load without a consent prompt (ads cookies stay off; no account, no personal data sold). A short-lived site cookie is used only to load the data files; it is not a tracking cookie and is not prompted. Free cricket stats and data. Photos: Wikimedia Commons (free licences, where available). Data: open ball-by-ball data plus provisional scorecards. Decimal prices are market data shown next to history; fair price is 1 ÷ historical hit rate with no margin. Fancy.cash does not offer, promote or encourage gambling. Book names and logos are trademarks of their owners, shown only to say where a listed price comes from.</p></AccordionContent></AccordionItem>
      </Accordion></Card>
      <Muted className="mt-3">See also: <Link className="text-primary" to="/glossary">Cricket stats explained</Link>.</Muted>
    </div>
  );
}

// ------------------------------------------------------------------ saved
// ------------------------------------------------------------------ players search
export function PlayersPage() {
  setTitle("Cricket player stats");
  const { store, rz } = useData();
  const [q, setQ] = useQ();
  const [text, setText] = useState(q.q || "");
  const t = text.trim();
  const rows = useMemo(() => (t.length < 2 ? [] : rz.players(t, {}, 20)), [t, rz]);
  const change = (v: string) => { setText(v); setQ({ q: v }); };
  return (
    <div className="flex flex-col gap-stack">
      <h1 className="text-title font-bold tracking-tight">Players</h1>
      <InputGroup className="h-control rounded-[10px] border-0 bg-muted">
        <InputGroupAddon><MagnifyingGlassIcon className="size-4" /></InputGroupAddon>
        <InputGroupInput type="search" autoFocus placeholder="Search a player (typos ok)" aria-label="Search players" value={text} onChange={(e) => change(e.target.value)} className="text-body" />
        {text && <InputGroupAddon align="inline-end"><InputGroupButton size="icon-xs" aria-label="Clear" onClick={() => change("")}><XMarkIcon className="size-4" /></InputGroupButton></InputGroupAddon>}
      </InputGroup>
      {t.length < 2 ? <p className="text-callout text-muted-foreground">Type at least two letters.</p>
        : !rows.length ? <p className="text-callout text-muted-foreground">No player matches “{t}”.</p> : (
          <ul className="overflow-hidden rounded-2xl bg-card ring-1 ring-hairline">
            {rows.map((p: any) => (
              <li key={p.idx} className="relative after:absolute after:bottom-0 after:left-[calc(var(--gutter)+var(--control)+var(--spacing-snug))] after:right-0 after:h-px after:bg-hairline last:after:hidden">
                <Item asChild size="sm" className="min-h-row rounded-none border-0 px-gutter py-snug transition-colors active:bg-accent">
                  <Link to={`/player/${p.idx}`}>
                    <ItemMedia><PlayerBadge idx={p.idx} size="md" className="size-control" /></ItemMedia>
                    <ItemContent className="min-w-0 gap-hair">
                      <ItemTitle className="max-w-full text-body font-semibold leading-snug"><span className="truncate">{p.name}</span></ItemTitle>
                      <ItemDescription className="truncate text-callout text-muted-foreground">{store.teamName(p.team)} · {FORMATS.filter((_: string, i: number) => (store.P.fm[p.idx] >> i) & 1).join(" ")}{p.last ? ` · last ${p.last}` : ""}</ItemDescription>
                    </ItemContent>
                    <ItemActions className="gap-tight text-footnote tabular-nums text-muted-foreground">{store.P.n[p.idx]} inns<ChevronRightIcon className="size-4" aria-hidden /></ItemActions>
                  </Link>
                </Item>
              </li>
            ))}
          </ul>)}
    </div>
  );
}

// ------------------------------------------------------------------ teams & venues
export function TeamsPage() {
  setTitle("Teams and venues");
  const { store, rz } = useData();
  const [q, setQ] = useQ();
  const tab = q.tab === "venues" ? "venues" : "teams";
  const [text, setText] = useState(q.q || "");
  const rows = useMemo((): [string, number, number][] => {
    const t = text.trim();
    if (tab === "venues" && t.length >= 2) return rz.venues(t, 60).map((v: { name: string; idx: number }) => [v.name, v.idx, rz.venueCount[v.idx]] as [string, number, number]);
    const counts = tab === "teams" ? rz.teamCount : rz.venueCount;
    const names: string[] = tab === "teams" ? store.teams.map((_: any, i: number) => store.teamName(i)) : store.venues;
    const q = t.toLowerCase();
    return names.map((n, i) => [n, i] as [string, number]).filter(([n]) => !q || n.toLowerCase().includes(q)).sort((a, b) => counts[b[1]] - counts[a[1]]).slice(0, 60).map(([n, i]) => [n, i, counts[i]] as [string, number, number]);
  }, [tab, text, store, rz]);
  return (
    <div>
      <PageTitle>Teams &amp; venues</PageTitle>
      <div className="mb-3 flex gap-2">{(["teams", "venues"] as const).map((k) => <Button key={k} variant={tab === k ? "secondary" : "ghost"} className="rounded-full capitalize" onClick={() => setQ({ tab: k })}>{k}</Button>)}</div>
      <Input type="search" placeholder={`Search ${tab}`} value={text} onChange={(e) => setText(e.target.value)} className="mb-3" />
      <Panel flat><DataTable columns={[tab === "teams" ? "Team" : "Venue", "Matches"]} rows={rows.map(([n, i, c]) => [<Link key={i} className="text-primary" to={`/${tab === "teams" ? "team" : "venue"}/${i}`}>{n}</Link>, c])} /></Panel>
    </div>
  );
}
